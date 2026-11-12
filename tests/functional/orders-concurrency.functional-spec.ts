import { INestApplication } from '@nestjs/common';
import { Server } from 'net';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import {
  createInstruments,
  createUserWithCash,
  Instruments,
} from '../support/fixtures';
import { createTestApp } from '../support/test-app';
import { resetSchema, truncateAll } from '../support/test-database';

interface Envelope<T> {
  statusCode: number;
  data: T;
  timestamp: string;
}

interface OrderResponse {
  id: number;
  status: 'NEW' | 'FILLED' | 'REJECTED' | 'CANCELLED';
}

/**
 * Reproduction for the double-spend window in `placeTradeOrder`.
 *
 * The service validates cash with a plain `SELECT SUM(...)` inside the
 * transaction, with no row lock and no serializable isolation. Two concurrent
 * BUYs for the same user can both read the same balance, both pass the check
 * and both commit, leaving a negative balance.
 *
 * This test is EXPECTED TO FAIL until the per-user advisory lock lands.
 */
describe('Concurrent order placement (functional, real database)', () => {
  const USERS = 5;
  const INITIAL_CASH = 100;
  const ORDER_SIZE = 60; // two of these cost 120 > 100
  const PRICE = 1;

  let app: INestApplication;
  let sequelize: Sequelize;
  let instruments: Instruments;
  let userIds: number[];

  const server = (): Server => app.getHttpServer() as Server;

  const balanceOf = async (userId: number): Promise<number> => {
    const rows = await sequelize.query<{ balance: string }>(
      `SELECT COALESCE(SUM(CASE WHEN side = 'CASH_IN' THEN size
                               WHEN side = 'CASH_OUT' THEN -size
                               WHEN side = 'BUY' THEN -(size * price)
                               WHEN side = 'SELL' THEN (size * price)
                               ELSE 0 END), 0) AS balance
       FROM orders
       WHERE "userId" = :userId AND status = 'FILLED'`,
      { replacements: { userId }, type: QueryTypes.SELECT },
    );
    return Number(rows[0]?.balance ?? 0);
  };

  beforeAll(async () => {
    const context = await createTestApp();
    app = context.app;
    sequelize = context.sequelize;
    await resetSchema(sequelize);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(sequelize);
    instruments = await createInstruments(app, { price: PRICE });

    userIds = [];
    for (let i = 0; i < USERS; i += 1) {
      userIds.push(
        await createUserWithCash(
          app,
          `concurrent-${i}@example.com`,
          INITIAL_CASH,
          instruments.arsInstrumentId,
        ),
      );
    }
  });

  it.failing(
    'never spends more cash than available when two BUYs run in parallel',
    async () => {
      const requests = userIds.flatMap((userId) =>
        [0, 1].map(() =>
          request(server()).post('/orders').send({
            userId,
            instrumentId: instruments.instrumentId,
            side: 'BUY',
            size: ORDER_SIZE,
            type: 'MARKET',
          }),
        ),
      );

      const responses = await Promise.all(requests);

      // The order of `responses` matches the order of `requests`, which is
      // two entries per user, in `userIds` order.
      const statusesByUser = userIds.map((userId, index) => {
        const pair = responses.slice(index * 2, index * 2 + 2);
        return {
          userId,
          statuses: pair.map(
            (response) =>
              (response.body as Envelope<OrderResponse>).data?.status,
          ),
        };
      });

      const violations: string[] = [];

      for (const { userId, statuses } of statusesByUser) {
        const filled = statuses.filter((status) => status === 'FILLED').length;
        const balance = await balanceOf(userId);

        if (filled > 1) {
          violations.push(
            `user ${userId}: ${filled} FILLED orders (expected at most 1)`,
          );
        }
        if (balance < 0) {
          violations.push(`user ${userId}: negative balance ${balance}`);
        }
      }

      expect(violations).toEqual([]);
    },
  );
});

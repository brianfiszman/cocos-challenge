import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Server } from 'net';
import { ModelStatic, QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import { Order } from '../../src/models';
import { Baseline, seedBaseline } from '../support/fixtures';
import { createTestApp } from '../support/test-app';
import { resetSchema, truncateAll } from '../support/test-database';

jest.setTimeout(15000);

interface Envelope<T> {
  statusCode: number;
  data: T;
  timestamp: string;
}

interface OrderResponse {
  id: number;
  status: 'NEW' | 'FILLED' | 'REJECTED' | 'CANCELLED';
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `cancelOrder` used to read the order and then save it (read-modify-write).
 * A fill that committed between the read and the write was overwritten by a
 * stale `CANCELLED`.
 *
 * The test holds the order row locked in an open transaction that sets it to
 * `FILLED`, starts a cancel request, waits until the cancel is actually
 * blocked on that row and only then commits the fill. Under READ COMMITTED
 * the conditional `UPDATE ... WHERE status = 'NEW'` re-checks the row and
 * matches zero rows; the old unconditional save overwrites the fill.
 */
describe('Cancel racing a fill (functional, real database)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let orders: ModelStatic<Order>;
  let baseline: Baseline;

  const server = (): Server => app.getHttpServer() as Server;

  const waitForCancelToBlock = async (): Promise<void> => {
    const deadline = Date.now() + 5000;

    while (Date.now() < deadline) {
      const rows = await sequelize.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM pg_stat_activity
         WHERE state = 'active'
           AND wait_event_type = 'Lock'
           AND query ILIKE '%UPDATE%orders%'`,
        { type: QueryTypes.SELECT },
      );

      if (Number(rows[0]?.count ?? 0) > 0) {
        return;
      }

      await sleep(25);
    }

    throw new Error('cancelOrder never blocked on the order row');
  };

  beforeAll(async () => {
    const context = await createTestApp();
    app = context.app;
    sequelize = context.sequelize;
    orders = app.get<ModelStatic<Order>>(getModelToken(Order));
    await resetSchema(sequelize);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(sequelize);
    baseline = await seedBaseline(app);
  });

  it('does not overwrite a fill that commits while the cancel is in flight', async () => {
    const created = await request(server()).post('/orders').send({
      userId: baseline.userId,
      instrumentId: baseline.instrumentId,
      side: 'BUY',
      size: 1,
      price: 50,
      type: 'LIMIT',
    });

    expect(created.status).toBe(201);
    const orderId = Number((created.body as Envelope<OrderResponse>).data.id);

    const fill = await sequelize.transaction();
    let committed = false;

    try {
      // Simulate the fill: lock the row and leave the transaction open.
      await orders.update(
        { status: 'FILLED' },
        { where: { id: orderId }, transaction: fill },
      );

      // Starting the request requires consuming the thenable.
      const cancel = request(server())
        .patch(`/orders/${orderId}/cancel`)
        .then((response) => response);

      await waitForCancelToBlock();
      await fill.commit();
      committed = true;

      const response = await cancel;

      expect(response.status).toBe(200);
      expect(
        (response.body as Envelope<{ cancelled: boolean }>).data.cancelled,
      ).toBe(false);
    } finally {
      if (!committed) {
        await fill.rollback();
      }
    }

    const row = await orders.findByPk(orderId);
    expect(row?.status).toBe('FILLED');
  });
});

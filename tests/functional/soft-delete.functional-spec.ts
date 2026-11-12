import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Server } from 'net';
import { ModelStatic } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import { MarketData, Order } from '../../src/models';
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

interface PortfolioResponse {
  availableCash: number;
  positions: Array<{ instrumentId: number; size: number }>;
}

/**
 * `users`, `instruments`, `orders` and `marketdata` are paranoid, but the
 * aggregates that compute cash and positions run raw SQL. Raw SQL does not
 * apply Sequelize's `deletedAt IS NULL` filter, so a soft-deleted row would
 * keep counting toward money math.
 */
describe('Soft-deleted rows and money math (functional, real database)', () => {
  const CASH = 1000;
  const PRICE = 10;

  let app: INestApplication;
  let sequelize: Sequelize;
  let orders: ModelStatic<Order>;
  let marketData: ModelStatic<MarketData>;
  let instruments: Instruments;
  let userId: number;

  const server = (): Server => app.getHttpServer() as Server;

  const buy = async (size: number): Promise<OrderResponse> => {
    const response = await request(server()).post('/orders').send({
      userId,
      instrumentId: instruments.instrumentId,
      side: 'BUY',
      size,
      type: 'MARKET',
    });

    expect(response.status).toBe(201);
    return (response.body as Envelope<OrderResponse>).data;
  };

  const portfolio = async (): Promise<PortfolioResponse> => {
    const response = await request(server()).get(`/portfolio/${userId}`);

    expect(response.status).toBe(200);
    return (response.body as Envelope<PortfolioResponse>).data;
  };

  beforeAll(async () => {
    const context = await createTestApp();
    app = context.app;
    sequelize = context.sequelize;
    orders = app.get<ModelStatic<Order>>(getModelToken(Order));
    marketData = app.get<ModelStatic<MarketData>>(getModelToken(MarketData));
    await resetSchema(sequelize);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(sequelize);
    instruments = await createInstruments(app, { price: PRICE });
    userId = await createUserWithCash(
      app,
      'soft-delete@example.com',
      CASH,
      instruments.arsInstrumentId,
    );
  });

  it('excludes a soft-deleted BUY from cash and positions', async () => {
    const order = await buy(10);
    expect(order.status).toBe('FILLED');

    let snapshot = await portfolio();
    expect(snapshot.availableCash).toBe(CASH - 10 * PRICE);
    expect(snapshot.positions).toEqual([
      expect.objectContaining({
        instrumentId: instruments.instrumentId,
        size: 10,
      }),
    ]);

    const row = await orders.findByPk(order.id);
    expect(row).not.toBeNull();
    await row!.destroy();
    expect(await orders.findByPk(order.id)).toBeNull();

    snapshot = await portfolio();
    expect(snapshot.availableCash).toBe(CASH);
    expect(snapshot.positions).toEqual([]);
  });

  it('excludes a soft-deleted CASH_IN from the balance used to validate orders', async () => {
    const cashIn = await orders.findOne({
      where: { userId, side: 'CASH_IN' },
    });
    expect(cashIn).not.toBeNull();
    await cashIn!.destroy();

    // With the CASH_IN gone the user has no cash, so the BUY must be rejected.
    const response = await request(server()).post('/orders').send({
      userId,
      instrumentId: instruments.instrumentId,
      side: 'BUY',
      size: 10,
      type: 'MARKET',
    });

    expect(response.status).toBe(201);
    expect((response.body as Envelope<OrderResponse>).data.status).toBe(
      'REJECTED',
    );
  });

  it('ignores soft-deleted market data when pricing an order', async () => {
    const priceRow = await marketData.findOne({
      where: { instrumentId: instruments.instrumentId },
    });
    expect(priceRow).not.toBeNull();
    await priceRow!.destroy();

    // Without a price the MARKET order cannot be executed.
    const response = await request(server()).post('/orders').send({
      userId,
      instrumentId: instruments.instrumentId,
      side: 'BUY',
      size: 1,
      type: 'MARKET',
    });

    expect(response.status).toBe(201);
    expect((response.body as Envelope<OrderResponse>).data.status).toBe(
      'REJECTED',
    );
  });
});

import { INestApplication } from '@nestjs/common';
import { Server } from 'net';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import {
  Baseline,
  createFilledOrder,
  createInstrumentWithoutMarketData,
  createUser,
  seedBaseline,
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
  datetime: string;
}

interface PortfolioResponse {
  totalValue: number;
  availableCash: number;
  positions: Array<{
    instrumentId: number;
    ticker: string;
    name: string;
    size: number;
    value: number | null;
    returnPct: number | null;
    dailyReturnPct: number | null;
    priceAvailable: boolean;
  }>;
}

describe('Order placement (functional, real database)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let baseline: Baseline;

  const server = (): Server => app.getHttpServer() as Server;

  const postOrder = (body: Record<string, unknown>) =>
    request(server()).post('/orders').send(body);

  const getPortfolio = (userId: number) =>
    request(server()).get(`/portfolio/${userId}`);

  const orderStatusInDb = async (orderId: number): Promise<string> => {
    const rows = await sequelize.query<{ status: string }>(
      'SELECT status FROM orders WHERE id = :orderId',
      { replacements: { orderId }, type: QueryTypes.SELECT },
    );
    return rows[0]?.status;
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
    baseline = await seedBaseline(app);
  });

  describe('MARKET BUY', () => {
    it('fills at the latest close and decreases available cash', async () => {
      const response = await postOrder({
        userId: baseline.userId,
        instrumentId: baseline.instrumentId,
        side: 'BUY',
        size: 5,
        type: 'MARKET',
      });

      expect(response.status).toBe(201);
      const body = response.body as Envelope<OrderResponse>;
      expect(body.data.status).toBe('FILLED');
      expect(await orderStatusInDb(Number(body.data.id))).toBe('FILLED');

      const portfolio = (await getPortfolio(baseline.userId))
        .body as Envelope<PortfolioResponse>;
      expect(portfolio.data.availableCash).toBe(500);
      expect(portfolio.data.positions).toHaveLength(1);
      expect(portfolio.data.positions[0].size).toBe(5);
      expect(portfolio.data.positions[0].value).toBe(500);
    });

    it('rejects and persists the order when cash is insufficient', async () => {
      await truncateAll(sequelize);
      baseline = await seedBaseline(app, { cash: 100 });

      const response = await postOrder({
        userId: baseline.userId,
        instrumentId: baseline.instrumentId,
        side: 'BUY',
        size: 5,
        type: 'MARKET',
      });

      expect(response.status).toBe(201);
      const body = response.body as Envelope<OrderResponse>;
      expect(body.data.status).toBe('REJECTED');
      expect(await orderStatusInDb(Number(body.data.id))).toBe('REJECTED');

      const portfolio = (await getPortfolio(baseline.userId))
        .body as Envelope<PortfolioResponse>;
      expect(portfolio.data.availableCash).toBe(100);
      expect(portfolio.data.positions).toHaveLength(0);
    });

    it('rejects when there is no market data for the instrument', async () => {
      const instrumentWithoutPrices = await createInstrumentWithoutMarketData(
        app,
        'MSFT',
      );

      const response = await postOrder({
        userId: baseline.userId,
        instrumentId: instrumentWithoutPrices,
        side: 'BUY',
        size: 1,
        type: 'MARKET',
      });

      expect(response.status).toBe(201);
      const body = response.body as Envelope<OrderResponse>;
      expect(body.data.status).toBe('REJECTED');
    });
  });

  describe('MARKET SELL', () => {
    it('rejects when the user has no position', async () => {
      const response = await postOrder({
        userId: baseline.userId,
        instrumentId: baseline.instrumentId,
        side: 'SELL',
        size: 1,
        type: 'MARKET',
      });

      expect(response.status).toBe(201);
      const body = response.body as Envelope<OrderResponse>;
      expect(body.data.status).toBe('REJECTED');
      expect(await orderStatusInDb(Number(body.data.id))).toBe('REJECTED');
    });

    it('fills when the user owns the shares and reduces the position', async () => {
      const buy = await postOrder({
        userId: baseline.userId,
        instrumentId: baseline.instrumentId,
        side: 'BUY',
        size: 10,
        type: 'MARKET',
      });
      expect((buy.body as Envelope<OrderResponse>).data.status).toBe('FILLED');

      const sell = await postOrder({
        userId: baseline.userId,
        instrumentId: baseline.instrumentId,
        side: 'SELL',
        size: 4,
        type: 'MARKET',
      });

      expect((sell.body as Envelope<OrderResponse>).data.status).toBe('FILLED');

      const portfolio = (await getPortfolio(baseline.userId))
        .body as Envelope<PortfolioResponse>;
      expect(portfolio.data.positions[0].size).toBe(6);
      expect(portfolio.data.availableCash).toBe(400);
    });
  });

  describe('LIMIT orders', () => {
    it('creates a NEW order at the requested price without touching cash', async () => {
      const response = await postOrder({
        userId: baseline.userId,
        instrumentId: baseline.instrumentId,
        side: 'BUY',
        size: 2,
        price: 90,
        type: 'LIMIT',
      });

      expect(response.status).toBe(201);
      const body = response.body as Envelope<OrderResponse>;
      expect(body.data.status).toBe('NEW');
      expect(await orderStatusInDb(Number(body.data.id))).toBe('NEW');

      const portfolio = (await getPortfolio(baseline.userId))
        .body as Envelope<PortfolioResponse>;
      expect(portfolio.data.availableCash).toBe(1000);
      expect(portfolio.data.positions).toHaveLength(0);
    });

    it('requires a price', async () => {
      const response = await postOrder({
        userId: baseline.userId,
        instrumentId: baseline.instrumentId,
        side: 'BUY',
        size: 2,
        type: 'LIMIT',
      });

      expect(response.status).toBe(400);
    });
  });

  describe('amount to whole shares', () => {
    it('floors the number of shares', async () => {
      await truncateAll(sequelize);
      baseline = await seedBaseline(app, { cash: 1000, price: 100.5 });

      const response = await postOrder({
        userId: baseline.userId,
        instrumentId: baseline.instrumentId,
        side: 'BUY',
        amount: 250,
        type: 'MARKET',
      });

      expect(response.status).toBe(201);
      expect((response.body as Envelope<OrderResponse>).data.status).toBe(
        'FILLED',
      );

      const portfolio = (await getPortfolio(baseline.userId))
        .body as Envelope<PortfolioResponse>;
      expect(portfolio.data.positions[0].size).toBe(2);
    });

    it('rejects when the amount cannot buy one share', async () => {
      const response = await postOrder({
        userId: baseline.userId,
        instrumentId: baseline.instrumentId,
        side: 'BUY',
        amount: 50, // price is 100
        type: 'MARKET',
      });

      expect(response.status).toBe(400);
    });

    it('rejects when both size and amount are provided', async () => {
      const response = await postOrder({
        userId: baseline.userId,
        instrumentId: baseline.instrumentId,
        side: 'BUY',
        size: 1,
        amount: 100,
        type: 'MARKET',
      });

      expect(response.status).toBe(400);
    });

    it('rejects a non-integer size for BUY/SELL', async () => {
      const response = await postOrder({
        userId: baseline.userId,
        instrumentId: baseline.instrumentId,
        side: 'BUY',
        size: 1.5,
        type: 'MARKET',
      });

      expect(response.status).toBe(400);
    });
  });

  describe('cash transfers', () => {
    it('CASH_IN increases the balance', async () => {
      const response = await postOrder({
        userId: baseline.userId,
        side: 'CASH_IN',
        size: 500,
      });

      expect(response.status).toBe(201);
      expect((response.body as Envelope<OrderResponse>).data.status).toBe(
        'FILLED',
      );

      const portfolio = (await getPortfolio(baseline.userId))
        .body as Envelope<PortfolioResponse>;
      expect(portfolio.data.availableCash).toBe(1500);
    });

    it('CASH_OUT decreases the balance when funds are available', async () => {
      const response = await postOrder({
        userId: baseline.userId,
        side: 'CASH_OUT',
        size: 400,
      });

      expect(response.status).toBe(201);
      expect((response.body as Envelope<OrderResponse>).data.status).toBe(
        'FILLED',
      );

      const portfolio = (await getPortfolio(baseline.userId))
        .body as Envelope<PortfolioResponse>;
      expect(portfolio.data.availableCash).toBe(600);
    });

    it('CASH_OUT is rejected and persisted when funds are insufficient', async () => {
      const response = await postOrder({
        userId: baseline.userId,
        side: 'CASH_OUT',
        size: 5000,
      });

      expect(response.status).toBe(201);
      const body = response.body as Envelope<OrderResponse>;
      expect(body.data.status).toBe('REJECTED');
      expect(await orderStatusInDb(Number(body.data.id))).toBe('REJECTED');

      const portfolio = (await getPortfolio(baseline.userId))
        .body as Envelope<PortfolioResponse>;
      expect(portfolio.data.availableCash).toBe(1000);
    });
  });

  describe('unknown ids', () => {
    it('returns 404 for an unknown userId on a BUY', async () => {
      const response = await postOrder({
        userId: 999999,
        instrumentId: baseline.instrumentId,
        side: 'BUY',
        size: 1,
        type: 'MARKET',
      });
      const body = response.body as {
        statusCode: number;
        data: string;
        timestamp: string;
      };

      expect(response.status).toBe(404);
      expect(body.statusCode).toBe(404);
      expect(typeof body.data).toBe('string');
      expect(typeof body.timestamp).toBe('string');
    });

    it('returns 404 for an unknown instrumentId on a BUY', async () => {
      const response = await postOrder({
        userId: baseline.userId,
        instrumentId: 999999,
        side: 'BUY',
        size: 1,
        type: 'MARKET',
      });
      const body = response.body as {
        statusCode: number;
        data: string;
        timestamp: string;
      };

      expect(response.status).toBe(404);
      expect(body.statusCode).toBe(404);
      expect(typeof body.data).toBe('string');
      expect(typeof body.timestamp).toBe('string');
    });

    it('returns 404 for an unknown userId on a CASH_IN', async () => {
      const response = await postOrder({
        userId: 999999,
        side: 'CASH_IN',
        size: 100,
      });
      const body = response.body as {
        statusCode: number;
        data: string;
        timestamp: string;
      };

      expect(response.status).toBe(404);
      expect(body.statusCode).toBe(404);
      expect(typeof body.data).toBe('string');
      expect(typeof body.timestamp).toBe('string');
    });
  });

  describe('portfolio', () => {
    it('returns 200 with zeros for an existing user with no orders', async () => {
      const userId = await createUser(app, 'no-orders@example.com');

      const response = await getPortfolio(userId);

      expect(response.status).toBe(200);
      expect((response.body as Envelope<PortfolioResponse>).data).toEqual({
        totalValue: 0,
        availableCash: 0,
        positions: [],
      });
    });

    it('returns 404 with the standard envelope for an unknown user', async () => {
      const response = await getPortfolio(999999999);
      const body = response.body as {
        statusCode: number;
        data: string;
        timestamp: string;
      };

      expect(response.status).toBe(404);
      expect(body.statusCode).toBe(404);
      expect(typeof body.data).toBe('string');
      expect(typeof body.timestamp).toBe('string');
    });

    it('flags a position without market data and excludes it from totalValue', async () => {
      const unpricedInstrumentId = await createInstrumentWithoutMarketData(app);
      await createFilledOrder(app, {
        userId: baseline.userId,
        instrumentId: unpricedInstrumentId,
        side: 'BUY',
        size: 10,
        price: 100,
      });
      await createFilledOrder(app, {
        userId: baseline.userId,
        instrumentId: baseline.instrumentId,
        side: 'BUY',
        size: 1,
        price: baseline.price,
      });

      const response = await getPortfolio(baseline.userId);
      const data = (response.body as Envelope<PortfolioResponse>).data;

      expect(response.status).toBe(200);
      expect(data.positions).toHaveLength(2);

      const unpriced = data.positions.find(
        (position) => position.instrumentId === unpricedInstrumentId,
      );
      expect(unpriced).toEqual({
        instrumentId: unpricedInstrumentId,
        ticker: 'NODATA',
        name: 'No Market Data Inc.',
        size: 10,
        value: null,
        returnPct: null,
        dailyReturnPct: null,
        priceAvailable: false,
      });

      const priced = data.positions.find(
        (position) => position.instrumentId === baseline.instrumentId,
      );
      expect(priced).toMatchObject({
        size: 1,
        value: baseline.price,
        priceAvailable: true,
      });

      // cash 1000 - 10*100 - 1*100 = -100; only the priced position is summed.
      expect(data.availableCash).toBe(-100);
      expect(data.totalValue).toBe(-100 + baseline.price);
    });

    it('reports the daily return from close and previousClose', async () => {
      await truncateAll(sequelize);
      baseline = await seedBaseline(app, { price: 120, previousClose: 100 });
      await createFilledOrder(app, {
        userId: baseline.userId,
        instrumentId: baseline.instrumentId,
        side: 'BUY',
        size: 1,
        price: baseline.price,
      });

      const response = await getPortfolio(baseline.userId);
      const data = (response.body as Envelope<PortfolioResponse>).data;
      const position = data.positions.find(
        (item) => item.instrumentId === baseline.instrumentId,
      );

      expect(position?.priceAvailable).toBe(true);
      expect(position?.dailyReturnPct).toBeCloseTo(0.2);
    });
  });

  describe('cancellation', () => {
    it('cancels a NEW order', async () => {
      const created = await postOrder({
        userId: baseline.userId,
        instrumentId: baseline.instrumentId,
        side: 'BUY',
        size: 1,
        price: 50,
        type: 'LIMIT',
      });
      const orderId = Number((created.body as Envelope<OrderResponse>).data.id);

      const response = await request(server()).patch(
        `/orders/${orderId}/cancel`,
      );

      expect(response.status).toBe(200);
      expect(
        (response.body as Envelope<{ cancelled: boolean }>).data.cancelled,
      ).toBe(true);
      expect(await orderStatusInDb(orderId)).toBe('CANCELLED');
    });

    it('does not cancel a FILLED order', async () => {
      const created = await postOrder({
        userId: baseline.userId,
        instrumentId: baseline.instrumentId,
        side: 'BUY',
        size: 1,
        type: 'MARKET',
      });
      const orderId = Number((created.body as Envelope<OrderResponse>).data.id);

      const response = await request(server()).patch(
        `/orders/${orderId}/cancel`,
      );

      expect(response.status).toBe(200);
      expect(
        (response.body as Envelope<{ cancelled: boolean }>).data.cancelled,
      ).toBe(false);
      expect(await orderStatusInDb(orderId)).toBe('FILLED');
    });

    it('returns 404 when the order does not exist', async () => {
      const response = await request(server()).patch('/orders/999999/cancel');
      const body = response.body as {
        statusCode: number;
        data: string;
        timestamp: string;
      };

      expect(response.status).toBe(404);
      expect(body.statusCode).toBe(404);
      expect(typeof body.data).toBe('string');
      expect(typeof body.timestamp).toBe('string');
    });
  });
});

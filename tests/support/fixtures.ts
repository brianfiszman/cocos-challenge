import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { ModelStatic } from 'sequelize';
import { Instrument, MarketData, Order, User } from '../../src/models';

export interface Instruments {
  /** Stock instrument used to trade. */
  instrumentId: number;
  /** ARS instrument (`type: MONEDA`) used for cash movements. */
  arsInstrumentId: number;
  /** Latest close price for the stock instrument. */
  price: number;
}

export interface Baseline extends Instruments {
  userId: number;
  /** A second user, useful for isolation checks. */
  otherUserId: number;
}

export interface BaselineOptions {
  cash?: number;
  price?: number;
  previousClose?: number;
}

function models(app: INestApplication) {
  return {
    users: app.get<ModelStatic<User>>(getModelToken(User)),
    instruments: app.get<ModelStatic<Instrument>>(getModelToken(Instrument)),
    orders: app.get<ModelStatic<Order>>(getModelToken(Order)),
    marketData: app.get<ModelStatic<MarketData>>(getModelToken(MarketData)),
  };
}

/** Creates the ARS cash instrument and a tradable stock with one price row. */
export async function createInstruments(
  app: INestApplication,
  options: BaselineOptions = {},
): Promise<Instruments> {
  const price = options.price ?? 100;
  const { instruments, marketData } = models(app);

  const ars = await instruments.create({
    ticker: 'ARS',
    name: 'Argentine Peso',
    type: 'MONEDA',
  });
  const stock = await instruments.create({
    ticker: 'AAPL',
    name: 'Apple Inc.',
    type: 'stock',
  });

  await marketData.create({
    instrumentId: Number(stock.id),
    high: price,
    low: price,
    open: price,
    close: price,
    previousClose: options.previousClose ?? price,
    datetime: new Date(),
  });

  return {
    instrumentId: Number(stock.id),
    arsInstrumentId: Number(ars.id),
    price,
  };
}

/** Creates a user whose balance is `cash`, materialized as a FILLED CASH_IN. */
export async function createUserWithCash(
  app: INestApplication,
  email: string,
  cash: number,
  arsInstrumentId: number,
): Promise<number> {
  const { users, orders } = models(app);

  const user = await users.create({
    email,
    accountNumber: `ACC-${email}`,
  });

  await orders.create({
    userId: Number(user.id),
    instrumentId: arsInstrumentId,
    side: 'CASH_IN',
    size: cash,
    price: null,
    type: 'MARKET',
    status: 'FILLED',
    datetime: new Date(),
  });

  return Number(user.id);
}

/** Creates an instrument with no price rows, to exercise the "no market data" path. */
export async function createInstrumentWithoutMarketData(
  app: INestApplication,
  ticker = 'NODATA',
): Promise<number> {
  const { instruments } = models(app);

  const instrument = await instruments.create({
    ticker,
    name: 'No Market Data Inc.',
    type: 'stock',
  });

  return Number(instrument.id);
}

/** One user with cash, one instrument with a price, and a second idle user. */
export async function seedBaseline(
  app: INestApplication,
  options: BaselineOptions = {},
): Promise<Baseline> {
  const instruments = await createInstruments(app, options);
  const cash = options.cash ?? 1000;

  const userId = await createUserWithCash(
    app,
    'alice@example.com',
    cash,
    instruments.arsInstrumentId,
  );
  const otherUserId = await createUserWithCash(
    app,
    'bob@example.com',
    0,
    instruments.arsInstrumentId,
  );

  return { ...instruments, userId, otherUserId };
}

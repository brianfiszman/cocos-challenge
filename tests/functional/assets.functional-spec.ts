import { INestApplication } from '@nestjs/common';
import { Server } from 'net';
import { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import { seedBaseline } from '../support/fixtures';
import { createTestApp } from '../support/test-app';
import { resetSchema, truncateAll } from '../support/test-database';

interface Envelope<T> {
  statusCode: number;
  data: T;
  timestamp: string;
}

interface AssetItem {
  id: string;
  ticker: string;
  name: string;
  type: string;
}

describe('Asset search (functional, real database)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;

  const server = (): Server => app.getHttpServer() as Server;

  const search = (query: string) =>
    request(server()).get('/assets').query({ q: query });

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
    await seedBaseline(app);
  });

  it('does not return the cash instrument', async () => {
    const response = await search('ARS');

    expect(response.status).toBe(200);
    const body = response.body as Envelope<AssetItem[]>;
    expect(body.data).toEqual([]);
  });

  it('returns tradable instruments when the query also matches cash', async () => {
    const response = await search('a');

    expect(response.status).toBe(200);
    const body = response.body as Envelope<AssetItem[]>;
    const tickers = body.data.map((asset) => asset.ticker);

    expect(tickers).toContain('AAPL');
    expect(tickers).not.toContain('ARS');
  });
});

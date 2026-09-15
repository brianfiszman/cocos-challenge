import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Server } from 'net';
import request from 'supertest';
import { UserController } from '../../src/modules/users/users.controllers';
import { UserService } from '../../src/modules/users/users.service';
import { MarketDataController } from '../../src/modules/market-data/market-data.controllers';
import { MarketDataService } from '../../src/modules/market-data/market-data.service';
import { HttpExceptionFilter } from '../../src/common/exceptions/http-exception.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';

interface ResponseBody {
  statusCode: number;
  data: unknown;
  timestamp: string;
}

describe('Portfolio & Assets (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UserController, MarketDataController],
      providers: [
        {
          provide: UserService,
          useValue: {
            getPortfolio: jest.fn().mockResolvedValue({
              totalValue: 1000,
              availableCash: 500,
              positions: [
                {
                  instrumentId: 1,
                  ticker: 'AAPL',
                  name: 'Apple Inc.',
                  size: 10,
                  value: 500,
                  returnPct: 0.05,
                },
              ],
            }),
          },
        },
        {
          provide: MarketDataService,
          useValue: {
            search: jest.fn().mockImplementation((q: string) => {
              if (!q || q.trim().length === 0) {
                return Promise.resolve([]);
              }
              const lower = q.toLowerCase();
              if (lower.includes('aapl') || lower.includes('apple')) {
                return Promise.resolve([
                  {
                    id: 1,
                    ticker: 'AAPL',
                    name: 'Apple Inc.',
                    type: 'stock',
                  },
                ]);
              }
              return Promise.resolve([]);
            }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = (): Server => app.getHttpServer() as Server;

  describe('GET /portfolio/:userId', () => {
    it('returns portfolio with totalValue, availableCash, and positions', async () => {
      const res = await request(server()).get('/portfolio/1');
      const body = res.body as ResponseBody;

      expect(res.status).toBe(200);
      expect(body.statusCode).toBe(200);
      expect(typeof body.timestamp).toBe('string');
      expect(body.data).toEqual({
        totalValue: 1000,
        availableCash: 500,
        positions: [
          {
            instrumentId: 1,
            ticker: 'AAPL',
            name: 'Apple Inc.',
            size: 10,
            value: 500,
            returnPct: 0.05,
          },
        ],
      });
    });

    it('returns 400 for non-numeric userId', async () => {
      const res = await request(server()).get('/portfolio/abc');
      const body = res.body as ResponseBody;

      expect(res.status).toBe(400);
      expect(body.statusCode).toBe(400);
      expect(body.data).toBe('The request could not be completed.');
    });
  });

  describe('GET /assets', () => {
    it('returns matching assets when q is provided', async () => {
      const res = await request(server()).get('/assets?q=aapl');
      const body = res.body as ResponseBody;

      expect(res.status).toBe(200);
      expect(body.statusCode).toBe(200);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data).toEqual([
        {
          id: 1,
          ticker: 'AAPL',
          name: 'Apple Inc.',
          type: 'stock',
        },
      ]);
    });

    it('returns empty array when q is missing', async () => {
      const res = await request(server()).get('/assets');
      const body = res.body as ResponseBody;

      expect(res.status).toBe(200);
      expect(body.data).toEqual([]);
    });

    it('returns empty array when q is empty string', async () => {
      const res = await request(server()).get('/assets?q=');
      const body = res.body as ResponseBody;

      expect(res.status).toBe(200);
      expect(body.data).toEqual([]);
    });

    it('returns empty array when no matches found', async () => {
      const res = await request(server()).get('/assets?q=zzzz');
      const body = res.body as ResponseBody;

      expect(res.status).toBe(200);
      expect(body.data).toEqual([]);
    });
  });
});

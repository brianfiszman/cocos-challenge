import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Server } from 'net';
import request from 'supertest';
import { OrderController } from '../../src/modules/orders/order.controllers';
import { OrderService } from '../../src/modules/orders/orders.service';
import { HttpExceptionFilter } from '../../src/common/exceptions/http-exception.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';

interface ResponseBody {
  statusCode: number;
  data: unknown;
  timestamp: string;
}

describe('OrdersController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        {
          provide: OrderService,
          useValue: {
            placeOrder: jest.fn().mockResolvedValue({
              id: 1,
              status: 'NEW',
              datetime: new Date(),
            }),
            cancelOrder: jest.fn().mockResolvedValue(true),
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

  describe('POST /orders', () => {
    const cases: Array<{
      label: string;
      body: Record<string, unknown>;
      expectedStatus: number;
      expectSuccess: boolean;
    }> = [
      {
        label: 'valid market buy order',
        body: {
          instrumentId: 1,
          userId: 1,
          side: 'BUY',
          size: 10,
          price: 185.2,
          type: 'MARKET',
        },
        expectedStatus: 201,
        expectSuccess: true,
      },
      {
        label: 'valid limit sell order',
        body: {
          instrumentId: 2,
          userId: 2,
          side: 'SELL',
          size: 5,
          price: 410.75,
          type: 'LIMIT',
        },
        expectedStatus: 201,
        expectSuccess: true,
      },
      {
        label: 'valid order without optional type',
        body: {
          instrumentId: 3,
          userId: 3,
          side: 'BUY',
          size: 2,
          price: 175.5,
        },
        expectedStatus: 201,
        expectSuccess: true,
      },
      {
        label: 'invalid enum side',
        body: {
          instrumentId: 1,
          userId: 1,
          side: 'hold',
          size: 10,
          price: 100,
        },
        expectedStatus: 400,
        expectSuccess: false,
      },
      {
        label: 'missing required side',
        body: { instrumentId: 1, userId: 1 },
        expectedStatus: 400,
        expectSuccess: false,
      },
      {
        label: 'negative size',
        body: {
          instrumentId: 1,
          userId: 1,
          side: 'BUY',
          size: -5,
          price: 100,
        },
        expectedStatus: 400,
        expectSuccess: false,
      },
      {
        label: 'unknown field rejected',
        body: {
          instrumentId: 1,
          userId: 1,
          side: 'BUY',
          size: 10,
          price: 100,
          bogus: 123,
        },
        expectedStatus: 400,
        expectSuccess: false,
      },
      {
        label: 'string where number expected',
        body: {
          instrumentId: 1,
          userId: 1,
          side: 'BUY',
          size: 'ten',
          price: 100,
        },
        expectedStatus: 400,
        expectSuccess: false,
      },
    ];

    it.each(cases)(
      '$label',
      async ({ body, expectedStatus, expectSuccess }) => {
        const res = await request(server()).post('/orders').send(body);
        const responseBody = res.body as ResponseBody;

        expect(res.status).toBe(expectedStatus);
        expect(responseBody.statusCode).toBe(expectedStatus);
        expect(typeof responseBody.timestamp).toBe('string');

        if (expectSuccess) {
          expect(responseBody.data).toBeDefined();
        } else {
          expect(responseBody.data).toBe('The request could not be completed.');
          expect(JSON.stringify(responseBody)).not.toMatch(/must be one of/);
          expect(JSON.stringify(responseBody)).not.toMatch(/should not exist/);
          expect(JSON.stringify(responseBody)).not.toMatch(/positive number/);
          expect(JSON.stringify(responseBody)).not.toMatch(/correlationId/);
        }
      },
    );
  });

  describe('PATCH /orders/:id/cancel', () => {
    it('cancels a NEW order', async () => {
      const res = await request(server()).patch('/orders/1/cancel');
      expect(res.status).toBe(200);
      const body = res.body as ResponseBody;
      expect(body.data).toEqual({ cancelled: true });
    });
  });
});

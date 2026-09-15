import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Server } from 'net';
import request from 'supertest';
import { OrderController } from '../../src/modules/orders/order.controllers';
import { OrderService } from '../../src/modules/orders/orders.service';
import { HttpExceptionFilter } from '../../src/common/exceptions/http-exception.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { CreateOrderDto } from '../../src/modules/orders/dto/create-order.dto';

interface ResponseBody {
  statusCode: number;
  data: unknown;
  timestamp: string;
}

interface MockOrderService {
  placeOrder: jest.MockedFunction<OrderService['placeOrder']>;
  cancelOrder: jest.MockedFunction<OrderService['cancelOrder']>;
}

describe('OrdersController SELL e2e', () => {
  let app: INestApplication;
  let mockService: MockOrderService;

  beforeEach(async () => {
    mockService = {
      placeOrder: jest.fn(),
      cancelOrder: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [{ provide: OrderService, useValue: mockService }],
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

  it('market SELL fills when position is sufficient', async () => {
    mockService.placeOrder.mockResolvedValueOnce({
      id: 501,
      status: 'FILLED',
      datetime: new Date('2026-09-18T00:00:00Z'),
    });

    const dto: CreateOrderDto = {
      instrumentId: 1,
      userId: 1,
      side: 'SELL',
      size: 5,
      type: 'MARKET',
    };

    const res = await request(server()).post('/orders').send(dto);
    const body = res.body as ResponseBody;

    expect(res.status).toBe(201);
    expect(body.statusCode).toBe(201);
    const data = body.data as { id: number; status: string };
    expect(data.id).toBe(501);
    expect(data.status).toBe('FILLED');
    expect(typeof body.timestamp).toBe('string');
  });

  it('limit SELL stays as NEW', async () => {
    mockService.placeOrder.mockResolvedValueOnce({
      id: 502,
      status: 'NEW',
      datetime: new Date('2026-09-18T00:00:00Z'),
    });

    const dto: CreateOrderDto = {
      instrumentId: 1,
      userId: 1,
      side: 'SELL',
      size: 5,
      price: 190,
      type: 'LIMIT',
    };

    const res = await request(server()).post('/orders').send(dto);
    const body = res.body as ResponseBody;

    expect(res.status).toBe(201);
    const data = body.data as { status: string };
    expect(data.status).toBe('NEW');
  });

  it('market SELL rejects when position is insufficient', async () => {
    mockService.placeOrder.mockResolvedValueOnce({
      id: 503,
      status: 'REJECTED',
      datetime: new Date('2026-09-18T00:00:00Z'),
    });

    const dto: CreateOrderDto = {
      instrumentId: 1,
      userId: 1,
      side: 'SELL',
      size: 20,
      type: 'MARKET',
    };

    const res = await request(server()).post('/orders').send(dto);
    const body = res.body as ResponseBody;

    expect(res.status).toBe(201);
    const data = body.data as { status: string };
    expect(data.status).toBe('REJECTED');
  });

  it('cancel endpoints returns cancelled=true for cancelable order', async () => {
    mockService.cancelOrder.mockResolvedValueOnce(true);

    const res = await request(server()).patch('/orders/502/cancel');
    const body = res.body as ResponseBody;

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ cancelled: true });
  });

  it('cancel endpoints returns cancelled=false for non-cancelable order', async () => {
    mockService.cancelOrder.mockResolvedValueOnce(false);

    const res = await request(server()).patch('/orders/501/cancel');
    const body = res.body as ResponseBody;

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ cancelled: false });
  });
});

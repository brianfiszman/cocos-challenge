import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { getModelToken } from '@nestjs/sequelize';
import { OrderService } from '../../src/modules/orders/orders.service';
import { CreateOrderDto } from '../../src/modules/orders/dto/create-order.dto';
import { Order } from '../../src/models/order.model';
import { Instrument } from '../../src/models/instrument.model';

interface MockOrder {
  id: number;
  status: string;
  datetime: Date;
  size?: number;
  price?: number | null;
  type?: string;
  side?: string;
  userId?: number;
  instrumentId?: number | null;
  save?: () => Promise<void>;
}

describe('OrderService', () => {
  let service: OrderService;
  let mockSequelize: {
    transaction: jest.Mock;
    query: jest.Mock;
  };
  let mockOrderModel: {
    create: jest.Mock;
    findByPk: jest.Mock;
  };
  let mockInstrumentModel: {
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    mockOrderModel = {
      create: jest.fn(),
      findByPk: jest.fn(),
    };

    mockInstrumentModel = {
      findOne: jest.fn().mockResolvedValue({ id: '6' }),
    };

    const mockTransaction: { commit: jest.Mock; rollback: jest.Mock } = {
      commit: jest.fn(),
      rollback: jest.fn(),
    };

    mockSequelize = {
      transaction: jest.fn().mockResolvedValue(mockTransaction),
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: Sequelize, useValue: mockSequelize },
        { provide: getModelToken(Order), useValue: mockOrderModel },
        {
          provide: getModelToken(Instrument),
          useValue: mockInstrumentModel,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('placeOrder', () => {
    it('rejects a BUY when cash is insufficient', async () => {
      mockSequelize.query
        .mockResolvedValueOnce([{ close: '100' }])
        .mockResolvedValueOnce([{ balance: '50' }])
        .mockResolvedValueOnce([{ size: '0' }]);

      mockOrderModel.create.mockResolvedValue({
        id: 99,
        status: 'REJECTED',
        datetime: new Date(),
      });

      const dto: CreateOrderDto = {
        instrumentId: 1,
        userId: 1,
        side: 'BUY',
        size: 10,
        type: 'MARKET',
      };

      const result = await service.placeOrder(dto);

      expect(result.status).toBe('REJECTED');
      expect(result.id).toBe(99);
    });

    it('rejects a BUY with amount and saves resolved size/price', async () => {
      mockSequelize.query
        .mockResolvedValueOnce([{ close: '150' }])
        .mockResolvedValueOnce([{ balance: '500' }])
        .mockResolvedValueOnce([{ size: '0' }]);

      mockOrderModel.create.mockResolvedValue({
        id: 97,
        status: 'REJECTED',
        datetime: new Date(),
      });

      const dto: CreateOrderDto = {
        instrumentId: 1,
        userId: 1,
        side: 'BUY',
        amount: 1000,
        type: 'MARKET',
      };

      const result = await service.placeOrder(dto);

      expect(result.status).toBe('REJECTED');
      const createArg = mockOrderModel.create.mock.calls[0][0] as {
        size: number;
        price: number;
      };
      expect(createArg.size).toBe(6);
      expect(createArg.price).toBe(150);
    });

    it('rejects a SELL when position is insufficient', async () => {
      mockSequelize.query
        .mockResolvedValueOnce([{ close: '100' }])
        .mockResolvedValueOnce([{ balance: '100000' }])
        .mockResolvedValueOnce([{ size: '2' }]);

      mockOrderModel.create.mockResolvedValue({
        id: 98,
        status: 'REJECTED',
        datetime: new Date(),
      });

      const dto: CreateOrderDto = {
        instrumentId: 1,
        userId: 1,
        side: 'SELL',
        size: 10,
        type: 'MARKET',
      };

      const result = await service.placeOrder(dto);

      expect(result.status).toBe('REJECTED');
      expect(result.id).toBe(98);
    });

    it('rejects a SELL with amount and saves resolved size/price', async () => {
      mockSequelize.query
        .mockResolvedValueOnce([{ close: '100' }])
        .mockResolvedValueOnce([{ balance: '100000' }])
        .mockResolvedValueOnce([{ size: '2' }]);

      mockOrderModel.create.mockResolvedValue({
        id: 96,
        status: 'REJECTED',
        datetime: new Date(),
      });

      const dto: CreateOrderDto = {
        instrumentId: 1,
        userId: 1,
        side: 'SELL',
        amount: 500,
        type: 'MARKET',
      };

      const result = await service.placeOrder(dto);

      expect(result.status).toBe('REJECTED');
      const createArg = mockOrderModel.create.mock.calls[0][0] as {
        size: number;
        price: number;
      };
      expect(createArg.size).toBe(5);
      expect(createArg.price).toBe(100);
    });

    it('fills a MARKET BUY when cash is sufficient', async () => {
      mockSequelize.query
        .mockResolvedValueOnce([{ close: '100' }])
        .mockResolvedValueOnce([{ balance: '100000' }])
        .mockResolvedValueOnce([{ size: '0' }]);

      mockOrderModel.create.mockResolvedValue({
        id: 42,
        status: 'FILLED',
        datetime: new Date(),
      });

      const dto: CreateOrderDto = {
        instrumentId: 1,
        userId: 1,
        side: 'BUY',
        size: 10,
        type: 'MARKET',
      };

      const result = await service.placeOrder(dto);

      expect(result.status).toBe('FILLED');
      expect(result.id).toBe(42);
    });

    it('keeps a LIMIT BUY as NEW', async () => {
      mockSequelize.query
        .mockResolvedValueOnce([{ balance: '100000' }])
        .mockResolvedValueOnce([{ size: '0' }]);

      mockOrderModel.create.mockResolvedValue({
        id: 7,
        status: 'NEW',
        datetime: new Date(),
      });

      const dto: CreateOrderDto = {
        instrumentId: 1,
        userId: 1,
        side: 'BUY',
        size: 10,
        price: 95,
        type: 'LIMIT',
      };

      const result = await service.placeOrder(dto);

      expect(result.status).toBe('NEW');
      expect(result.id).toBe(7);
    });

    it('rejects a LIMIT order without a price', async () => {
      const dto: CreateOrderDto = {
        instrumentId: 1,
        userId: 1,
        side: 'BUY',
        size: 10,
        type: 'LIMIT',
      };

      await expect(service.placeOrder(dto)).rejects.toThrow();
    });

    it('computes size from amount (max shares, no fractions)', async () => {
      mockSequelize.query
        .mockResolvedValueOnce([{ close: '150' }])
        .mockResolvedValueOnce([{ balance: '100000' }])
        .mockResolvedValueOnce([{ size: '0' }]);

      mockOrderModel.create.mockResolvedValue({
        id: 99,
        status: 'FILLED',
        datetime: new Date(),
      });

      const dto: CreateOrderDto = {
        instrumentId: 1,
        userId: 1,
        side: 'BUY',
        amount: 1000,
        type: 'MARKET',
      };

      const result = await service.placeOrder(dto);

      expect(result.status).toBe('FILLED');
      const createCall = (
        mockOrderModel.create.mock.calls[0] as unknown as Array<{
          size?: number;
        }>
      )[0];
      expect(createCall.size).toBe(6);
    });

    it('fills a CASH_IN transfer', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ balance: '0' }]);

      mockOrderModel.create.mockResolvedValue({
        id: 5,
        status: 'FILLED',
        datetime: new Date(),
      });

      const dto: CreateOrderDto = {
        instrumentId: null as unknown as number,
        userId: 1,
        side: 'CASH_IN',
        size: 500,
        type: 'MARKET',
      };

      const result = await service.placeOrder(dto);

      expect(result.status).toBe('FILLED');
      expect(result.id).toBe(5);
      const createArg = mockOrderModel.create.mock.calls[0][0] as {
        instrumentId: number;
      };
      expect(createArg.instrumentId).toBe(6);
    });

    it('creates CASH_IN order with the ARS instrument id', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ balance: '0' }]);

      mockOrderModel.create.mockResolvedValue({
        id: 5,
        status: 'FILLED',
        datetime: new Date(),
      });

      const dto: CreateOrderDto = {
        instrumentId: null as unknown as number,
        userId: 1,
        side: 'CASH_IN',
        size: 500,
        type: 'MARKET',
      };

      await service.placeOrder(dto);

      const createArg = mockOrderModel.create.mock.calls[0][0] as {
        instrumentId: number;
      };
      expect(createArg.instrumentId).toBe(6);
    });

    it('rejects a CASH_OUT when cash is insufficient', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ balance: '100' }]);

      mockOrderModel.create.mockResolvedValue({
        id: 6,
        status: 'REJECTED',
        datetime: new Date(),
      });

      const dto: CreateOrderDto = {
        instrumentId: null as unknown as number,
        userId: 1,
        side: 'CASH_OUT',
        size: 500,
        type: 'MARKET',
      };

      const result = await service.placeOrder(dto);

      expect(result.status).toBe('REJECTED');
      expect(result.id).toBe(6);
    });

    it('cancels a NEW order', async () => {
      const saved: MockOrder = {
        id: 1,
        status: 'NEW',
        datetime: new Date(),
        save: jest.fn().mockImplementation(function (this: MockOrder) {
          this.status = 'CANCELLED';
          return Promise.resolve();
        }),
      };

      mockOrderModel.findByPk.mockResolvedValue(saved);

      const cancelled = await service.cancelOrder(1);
      expect(cancelled).toBe(true);
    });

    it('does not cancel a non-NEW order', async () => {
      mockOrderModel.findByPk.mockResolvedValue({
        id: 1,
        status: 'FILLED',
        datetime: new Date(),
      });

      const cancelled = await service.cancelOrder(1);
      expect(cancelled).toBe(false);
    });

    it('does not cancel a non-existent order', async () => {
      mockOrderModel.findByPk.mockResolvedValue(null);

      const cancelled = await service.cancelOrder(999);
      expect(cancelled).toBe(false);
    });

    it('does not cancel a CANCELLED order', async () => {
      mockOrderModel.findByPk.mockResolvedValue({
        id: 1,
        status: 'CANCELLED',
        datetime: new Date(),
      });

      const cancelled = await service.cancelOrder(1);
      expect(cancelled).toBe(false);
    });

    it('does not cancel a REJECTED order', async () => {
      mockOrderModel.findByPk.mockResolvedValue({
        id: 1,
        status: 'REJECTED',
        datetime: new Date(),
      });

      const cancelled = await service.cancelOrder(1);
      expect(cancelled).toBe(false);
    });

    it('fills a CASH_OUT transfer when cash is sufficient', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ balance: '1000' }]);

      mockOrderModel.create.mockResolvedValue({
        id: 7,
        status: 'FILLED',
        datetime: new Date(),
      });

      const dto: CreateOrderDto = {
        instrumentId: null as unknown as number,
        userId: 1,
        side: 'CASH_OUT',
        size: 500,
        type: 'MARKET',
      };

      const result = await service.placeOrder(dto);

      expect(result.status).toBe('FILLED');
      expect(result.id).toBe(7);
    });

    it('saves a REJECTED order with status REJECTED to the database', async () => {
      mockSequelize.query
        .mockResolvedValueOnce([{ close: '100' }])
        .mockResolvedValueOnce([{ balance: '50' }])
        .mockResolvedValueOnce([{ size: '0' }]);

      mockOrderModel.create.mockResolvedValue({
        id: 99,
        status: 'REJECTED',
        datetime: new Date(),
      });

      const dto: CreateOrderDto = {
        instrumentId: 1,
        userId: 1,
        side: 'BUY',
        size: 10,
        type: 'MARKET',
      };

      const result = await service.placeOrder(dto);

      expect(result.status).toBe('REJECTED');
      expect(mockOrderModel.create).toHaveBeenCalled();
      const createArg = (
        mockOrderModel.create.mock.calls[0] as unknown as Array<{
          status: string;
          side: string;
          userId: number;
          instrumentId: number;
        }>
      )[0];
      expect(createArg.status).toBe('REJECTED');
      expect(createArg.side).toBe('BUY');
      expect(createArg.userId).toBe(1);
      expect(createArg.instrumentId).toBe(1);
    });

    it('sells when position is sufficient', async () => {
      mockSequelize.query
        .mockResolvedValueOnce([{ close: '100' }])
        .mockResolvedValueOnce([{ balance: '0' }])
        .mockResolvedValueOnce([{ size: '10' }]);

      mockOrderModel.create.mockResolvedValue({
        id: 8,
        status: 'FILLED',
        datetime: new Date(),
      });

      const dto: CreateOrderDto = {
        instrumentId: 1,
        userId: 1,
        side: 'SELL',
        size: 5,
        type: 'MARKET',
      };

      const result = await service.placeOrder(dto);

      expect(result.status).toBe('FILLED');
      expect(result.id).toBe(8);
    });

    it('sells exactly the available position (boundary)', async () => {
      mockSequelize.query
        .mockResolvedValueOnce([{ close: '100' }])
        .mockResolvedValueOnce([{ balance: '0' }])
        .mockResolvedValueOnce([{ size: '10' }]);

      mockOrderModel.create.mockResolvedValue({
        id: 9,
        status: 'FILLED',
        datetime: new Date(),
      });

      const dto: CreateOrderDto = {
        instrumentId: 1,
        userId: 1,
        side: 'SELL',
        size: 10,
        type: 'MARKET',
      };

      const result = await service.placeOrder(dto);

      expect(result.status).toBe('FILLED');
    });

    it('computes size from amount with exact division (no fractions)', async () => {
      mockSequelize.query
        .mockResolvedValueOnce([{ close: '50' }])
        .mockResolvedValueOnce([{ balance: '100000' }])
        .mockResolvedValueOnce([{ size: '0' }]);

      mockOrderModel.create.mockResolvedValue({
        id: 10,
        status: 'FILLED',
        datetime: new Date(),
      });

      const dto: CreateOrderDto = {
        instrumentId: 1,
        userId: 1,
        side: 'BUY',
        amount: 1000,
        type: 'MARKET',
      };

      const result = await service.placeOrder(dto);

      expect(result.status).toBe('FILLED');
      const createArg = (
        mockOrderModel.create.mock.calls[0] as unknown as Array<{
          size: number;
        }>
      )[0];
      expect(createArg.size).toBe(20);
    });

    it('rejects when no market data is available for the instrument', async () => {
      mockSequelize.query.mockResolvedValueOnce([]);

      mockOrderModel.create.mockResolvedValue({
        id: 11,
        status: 'REJECTED',
        datetime: new Date(),
      });

      const dto: CreateOrderDto = {
        instrumentId: 999,
        userId: 1,
        side: 'BUY',
        size: 10,
        type: 'MARKET',
      };

      const result = await service.placeOrder(dto);

      expect(result.status).toBe('REJECTED');
    });

    it('LIMIT SELL does not require cash balance', async () => {
      mockSequelize.query
        .mockResolvedValueOnce([{ balance: '0' }])
        .mockResolvedValueOnce([{ size: '10' }]);

      mockOrderModel.create.mockResolvedValue({
        id: 12,
        status: 'NEW',
        datetime: new Date(),
      });

      const dto: CreateOrderDto = {
        instrumentId: 1,
        userId: 1,
        side: 'SELL',
        size: 5,
        price: 110,
        type: 'LIMIT',
      };

      const result = await service.placeOrder(dto);

      expect(result.status).toBe('NEW');
    });

    it('rejects BUYs specifying both size and amount', async () => {
      await expect(
        service.placeOrder({
          userId: 1,
          side: 'BUY',
          instrumentId: 1,
          size: 5,
          amount: 500,
          type: 'MARKET',
        }),
      ).rejects.toThrow('not both');
    });

    it('rejects BUY with non-integer size', async () => {
      await expect(
        service.placeOrder({
          userId: 1,
          side: 'BUY',
          instrumentId: 1,
          size: 5.5,
          type: 'MARKET',
        }),
      ).rejects.toThrow('integer');
    });

    it('rejects CASH_IN without size', async () => {
      await expect(
        service.placeOrder({
          userId: 1,
          side: 'CASH_IN',
          type: 'MARKET',
        } as any),
      ).rejects.toThrow('size is required');
    });
  });
});

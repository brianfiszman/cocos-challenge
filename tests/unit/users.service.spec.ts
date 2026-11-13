import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { getModelToken } from '@nestjs/sequelize';
import { UserService } from '../../src/modules/users/users.service';
import { User } from '../../src/models/user.model';

describe('UserService', () => {
  let service: UserService;
  let mockSequelize: {
    query: jest.Mock;
  };
  let mockUserModel: {
    findByPk: jest.Mock;
  };

  beforeEach(async () => {
    mockSequelize = {
      query: jest.fn(),
    };

    mockUserModel = {
      findByPk: jest.fn().mockResolvedValue({ id: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: Sequelize, useValue: mockSequelize },
        { provide: getModelToken(User), useValue: mockUserModel },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('getPortfolio', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      mockUserModel.findByPk.mockResolvedValueOnce(null);

      await expect(service.getPortfolio(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockSequelize.query).not.toHaveBeenCalled();
    });

    it('returns empty portfolio when user has no orders', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ balance: '0' }]);
      mockSequelize.query.mockResolvedValueOnce([]);

      const result = await service.getPortfolio(1);

      expect(result.totalValue).toBe(0);
      expect(result.availableCash).toBe(0);
      expect(result.positions).toEqual([]);
    });

    it('calculates available cash from CASH_IN and CASH_OUT orders', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ balance: '500' }]);
      mockSequelize.query.mockResolvedValueOnce([]);

      const result = await service.getPortfolio(1);

      expect(result.availableCash).toBe(500);
      expect(result.totalValue).toBe(500);
    });

    it('calculates available cash with negative balance (CASH_OUT > CASH_IN)', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ balance: '-100' }]);
      mockSequelize.query.mockResolvedValueOnce([]);

      const result = await service.getPortfolio(1);

      expect(result.availableCash).toBe(-100);
    });

    it('builds positions with size, value, and returnPct from cost basis', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ balance: '1000' }]);
      mockSequelize.query.mockResolvedValueOnce([
        { instrumentId: 1, size: '10', buySize: '10', buyCost: '1000' },
      ]);
      mockSequelize.query.mockResolvedValueOnce([
        { close: '185.2', previousClose: '160' },
      ]);
      mockSequelize.query.mockResolvedValueOnce([
        { ticker: 'AAPL', name: 'Apple Inc.' },
      ]);

      const result = await service.getPortfolio(1);

      expect(result.positions).toHaveLength(1);
      expect(result.positions[0].instrumentId).toBe(1);
      expect(result.positions[0].ticker).toBe('AAPL');
      expect(result.positions[0].name).toBe('Apple Inc.');
      expect(result.positions[0].size).toBe(10);
      expect(result.positions[0].value).toBe(1852);
      expect(result.positions[0].returnPct).toBeCloseTo(85.2, 5);
      expect(result.positions[0].dailyReturnPct).toBeCloseTo(15.75, 5);
      expect(result.totalValue).toBe(2852);
    });

    it('handles multiple positions', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ balance: '1000' }]);
      mockSequelize.query.mockResolvedValueOnce([
        { instrumentId: 1, size: '10', buySize: '10', buyCost: '1000' },
        { instrumentId: 2, size: '5', buySize: '5', buyCost: '1000' },
      ]);
      mockSequelize.query.mockResolvedValueOnce([{ close: '100' }]);
      mockSequelize.query.mockResolvedValueOnce([
        { ticker: 'AAPL', name: 'Apple Inc.' },
      ]);
      mockSequelize.query.mockResolvedValueOnce([{ close: '200' }]);
      mockSequelize.query.mockResolvedValueOnce([
        { ticker: 'GOOGL', name: 'Alphabet Inc.' },
      ]);

      const result = await service.getPortfolio(1);

      expect(result.positions).toHaveLength(2);
      expect(result.positions[0].value).toBe(1000);
      expect(result.positions[1].value).toBe(1000);
      expect(result.totalValue).toBe(3000);
    });

    it('marks a position without market data and keeps it out of totalValue', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ balance: '500' }]);
      mockSequelize.query.mockResolvedValueOnce([
        { instrumentId: 1, size: '10', buySize: '10', buyCost: '1000' },
      ]);
      mockSequelize.query.mockResolvedValueOnce([]);
      mockSequelize.query.mockResolvedValueOnce([
        { ticker: 'NODATA', name: 'No Market Data Inc.' },
      ]);

      const result = await service.getPortfolio(1);

      expect(result.positions).toEqual([
        {
          instrumentId: 1,
          ticker: 'NODATA',
          name: 'No Market Data Inc.',
          size: 10,
          value: null,
          returnPct: null,
          dailyReturnPct: null,
          priceAvailable: false,
        },
      ]);
      expect(result.totalValue).toBe(500);
    });

    it('excludes positions with zero net size', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ balance: '0' }]);
      mockSequelize.query.mockResolvedValueOnce([]);

      const result = await service.getPortfolio(1);

      expect(result.positions).toEqual([]);
    });

    it('handles negative return when close is below cost basis', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ balance: '0' }]);
      mockSequelize.query.mockResolvedValueOnce([
        { instrumentId: 1, size: '10', buySize: '10', buyCost: '1000' },
      ]);
      mockSequelize.query.mockResolvedValueOnce([{ close: '90' }]);
      mockSequelize.query.mockResolvedValueOnce([
        { ticker: 'AAPL', name: 'Apple Inc.' },
      ]);

      const result = await service.getPortfolio(1);

      expect(result.positions[0].returnPct).toBeCloseTo(-10, 5);
    });

    it('returns null returnPct for a short position but keeps the daily return', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ balance: '0' }]);
      mockSequelize.query.mockResolvedValueOnce([
        { instrumentId: 1, size: '-5', buySize: '5', buyCost: '500' },
      ]);
      mockSequelize.query.mockResolvedValueOnce([
        { close: '90', previousClose: '100' },
      ]);
      mockSequelize.query.mockResolvedValueOnce([
        { ticker: 'AAPL', name: 'Apple Inc.' },
      ]);

      const result = await service.getPortfolio(1);
      const position = result.positions[0];

      expect(position.size).toBe(-5);
      expect(position.value).toBe(-450);
      expect(position.returnPct).toBeNull();
      expect(position.dailyReturnPct).toBeCloseTo(-10, 5);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { getModelToken } from '@nestjs/sequelize';
import { UserService } from '../../src/modules/users/users.service';
import { User } from '../../src/models/user.model';

describe('UserService', () => {
  let service: UserService;
  let mockSequelize: {
    query: jest.Mock;
  };

  beforeEach(async () => {
    mockSequelize = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: Sequelize, useValue: mockSequelize },
        { provide: getModelToken(User), useValue: {} },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('getPortfolio', () => {
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
      mockSequelize.query.mockResolvedValueOnce([{ close: '185.2' }]);
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
      expect(result.positions[0].returnPct).toBeCloseTo(0.852, 5);
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

      expect(result.positions[0].returnPct).toBeCloseTo(-0.1, 5);
    });
  });
});

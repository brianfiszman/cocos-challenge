import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { MarketDataService } from '../../src/modules/market-data/market-data.service';
import { Instrument } from '../../src/models/instrument.model';

describe('MarketDataService', () => {
  let service: MarketDataService;
  let mockInstrumentModel: {
    findAll: jest.Mock;
  };

  beforeEach(async () => {
    mockInstrumentModel = {
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketDataService,
        { provide: getModelToken(Instrument), useValue: mockInstrumentModel },
      ],
    }).compile();

    service = module.get<MarketDataService>(MarketDataService);
  });

  describe('search', () => {
    it('returns empty array when query is empty string', async () => {
      mockInstrumentModel.findAll.mockResolvedValue([]);

      const result = await service.search('');

      expect(result).toEqual([]);
      expect(mockInstrumentModel.findAll).not.toHaveBeenCalled();
    });

    it('returns empty array when query is whitespace only', async () => {
      mockInstrumentModel.findAll.mockResolvedValue([]);

      const result = await service.search('   ');

      expect(result).toEqual([]);
    });

    it('returns empty array when query is missing', async () => {
      mockInstrumentModel.findAll.mockResolvedValue([]);

      const result = await service.search(undefined as unknown as string);

      expect(result).toEqual([]);
    });

    it('searches by ticker', async () => {
      mockInstrumentModel.findAll.mockResolvedValue([
        {
          id: 1,
          ticker: 'AAPL',
          name: 'Apple Inc.',
          type: 'stock',
        },
      ]);

      const result = await service.search('aapl');

      expect(result).toHaveLength(1);
      expect(result[0].ticker).toBe('AAPL');
      expect(result[0].name).toBe('Apple Inc.');
      expect(result[0].type).toBe('stock');
      expect(mockInstrumentModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [Op.or]: expect.arrayContaining([
              expect.objectContaining({
                ticker: expect.objectContaining({
                  [Op.iLike]: expect.stringContaining('%aapl%'),
                }),
              }),
            ]),
          }),
          limit: 50,
        }),
      );
    });

    it('searches by name', async () => {
      mockInstrumentModel.findAll.mockResolvedValue([
        {
          id: 1,
          ticker: 'AAPL',
          name: 'Apple Inc.',
          type: 'stock',
        },
      ]);

      const result = await service.search('apple');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Apple Inc.');
    });

    it('searches by partial ticker or name', async () => {
      mockInstrumentModel.findAll.mockResolvedValue([
        {
          id: 1,
          ticker: 'AAPL',
          name: 'Apple Inc.',
          type: 'stock',
        },
        {
          id: 2,
          ticker: 'GOOGL',
          name: 'Alphabet Inc.',
          type: 'stock',
        },
      ]);

      const result = await service.search('app');

      expect(result).toHaveLength(2);
    });

    it('returns empty array when no matches found', async () => {
      mockInstrumentModel.findAll.mockResolvedValue([]);

      const result = await service.search('zzzznomatch');

      expect(result).toEqual([]);
    });

    it('limits results to 50', async () => {
      mockInstrumentModel.findAll.mockResolvedValue([]);

      await service.search('a');

      expect(mockInstrumentModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
        }),
      );
    });

    it('trims whitespace from query before searching', async () => {
      mockInstrumentModel.findAll.mockResolvedValue([]);

      await service.search('  aapl  ');

      expect(mockInstrumentModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [Op.or]: expect.arrayContaining([
              expect.objectContaining({
                ticker: expect.objectContaining({
                  [Op.iLike]: '%aapl%',
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });
});

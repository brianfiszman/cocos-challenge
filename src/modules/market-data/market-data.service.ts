import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Instrument } from '../../models/instrument.model';

export interface AssetItem {
  id: number;
  ticker: string;
  name: string;
  type: string;
}

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  constructor(
    @InjectModel(Instrument)
    private readonly instrumentModel: typeof Instrument,
  ) {}

  async search(query: string): Promise<AssetItem[]> {
    this.logger.log(`search query="${query}"`);
    const trimmed = (query ?? '').trim();
    if (trimmed.length === 0) {
      return [];
    }

    const pattern = `%${trimmed}%`;

    const rows = await this.instrumentModel.findAll({
      where: {
        [Op.or]: [
          { ticker: { [Op.iLike]: pattern } },
          { name: { [Op.iLike]: pattern } },
        ],
      },
      limit: 50,
    });

    return rows.map((r) => ({
      id: r.id,
      ticker: r.ticker,
      name: r.name,
      type: r.type,
    }));
  }
}

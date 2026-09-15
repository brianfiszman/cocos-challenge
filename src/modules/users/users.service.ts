import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { User } from '../../models/user.model';

export interface PositionItem {
  instrumentId: number;
  ticker: string;
  name: string;
  size: number;
  value: number;
  returnPct: number;
}

export interface PortfolioResult {
  totalValue: number;
  availableCash: number;
  positions: PositionItem[];
}

interface PositionRow {
  instrumentId: number;
  size: string;
  buySize: string;
  buyCost: string;
}

interface PriceRow {
  close: string;
}

interface InstrumentRow {
  ticker: string;
  name: string;
}
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    private readonly sequelize: Sequelize,
  ) {}

  async getPortfolio(userId: number): Promise<PortfolioResult> {
    this.logger.log(`getPortfolio userId=${userId}`);
    const cash = await this.getCashBalance(userId);
    const positions = await this.buildPositions(userId);

    const totalValue = cash + positions.reduce((sum, p) => sum + p.value, 0);

    return {
      totalValue,
      availableCash: cash,
      positions,
    };
  }

  private async buildPositions(userId: number): Promise<PositionItem[]> {
    const rows = await this.sequelize.query<PositionRow>(
      `SELECT
         o."instrumentId" AS "instrumentId",
         SUM(CASE WHEN o.side = 'BUY' THEN o.size
                  WHEN o.side = 'SELL' THEN -o.size
                  ELSE 0 END) AS "size",
         SUM(CASE WHEN o.side = 'BUY' THEN o.size END) AS "buySize",
         SUM(CASE WHEN o.side = 'BUY' THEN o.size * o.price END) AS "buyCost"
       FROM orders o
       WHERE o."userId" = :userId AND o.status = 'FILLED'
         AND o.side IN ('BUY', 'SELL')
       GROUP BY o."instrumentId"
       HAVING SUM(CASE WHEN o.side = 'BUY' THEN o.size
                   WHEN o.side = 'SELL' THEN -o.size
                   ELSE 0 END) <> 0`,
      { replacements: { userId }, type: QueryTypes.SELECT },
    );

    const result: PositionItem[] = [];

    for (const row of rows) {
      const instrumentId: number = Number(row.instrumentId);
      const size: number = Number(row.size);

      const priceRows = await this.sequelize.query<PriceRow>(
        `SELECT close FROM marketdata
         WHERE "instrumentId" = :instrumentId
         ORDER BY datetime DESC LIMIT 1`,
        { replacements: { instrumentId }, type: QueryTypes.SELECT },
      );
      const close: number =
        priceRows.length > 0 ? Number(priceRows[0].close) : 0;

      const instrumentRows = await this.sequelize.query<InstrumentRow>(
        `SELECT ticker, name FROM instruments WHERE id = :instrumentId LIMIT 1`,
        { replacements: { instrumentId }, type: QueryTypes.SELECT },
      );
      const ticker: string =
        instrumentRows.length > 0 ? instrumentRows[0].ticker : '';
      const name: string =
        instrumentRows.length > 0 ? instrumentRows[0].name : '';

      const value: number = size * close;
      const buySize: number = Number(row.buySize);
      const buyCost: number = Number(row.buyCost);
      let returnPct = 0;
      if (size > 0 && buySize > 0) {
        const avgCost = buyCost / buySize;
        const costBasis = size * avgCost;
        if (costBasis > 0) {
          returnPct = (value - costBasis) / costBasis;
        }
      }

      result.push({
        instrumentId,
        ticker,
        name,
        size,
        value,
        returnPct,
      });
    }

    return result;
  }

  private async getCashBalance(userId: number): Promise<number> {
    const rows = await this.sequelize.query<{ balance: string }>(
      `SELECT COALESCE(
         SUM(CASE WHEN side = 'CASH_IN' THEN size
                  WHEN side = 'CASH_OUT' THEN -size
                  WHEN side = 'BUY' THEN -(size * price)
                  WHEN side = 'SELL' THEN (size * price)
                  ELSE 0 END), 0) AS balance
       FROM orders
       WHERE "userId" = :userId AND status = 'FILLED'`,
      { replacements: { userId }, type: QueryTypes.SELECT },
    );
    if (rows.length === 0) {
      return 0;
    }
    return Number(rows[0].balance);
  }
}

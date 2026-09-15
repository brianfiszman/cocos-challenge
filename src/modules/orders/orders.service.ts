import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Transaction, QueryTypes } from 'sequelize';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from '../../models/order.model';
import { Instrument } from '../../models/instrument.model';

export interface CreateOrderResult {
  id: number;
  status: 'NEW' | 'FILLED' | 'REJECTED' | 'CANCELLED';
  datetime: Date;
}

interface CashRow {
  balance: string;
}

interface PositionRow {
  instrumentId: number;
  size: string;
}

interface MarketPriceRow {
  close: string;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectModel(Order) private readonly orderModel: typeof Order,
    @InjectModel(Instrument)
    private readonly instrumentModel: typeof Instrument,
    private readonly sequelize: Sequelize,
  ) {}

  async placeOrder(_orderData: CreateOrderDto): Promise<CreateOrderResult> {
    const { side, type = 'MARKET', size, amount } = _orderData;

    if (side === 'CASH_IN' || side === 'CASH_OUT') {
      if (size == null) {
        throw new BadRequestException('size is required for cash transfers');
      }
      return this.placeCashTransfer(_orderData);
    }

    if (size != null && amount != null) {
      throw new BadRequestException(
        'Only one of size or amount may be provided, not both',
      );
    }
    if (size != null && !Number.isInteger(size)) {
      throw new BadRequestException(
        'size must be an integer for BUY/SELL orders',
      );
    }

    return this.placeTradeOrder(_orderData, type);
  }

  private async placeCashTransfer(
    dto: CreateOrderDto,
  ): Promise<CreateOrderResult> {
    const { side, userId, size: amount } = dto;
    if (amount == null) {
      throw new BadRequestException('size is required for cash transfers');
    }
    const arsInstrument = await this.instrumentModel.findOne({
      where: { ticker: 'ARS' },
    });
    if (!arsInstrument) {
      throw new InternalServerErrorException('ARS instrument not configured');
    }
    const instrumentId = Number(arsInstrument.id);
    const t = await this.sequelize.transaction();

    try {
      const balance = await this.getCashBalance(userId, t);

      if (side === 'CASH_OUT' && Number(balance) < amount) {
        const order = await this.orderModel.create(
          {
            userId,
            side,
            size: amount,
            price: null,
            type: 'MARKET',
            status: 'REJECTED',
            datetime: new Date(),
            instrumentId,
          },
          { transaction: t },
        );
        await t.commit();
        return {
          id: order.id,
          status: 'REJECTED',
          datetime: order.datetime,
        };
      }

      const order = await this.orderModel.create(
        {
          userId,
          side,
          size: amount,
          price: null,
          type: 'MARKET',
          status: 'FILLED',
          datetime: new Date(),
          instrumentId,
        },
        { transaction: t },
      );

      await t.commit();

      this.logger.log(
        `Cash transfer ${side} for user ${userId}, amount=${amount}`,
      );

      return {
        id: order.id,
        status: 'FILLED',
        datetime: order.datetime,
      };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  private async placeTradeOrder(
    dto: CreateOrderDto,
    type: 'MARKET' | 'LIMIT',
  ): Promise<CreateOrderResult> {
    const { side, userId, price } = dto;
    const instrumentId = dto.instrumentId;
    if (instrumentId == null) {
      throw new BadRequestException(
        'instrumentId is required for BUY/SELL orders',
      );
    }

    let executionPrice: number;
    if (type === 'MARKET') {
      const marketPrice = await this.getLatestClose(instrumentId);
      if (marketPrice === null) {
        return this.saveRejected(
          dto,
          'No market data available',
          dto.size ?? dto.amount ?? 0,
          null,
        );
      }
      executionPrice = marketPrice;
    } else {
      if (price == null) {
        throw new BadRequestException('LIMIT orders require a price');
      }
      executionPrice = price;
    }

    const size = this.resolveSize(dto, executionPrice);

    const t = await this.sequelize.transaction();

    try {
      const balance = await this.getCashBalance(userId, t);

      if (side === 'BUY' && Number(balance) < size * executionPrice) {
        await t.rollback();
        return this.saveRejected(
          dto,
          'Insufficient cash',
          size,
          executionPrice,
        );
      }

      if (side === 'SELL') {
        const position = await this.getPosition(userId, instrumentId, t);
        if (Number(position) < size) {
          await t.rollback();
          return this.saveRejected(
            dto,
            'Insufficient shares',
            size,
            executionPrice,
          );
        }
      }

      const orderStatus: 'NEW' | 'FILLED' =
        type === 'MARKET' ? 'FILLED' : 'NEW';

      const order = await this.orderModel.create(
        {
          userId,
          instrumentId,
          side,
          size,
          price: executionPrice,
          type,
          status: orderStatus,
          datetime: new Date(),
        },
        { transaction: t },
      );

      await t.commit();

      this.logger.log(
        `Order ${order.id} placed: ${side} ${size} @ ${executionPrice} ` +
          `(${orderStatus})`,
      );

      return {
        id: order.id,
        status: orderStatus,
        datetime: order.datetime,
      };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  private async saveRejected(
    dto: CreateOrderDto,
    _reason: string,
    resolvedSize: number,
    resolvedPrice: number | null,
  ): Promise<CreateOrderResult> {
    const order = await this.orderModel.create({
      userId: dto.userId,
      side: dto.side,
      size: resolvedSize,
      price: resolvedPrice,
      type: dto.type ?? 'MARKET',
      status: 'REJECTED',
      datetime: new Date(),
      instrumentId: dto.instrumentId!,
    });
    this.logger.log(`Order ${order.id} REJECTED: ${_reason}`);
    return {
      id: order.id,
      status: 'REJECTED',
      datetime: order.datetime,
    };
  }

  private resolveSize(dto: CreateOrderDto, price: number): number {
    if (dto.size != null) {
      return dto.size;
    }
    if (dto.amount != null) {
      const size = Math.floor(dto.amount / price);
      if (size < 1) {
        throw new BadRequestException(
          'Amount too small to purchase at least 1 share',
        );
      }
      return size;
    }
    throw new BadRequestException('Either size or amount must be provided');
  }

  private async getLatestClose(instrumentId: number): Promise<number | null> {
    const rows = await this.sequelize.query<MarketPriceRow>(
      `SELECT close FROM marketdata
       WHERE "instrumentId" = :instrumentId
       ORDER BY datetime DESC
       LIMIT 1`,
      {
        replacements: { instrumentId },
        type: QueryTypes.SELECT,
      },
    );
    if (rows.length === 0) {
      return null;
    }
    return Number(rows[0].close);
  }

  private async getCashBalance(
    userId: number,
    transaction: Transaction,
  ): Promise<string> {
    const rows = await this.sequelize.query<CashRow>(
      `SELECT COALESCE(
         SUM(CASE WHEN side = 'CASH_IN' THEN size
                  WHEN side = 'CASH_OUT' THEN -size
                  WHEN side = 'BUY' THEN -(size * price)
                  WHEN side = 'SELL' THEN (size * price)
                  ELSE 0 END), 0) AS balance
       FROM orders
       WHERE "userId" = :userId AND status = 'FILLED'`,
      { replacements: { userId }, transaction, type: QueryTypes.SELECT },
    );
    if (rows.length === 0) {
      return '0';
    }
    return rows[0].balance;
  }

  private async getPosition(
    userId: number,
    instrumentId: number,
    transaction: Transaction,
  ): Promise<string> {
    const rows = await this.sequelize.query<PositionRow>(
      `SELECT COALESCE(
          SUM(CASE WHEN side = 'BUY' THEN size
                   WHEN side = 'SELL' THEN -size
                   ELSE 0 END), 0) AS size
        FROM orders
        WHERE "userId" = :userId
          AND "instrumentId" = :instrumentId
          AND status = 'FILLED'`,
      {
        replacements: { userId, instrumentId },
        transaction,
        type: QueryTypes.SELECT,
      },
    );
    if (rows.length === 0) {
      return '0';
    }
    return rows[0].size;
  }

  async cancelOrder(id: number): Promise<boolean> {
    const order = await this.orderModel.findByPk(id);
    if (!order || order.status.toUpperCase() !== 'NEW') {
      return false;
    }
    order.status = 'CANCELLED';
    await order.save();
    return true;
  }
}

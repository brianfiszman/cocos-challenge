import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
  AllowNull,
  Default,
  ForeignKey,
  Index,
} from 'sequelize-typescript';
import { Optional } from 'sequelize';
import { User } from './user.model';
import { Instrument } from './instrument.model';

interface OrderAttributes {
  id: number;
  instrumentId: number;
  userId: number;
  side: 'BUY' | 'SELL' | 'CASH_IN' | 'CASH_OUT';
  size: number;
  price: number | null;
  type: 'MARKET' | 'LIMIT';
  status: 'NEW' | 'FILLED' | 'REJECTED' | 'CANCELLED';
  datetime: Date;
}

type OrderCreationAttributes = Optional<OrderAttributes, 'id'>;

@Table({
  tableName: 'orders',
  timestamps: true,
  paranoid: true,
})
export class Order extends Model<OrderAttributes, OrderCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @AllowNull(false)
  @ForeignKey(() => Instrument)
  @Column(DataType.BIGINT)
  declare instrumentId: number;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.BIGINT)
  declare userId: number;

  @AllowNull(false)
  @Default('BUY')
  @Column(DataType.ENUM('BUY', 'SELL', 'CASH_IN', 'CASH_OUT'))
  declare side: string;

  @AllowNull(false)
  @Column(DataType.DECIMAL(18, 8))
  declare size: number;

  @AllowNull(true)
  @Column(DataType.DECIMAL(18, 8))
  declare price: number | null;

  @AllowNull(false)
  @Default('MARKET')
  @Column(DataType.ENUM('MARKET', 'LIMIT'))
  declare type: string;

  @AllowNull(false)
  @Default('NEW')
  @Column(DataType.ENUM('NEW', 'FILLED', 'REJECTED', 'CANCELLED'))
  declare status: string;

  @AllowNull(false)
  @Index
  @Column(DataType.DATE)
  declare datetime: Date;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @DeletedAt
  @Column(DataType.DATE)
  declare deletedAt: Date | null;
}

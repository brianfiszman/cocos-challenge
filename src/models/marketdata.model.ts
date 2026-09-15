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
  ForeignKey,
  Index,
} from 'sequelize-typescript';
import { Optional } from 'sequelize';
import { Instrument } from './instrument.model';

interface MarketDataAttributes {
  id: number;
  instrumentId: number;
  high: number;
  low: number;
  open: number;
  close: number;
  previousClose: number;
  datetime: Date;
}

type MarketDataCreationAttributes = Optional<MarketDataAttributes, 'id'>;

@Table({
  tableName: 'marketdata',
  timestamps: true,
  paranoid: true,
})
export class MarketData extends Model<
  MarketDataAttributes,
  MarketDataCreationAttributes
> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @AllowNull(false)
  @ForeignKey(() => Instrument)
  @Column(DataType.BIGINT)
  declare instrumentId: number;

  @AllowNull(false)
  @Column(DataType.DECIMAL(18, 8))
  declare high: number;

  @AllowNull(false)
  @Column(DataType.DECIMAL(18, 8))
  declare low: number;

  @AllowNull(false)
  @Column(DataType.DECIMAL(18, 8))
  declare open: number;

  @AllowNull(false)
  @Column(DataType.DECIMAL(18, 8))
  declare close: number;

  @AllowNull(false)
  @Column(DataType.DECIMAL(18, 8))
  declare previousClose: number;

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

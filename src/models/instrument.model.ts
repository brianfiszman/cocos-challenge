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
  Unique,
  Length,
  Default,
} from 'sequelize-typescript';
import { Optional } from 'sequelize';

interface InstrumentAttributes {
  id: number;
  ticker: string;
  name: string;
  type: string;
}

type InstrumentCreationAttributes = Optional<InstrumentAttributes, 'id'>;

@Table({
  tableName: 'instruments',
  timestamps: true,
  paranoid: true,
})
export class Instrument extends Model<
  InstrumentAttributes,
  InstrumentCreationAttributes
> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @AllowNull(false)
  @Unique
  @Length({ min: 1, max: 10 })
  @Column(DataType.STRING(10))
  declare ticker: string;

  @AllowNull(false)
  @Length({ min: 1, max: 255 })
  @Column(DataType.STRING(255))
  declare name: string;

  @AllowNull(false)
  @Default('stock')
  @Length({ min: 1, max: 50 })
  @Column(DataType.STRING(50))
  declare type: string;

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

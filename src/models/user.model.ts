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
  IsEmail,
  Length,
} from 'sequelize-typescript';
import { Optional } from 'sequelize';

interface UserAttributes {
  id: number;
  email: string;
  accountNumber: string;
}

type UserCreationAttributes = Optional<UserAttributes, 'id'>;

@Table({
  tableName: 'users',
  timestamps: true,
  paranoid: true,
})
export class User extends Model<UserAttributes, UserCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @AllowNull(false)
  @Unique
  @IsEmail
  @Column(DataType.STRING(255))
  declare email: string;

  @AllowNull(false)
  @Unique
  @Length({ min: 1, max: 50 })
  @Column(DataType.STRING(50))
  declare accountNumber: string;

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

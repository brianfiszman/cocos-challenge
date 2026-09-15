import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from 'class-validator';

export class CreateOrderDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(999999)
  instrumentId?: number;

  @IsNumber()
  @Min(1)
  @Max(999999)
  userId!: number;

  @IsEnum(['BUY', 'SELL', 'CASH_IN', 'CASH_OUT'])
  side!: 'BUY' | 'SELL' | 'CASH_IN' | 'CASH_OUT';

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(100000000)
  size?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(100000000)
  amount?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(100000000)
  price?: number | null;

  @IsOptional()
  @IsEnum(['MARKET', 'LIMIT'])
  type?: 'MARKET' | 'LIMIT';
}

import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { databaseConfig } from './database.config';
import {
  associateModels,
  User,
  Instrument,
  Order,
  MarketData,
} from '../models';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env.development', '.env.test', '.env'],
    }),
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: databaseConfig,
    }),
    SequelizeModule.forFeature([User, Instrument, Order, MarketData]),
  ],
  exports: [SequelizeModule],
})
export class DatabaseModule implements OnModuleInit {
  onModuleInit(): void {
    associateModels();
  }
}

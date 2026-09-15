import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { OrdersModule } from './modules/orders/orders.module';
import { UsersModule } from './modules/users/users.module';
import { MarketDataModule } from './modules/market-data/market-data.module';

@Module({
  imports: [DatabaseModule, OrdersModule, UsersModule, MarketDataModule],
})
export class AppModule {}

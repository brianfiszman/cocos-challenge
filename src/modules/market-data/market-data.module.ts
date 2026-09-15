import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MarketDataService } from './market-data.service';
import { MarketDataController } from './market-data.controllers';

@Module({
  imports: [DatabaseModule],
  controllers: [MarketDataController],
  providers: [MarketDataService],
})
export class MarketDataModule {}

import { Controller, Get, Query } from '@nestjs/common';
import { MarketDataService, AssetItem } from './market-data.service';

@Controller('assets')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Get()
  async search(@Query('q') query: string): Promise<AssetItem[]> {
    return this.marketDataService.search(query);
  }
}

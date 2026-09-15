import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { UserService, PortfolioResult } from './users.service';

@Controller('portfolio')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':userId')
  async getPortfolio(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<PortfolioResult> {
    return this.userService.getPortfolio(userId);
  }
}

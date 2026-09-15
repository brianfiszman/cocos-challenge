import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OrderService } from './orders.service';
import { OrderController } from './order.controllers';

@Module({
  imports: [DatabaseModule],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrdersModule {}

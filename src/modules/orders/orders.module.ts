import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OrderService } from './orders.service';
import { UserLockService } from './user-lock.service';
import { OrderController } from './order.controllers';

@Module({
  imports: [DatabaseModule],
  controllers: [OrderController],
  providers: [OrderService, UserLockService],
})
export class OrdersModule {}

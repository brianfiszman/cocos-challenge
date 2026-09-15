import {
  Controller,
  Post,
  Body,
  Param,
  Patch,
  ParseIntPipe,
} from '@nestjs/common';
import { OrderService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  createOrder(@Body() orderData: CreateOrderDto) {
    return this.orderService.placeOrder(orderData);
  }

  @Patch(':id/cancel')
  async cancelOrder(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ cancelled: boolean }> {
    const cancelled = await this.orderService.cancelOrder(id);
    return { cancelled };
  }
}

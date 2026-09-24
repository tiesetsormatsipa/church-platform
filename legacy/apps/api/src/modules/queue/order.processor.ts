import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrdersService } from '../marketplace/orders.service';

@Processor('order-processing')
export class OrderProcessor {
  private readonly logger = new Logger(OrderProcessor.name);
  constructor(private prisma: PrismaService, private ordersService: OrdersService) {}

  @Process('generate-receipt')
  async handleGenerateReceipt(job: Job<{ orderId: string }>) {
    this.logger.log(`Generating receipt for order ${job.data.orderId}`);
    await this.ordersService.generateOrderReceipt(job.data.orderId);
  }
}

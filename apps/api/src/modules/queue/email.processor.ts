import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EmailAdapter } from '../email/email.adapter';

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
  constructor(private prisma: PrismaService, private email: EmailAdapter) {}

  @Process('send-order-confirmation')
  async handleOrderConfirmation(job: Job<{ orderId: string; documentId: string }>) {
    const { orderId } = job.data;
    this.logger.log(`Sending confirmation for order ${orderId}`);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { subOrders: { include: { store: true, items: { include: { product: true } } } } },
    });
    if (!order) return;
    const buyer = await this.prisma.user.findUnique({ where: { id: order.buyerId }, include: { profile: true } });
    if (!buyer?.email) return;
    await this.email.sendFromTemplate('order-confirmation', buyer.email, {
      orderNumber: order.id.slice(0, 8).toUpperCase(),
      buyerName: `${buyer.profile?.firstName} ${buyer.profile?.surname}`,
      totalAmount: `R${Number(order.totalAmount).toFixed(2)}`,
      orderDate: new Date().toLocaleDateString('en-ZA', { dateStyle: 'long' }),
      paymentStatus: order.paymentStatus,
      viewOrderUrl: `${process.env.FRONTEND_URL}/profile/orders/${orderId}`,
    }, { orderId });
  }
}

import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../admin/audit.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    @InjectQueue('order-processing') private orderQueue: Queue,
    @InjectQueue('email') private emailQueue: Queue,
  ) {}

  async createOrder(buyerId: string, tenantId: string, items: any[]) {
    const storeGroups = new Map<string, any[]>();
    for (const item of items) {
      const product = await this.prisma.product.findUnique({ where: { id: item.productId }, include: { store: true } });
      if (!product) continue;
      if (!storeGroups.has(product.storeId)) storeGroups.set(product.storeId, []);
      storeGroups.get(product.storeId)!.push({ ...item, product });
    }
    const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({ data: { buyerId, tenantId, totalAmount, status: 'PENDING', paymentStatus: 'PENDING', currency: 'ZAR' } });
      await tx.paymentIntentStub.create({ data: { orderId: newOrder.id, amount: totalAmount, currency: 'ZAR', provider: 'STUB' } });

      for (const [storeId, storeItems] of storeGroups.entries()) {
        const subTotal = storeItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
        const conversation = await tx.conversation.create({
          data: {
            type: 'ORDER', orderId: newOrder.id,
            title: `Order #${newOrder.id.slice(0, 8)}`,
            participants: {
              create: [
                { userId: buyerId },
                ...(storeItems[0].product.store?.userId ? [{ userId: storeItems[0].product.store.userId }] : []),
              ],
            },
          },
        });
        await tx.subOrder.create({
          data: {
            orderId: newOrder.id, storeId, totalAmount: subTotal, status: 'PENDING',
            conversationId: conversation.id,
            items: { create: storeItems.map((i: any) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.quantity * i.unitPrice })) },
          },
        });
      }
      return newOrder;
    });

    await this.audit.log({ userId: buyerId, action: 'CREATE', entityType: 'Order', entityId: order.id, metadata: { totalAmount, storeCount: storeGroups.size } });
    return order;
  }

  async getMyOrders(buyerId: string) {
    return this.prisma.order.findMany({
      where: { buyerId },
      include: {
        subOrders: {
          include: {
            store: { select: { id: true, name: true } },
            items: { include: { product: { select: { id: true, title: true } } } },
          },
        },
        document: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderById(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        subOrders: {
          include: {
            store: { select: { id: true, name: true, slug: true, userId: true } },
            items: { include: { product: { include: { images: { include: { mediaAsset: true }, take: 1 } } } } },
          },
        },
        document: true,
        emailLogs: true,
      },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found.`);
    const isBuyer = order.buyerId === userId;
    const isSeller = order.subOrders.some((s: any) => s.store?.userId === userId);
    if (!isBuyer && !isSeller) throw new ForbiddenException('Access denied.');
    return order;
  }

  async confirmPayment(orderId: string, confirmedBy: string) {
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'COMPLETED', status: 'CONFIRMED' },
      include: { subOrders: { include: { store: true, items: { include: { product: true } } } } },
    });
    await this.prisma.paymentIntentStub.update({ where: { orderId }, data: { status: 'COMPLETED' } });
    await this.orderQueue.add('generate-receipt', { orderId }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
    await this.audit.log({ userId: confirmedBy, action: 'UPDATE', entityType: 'Order', entityId: orderId, newValue: 'PAYMENT_CONFIRMED' });
    return order;
  }

  async generateOrderReceipt(orderId: string): Promise<string> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { subOrders: { include: { store: { include: { user: { include: { profile: true } } } }, items: { include: { product: true } } } } },
    });
    if (!order) throw new Error(`Order ${orderId} not found`);

    const doc = await this.prisma.generatedOrderDocument.upsert({
      where: { orderId },
      update: { status: 'GENERATED', generatedAt: new Date() },
      create: { orderId, status: 'GENERATED' },
    });

    await this.emailQueue.add('send-order-confirmation', { orderId, documentId: doc.id }, { attempts: 5, backoff: { type: 'exponential', delay: 3000 } });
    return doc.id;
  }
}

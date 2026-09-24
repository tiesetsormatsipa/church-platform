import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../admin/audit.service';

@Injectable()
export class MarketplaceService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async getCategories() {
    return this.prisma.productCategory.findMany({ where: { parentId: null }, include: { children: true }, orderBy: { name: 'asc' } });
  }

  async findProducts(filters: { search?: string; categoryId?: string; storeId?: string; page?: number; limit?: number; status?: string; tenantId?: string }) {
    const { search, categoryId, storeId, page = 1, limit = 16, status = 'PUBLISHED', tenantId } = filters;
    const where: any = {
      status: status as any, deletedAt: null,
      ...(storeId && { storeId }),
      ...(categoryId && { categoryId }),
      ...(tenantId && { store: { tenantId } }),
      ...(search && { OR: [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] }),
    };
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          store:    { select: { id: true, name: true, slug: true } },
          category: { select: { id: true, name: true } },
          images:   { include: { mediaAsset: { select: { url: true } } }, orderBy: { order: 'asc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { data: products, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findProductById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id, deletedAt: null },
      include: {
        store:    { include: { user: { include: { profile: { select: { firstName: true, surname: true } } } } } },
        category: true,
        images:   { include: { mediaAsset: true }, orderBy: { order: 'asc' } },
        approval: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  async createProduct(data: any, userId: string) {
    const store = await this.prisma.marketplaceStore.findUnique({ where: { userId } });
    if (!store) throw new ForbiddenException('You need an approved store to list products.');
    if (store.status !== 'PUBLISHED') throw new ForbiddenException('Your store is not yet approved.');
    const product = await this.prisma.product.create({ data: { ...data, storeId: store.id, status: 'PENDING_REVIEW' } });
    await this.prisma.productApproval.create({ data: { productId: product.id, status: 'PENDING_REVIEW' } });
    await this.audit.log({ userId, action: 'CREATE', entityType: 'Product', entityId: product.id });
    return product;
  }

  async approveProduct(productId: string, reviewerId: string, notes?: string) {
    await this.prisma.$transaction([
      this.prisma.productApproval.update({ where: { productId }, data: { status: 'PUBLISHED', reviewedBy: reviewerId, reviewedAt: new Date(), notes } }),
      this.prisma.product.update({ where: { id: productId }, data: { status: 'PUBLISHED' } }),
    ]);
    await this.audit.log({ userId: reviewerId, action: 'APPROVE', entityType: 'Product', entityId: productId });
    return { success: true };
  }

  async getMyStore(userId: string) {
    return this.prisma.marketplaceStore.findUnique({
      where: { userId },
      include: {
        products: { where: { deletedAt: null }, include: { images: { include: { mediaAsset: true }, take: 1 }, _count: { select: { orderItems: true } } } },
        _count: { select: { subOrders: true } },
      },
    });
  }

  async createStore(data: any, userId: string) {
    const existing = await this.prisma.marketplaceStore.findUnique({ where: { userId } });
    if (existing) throw new ForbiddenException('You already have a store.');
    const store = await this.prisma.marketplaceStore.create({ data: { ...data, userId, status: 'PENDING_REVIEW', verificationStatus: 'PENDING' } });
    await this.audit.log({ userId, action: 'CREATE', entityType: 'MarketplaceStore', entityId: store.id });
    return store;
  }

  async getPendingProducts() {
    return this.prisma.product.findMany({
      where: { status: 'PENDING_REVIEW' },
      include: { store: { select: { name: true } }, approval: true, images: { include: { mediaAsset: true }, take: 1 } },
      orderBy: { createdAt: 'asc' },
    });
  }
}

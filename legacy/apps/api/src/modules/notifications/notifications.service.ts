import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(data: { userId: string; type: string; title: string; body: string; data?: any }) {
    return this.prisma.notification.create({
      data: { userId: data.userId, type: data.type as any, title: data.title, body: data.body, data: data.data },
    });
  }

  async getUserNotifications(userId: string, page = 1, limit = 30) {
    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { data: notifications, meta: { page, limit, total, totalPages: Math.ceil(total / limit), unreadCount } };
  }

  async markRead(notificationId: string, userId: string) {
    await this.prisma.notification.update({ where: { id: notificationId }, data: { isRead: true, readAt: new Date() } });
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
    return { success: true };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }
}

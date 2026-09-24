import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseClient, Prisma } from '@church/database';
import type {
  MarkNotificationsRead,
  NotificationDto,
  NotificationsPage,
  NotificationsQuery,
  NotificationsUnread,
} from '@church/shared';
import type { z } from 'zod';
import { Errors } from '../../common/http/errors.js';
import type { Principal } from '../../common/principal.js';
import { DATABASE } from '../../infrastructure/tokens.js';

const NOTIFICATION_SELECT = {
  id: true,
  category: true,
  title: true,
  body: true,
  url: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof NOTIFICATION_SELECT }>;

function toDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    url: row.url,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Keyset cursor over (createdAt desc, id desc), matching the notifications index. */
function encodeCursor(row: NotificationRow): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const [timestamp, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const createdAt = timestamp ? new Date(timestamp) : new Date(Number.NaN);
  if (!id || Number.isNaN(createdAt.getTime()))
    throw Errors.badRequest('invalid_cursor', 'That page link is no longer valid.');
  return { createdAt, id };
}

@Injectable()
export class NotificationsService {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  async list(
    principal: Principal,
    query: z.output<typeof NotificationsQuery>,
  ): Promise<NotificationsPage> {
    const where: Prisma.NotificationWhereInput = {
      userId: principal.userId,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };
    if (query.cursor) {
      const { createdAt, id } = decodeCursor(query.cursor);
      where.OR = [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }];
    }

    const [rows, unread] = await Promise.all([
      this.db.notification.findMany({
        where,
        select: NOTIFICATION_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
      }),
      this.db.notification.count({ where: { userId: principal.userId, readAt: null } }),
    ]);

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items.at(-1);
    return {
      items: items.map(toDto),
      nextCursor: hasMore && last ? encodeCursor(last) : null,
      unread,
    };
  }

  async unreadCount(principal: Principal): Promise<NotificationsUnread> {
    const unread = await this.db.notification.count({
      where: { userId: principal.userId, readAt: null },
    });
    return { unread };
  }

  /** Marks the given notifications read, or all of them. Always scoped to the caller. */
  async markRead(
    principal: Principal,
    input: z.output<typeof MarkNotificationsRead>,
  ): Promise<NotificationsUnread> {
    await this.db.notification.updateMany({
      where: {
        userId: principal.userId,
        readAt: null,
        ...(input.ids ? { id: { in: input.ids } } : {}),
      },
      data: { readAt: new Date() },
    });
    return this.unreadCount(principal);
  }
}

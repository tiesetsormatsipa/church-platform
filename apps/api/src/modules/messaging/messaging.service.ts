/**
 * Messaging between members.
 *
 * Ported from the old platform, which had conversations, participants and messages. Who may
 * write to whom is deliberately narrow: you can reach someone who worships at a branch you
 * belong to, and nobody else. A church-wide list of every member's name and picture is
 * exactly the thing that should not be handed to anyone who signs up.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseClient, Prisma } from '@church/database';
import { JobProducer } from '@church/infrastructure/queue';
import type {
  ConversationList,
  ConversationsQuery,
  ConversationSummary,
  DirectoryList,
  DirectoryQuery,
  MessageDto,
  MessagePerson,
  MessageResult,
  MessagesPage,
  MessagesQuery,
  SendMessageRequest,
  StartConversation,
  UnreadMessages,
} from '@church/shared';
import type { z } from 'zod';
import { Errors } from '../../common/http/errors.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { DATABASE } from '../../infrastructure/tokens.js';
import { MEDIA_URL_SELECT, MediaUrlService } from '../core/media-urls.service.js';
import { OrganizationService } from '../core/organization.service.js';

const PERSON_SELECT = {
  id: true,
  profile: {
    select: {
      firstName: true,
      lastName: true,
      displayName: true,
      avatarMedia: { select: MEDIA_URL_SELECT },
    },
  },
} satisfies Prisma.UserSelect;

type PersonRow = Prisma.UserGetPayload<{ select: typeof PERSON_SELECT }>;

/** Two member ids in a fixed order, so both sides compute the same key for one thread. */
export function directKey(a: string, b: string): string {
  return [a, b].sort().join('-');
}

/** Keyset cursor over (createdAt desc, id desc), matching the messages index. */
function encodeCursor(row: { createdAt: Date; id: string }): string {
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
export class MessagingService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly organizations: OrganizationService,
    private readonly media: MediaUrlService,
    private readonly jobs: JobProducer,
  ) {}

  // -------------------------------------------------------------------------------------
  // Reading
  // -------------------------------------------------------------------------------------

  async list(
    principal: Principal,
    query: z.output<typeof ConversationsQuery>,
  ): Promise<ConversationList> {
    const rows = await this.db.conversation.findMany({
      where: {
        deletedAt: null,
        ...(query.context ? { context: query.context } : {}),
        participants: { some: { userId: principal.userId, leftAt: null } },
        ...(query.q
          ? {
              OR: [
                { subject: { contains: query.q, mode: 'insensitive' } },
                {
                  messages: {
                    some: { deletedAt: null, body: { contains: query.q, mode: 'insensitive' } },
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        context: true,
        subject: true,
        participants: {
          select: { userId: true, lastReadAt: true, user: { select: PERSON_SELECT } },
          where: { leftAt: null },
        },
        messages: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { body: true, createdAt: true, senderId: true },
        },
      },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      take: 100,
    });

    const unread = await this.unreadByConversation(principal.userId);
    const items = rows.map((row) => this.toSummary(principal, row, unread));
    return { items, unreadTotal: items.reduce((total, item) => total + item.unread, 0) };
  }

  async unread(principal: Principal): Promise<UnreadMessages> {
    const counts = await this.unreadByConversation(principal.userId);
    let total = 0;
    for (const count of counts.values()) total += count;
    return { unread: total };
  }

  async thread(
    principal: Principal,
    conversationId: string,
    query: z.output<typeof MessagesQuery>,
  ): Promise<MessagesPage> {
    const conversation = await this.loadForParticipant(principal, conversationId);
    const before = query.before ? decodeCursor(query.before) : null;

    // Newest first for the keyset, then reversed so the thread reads downwards.
    const rows = await this.db.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        ...(before
          ? {
              OR: [
                { createdAt: { lt: before.createdAt } },
                { createdAt: before.createdAt, id: { lt: before.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: {
        id: true,
        body: true,
        createdAt: true,
        editedAt: true,
        senderId: true,
        sender: { select: PERSON_SELECT },
      },
    });

    const hasOlder = rows.length > query.limit;
    const page = hasOlder ? rows.slice(0, query.limit) : rows;
    const oldest = page.at(-1);

    const unread = await this.unreadByConversation(principal.userId);
    return {
      conversation: this.toSummary(principal, conversation, unread),
      items: [...page].reverse().map((row) => this.toMessage(principal, row)),
      olderCursor: hasOlder && oldest ? encodeCursor(oldest) : null,
    };
  }

  /**
   * Members you may write to: everyone with an active membership of a branch you are an
   * active member of. Name, picture and branch only — never an address or a telephone
   * number, which is what the profile page is for.
   */
  async directory(
    principal: Principal,
    query: z.output<typeof DirectoryQuery>,
  ): Promise<DirectoryList> {
    const branchIds = await this.myBranchIds(principal.userId);
    if (branchIds.length === 0) return { items: [] };

    const rows = await this.db.user.findMany({
      where: {
        id: { not: principal.userId },
        status: 'ACTIVE',
        deletedAt: null,
        memberships: { some: { branchId: { in: branchIds }, status: 'ACTIVE' } },
        ...(query.q
          ? {
              profile: {
                OR: [
                  { firstName: { contains: query.q, mode: 'insensitive' } },
                  { lastName: { contains: query.q, mode: 'insensitive' } },
                  { displayName: { contains: query.q, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      select: {
        ...PERSON_SELECT,
        memberships: {
          where: { branchId: { in: branchIds }, status: 'ACTIVE' },
          select: { branch: { select: { name: true } } },
          take: 1,
        },
      },
      orderBy: [{ profile: { firstName: 'asc' } }, { profile: { lastName: 'asc' } }, { id: 'asc' }],
      take: query.limit,
    });

    return {
      items: rows.map((row) => ({
        ...this.toPerson(row),
        branchName: row.memberships[0]?.branch.name ?? null,
      })),
    };
  }

  // -------------------------------------------------------------------------------------
  // Writing
  // -------------------------------------------------------------------------------------

  async start(
    principal: Principal,
    body: z.output<typeof StartConversation>,
    meta: RequestMeta,
  ): Promise<MessageResult> {
    if (body.userId === principal.userId)
      throw Errors.badRequest('cannot_message_self', 'You cannot write to yourself.');

    await this.assertCanMessage(principal.userId, body.userId);

    const organizationId = await this.organizations.currentId();
    const key = directKey(principal.userId, body.userId);

    const conversation = await this.db.conversation.upsert({
      where: { directKey: key },
      // A thread with this pair already exists; leave it exactly as it is.
      update: {},
      create: {
        organizationId,
        context: 'PERSONAL',
        directKey: key,
        createdById: principal.userId,
        participants: { create: [{ userId: principal.userId }, { userId: body.userId }] },
      },
      select: { id: true },
    });

    return this.append(principal, conversation.id, body.body, meta);
  }

  async send(
    principal: Principal,
    conversationId: string,
    body: z.output<typeof SendMessageRequest>,
    meta: RequestMeta,
  ): Promise<MessageResult> {
    await this.loadForParticipant(principal, conversationId);
    return this.append(principal, conversationId, body.body, meta);
  }

  async markRead(principal: Principal, conversationId: string): Promise<void> {
    await this.loadForParticipant(principal, conversationId);
    await this.db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: principal.userId } },
      data: { lastReadAt: new Date() },
    });
  }

  // -------------------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------------------

  private async append(
    principal: Principal,
    conversationId: string,
    body: string,
    meta: RequestMeta,
  ): Promise<MessageResult> {
    const message = await this.db.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { conversationId, senderId: principal.userId, body },
        select: {
          id: true,
          body: true,
          createdAt: true,
          editedAt: true,
          senderId: true,
          sender: { select: PERSON_SELECT },
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: created.createdAt },
      });
      // Writing counts as reading everything before it.
      await tx.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: principal.userId } },
        data: { lastReadAt: created.createdAt },
      });
      return created;
    });

    // After the commit, so the worker cannot read a message that is not there yet.
    await this.jobs.enqueue('messageSent', { messageId: message.id, requestId: meta.requestId });

    return { conversationId, message: this.toMessage(principal, message) };
  }

  /** The thread, if the caller is in it. Anything else is a 404, never a 403 (AGENTS §5). */
  private async loadForParticipant(principal: Principal, conversationId: string) {
    const conversation = await this.db.conversation.findFirst({
      where: {
        id: conversationId,
        deletedAt: null,
        participants: { some: { userId: principal.userId, leftAt: null } },
      },
      select: {
        id: true,
        context: true,
        subject: true,
        participants: {
          select: { userId: true, lastReadAt: true, user: { select: PERSON_SELECT } },
          where: { leftAt: null },
        },
        messages: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { body: true, createdAt: true, senderId: true },
        },
      },
    });
    if (!conversation) throw Errors.notFound('That conversation');
    return conversation;
  }

  /** Branches where the caller is an active member. */
  private async myBranchIds(userId: string): Promise<string[]> {
    const memberships = await this.db.branchMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { branchId: true },
    });
    return memberships.map((m) => m.branchId);
  }

  private async assertCanMessage(actorId: string, targetId: string): Promise<void> {
    const branchIds = await this.myBranchIds(actorId);
    const reachable =
      branchIds.length > 0 &&
      (await this.db.user.findFirst({
        where: {
          id: targetId,
          status: 'ACTIVE',
          deletedAt: null,
          memberships: { some: { branchId: { in: branchIds }, status: 'ACTIVE' } },
        },
        select: { id: true },
      }));
    if (!reachable)
      throw Errors.forbidden(
        'You can only write to members of a branch you belong to.',
        'NOT_REACHABLE',
      );
  }

  /** Unread messages per conversation for one person, in a single grouped query. */
  private async unreadByConversation(userId: string): Promise<Map<string, number>> {
    const mine = await this.db.conversationParticipant.findMany({
      where: { userId, leftAt: null },
      select: { conversationId: true, lastReadAt: true },
    });
    if (mine.length === 0) return new Map();

    const grouped = await this.db.message.groupBy({
      by: ['conversationId'],
      where: {
        deletedAt: null,
        senderId: { not: userId },
        OR: mine.map((p) => ({
          conversationId: p.conversationId,
          ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
        })),
      },
      _count: { _all: true },
    });
    return new Map(grouped.map((row) => [row.conversationId, row._count._all]));
  }

  private toPerson(row: PersonRow): MessagePerson {
    const profile = row.profile;
    const name =
      profile?.displayName?.trim() ||
      [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim();
    return {
      id: row.id,
      displayName: name || 'A member',
      avatarUrl: this.media.imageUrl(profile?.avatarMedia, 96),
    };
  }

  private toMessage(
    principal: Principal,
    row: {
      id: string;
      body: string;
      createdAt: Date;
      editedAt: Date | null;
      senderId: string | null;
      sender: PersonRow | null;
    },
  ): MessageDto {
    return {
      id: row.id,
      body: row.body,
      sender: row.sender ? this.toPerson(row.sender) : null,
      mine: row.senderId === principal.userId,
      createdAt: row.createdAt.toISOString(),
      editedAt: row.editedAt?.toISOString() ?? null,
    };
  }

  private toSummary(
    principal: Principal,
    row: {
      id: string;
      context: ConversationSummary['context'];
      subject: string | null;
      participants: { userId: string; lastReadAt: Date | null; user: PersonRow }[];
      messages: { body: string; createdAt: Date; senderId: string | null }[];
    },
    unread: Map<string, number>,
  ): ConversationSummary {
    const last = row.messages[0];
    return {
      id: row.id,
      context: row.context,
      subject: row.subject,
      others: row.participants
        .filter((p) => p.userId !== principal.userId)
        .map((p) => this.toPerson(p.user)),
      lastMessage: last
        ? {
            body: last.body,
            createdAt: last.createdAt.toISOString(),
            mine: last.senderId === principal.userId,
          }
        : null,
      unread: unread.get(row.id) ?? 0,
    };
  }
}

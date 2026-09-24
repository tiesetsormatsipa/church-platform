import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const PDF_MAX_BYTES = 500 * 1024;

@Injectable()
export class MessagingService {
  constructor(private prisma: PrismaService) {}

  async getUserConversations(userId: string, tab: string, search?: string) {
    const typeFilter: Record<string, any> = { members: { type: 'DIRECT' }, market: { type: 'ORDER' }, jobs: { type: 'JOB' } };
    const where: any = { participants: { some: { userId } }, ...typeFilter[tab] };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { orderId: { contains: search, mode: 'insensitive' } },
        { messages: { some: { content: { contains: search, mode: 'insensitive' } } } },
      ];
    }
    const conversations = await this.prisma.conversation.findMany({
      where,
      include: {
        participants: { include: { user: { include: { profile: { select: { firstName: true, surname: true, profilePictureUrl: true } } } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return Promise.all(conversations.map(async (conv) => {
      const participant = conv.participants.find((p) => p.userId === userId);
      const unreadCount = await this.prisma.message.count({
        where: { conversationId: conv.id, senderId: { not: userId }, ...(participant?.lastReadAt ? { createdAt: { gt: participant.lastReadAt } } : {}) },
      });
      return { ...conv, lastMessage: conv.messages[0] || null, unreadCount };
    }));
  }

  async getUserConversationIds(userId: string): Promise<string[]> {
    const participations = await this.prisma.conversationParticipant.findMany({ where: { userId }, select: { conversationId: true } });
    return participations.map((p) => p.conversationId);
  }

  async getConversationMessages(conversationId: string, userId: string, page = 1, limit = 50) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new ForbiddenException('Not a participant in this conversation.');
    return this.prisma.message.findMany({
      where: { conversationId, deletedAt: null },
      include: { sender: { include: { profile: { select: { firstName: true, surname: true, profilePictureUrl: true } } } }, attachments: { include: { mediaAsset: true } } },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async sendMessage(data: { conversationId: string; senderId: string; content: string; type?: string; attachmentIds?: string[] }) {
    const { conversationId, senderId, content, type = 'TEXT', attachmentIds } = data;
    const participant = await this.prisma.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId: senderId } } });
    if (!participant) throw new ForbiddenException('Not a participant in this conversation.');

    if (attachmentIds?.length) {
      const assets = await this.prisma.mediaAsset.findMany({ where: { id: { in: attachmentIds } } });
      const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
      for (const asset of assets) {
        if (conv?.type !== 'ORDER') {
          if (asset.mimeType !== 'application/pdf') throw new BadRequestException('Only PDF attachments are allowed in general messaging.');
          if (asset.sizeBytes > PDF_MAX_BYTES) throw new BadRequestException('PDF attachment must be under 500 KB.');
        }
      }
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId, senderId, content, type: type as any,
          attachments: attachmentIds?.length ? { create: attachmentIds.map((id) => ({ mediaAssetId: id })) } : undefined,
        },
        include: { sender: { include: { profile: { select: { firstName: true, surname: true, profilePictureUrl: true } } } }, attachments: { include: { mediaAsset: true } } },
      });
      await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      return msg;
    });
    return message;
  }

  async markConversationRead(conversationId: string, userId: string) {
    await this.prisma.conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId } }, data: { lastReadAt: new Date() } });
  }

  async getConversationParticipants(conversationId: string) {
    return this.prisma.conversationParticipant.findMany({ where: { conversationId }, include: { user: { select: { id: true, email: true } } } });
  }

  async createDirectConversation(userAId: string, userBId: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: { type: 'DIRECT', AND: [{ participants: { some: { userId: userAId } } }, { participants: { some: { userId: userBId } } }] },
    });
    if (existing) return existing;
    return this.prisma.conversation.create({
      data: { type: 'DIRECT', participants: { create: [{ userId: userAId }, { userId: userBId }] } },
      include: { participants: true },
    });
  }
}

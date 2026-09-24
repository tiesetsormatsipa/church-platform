import { Test, TestingModule } from '@nestjs/testing';
import { MessagingService } from '../../modules/messaging/messaging.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('MessagingService', () => {
  let service: MessagingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      conversationParticipant: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      message: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      conversation: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
      mediaAsset: { findMany: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(MessagingService);
  });

  it('throws ForbiddenException if sender is not participant', async () => {
    prisma.conversationParticipant.findUnique.mockResolvedValue(null);
    await expect(service.sendMessage({ conversationId: 'c1', senderId: 'u1', content: 'Hello' })).rejects.toThrow(ForbiddenException);
  });

  it('rejects non-PDF attachments in direct messaging', async () => {
    prisma.conversationParticipant.findUnique.mockResolvedValue({ userId: 'u1' });
    prisma.conversation.findUnique.mockResolvedValue({ type: 'DIRECT' });
    prisma.mediaAsset.findMany.mockResolvedValue([{ id: 'a1', mimeType: 'image/jpeg', sizeBytes: 100000 }]);
    await expect(service.sendMessage({ conversationId: 'c1', senderId: 'u1', content: 'see attachment', attachmentIds: ['a1'] })).rejects.toThrow(BadRequestException);
  });

  it('rejects PDFs larger than 500KB', async () => {
    prisma.conversationParticipant.findUnique.mockResolvedValue({ userId: 'u1' });
    prisma.conversation.findUnique.mockResolvedValue({ type: 'DIRECT' });
    prisma.mediaAsset.findMany.mockResolvedValue([{ id: 'a1', mimeType: 'application/pdf', sizeBytes: 600 * 1024 }]);
    await expect(service.sendMessage({ conversationId: 'c1', senderId: 'u1', content: 'see pdf', attachmentIds: ['a1'] })).rejects.toThrow('under 500 KB');
  });
});

// apps/api/src/modules/songs/songs.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../admin/audit.service';

@Injectable()
export class SongsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(filters: {
    search?: string;
    tab?: string;
    language?: string;
    artist?: string;
    page?: number;
    limit?: number;
    status?: string;
    tenantId?: string;
  }) {
    const {
      search, tab, language, artist,
      page = 1, limit = 20, status = 'PUBLISHED', tenantId,
    } = filters;

    const where: any = {
      status: status as any,
      ...(tenantId && { tenantId }),
      ...(tab && { tab }),
      ...(language && { language }),
      ...(artist && { artist: { contains: artist, mode: 'insensitive' } }),
      ...(search && {
        OR: [
          { title:  { contains: search, mode: 'insensitive' } },
          { artist: { contains: search, mode: 'insensitive' } },
          { album:  { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [songs, total] = await Promise.all([
      this.prisma.song.findMany({
        where,
        include: {
          audioAsset: { select: { id: true, url: true, durationSeconds: true } },
          uploader: {
            include: {
              profile: { select: { firstName: true, surname: true, profilePictureUrl: true } },
            },
          },
          _count: { select: { likes: true } },
        },
        orderBy: [{ plays: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.song.count({ where }),
    ]);

    return {
      data: songs,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const song = await this.prisma.song.findUnique({
      where: { id },
      include: {
        audioAsset: true,
        approval: true,
        uploader: { include: { profile: true } },
        _count: { select: { likes: true } },
      },
    });
    if (!song) throw new NotFoundException('Song not found.');
    await this.prisma.song.update({ where: { id }, data: { plays: { increment: 1 } } });
    return song;
  }

  async create(data: any, uploaderId: string) {
    const song = await this.prisma.song.create({
      data: { ...data, uploaderId, status: 'DRAFT' },
    });
    await this.prisma.songApproval.create({
      data: { songId: song.id, status: 'PENDING_REVIEW' },
    });
    await this.audit.log({
      userId: uploaderId,
      action: 'CREATE',
      entityType: 'Song',
      entityId: song.id,
    });
    return song;
  }

  async approveSong(songId: string, reviewerId: string, notes?: string) {
    await this.prisma.$transaction([
      this.prisma.songApproval.update({
        where: { songId },
        data: {
          status: 'PUBLISHED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          notes,
        },
      }),
      this.prisma.song.update({ where: { id: songId }, data: { status: 'PUBLISHED' } }),
    ]);
    await this.audit.log({
      userId: reviewerId,
      action: 'APPROVE',
      entityType: 'Song',
      entityId: songId,
      reason: notes,
    });
    return { success: true };
  }

  async rejectSong(songId: string, reviewerId: string, reason: string) {
    await this.prisma.$transaction([
      this.prisma.songApproval.update({
        where: { songId },
        data: {
          status: 'REJECTED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          notes: reason,
        },
      }),
      this.prisma.song.update({ where: { id: songId }, data: { status: 'REJECTED' } }),
    ]);
    await this.audit.log({
      userId: reviewerId,
      action: 'REJECT',
      entityType: 'Song',
      entityId: songId,
      reason,
    });
    return { success: true };
  }

  async toggleLike(songId: string, userId: string) {
    const existing = await this.prisma.like.findUnique({
      where: {
        userId_entityType_entityId: {
          userId,
          entityType: 'Song',
          entityId: songId,
        },
      },
    });

    if (existing) {
      await this.prisma.like.delete({
        where: {
          userId_entityType_entityId: {
            userId,
            entityType: 'Song',
            entityId: songId,
          },
        },
      });
      return { liked: false };
    }

    await this.prisma.like.create({
      data: { userId, entityType: 'Song', entityId: songId, songId },
    });
    return { liked: true };
  }

  async getPendingApprovals() {
    return this.prisma.song.findMany({
      where: { status: 'PENDING_REVIEW' },
      include: {
        approval: true,
        uploader: { include: { profile: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}

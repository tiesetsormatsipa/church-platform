import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../admin/audit.service';

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async findAll(filters: { search?: string; type?: string; countryId?: string; category?: string; page?: number; limit?: number; tenantId?: string; status?: string }) {
    const { search, type, countryId, category, page = 1, limit = 12, tenantId, status = 'PUBLISHED' } = filters;
    const where: any = {
      status: status as any,
      deletedAt: null,
      ...(tenantId && { tenantId }),
      ...(type && { type: type as any }),
      ...(countryId && { countryId }),
      ...(category && { category: { contains: category, mode: 'insensitive' } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [jobs, total] = await Promise.all([
      this.prisma.jobPost.findMany({
        where,
        include: {
          poster: { include: { profile: { select: { firstName: true, surname: true } } } },
          _count: { select: { applications: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.jobPost.count({ where }),
    ]);
    return { data: jobs, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const job = await this.prisma.jobPost.findUnique({
      where: { id, deletedAt: null },
      include: { poster: { include: { profile: true } }, approval: true, _count: { select: { applications: true } } },
    });
    if (!job) throw new NotFoundException(`Job ${id} not found.`);
    return job;
  }

  async create(data: any, posterId: string) {
    const job = await this.prisma.jobPost.create({ data: { ...data, posterId, status: 'PENDING_REVIEW' } });
    await this.prisma.jobApproval.create({ data: { jobPostId: job.id, status: 'PENDING_REVIEW' } });
    await this.audit.log({ userId: posterId, action: 'CREATE', entityType: 'JobPost', entityId: job.id });
    return job;
  }

  async update(id: string, data: any, userId: string) {
    const job = await this.prisma.jobPost.findUnique({ where: { id } });
    if (!job) throw new NotFoundException(`Job ${id} not found.`);
    if (job.posterId !== userId) throw new ForbiddenException('Only the poster can edit this job.');
    const updated = await this.prisma.jobPost.update({ where: { id }, data });
    await this.audit.log({ userId, action: 'UPDATE', entityType: 'JobPost', entityId: id });
    return updated;
  }

  async approve(jobId: string, reviewerId: string, notes?: string) {
    await this.prisma.$transaction([
      this.prisma.jobApproval.update({ where: { jobPostId: jobId }, data: { status: 'PUBLISHED', reviewedBy: reviewerId, reviewedAt: new Date(), notes } }),
      this.prisma.jobPost.update({ where: { id: jobId }, data: { status: 'PUBLISHED' } }),
    ]);
    await this.audit.log({ userId: reviewerId, action: 'APPROVE', entityType: 'JobPost', entityId: jobId, reason: notes });
    return { success: true };
  }

  async reject(jobId: string, reviewerId: string, reason: string) {
    await this.prisma.$transaction([
      this.prisma.jobApproval.update({ where: { jobPostId: jobId }, data: { status: 'REJECTED', reviewedBy: reviewerId, reviewedAt: new Date(), notes: reason } }),
      this.prisma.jobPost.update({ where: { id: jobId }, data: { status: 'REJECTED' } }),
    ]);
    await this.audit.log({ userId: reviewerId, action: 'REJECT', entityType: 'JobPost', entityId: jobId, reason });
    return { success: true };
  }

  async apply(jobId: string, applicantId: string, data: { coverLetter?: string }) {
    const existing = await this.prisma.jobApplication.findFirst({ where: { jobPostId: jobId, applicantId } });
    if (existing) throw new BadRequestException('You have already applied to this job.');
    const application = await this.prisma.jobApplication.create({ data: { jobPostId: jobId, applicantId, ...data, status: 'SUBMITTED' } });
    const job = await this.prisma.jobPost.findUnique({ where: { id: jobId } });
    if (job) {
      await this.prisma.conversation.create({
        data: {
          type: 'JOB', jobId,
          title: `Application: ${job.title}`,
          participants: { create: [{ userId: applicantId }, { userId: job.posterId }] },
        },
      });
    }
    await this.audit.log({ userId: applicantId, action: 'CREATE', entityType: 'JobApplication', entityId: application.id });
    return application;
  }

  async getPendingApprovals() {
    return this.prisma.jobPost.findMany({
      where: { status: 'PENDING_REVIEW' },
      include: { poster: { include: { profile: true } }, approval: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}

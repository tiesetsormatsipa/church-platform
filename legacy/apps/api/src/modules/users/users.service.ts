import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../admin/audit.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async getMyProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { country: true, province: true, branch: { select: { id: true, name: true, type: true } } },
    });
    if (!profile) throw new NotFoundException('Profile not found.');
    return profile;
  }

  async updateMyProfile(userId: string, data: any) {
    const existing = await this.prisma.profile.findUnique({ where: { userId } });
    if (!existing) throw new NotFoundException('Profile not found.');

    const updated = await this.prisma.profile.update({
      where: { userId },
      data: {
        ...data,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        baptismDate: data.baptismDate ? new Date(data.baptismDate) : undefined,
        updatedAt: new Date(),
      },
    });

    const requiredFields = ['firstName', 'surname', 'dateOfBirth', 'baptismDate', 'baptismPlace'];
    const isComplete = requiredFields.every((f) => !!(updated as any)[f]);
    await this.prisma.profile.update({ where: { userId }, data: { isProfileComplete: isComplete } });

    await this.audit.log({ userId, action: 'UPDATE', entityType: 'Profile', entityId: userId });
    return updated;
  }

  async submitVerification(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, verificationRequest: true },
    });
    if (!user) throw new NotFoundException('User not found.');
    if (!user.profile?.isProfileComplete) throw new BadRequestException('Profile must be complete first.');
    if (user.verificationRequest?.status === 'PENDING') throw new BadRequestException('Already pending.');

    const vr = await this.prisma.verificationRequest.upsert({
      where: { userId },
      update: { status: 'PENDING', submittedAt: new Date(), rejectionReason: null },
      create: { userId, status: 'PENDING' },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { verificationStatus: 'PENDING' } });
    await this.audit.log({ userId, action: 'CREATE', entityType: 'VerificationRequest', entityId: vr.id });
    return vr;
  }

  async approveVerification(verificationId: string, reviewerId: string, notes?: string) {
    const vr = await this.prisma.verificationRequest.findUnique({ where: { id: verificationId } });
    if (!vr) throw new NotFoundException('Verification request not found.');

    await this.prisma.$transaction([
      this.prisma.verificationRequest.update({
        where: { id: verificationId },
        data: { status: 'VERIFIED', reviewedAt: new Date(), reviewedBy: reviewerId, notes },
      }),
      this.prisma.user.update({ where: { id: vr.userId }, data: { verificationStatus: 'VERIFIED', status: 'ACTIVE' } }),
    ]);

    const verifiedRole = await this.prisma.role.findUnique({ where: { slug: 'verified-member' } });
    if (verifiedRole) {
      await this.prisma.userRole.upsert({
        where: { userId_roleId: { userId: vr.userId, roleId: verifiedRole.id } },
        update: {},
        create: { userId: vr.userId, roleId: verifiedRole.id },
      });
    }
    await this.audit.log({ userId: reviewerId, action: 'APPROVE', entityType: 'VerificationRequest', entityId: verificationId, reason: notes });
    return { success: true };
  }

  async rejectVerification(verificationId: string, reviewerId: string, reason: string) {
    const vr = await this.prisma.verificationRequest.findUnique({ where: { id: verificationId } });
    if (!vr) throw new NotFoundException('Not found.');
    await this.prisma.$transaction([
      this.prisma.verificationRequest.update({
        where: { id: verificationId },
        data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: reviewerId, rejectionReason: reason },
      }),
      this.prisma.user.update({ where: { id: vr.userId }, data: { verificationStatus: 'REJECTED' } }),
    ]);
    await this.audit.log({ userId: reviewerId, action: 'REJECT', entityType: 'VerificationRequest', entityId: verificationId, reason });
    return { success: true };
  }

  async listUsers(filters: { search?: string; verificationStatus?: string; branchId?: string; page?: number; limit?: number; tenantId?: string }) {
    const { search, verificationStatus, branchId, page = 1, limit = 20, tenantId } = filters;
    const where: any = {
      deletedAt: null,
      ...(tenantId && { tenantMemberships: { some: { tenantId } } }),
      ...(verificationStatus && { verificationStatus }),
      ...(branchId && { profile: { branchId } }),
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { profile: { firstName: { contains: search, mode: 'insensitive' } } },
          { profile: { surname:   { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          profile:   { select: { firstName: true, surname: true, profilePictureUrl: true, branchId: true } },
          userRoles: { include: { role: { select: { name: true, slug: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data: users, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getPendingVerifications() {
    return this.prisma.verificationRequest.findMany({
      where: { status: 'PENDING' },
      include: { user: { include: { profile: { include: { country: true, branch: true } } } }, documents: { include: { mediaAsset: true } } },
      orderBy: { submittedAt: 'asc' },
    });
  }

  async assignRole(userId: string, roleSlug: string, grantedBy: string) {
    const role = await this.prisma.role.findUnique({ where: { slug: roleSlug } });
    if (!role) throw new NotFoundException(`Role '${roleSlug}' not found.`);
    const assigned = await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id, grantedBy },
    });
    await this.audit.log({ userId: grantedBy, action: 'UPDATE', entityType: 'UserRole', entityId: userId, newValue: roleSlug });
    return assigned;
  }
}

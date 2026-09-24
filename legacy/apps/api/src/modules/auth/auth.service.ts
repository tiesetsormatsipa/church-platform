import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../admin/audit.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  async validateGoogleUser(googleProfile: any): Promise<any> {
    const { id: googleId, emails, displayName, photos } = googleProfile;
    const email = emails[0]?.value;
    if (!email) throw new UnauthorizedException('No email from Google');

    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true, userRoles: { include: { role: true } } },
    });

    if (!user) {
      const nameParts = displayName?.split(' ') || ['', ''];
      user = await this.prisma.user.create({
        data: {
          email, googleId,
          isEmailVerified: true,
          status: 'PENDING_VERIFICATION',
          verificationStatus: 'UNVERIFIED',
          profile: {
            create: {
              firstName: nameParts[0] || '',
              surname: nameParts.slice(1).join(' ') || '',
              profilePictureUrl: photos?.[0]?.value,
              isProfileComplete: false,
            },
          },
        },
        include: { profile: true, userRoles: { include: { role: true } } },
      });

      const unverifiedRole = await this.prisma.role.findUnique({ where: { slug: 'unverified-member' } });
      if (unverifiedRole) {
        await this.prisma.userRole.create({ data: { userId: user.id, roleId: unverifiedRole.id } });
      }
      await this.audit.log({ userId: user.id, action: 'CREATE', entityType: 'User', entityId: user.id, metadata: { method: 'google_oauth' } });
    } else if (!user.googleId) {
      await this.prisma.user.update({ where: { id: user.id }, data: { googleId } });
    }

    return user;
  }

  async generateTokens(user: any): Promise<{ accessToken: string; refreshToken: string }> {
    const roles = user.userRoles?.map((ur: any) => ur.role.slug) || [];
    const payload = { sub: user.id, email: user.email, roles };
    const accessToken  = this.jwt.sign(payload, { secret: this.config.get<string>('auth.jwtSecret'), expiresIn: '15m' });
    const refreshToken = this.jwt.sign(payload, { secret: this.config.get<string>('auth.jwtRefreshSecret'), expiresIn: '7d' });

    await this.prisma.deviceSession.create({
      data: {
        userId: user.id,
        refreshToken: await bcrypt.hash(refreshToken, 10),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwt.verify(refreshToken, { secret: this.config.get<string>('auth.jwtRefreshSecret') }) as any;
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { userRoles: { include: { role: true } } } });
      if (!user || user.status === 'BANNED' || user.status === 'SUSPENDED') throw new UnauthorizedException('Account not active.');
      const roles = user.userRoles.map((ur) => ur.role.slug);
      const newAccessToken = this.jwt.sign({ sub: user.id, email: user.email, roles }, { secret: this.config.get<string>('auth.jwtSecret'), expiresIn: '15m' });
      return { accessToken: newAccessToken };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const sessions = await this.prisma.deviceSession.findMany({ where: { userId } });
    for (const session of sessions) {
      if (session.refreshToken && await bcrypt.compare(refreshToken, session.refreshToken)) {
        await this.prisma.deviceSession.delete({ where: { id: session.id } });
        break;
      }
    }
    await this.audit.log({ userId, action: 'LOGOUT', entityType: 'User', entityId: userId });
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: { include: { country: true, province: true, branch: true } },
        userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        geoRoleAssignments: true,
      },
    });
  }
}

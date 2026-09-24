import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { FEATURE_KEY } from '../decorators/feature.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const ALWAYS_ON = ['home', 'profile', 'regions', 'HOME', 'PROFILE', 'REGIONS'];

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<string>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredFeature) return true;
    if (ALWAYS_ON.includes(requiredFeature)) return true;

    const request = context.switchToHttp().getRequest();
    const tenantId = request.headers['x-tenant-id'] || process.env.DEFAULT_TENANT_ID;

    const flag = await this.prisma.featureFlag.findFirst({
      where: {
        key: requiredFeature,
        OR: [{ tenantId }, { tenantId: null }],
      },
      include: { rolloutRules: { where: { isActive: true } } },
    });

    if (!flag || !flag.isEnabled) {
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'This feature is not currently available.',
          code: 'FEATURE_DISABLED',
          feature: requiredFeature,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (flag.rolloutRules.length > 0) {
      const user = request.user;
      const allowed = this.evaluateRolloutRules(flag.rolloutRules, user);
      if (!allowed) {
        throw new HttpException(
          {
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            message: 'This feature is not yet available for your account.',
            code: 'FEATURE_NOT_IN_ROLLOUT',
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }

    return true;
  }

  private evaluateRolloutRules(rules: any[], user: any): boolean {
    for (const rule of rules) {
      switch (rule.ruleType) {
        case 'ALL': return true;
        case 'ROLE':
          if (user?.roles?.some((r: any) => r.slug === rule.ruleValue)) return true;
          break;
        case 'COUNTRY':
          if (user?.profile?.countryId === rule.ruleValue) return true;
          break;
        case 'VERIFICATION_STATUS':
          if (user?.verificationStatus === rule.ruleValue) return true;
          break;
        case 'PERCENTAGE':
          if (user?.id) {
            const hash = user.id.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
            if ((hash % 100) < (rule.percentage || 0)) return true;
          }
          break;
      }
    }
    return false;
  }
}

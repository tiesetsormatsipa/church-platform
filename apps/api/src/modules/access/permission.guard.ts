import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ORGANIZATION_TARGET } from '@church/shared';
import type { FastifyRequest } from 'fastify';
import { type PermissionRequirement, REQUIRE_PERMISSION } from '../../common/decorators/index.js';
import { Errors } from '../../common/http/errors.js';
import { AccessService } from './access.service.js';

/** Coarse, route-level permission check declared with `@RequirePermission()`. */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement | undefined>(REQUIRE_PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requirement) return true;
    const { principal } = context.switchToHttp().getRequest<FastifyRequest>();
    if (!principal) throw Errors.unauthenticated();
    const allowed =
      requirement.scope === 'ORGANIZATION'
        ? this.access.can(principal, requirement.permission, ORGANIZATION_TARGET)
        : this.access.canAnywhere(principal, requirement.permission);
    if (!allowed) throw Errors.forbidden();
    return true;
  }
}

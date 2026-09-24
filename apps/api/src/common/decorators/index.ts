import {
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
  SerializeOptions,
  SetMetadata,
} from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import type { Permission } from '@church/shared';
import type { FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { clientOf } from '../http/client.js';
import { Errors } from '../http/errors.js';
import type { Principal, RequestMeta } from '../principal.js';

export const IS_PUBLIC = 'cp:isPublic';
export const REQUIRE_VERIFIED_EMAIL = 'cp:requireVerifiedEmail';
export const REQUIRE_PERMISSION = 'cp:requirePermission';
export const RATE_LIMIT = 'cp:rateLimit';

/** The route can be called without signing in (a session is still resolved if present). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** The signed-in user must have verified their e-mail address. */
export const RequireVerifiedEmail = () => SetMetadata(REQUIRE_VERIFIED_EMAIL, true);

export interface PermissionRequirement {
  permission: Permission;
  /**
   * ORGANIZATION: the permission must be held church-wide.
   * ANYWHERE: held church-wide or in at least one branch (the service then checks the
   * specific branch once the target is known).
   */
  scope: 'ORGANIZATION' | 'ANYWHERE';
}

/** Route-level permission check; services still check the concrete target. */
export const RequirePermission = (permission: Permission, scope: PermissionRequirement['scope'] = 'ANYWHERE') =>
  SetMetadata(REQUIRE_PERMISSION, { permission, scope } satisfies PermissionRequirement);

export interface RateLimitRule {
  /** Bucket name, e.g. "auth.register". */
  name: string;
  limit: number;
  windowSeconds: number;
  /** Key requests by client IP (default) or by signed-in user. */
  by?: 'ip' | 'user';
}

export const RateLimit = (...rules: RateLimitRule[]) => SetMetadata(RATE_LIMIT, rules);

/** The signed-in user. Only use on routes that require authentication. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): Principal => {
  const request = ctx.switchToHttp().getRequest<FastifyRequest>();
  if (!request.principal) throw Errors.unauthenticated();
  return request.principal;
});

/** The signed-in user, or null on public routes. */
export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Principal | null =>
    ctx.switchToHttp().getRequest<FastifyRequest>().principal ?? null,
);

export function requestMeta(request: FastifyRequest): RequestMeta {
  const userAgent = request.headers['user-agent'];
  return {
    requestId: String(request.id),
    ip: clientOf(request).ip,
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 512) : null,
  };
}

export const Meta = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestMeta =>
  requestMeta(ctx.switchToHttp().getRequest<FastifyRequest>()),
);

/**
 * Documents the response in OpenAPI and serialises it through the schema at runtime, which
 * strips any field the contract does not declare.
 */
export function ApiResult(schema: z.ZodType, options: { status?: number; description?: string } = {}) {
  return applyDecorators(
    ApiResponse({
      status: options.status ?? 200,
      description: options.description ?? 'Success',
      standardSchema: schema,
    }),
    SerializeOptions({ schema }),
  );
}

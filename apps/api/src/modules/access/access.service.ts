import { Injectable } from '@nestjs/common';
import {
  type AccessTarget,
  can,
  canAnywhere,
  canForType,
  type ContentType,
  contentTarget,
  type Permission,
  scopeOf,
} from '@church/shared';
import { Errors } from '../../common/http/errors.js';
import type { Principal } from '../../common/principal.js';

/**
 * Server-side authorization. Every mutation checks the concrete target (a branch or the
 * whole church) with these helpers; route guards only perform coarse checks.
 */
@Injectable()
export class AccessService {
  can(
    principal: Principal | null | undefined,
    permission: Permission,
    target: AccessTarget,
  ): boolean {
    return !!principal && can(principal.grants, permission, target);
  }

  canAnywhere(principal: Principal | null | undefined, permission: Permission): boolean {
    return !!principal && canAnywhere(principal.grants, permission);
  }

  /** 'ALL' (church-wide) or the branch ids where the permission is held. */
  scopeOf(principal: Principal, permission: Permission): 'ALL' | string[] {
    return scopeOf(principal.grants, permission);
  }

  assert(
    principal: Principal | null | undefined,
    permission: Permission,
    target: AccessTarget,
    detail?: string,
  ): void {
    if (!principal) throw Errors.unauthenticated();
    if (!can(principal.grants, permission, target)) throw Errors.forbidden(detail);
  }

  assertContent(
    principal: Principal | null | undefined,
    permission: Permission,
    content: { scope: 'GLOBAL' | 'BRANCH'; branchId: string | null; type?: ContentType },
  ): void {
    // An auxiliary is appointed to particular content types, so the type has to be part of
    // the question: "may you create a song" and "may you create a sermon" differ for them.
    if (content.type && principal) {
      if (!canForType(principal.grants, permission, contentTarget(content), content.type)) {
        throw Errors.forbidden('Your role does not cover this kind of content here.');
      }
      return;
    }
    this.assert(
      principal,
      permission,
      contentTarget(content),
      content.scope === 'GLOBAL'
        ? 'Only church administrators can manage church-wide content.'
        : 'You can only manage content for branches you administer.',
    );
  }

  /**
   * Prisma `where` fragment limiting rows to branches the principal holds `permission` in.
   * Returns `{}` for church-wide holders and an impossible filter for none.
   */
  branchFilter(principal: Principal, permission: Permission): { branchId?: { in: string[] } } {
    const scope = this.scopeOf(principal, permission);
    if (scope === 'ALL') return {};
    return { branchId: { in: scope } };
  }
}

import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  can,
  canAnywhere,
  canAssignRole,
  contentRights,
  contentTarget,
  branchTarget,
  ORGANIZATION_TARGET,
  PERMISSIONS,
  permissionsAllowedAt,
  scopeOf,
  SYSTEM_ROLES,
  type Grant,
} from './permissions.js';

const CAPE_TOWN = 'b-cape-town';
const DURBAN = 'b-durban';

const branchAdminCapeTown: Grant[] = [
  { branchId: CAPE_TOWN, permissions: SYSTEM_ROLES.branch_admin.permissions },
];
const churchAdmin: Grant[] = [
  { branchId: null, permissions: SYSTEM_ROLES.church_admin.permissions },
];
const superAdmin: Grant[] = [{ branchId: null, permissions: SYSTEM_ROLES.super_admin.permissions }];

describe('can', () => {
  it('lets a branch admin manage content in their own branch only', () => {
    expect(can(branchAdminCapeTown, 'content.publish', branchTarget(CAPE_TOWN))).toBe(true);
    expect(can(branchAdminCapeTown, 'content.publish', branchTarget(DURBAN))).toBe(false);
  });

  it('never lets a branch grant satisfy an organisation target (global content)', () => {
    expect(can(branchAdminCapeTown, 'content.create', ORGANIZATION_TARGET)).toBe(false);
    expect(
      can(
        branchAdminCapeTown,
        'content.create',
        contentTarget({ scope: 'GLOBAL', branchId: null }),
      ),
    ).toBe(false);
  });

  it('lets a church-wide grant act on any branch and on global content', () => {
    expect(can(churchAdmin, 'content.publish', branchTarget(DURBAN))).toBe(true);
    expect(can(churchAdmin, 'content.publish', ORGANIZATION_TARGET)).toBe(true);
  });

  it('denies permissions that are not granted', () => {
    expect(can(churchAdmin, 'settings.manage', ORGANIZATION_TARGET)).toBe(false);
    expect(can([], 'content.create', branchTarget(CAPE_TOWN))).toBe(false);
  });

  it('rejects branch content without a branch id', () => {
    expect(() => contentTarget({ scope: 'BRANCH', branchId: null })).toThrow();
  });
});

describe('scopeOf / canAnywhere', () => {
  it('reports the branches in which a permission is held', () => {
    const grants: Grant[] = [
      { branchId: CAPE_TOWN, permissions: ['content.create'] },
      { branchId: DURBAN, permissions: ['content.create', 'content.publish'] },
    ];
    expect(scopeOf(grants, 'content.create')).toEqual([CAPE_TOWN, DURBAN]);
    expect(scopeOf(grants, 'content.publish')).toEqual([DURBAN]);
    expect(scopeOf(grants, 'audit.read')).toEqual([]);
    expect(scopeOf(churchAdmin, 'content.create')).toBe('ALL');
    expect(canAnywhere(grants, 'content.publish')).toBe(true);
    expect(canAnywhere(grants, 'user.manage')).toBe(false);
  });
});

describe('canAssignRole', () => {
  it('lets a branch admin grant branch editor in their own branch', () => {
    expect(
      canAssignRole(branchAdminCapeTown, SYSTEM_ROLES.branch_editor, branchTarget(CAPE_TOWN)),
    ).toBe(true);
    expect(
      canAssignRole(branchAdminCapeTown, SYSTEM_ROLES.branch_editor, branchTarget(DURBAN)),
    ).toBe(false);
  });

  it('prevents escalation beyond the granter’s own permissions', () => {
    // A branch admin cannot mint a church admin, nor a church admin a super admin.
    expect(canAssignRole(branchAdminCapeTown, SYSTEM_ROLES.church_admin, ORGANIZATION_TARGET)).toBe(
      false,
    );
    expect(canAssignRole(churchAdmin, SYSTEM_ROLES.super_admin, ORGANIZATION_TARGET)).toBe(false);
    expect(canAssignRole(superAdmin, SYSTEM_ROLES.super_admin, ORGANIZATION_TARGET)).toBe(true);
  });

  it('requires the role level to match the target', () => {
    expect(canAssignRole(superAdmin, SYSTEM_ROLES.branch_admin, ORGANIZATION_TARGET)).toBe(false);
    expect(canAssignRole(superAdmin, SYSTEM_ROLES.church_admin, branchTarget(CAPE_TOWN))).toBe(
      false,
    );
  });
});

describe('system roles', () => {
  it('only contain permissions allowed at their level', () => {
    for (const role of Object.values(SYSTEM_ROLES)) {
      const allowed = permissionsAllowedAt(role.scope);
      for (const permission of role.permissions) {
        expect(allowed, `${role.name}: ${permission}`).toContain(permission);
      }
    }
  });

  it('give super admins every permission', () => {
    expect([...SYSTEM_ROLES.super_admin.permissions].sort()).toEqual([...ALL_PERMISSIONS].sort());
    expect(ALL_PERMISSIONS.length).toBe(Object.keys(PERMISSIONS).length);
  });
});

describe('contentRights', () => {
  const EDITOR = 'u-editor';
  const editorCapeTown: Grant[] = [
    { branchId: CAPE_TOWN, permissions: ['content.create', 'media.upload'] },
  ];
  const draft = (
    createdById: string | null,
    status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' = 'DRAFT',
  ) => ({
    scope: 'BRANCH' as const,
    branchId: CAPE_TOWN,
    status,
    createdById,
  });

  it('lets editors edit and submit only their own unpublished branch content', () => {
    expect(contentRights(editorCapeTown, EDITOR, draft(EDITOR))).toEqual({
      edit: true,
      submit: true,
      publish: false,
      archive: false,
    });
    expect(contentRights(editorCapeTown, EDITOR, draft(EDITOR, 'PENDING_REVIEW'))).toMatchObject({
      edit: true,
      submit: false,
    });
    expect(contentRights(editorCapeTown, EDITOR, draft(EDITOR, 'PUBLISHED')).edit).toBe(false);
    expect(contentRights(editorCapeTown, EDITOR, draft('someone-else')).edit).toBe(false);
    expect(contentRights(editorCapeTown, EDITOR, { ...draft(EDITOR), branchId: DURBAN }).edit).toBe(
      false,
    );
  });

  it('gives branch admins full rights in their branch but not church-wide', () => {
    expect(
      contentRights(branchAdminCapeTown, 'u-admin', draft('someone-else', 'PUBLISHED')),
    ).toEqual({
      edit: true,
      submit: false,
      publish: true,
      archive: true,
    });
    const global = {
      scope: 'GLOBAL' as const,
      branchId: null,
      status: 'DRAFT' as const,
      createdById: null,
    };
    expect(contentRights(branchAdminCapeTown, 'u-admin', global)).toEqual({
      edit: false,
      submit: false,
      publish: false,
      archive: false,
    });
  });
});

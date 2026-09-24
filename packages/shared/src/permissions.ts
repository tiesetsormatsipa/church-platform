/**
 * Permission catalogue and pure access evaluation.
 *
 * Permissions are defined in code (typed, reviewed, tested). Roles are database rows that
 * bundle permission keys, and role assignments grant a role either organisation-wide
 * (`branchId = null`) or for one branch.
 *
 * The API is the enforcement point (see apps/api/src/modules/access). The web app uses the
 * same functions only to decide which controls to show.
 */
import type { RoleScope } from './enums.js';

interface PermissionDefinition {
  label: string;
  description: string;
  /** Levels at which a role containing this permission may be granted. */
  scopes: readonly RoleScope[];
}

const BOTH = ['ORGANIZATION', 'BRANCH'] as const satisfies readonly RoleScope[];
const ORG_ONLY = ['ORGANIZATION'] as const satisfies readonly RoleScope[];

export const PERMISSIONS = {
  'content.create': {
    label: 'Create content',
    description: 'Write drafts of posts, announcements, news, events, sermons and baptism stories.',
    scopes: BOTH,
  },
  'content.update': {
    label: 'Edit content',
    description: 'Edit any content in scope, including content written by others.',
    scopes: BOTH,
  },
  'content.publish': {
    label: 'Publish content',
    description: 'Publish, schedule, unpublish, pin and feature content.',
    scopes: BOTH,
  },
  'content.archive': {
    label: 'Archive and delete content',
    description: 'Archive or delete content in scope.',
    scopes: BOTH,
  },
  'media.upload': {
    label: 'Upload media',
    description: 'Upload images, audio, video and documents.',
    scopes: BOTH,
  },
  'media.manage': {
    label: 'Manage media',
    description: 'Edit and delete media uploaded by others.',
    scopes: BOTH,
  },
  'branch.create': {
    label: 'Create branches',
    description: 'Add new branches to the church.',
    scopes: ORG_ONLY,
  },
  'branch.update': {
    label: 'Edit branch details',
    description: 'Edit branch profile, service times, leadership and gallery.',
    scopes: BOTH,
  },
  'branch.archive': {
    label: 'Archive branches',
    description: 'Deactivate or archive branches.',
    scopes: ORG_ONLY,
  },
  'branch_record.read': {
    label: 'View service records',
    description: 'View attendance, offering and baptism records.',
    scopes: BOTH,
  },
  'branch_record.manage': {
    label: 'Manage service records',
    description: 'Create and correct service records.',
    scopes: BOTH,
  },
  'membership.review': {
    label: 'Review memberships',
    description: 'Approve or decline branch membership requests.',
    scopes: BOTH,
  },
  'baptism_request.manage': {
    label: 'Manage baptism enquiries',
    description: 'View and follow up baptism enquiries.',
    scopes: BOTH,
  },
  'user.read': {
    label: 'View users',
    description: 'View the user directory and account details.',
    scopes: ORG_ONLY,
  },
  'user.manage': {
    label: 'Manage users',
    description: 'Suspend, reactivate and deactivate accounts.',
    scopes: ORG_ONLY,
  },
  'role.assign': {
    label: 'Assign roles',
    description: 'Grant and revoke roles, limited to permissions the granter holds.',
    scopes: BOTH,
  },
  'role.manage': {
    label: 'Manage roles',
    description: 'Create and edit role definitions.',
    scopes: ORG_ONLY,
  },
  'audit.read': {
    label: 'View audit log',
    description: 'View the audit trail of administrative actions.',
    scopes: ORG_ONLY,
  },
  'settings.manage': {
    label: 'Manage settings',
    description: 'Edit organisation-wide settings.',
    scopes: ORG_ONLY,
  },
} as const satisfies Record<string, PermissionDefinition>;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(value: string): value is Permission {
  return Object.hasOwn(PERMISSIONS, value);
}

/** Permissions that may be part of a role granted at the given level. */
export function permissionsAllowedAt(scope: RoleScope): Permission[] {
  return ALL_PERMISSIONS.filter((p) =>
    (PERMISSIONS[p].scopes as readonly RoleScope[]).includes(scope),
  );
}

// ---------------------------------------------------------------------------
// System roles
// ---------------------------------------------------------------------------

export interface RoleDefinition {
  name: string;
  description: string;
  scope: RoleScope;
  permissions: readonly Permission[];
}

const CONTENT_ALL = [
  'content.create',
  'content.update',
  'content.publish',
  'content.archive',
] as const satisfies readonly Permission[];

export const SYSTEM_ROLES = {
  branch_editor: {
    name: 'Branch editor',
    description: 'Writes content for a branch and submits it for review.',
    scope: 'BRANCH',
    permissions: ['content.create', 'media.upload'],
  },
  branch_admin: {
    name: 'Branch administrator',
    description:
      'Runs a branch: publishes its content, keeps its details current, reviews members and follows up baptism enquiries.',
    scope: 'BRANCH',
    permissions: [
      ...CONTENT_ALL,
      'media.upload',
      'media.manage',
      'branch.update',
      'branch_record.read',
      'branch_record.manage',
      'membership.review',
      'baptism_request.manage',
      'role.assign',
    ],
  },
  church_admin: {
    name: 'Church administrator',
    description: 'Manages church-wide content, all branches and members.',
    scope: 'ORGANIZATION',
    permissions: [
      ...CONTENT_ALL,
      'media.upload',
      'media.manage',
      'branch.create',
      'branch.update',
      'branch.archive',
      'branch_record.read',
      'branch_record.manage',
      'membership.review',
      'baptism_request.manage',
      'user.read',
      'user.manage',
      'role.assign',
      'audit.read',
    ],
  },
  super_admin: {
    name: 'Super administrator',
    description: 'Full control, including role definitions and organisation settings.',
    scope: 'ORGANIZATION',
    permissions: ALL_PERMISSIONS,
  },
} as const satisfies Record<string, RoleDefinition>;

export type SystemRoleKey = keyof typeof SYSTEM_ROLES;

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/** One role assignment flattened to its permissions. `branchId = null` means church-wide. */
export interface Grant {
  branchId: string | null;
  permissions: readonly Permission[];
}

export type AccessTarget = { scope: 'ORGANIZATION' } | { scope: 'BRANCH'; branchId: string };

export const ORGANIZATION_TARGET: AccessTarget = { scope: 'ORGANIZATION' };

export function branchTarget(branchId: string): AccessTarget {
  return { scope: 'BRANCH', branchId };
}

/** Target for a piece of content: global content is an organisation-level target. */
export function contentTarget(content: {
  scope: 'GLOBAL' | 'BRANCH';
  branchId: string | null;
}): AccessTarget {
  if (content.scope === 'BRANCH') {
    if (!content.branchId) throw new Error('Branch-scoped content must have a branchId');
    return branchTarget(content.branchId);
  }
  return ORGANIZATION_TARGET;
}

/**
 * Does any grant allow `permission` on `target`?
 *
 * - A church-wide grant satisfies every target.
 * - A branch grant satisfies only a target in the same branch.
 */
export function can(
  grants: readonly Grant[],
  permission: Permission,
  target: AccessTarget,
): boolean {
  for (const grant of grants) {
    if (!grant.permissions.includes(permission)) continue;
    if (grant.branchId === null) return true;
    if (target.scope === 'BRANCH' && target.branchId === grant.branchId) return true;
  }
  return false;
}

/** Does the principal hold `permission` anywhere (used to decide whether to show admin areas)? */
export function canAnywhere(grants: readonly Grant[], permission: Permission): boolean {
  return grants.some((g) => g.permissions.includes(permission));
}

/**
 * Where does the principal hold `permission`?
 * Returns `'ALL'` for a church-wide grant, otherwise the list of branch ids.
 */
export function scopeOf(grants: readonly Grant[], permission: Permission): 'ALL' | string[] {
  const branches = new Set<string>();
  for (const grant of grants) {
    if (!grant.permissions.includes(permission)) continue;
    if (grant.branchId === null) return 'ALL';
    branches.add(grant.branchId);
  }
  return [...branches];
}

/**
 * May `granter` assign a role with `rolePermissions` at `target`?
 * Requires `role.assign` at the target and every permission of the role at the target
 * (no privilege escalation), and the role's level must match the target.
 */
export function canAssignRole(
  granter: readonly Grant[],
  role: { scope: RoleScope; permissions: readonly Permission[] },
  target: AccessTarget,
): boolean {
  const targetLevel: RoleScope = target.scope === 'BRANCH' ? 'BRANCH' : 'ORGANIZATION';
  if (role.scope !== targetLevel) return false;
  if (!can(granter, 'role.assign', target)) return false;
  return role.permissions.every((p) => can(granter, p, target));
}

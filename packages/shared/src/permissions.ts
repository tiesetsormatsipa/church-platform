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
import type { ContentType, RoleScope } from './enums.js';

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
  /**
   * Seniority. **Lower is more senior**, and an administrator may only grant, or act on,
   * roles ranked strictly below their own. The gaps leave room for roles the church adds
   * later without renumbering the ones above and below.
   */
  rank: number;
  /**
   * Content types this role may work with. Empty means every type, which is what an ordinary
   * administrator has; an auxiliary is appointed to one job, such as posting the songs.
   */
  contentTypes: readonly ContentType[];
}

/** The ranks the church's own roles use. Anything the church adds sits between them. */
export const ROLE_RANK = {
  superAdmin: 10,
  churchAdmin: 20,
  branchAdmin: 30,
  editor: 40,
  auxiliary: 50,
} as const;

const CONTENT_ALL = [
  'content.create',
  'content.update',
  'content.publish',
  'content.archive',
] as const satisfies readonly Permission[];

export const SYSTEM_ROLES = {
  songs_auxiliary: {
    name: 'Songs auxiliary',
    description: 'Posts the songs for a branch. Everything posted goes for review.',
    scope: 'BRANCH',
    permissions: ['content.create', 'media.upload'],
    rank: ROLE_RANK.auxiliary,
    contentTypes: ['SONG'],
  },
  sermons_auxiliary: {
    name: 'Sermons auxiliary',
    description: 'Posts the sermons for a branch. Everything posted goes for review.',
    scope: 'BRANCH',
    permissions: ['content.create', 'media.upload'],
    rank: ROLE_RANK.auxiliary,
    contentTypes: ['SERMON'],
  },
  media_auxiliary: {
    name: 'Media auxiliary',
    description: 'Posts both the sermons and the songs for a branch, for review.',
    scope: 'BRANCH',
    permissions: ['content.create', 'media.upload'],
    rank: ROLE_RANK.auxiliary,
    contentTypes: ['SERMON', 'SONG'],
  },
  branch_editor: {
    name: 'Branch editor',
    description: 'Writes content for a branch and submits it for review.',
    scope: 'BRANCH',
    permissions: ['content.create', 'media.upload'],
    rank: ROLE_RANK.editor,
    contentTypes: [],
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
      'role.assign',
    ],
    rank: ROLE_RANK.branchAdmin,
    contentTypes: [],
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
      'user.read',
      'user.manage',
      'role.assign',
      'audit.read',
    ],
    rank: ROLE_RANK.churchAdmin,
    contentTypes: [],
  },
  super_admin: {
    name: 'Super administrator',
    description: 'Full control, including role definitions and organisation settings.',
    scope: 'ORGANIZATION',
    permissions: ALL_PERMISSIONS,
    rank: ROLE_RANK.superAdmin,
    contentTypes: [],
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
  /** Seniority of the role behind this grant; lower is more senior. */
  rank: number;
  /** Content types the grant covers. Empty or absent means every type. */
  contentTypes?: readonly ContentType[];
}

/**
 * How senior someone is: the rank of their most senior role, or `Infinity` for a member
 * with no role at all. Used to stop an administrator acting on an equal or a superior.
 */
export function rankOf(grants: readonly Grant[]): number {
  return grants.reduce((best, g) => Math.min(best, g.rank), Number.POSITIVE_INFINITY);
}

/**
 * May the actor act on this person — change their roles, suspend them, and so on?
 *
 * Strictly below, so two church administrators cannot act on each other, and nobody can act
 * on themselves through the administration screens. A person with no role is always below.
 */
export function canActOnRank(actorGrants: readonly Grant[], targetGrants: readonly Grant[]) {
  return rankOf(actorGrants) < rankOf(targetGrants);
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

/**
 * As `can`, but for a grant that may be limited to certain content types.
 *
 * An auxiliary appointed to the songs holds `content.create`, but only for songs; asking
 * "may they create a sermon" must say no. A grant with no type limit covers every type.
 */
export function canForType(
  grants: readonly Grant[],
  permission: Permission,
  target: AccessTarget,
  type: ContentType,
): boolean {
  for (const grant of grants) {
    if (!grant.permissions.includes(permission)) continue;
    if (grant.contentTypes?.length && !grant.contentTypes.includes(type)) continue;
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
  role: { scope: RoleScope; permissions: readonly Permission[]; rank?: number },
  target: AccessTarget,
): boolean {
  const targetLevel: RoleScope = target.scope === 'BRANCH' ? 'BRANCH' : 'ORGANIZATION';
  if (role.scope !== targetLevel) return false;
  if (!can(granter, 'role.assign', target)) return false;
  // Seniority: you may only hand out a role ranked below your own, so an administrator
  // cannot clone their own authority or promote someone above themselves.
  if (role.rank !== undefined && role.rank <= rankOf(granter)) return false;
  return role.permissions.every((p) => can(granter, p, target));
}

// ---------------------------------------------------------------------------
// Content workflow
// ---------------------------------------------------------------------------

export interface ContentRights {
  /** Change the text and details. */
  edit: boolean;
  /** Put a draft forward for review. */
  submit: boolean;
  /** Publish, schedule, unpublish, pin and feature. */
  publish: boolean;
  /** Archive or delete. */
  archive: boolean;
}

/**
 * What a user may do with one content item. Editors (`content.create` only) may edit and
 * submit their own drafts; `content.update` edits anything at the target; publishing and
 * archiving need their own permissions. The API enforces these; the UI mirrors them.
 */
export function contentRights(
  grants: readonly Grant[],
  userId: string,
  item: {
    scope: 'GLOBAL' | 'BRANCH';
    branchId: string | null;
    status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
    createdById: string | null;
    /** When given, an auxiliary's rights are limited to the types it was appointed to. */
    type?: ContentType;
  },
): ContentRights {
  const target = contentTarget(item);
  const allows = (permission: Permission) =>
    item.type ? canForType(grants, permission, target, item.type) : can(grants, permission, target);
  const ownUnpublished =
    item.createdById === userId && (item.status === 'DRAFT' || item.status === 'PENDING_REVIEW');
  const edit = allows('content.update') || (ownUnpublished && allows('content.create'));
  return {
    edit,
    submit: edit && item.status === 'DRAFT',
    publish: allows('content.publish'),
    archive: allows('content.archive'),
  };
}

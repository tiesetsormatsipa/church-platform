/**
 * Base seed: safe to run in every environment, idempotent.
 * Creates the organisation, the system roles (permissions kept in sync with code) and,
 * optionally, the first super administrator.
 */
import {
  normalizeEmail,
  OrganizationSettings,
  SYSTEM_ROLES,
  type SystemRoleKey,
} from '@church/shared';
import { hashPassword } from '@church/infrastructure/password';
import type { PrismaClient, Organization, Role } from '../generated/prisma/client.js';

export interface BaseSeedOptions {
  organization: {
    slug: string;
    name: string;
    shortName?: string;
    tagline?: string;
    email?: string;
    timezone?: string;
    locale?: string;
  };
  superAdmin?: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  };
}

export interface BaseSeedResult {
  organization: Organization;
  roles: Record<SystemRoleKey, Role>;
}

export type SeedLogger = (message: string) => void;

export async function seedBase(
  prisma: PrismaClient,
  options: BaseSeedOptions,
  log: SeedLogger = () => {},
): Promise<BaseSeedResult> {
  const org = options.organization;
  const organization = await prisma.organization.upsert({
    where: { slug: org.slug },
    update: {},
    create: {
      slug: org.slug,
      name: org.name,
      shortName: org.shortName ?? null,
      tagline: org.tagline ?? null,
      email: org.email ?? null,
      timezone: org.timezone ?? 'Africa/Johannesburg',
      locale: org.locale ?? 'en-ZA',
      settings: OrganizationSettings.parse({}),
    },
  });
  log(`organisation: ${organization.name} (${organization.slug})`);

  const roles = {} as Record<SystemRoleKey, Role>;
  for (const [key, definition] of Object.entries(SYSTEM_ROLES) as [
    SystemRoleKey,
    (typeof SYSTEM_ROLES)[SystemRoleKey],
  ][]) {
    const role = await prisma.role.upsert({
      where: { organizationId_key: { organizationId: organization.id, key } },
      update: {
        name: definition.name,
        description: definition.description,
        scope: definition.scope,
        rank: definition.rank,
        contentTypes: [...(definition.contentTypes ?? [])],
        isSystem: true,
      },
      create: {
        organizationId: organization.id,
        key,
        name: definition.name,
        description: definition.description,
        scope: definition.scope,
        rank: definition.rank,
        contentTypes: [...(definition.contentTypes ?? [])],
        isSystem: true,
      },
    });
    const permissions = [...definition.permissions];
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permission: { notIn: permissions } },
    });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: role.id, permission })),
      skipDuplicates: true,
    });
    roles[key] = role;
  }
  log(`system roles: ${Object.keys(roles).join(', ')}`);

  if (options.superAdmin) {
    const email = normalizeEmail(options.superAdmin.email);
    const existing = await prisma.user.findUnique({ where: { email } });
    const user =
      existing ??
      (await prisma.user.create({
        data: {
          email,
          emailVerifiedAt: new Date(),
          passwordHash: await hashPassword(options.superAdmin.password),
          passwordChangedAt: new Date(),
          profile: {
            create: {
              firstName: options.superAdmin.firstName,
              lastName: options.superAdmin.lastName,
              termsAcceptedAt: new Date(),
              privacyConsentAt: new Date(),
            },
          },
        },
      }));
    const assigned = await prisma.roleAssignment.findFirst({
      where: { userId: user.id, roleId: roles.super_admin.id, branchId: null },
    });
    if (!assigned) {
      await prisma.roleAssignment.create({
        data: { userId: user.id, roleId: roles.super_admin.id, organizationId: organization.id },
      });
    }
    log(`super admin: ${email}${existing ? ' (existing account kept)' : ''}`);
  }

  return { organization, roles };
}

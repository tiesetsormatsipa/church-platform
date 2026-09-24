/**
 * Seed command.
 *
 *   pnpm db:seed            base data (organisation, roles, optional first super admin)
 *   pnpm db:seed --demo     base data + demo branches, people and content (never in production)
 *
 * Environment: DATABASE_URL, ORGANIZATION_SLUG, ORGANIZATION_NAME, ORGANIZATION_SHORT_NAME,
 * SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_FIRST_NAME, SEED_ADMIN_LAST_NAME.
 */
import { PASSWORD_MIN_LENGTH } from '@church/infrastructure/password';
import { createPrismaClient } from '../client.js';
import { seedBase } from './base.js';
import { seedDemo } from './demo.js';

const env = process.env;
const demo = process.argv.includes('--demo');

if (demo && env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.error('Refusing to load demo data with NODE_ENV=production (pass --force to override).');
  process.exit(1);
}

const url = env.DATABASE_URL ?? 'postgresql://church:church@localhost:5432/church';
const prisma = createPrismaClient({ url, poolMax: 2, applicationName: 'seed' });

const adminPassword = env.SEED_ADMIN_PASSWORD;
if (env.SEED_ADMIN_EMAIL && (!adminPassword || adminPassword.length < PASSWORD_MIN_LENGTH)) {
  console.error(`SEED_ADMIN_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  process.exit(1);
}

try {
  const log = (message: string) => console.log(`  ✓ ${message}`);
  console.log(demo ? 'Seeding base + demo data…' : 'Seeding base data…');
  const base = await seedBase(
    prisma,
    {
      organization: {
        slug: env.ORGANIZATION_SLUG ?? 'first-church',
        name: env.ORGANIZATION_NAME ?? 'First Church of Our Lord Jesus Christ',
        shortName: env.ORGANIZATION_SHORT_NAME ?? 'Truth of God',
        tagline: 'Faith, fellowship and the truth of God’s Word.',
      },
      ...(env.SEED_ADMIN_EMAIL && adminPassword
        ? {
            superAdmin: {
              email: env.SEED_ADMIN_EMAIL,
              password: adminPassword,
              firstName: env.SEED_ADMIN_FIRST_NAME ?? 'Site',
              lastName: env.SEED_ADMIN_LAST_NAME ?? 'Administrator',
            },
          }
        : {}),
    },
    log,
  );
  if (demo) await seedDemo(prisma, base, log);
  console.log('Done.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

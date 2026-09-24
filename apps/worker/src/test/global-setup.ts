/**
 * Creates a fresh, uniquely named PostgreSQL database for this test run, applies the
 * migrations (`prisma migrate deploy`, non-destructive) and seeds the base data. The
 * database is dropped again when the run ends. No existing database is ever reset.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { TestProject } from 'vitest/node';
import { createPrismaClient } from '@church/database';
import { seedBase } from '@church/database/seed';
import { createRedis } from '@church/infrastructure/redis';

const here = dirname(fileURLToPath(import.meta.url));
const databasePackage = resolve(here, '../../../../packages/database');

declare module 'vitest' {
  interface ProvidedContext {
    databaseUrl: string;
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const template = new URL(
    process.env.TEST_DATABASE_URL ?? 'postgresql://church:church@localhost:5432/church_test',
  );
  const name = `church_wit_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
  const maintenance = new URL(template);
  maintenance.pathname = '/postgres';
  const testUrl = new URL(template);
  testUrl.pathname = `/${name}`;

  const admin = new pg.Client({ connectionString: maintenance.toString() });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: databasePackage,
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    stdio: 'pipe',
  });
  const prisma = createPrismaClient({ url: testUrl.toString(), poolMax: 2 });
  await seedBase(prisma, { organization: { slug: 'test-church', name: 'Test Church' } });
  await prisma.$disconnect();

  const redis = createRedis({
    url: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/2',
    name: 'worker-test-setup',
  });
  await redis.flushdb();
  redis.disconnect();

  project.provide('databaseUrl', testUrl.toString());

  return async () => {
    const cleanup = new pg.Client({ connectionString: maintenance.toString() });
    await cleanup.connect();
    // Only the database created above by this run.
    await cleanup.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await cleanup.end();
  };
}

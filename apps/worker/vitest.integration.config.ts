import { defineConfig } from 'vitest/config';

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgresql://church:church@localhost:5432/church_test';

// Integration tests run the real job handlers against real PostgreSQL and Redis. The global
// setup creates and drops its own database; Redis DB 2 keeps it clear of the API's tests.
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    globalSetup: ['src/test/global-setup.ts'],
    setupFiles: ['src/test/setup-env.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      TEST_DATABASE_URL: databaseUrl,
      REDIS_URL: process.env.TEST_WORKER_REDIS_URL ?? 'redis://localhost:6379/2',
      ORGANIZATION_SLUG: 'test-church',
      APP_ORIGIN: 'http://localhost:3000',
      WEB_INTERNAL_URL: 'http://localhost:3000',
      REVALIDATE_SECRET: 'test-revalidate-secret-0123456789abcdef',
      MAIL_PROVIDER: 'memory',
      MAIL_FROM: 'Test Church <no-reply@example.org>',
    },
  },
});

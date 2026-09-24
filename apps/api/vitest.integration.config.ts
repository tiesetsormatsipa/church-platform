import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://church:church@localhost:5432/church_test';

// Integration tests boot the whole API against real PostgreSQL and Redis
// (the `church_test` database and Redis DB 1 from infra/docker/compose.dev.yml).
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
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
      APP_ORIGIN: 'http://localhost:3000',
      TEST_DATABASE_URL: databaseUrl,
      REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/1',
      ORGANIZATION_SLUG: 'test-church',
      COOKIE_SECURE: 'false',
      API_DOCS_ENABLED: 'false',
      S3_ENDPOINT: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
      S3_REGION: 'us-east-1',
      S3_BUCKET: process.env.TEST_S3_BUCKET ?? 'church-test',
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? 'church-dev',
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? 'church-dev-secret',
      S3_FORCE_PATH_STYLE: 'true',
      MEDIA_PUBLIC_BASE_URL: 'http://localhost:9000/church-test',
      STORAGE_ENSURE_BUCKET: 'true',
      INTERNAL_API_TOKEN: 'test-internal-api-token-0123456789abcdef',
    },
  },
});

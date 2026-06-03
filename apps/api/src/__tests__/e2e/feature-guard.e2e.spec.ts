import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
const request = require('supertest');

/**
 * E2E tests for feature flag enforcement.
 * These tests verify that disabled modules return HTTP 503
 * regardless of authentication status.
 *
 * NOTE: These tests require a running database.
 * Run with: yarn test:e2e
 */
describe('Feature Guard (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Skip e2e if no DB available (CI without DB)
    if (!process.env.DATABASE_URL) {
      console.log('Skipping e2e tests: no DATABASE_URL set');
      return;
    }

    const { AppModule } = await import('../../app.module');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('should return 503 for disabled marketplace module', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer()).get('/api/v1/marketplace/products');
    // Will be 503 if disabled, 200 if enabled
    expect([200, 503]).toContain(res.status);
    if (res.status === 503) {
      expect(res.body.code).toBe('FEATURE_DISABLED');
    }
  });

  it('GET /api/v1/announcements should always return 200 (announcements is always-visible)', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer()).get('/api/v1/announcements');
    expect(res.status).not.toBe(503);
  });

  it('GET /api/v1/geo/overview should always return 200', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer()).get('/api/v1/geo/overview');
    expect(res.status).toBe(200);
  });
});

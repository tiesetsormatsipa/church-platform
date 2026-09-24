import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the seeded demo data (`pnpm db:seed:demo`).
 *
 * By default Playwright starts the built API, worker and web app (run `pnpm build` first) or
 * reuses servers already running. Set `WEB_PORT` (and `APP_ORIGIN` to match) when 3000 is
 * taken by something else; set `E2E_BASE_URL` to test an already deployed environment, which
 * starts nothing locally.
 */
const webPort = process.env.WEB_PORT ?? '3000';
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${webPort}`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // Local testing never needs a proxy (and a system proxy can intercept localhost).
    launchOptions: { executablePath, args: ['--no-proxy-server'] },
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, dependencies: ['setup'] },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: 'node dist/main.js',
          cwd: '../api',
          url: 'http://localhost:4000/api/health/ready',
          reuseExistingServer: true,
          timeout: 60_000,
        },
        // The worker delivers the e-mails and cache revalidations that worker.spec.ts and
        // admin.spec.ts assert on, so the suite cannot pass without it.
        {
          command: 'node dist/main.js',
          cwd: '../worker',
          url: `http://localhost:${process.env.WORKER_HEALTH_PORT ?? 4100}/health`,
          reuseExistingServer: true,
          timeout: 60_000,
        },
        { command: 'pnpm start', url: baseURL, reuseExistingServer: true, timeout: 60_000 },
      ],
});

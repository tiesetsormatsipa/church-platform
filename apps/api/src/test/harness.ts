import type { OutgoingHttpHeaders } from 'node:http';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { DatabaseClient } from '@church/database';
import { JobProducer } from '@church/infrastructure/queue';
import type { Redis } from '@church/infrastructure/redis';
import { CSRF_HEADER, type EmailMessage } from '@church/shared';
import { createApp } from '../bootstrap.js';
import { DATABASE, REDIS } from '../infrastructure/tokens.js';

export interface TestContext {
  app: NestFastifyApplication;
  db: DatabaseClient;
  redis: Redis;
  jobs: JobProducer;
  close(): Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  const app = await createApp({ bufferLogs: true });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return {
    app,
    db: app.get<DatabaseClient>(DATABASE),
    redis: app.get<Redis>(REDIS),
    jobs: app.get(JobProducer),
    close: () => app.close(),
  };
}

export interface TestResponse<T = unknown> {
  status: number;
  body: T;
  headers: OutgoingHttpHeaders;
}

/** A browser-like client: keeps cookies and sends the CSRF header and Origin on writes. */
export class TestClient {
  private readonly cookies = new Map<string, string>();
  /** Each client gets its own address so IP-based rate limits do not leak between tests. */
  readonly ip = `10.${rand()}.${rand()}.${rand()}`;

  constructor(
    private readonly app: NestFastifyApplication,
    private readonly origin = 'http://localhost:3000',
  ) {}

  cookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  clearCookies(): void {
    this.cookies.clear();
  }

  async request<T = unknown>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    options: {
      body?: unknown;
      csrf?: boolean;
      origin?: string | null;
      headers?: Record<string, string>;
    } = {},
  ): Promise<TestResponse<T>> {
    const unsafe = method !== 'GET';
    if (unsafe && options.csrf !== false && !this.cookies.has('cp_csrf')) {
      await this.request('GET', '/api/v1/auth/csrf');
    }
    const headers: Record<string, string> = { ...options.headers };
    if (this.cookies.size) {
      headers.cookie = [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    if (unsafe && options.csrf !== false) headers[CSRF_HEADER] = this.cookies.get('cp_csrf') ?? '';
    if (unsafe && options.origin !== null) headers.origin = options.origin ?? this.origin;
    if (options.body !== undefined) headers['content-type'] = 'application/json';

    const response = await this.app.inject({
      method,
      url,
      headers,
      remoteAddress: this.ip,
      ...(options.body !== undefined ? { payload: JSON.stringify(options.body) } : {}),
    });
    const setCookie = response.headers['set-cookie'];
    for (const raw of Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []) {
      const [pair, ...attributes] = raw.split(';');
      const [name, ...value] = (pair ?? '').split('=');
      if (!name) continue;
      const expired = attributes.some(
        (a) => /expires=Thu, 01 Jan 1970/i.test(a) || /max-age=0/i.test(a.trim()),
      );
      if (expired || value.join('=') === '') this.cookies.delete(name.trim());
      else this.cookies.set(name.trim(), value.join('='));
    }
    const text = response.body;
    return {
      status: response.statusCode,
      body: (text ? JSON.parse(text) : undefined) as T,
      headers: response.headers,
    };
  }

  get<T = unknown>(url: string) {
    return this.request<T>('GET', url);
  }

  post<T = unknown>(
    url: string,
    body?: unknown,
    options: { csrf?: boolean; origin?: string | null } = {},
  ) {
    return this.request<T>('POST', url, { ...options, body: body ?? {} });
  }

  patch<T = unknown>(url: string, body?: unknown) {
    return this.request<T>('PATCH', url, { body: body ?? {} });
  }

  put<T = unknown>(url: string, body?: unknown) {
    return this.request<T>('PUT', url, { body: body ?? {} });
  }

  delete<T = unknown>(url: string) {
    return this.request<T>('DELETE', url);
  }
}

/** E-mails enqueued for delivery to `to` (most recent last). */
export async function queuedEmails(jobs: JobProducer, to: string): Promise<EmailMessage[]> {
  const queued = await jobs
    .queue('email')
    .getJobs(['waiting', 'delayed', 'prioritized', 'active', 'completed']);
  return queued
    .map((job) => (job.data as { message: EmailMessage }).message)
    .filter((message) => message.to === to);
}

export function tokenFromUrl(url: string): string {
  const token = new URL(url).searchParams.get('token');
  if (!token) throw new Error(`No token in ${url}`);
  return token;
}

function rand(): number {
  return Math.floor(Math.random() * 254) + 1;
}

let counter = 0;
/** A unique e-mail address per test. */
export function uniqueEmail(prefix = 'user'): string {
  counter += 1;
  return `${prefix}.${Date.now().toString(36)}${counter}@example.org`;
}

export const TEST_PASSWORD = 'A-sufficiently-long-password';

/** Register and confirm a new account through the API; `client` is signed in afterwards. */
export async function signUpVerified(
  ctx: TestContext,
  client: TestClient,
  email = uniqueEmail(),
  names: { firstName: string; lastName: string } = { firstName: 'Test', lastName: 'Person' },
): Promise<string> {
  const res = await client.post('/api/v1/auth/register', {
    email,
    password: TEST_PASSWORD,
    ...names,
    acceptTerms: true,
  });
  if (res.status !== 202) throw new Error(`Registration failed: ${res.status}`);
  const message = (await queuedEmails(ctx.jobs, email)).find((m) => m.template === 'verify-email');
  if (message?.template !== 'verify-email') throw new Error('No verification e-mail was queued');
  const verified = await client.post('/api/v1/auth/verify-email', {
    token: tokenFromUrl(message.data.verifyUrl),
  });
  if (verified.status !== 200) throw new Error(`Verification failed: ${verified.status}`);
  return email;
}

/** Sign `client` in as an existing account (e.g. a demo user from `ensureDemoData`). */
export async function signIn(client: TestClient, email: string, password: string): Promise<void> {
  const res = await client.post('/api/v1/auth/login', { email, password });
  if (res.status !== 200) throw new Error(`Sign-in as ${email} failed: ${res.status}`);
}

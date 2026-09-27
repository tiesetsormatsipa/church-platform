import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { JobDetailPage, JobsPage, MyJobPosting, MyJobPostings } from '@church/shared';
import { DEMO_PASSWORD, DEMO_USERS } from '@church/database/seed';
import {
  createTestContext,
  signIn,
  signUpVerified,
  TestClient,
  type TestContext,
} from '../../test/harness.js';
import { ensureDemoData } from '../../test/demo.js';

let ctx: TestContext;
/** An ordinary member: may post, may never publish. */
let grace: TestClient;
/** Another ordinary member, to prove postings are private to their author. */
let john: TestClient;
/** The church administrator, who reviews. */
let reviewer: TestClient;
/** Nobody at all. */
let anonymous: TestClient;

const POSTING = {
  title: 'Bookkeeper for a small practice',
  summary: 'Two days a week, Johannesburg CBD.',
  body: 'We keep the books for a handful of family businesses and need a steady hand.',
  employerName: 'Khumalo & Daughters',
  location: 'Johannesburg',
  employmentType: 'PART_TIME',
  salaryRange: 'R9 000 – R12 000 a month',
  applyEmail: 'work@example.org',
  applyNote: 'Send a CV and two references.',
} as const;

beforeAll(async () => {
  ctx = await createTestContext();
  await ensureDemoData(ctx.db);

  grace = new TestClient(ctx.app);
  await signIn(grace, DEMO_USERS.member, DEMO_PASSWORD);
  john = new TestClient(ctx.app);
  await signIn(john, DEMO_USERS.pendingMember, DEMO_PASSWORD);
  reviewer = new TestClient(ctx.app);
  await signIn(reviewer, DEMO_USERS.churchAdmin, DEMO_PASSWORD);
  anonymous = new TestClient(ctx.app);
});

afterAll(async () => {
  await ctx?.db.contentItem.deleteMany({ where: { type: 'JOB' } });
  await ctx?.close();
});

async function post(client: TestClient, overrides: Record<string, unknown> = {}) {
  return client.post<MyJobPosting>('/api/v1/me/jobs', {
    ...POSTING,
    title: `${POSTING.title} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    ...overrides,
  });
}

describe('putting an opening forward', () => {
  it('is something an ordinary member may do, and it goes straight for review', async () => {
    const response = await post(grace);
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('PENDING_REVIEW');
    expect(response.body.publishedAt).toBeNull();
    expect(response.body.job.employerName).toBe(POSTING.employerName);
    expect(response.body.job.applyEmail).toBe(POSTING.applyEmail);
  });

  it('is refused to anyone who is not signed in', async () => {
    const response = await anonymous.post('/api/v1/me/jobs', POSTING);
    expect(response.status).toBe(401);
  });

  it('insists on exactly one way to apply', async () => {
    const neither = await post(grace, { applyEmail: null, applyUrl: null });
    expect(neither.status).toBe(400);

    const both = await post(grace, { applyUrl: 'https://example.org/apply' });
    expect(both.status).toBe(400);

    const justALink = await post(grace, {
      applyEmail: null,
      applyUrl: 'https://example.org/apply',
    });
    expect(justALink.status).toBe(201);
  });

  it('needs an employer and a place', async () => {
    expect((await post(grace, { employerName: '' })).status).toBe(400);
    expect((await post(grace, { location: '' })).status).toBe(400);
  });
});

describe('before a reviewer has read it', () => {
  let posting: MyJobPosting;

  beforeAll(async () => {
    posting = (await post(grace)).body;
  });

  it('is not on the board', async () => {
    const board = await anonymous.get<JobsPage>('/api/v1/jobs');
    expect(board.status).toBe(200);
    expect(board.body.items.map((j) => j.id)).not.toContain(posting.id);
  });

  it('has no page of its own', async () => {
    const page = await anonymous.get(`/api/v1/jobs/${posting.slug}`);
    expect(page.status).toBe(404);
  });

  it('is visible to its author, who can see where it stands', async () => {
    const mine = await grace.get<MyJobPostings>('/api/v1/me/jobs');
    const found = mine.body.items.find((j) => j.id === posting.id);
    expect(found?.status).toBe('PENDING_REVIEW');
    expect(found?.canEdit).toBe(true);
  });

  it('is not another member’s to see or change', async () => {
    const theirs = await john.get<MyJobPostings>('/api/v1/me/jobs');
    expect(theirs.body.items.map((j) => j.id)).not.toContain(posting.id);

    // 404, not 403: a posting that is not yours should not be known to exist.
    const edit = await john.request('PATCH', `/api/v1/me/jobs/${posting.id}`, {
      body: { ...POSTING, title: 'Hijacked' },
    });
    expect(edit.status).toBe(404);

    const withdraw = await john.request('DELETE', `/api/v1/me/jobs/${posting.id}`);
    expect(withdraw.status).toBe(404);
  });
});

describe('once a reviewer publishes it', () => {
  let posting: MyJobPosting;

  beforeAll(async () => {
    posting = (await post(grace)).body;
    const published = await reviewer.post(`/api/v1/admin/content/${posting.id}/publish`, {});
    expect(published.status).toBe(200);
  });

  it('appears on the board with the poster’s name', async () => {
    const board = await anonymous.get<JobsPage>('/api/v1/jobs');
    const found = board.body.items.find((j) => j.id === posting.id);
    expect(found).toBeDefined();
    expect(found?.postedBy).toBe('Grace Dlamini');
    expect(found?.job.location).toBe('Johannesburg');
    expect(found?.job.closed).toBe(false);
  });

  it('has a page of its own, body and all', async () => {
    const page = await anonymous.get<JobDetailPage>(`/api/v1/jobs/${posting.slug}`);
    expect(page.status).toBe(200);
    expect(page.body.body).toContain('family businesses');
    expect(page.body.job.applyNote).toBe(POSTING.applyNote);
  });

  it('narrows to a kind of work and a place', async () => {
    const byType = await anonymous.get<JobsPage>('/api/v1/jobs?employmentType=PART_TIME');
    expect(byType.body.items.map((j) => j.id)).toContain(posting.id);

    const wrongType = await anonymous.get<JobsPage>('/api/v1/jobs?employmentType=INTERNSHIP');
    expect(wrongType.body.items.map((j) => j.id)).not.toContain(posting.id);

    const byPlace = await anonymous.get<JobsPage>('/api/v1/jobs?where=johannes');
    expect(byPlace.body.items.map((j) => j.id)).toContain(posting.id);

    const elsewhere = await anonymous.get<JobsPage>('/api/v1/jobs?where=Gqeberha');
    expect(elsewhere.body.items.map((j) => j.id)).not.toContain(posting.id);
  });

  it('is found by the employer’s name', async () => {
    const found = await anonymous.get<JobsPage>('/api/v1/jobs?q=Khumalo');
    expect(found.body.items.map((j) => j.id)).toContain(posting.id);
  });

  it('leaves the board the moment its author edits it, and waits to be read again', async () => {
    const edited = await grace.request<MyJobPosting>('PATCH', `/api/v1/me/jobs/${posting.id}`, {
      body: { ...POSTING, title: posting.title, location: 'Pretoria' },
    });
    expect(edited.status).toBe(200);
    expect(edited.body.status).toBe('PENDING_REVIEW');

    const board = await anonymous.get<JobsPage>('/api/v1/jobs');
    expect(board.body.items.map((j) => j.id)).not.toContain(posting.id);
    expect((await anonymous.get(`/api/v1/jobs/${posting.slug}`)).status).toBe(404);
  });

  it('comes back when the reviewer publishes it again', async () => {
    const again = await reviewer.post(`/api/v1/admin/content/${posting.id}/publish`, {});
    expect(again.status).toBe(200);
    const board = await anonymous.get<JobsPage>('/api/v1/jobs');
    const found = board.body.items.find((j) => j.id === posting.id);
    expect(found?.job.location).toBe('Pretoria');
  });

  it('disappears when its author withdraws it', async () => {
    const withdrawn = await grace.request('DELETE', `/api/v1/me/jobs/${posting.id}`);
    expect(withdrawn.status).toBe(204);

    const board = await anonymous.get<JobsPage>('/api/v1/jobs');
    expect(board.body.items.map((j) => j.id)).not.toContain(posting.id);

    const mine = await grace.get<MyJobPostings>('/api/v1/me/jobs');
    expect(mine.body.items.map((j) => j.id)).not.toContain(posting.id);
  });
});

describe('a posting whose closing date has passed', () => {
  it('is no longer an opening', async () => {
    const posting = (await post(grace, { closesOn: '2026-01-31' })).body;
    await reviewer.post(`/api/v1/admin/content/${posting.id}/publish`, {});

    const board = await anonymous.get<JobsPage>('/api/v1/jobs');
    expect(board.body.items.map((j) => j.id)).not.toContain(posting.id);

    // Its page still answers, marked closed, so a link in an old e-mail is not a dead end.
    const page = await anonymous.get<JobDetailPage>(`/api/v1/jobs/${posting.slug}`);
    expect(page.status).toBe(200);
    expect(page.body.job.closed).toBe(true);
  });
});

/** A member who has not spent any of their daily allowance yet. */
async function freshMember(): Promise<TestClient> {
  const client = new TestClient(ctx.app);
  await signUpVerified(ctx, client);
  return client;
}

describe('paging the board', () => {
  it('walks forward with a cursor and refuses a made-up one', async () => {
    // Its own member: the daily posting limit is per person, and the tests above have
    // already spent most of Grace's.
    const poster = await freshMember();
    const ids: string[] = [];
    for (let n = 0; n < 3; n += 1) {
      const posting = (await post(poster, { title: `Paged opening ${n}` })).body;
      expect(posting.id).toBeTruthy();
      await reviewer.post(`/api/v1/admin/content/${posting.id}/publish`, {});
      ids.push(posting.id);
    }

    const first = await anonymous.get<JobsPage>('/api/v1/jobs?limit=2');
    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).toBeTruthy();

    const second = await anonymous.get<JobsPage>(
      `/api/v1/jobs?limit=2&cursor=${encodeURIComponent(first.body.nextCursor!)}`,
    );
    const seen = [...first.body.items, ...second.body.items].map((j) => j.id);
    expect(new Set(seen).size).toBe(seen.length);
    for (const id of ids) expect(seen).toContain(id);

    expect((await anonymous.get('/api/v1/jobs?cursor=not-a-cursor')).status).toBe(400);
  });
});

describe('the daily limit on postings', () => {
  it('stops one member filling the board', async () => {
    const eager = await freshMember();
    const statuses: number[] = [];
    for (let n = 0; n < 11; n += 1) {
      statuses.push((await post(eager, { title: `Eager opening ${n}` })).status);
    }
    expect(statuses.filter((s) => s === 201)).toHaveLength(10);
    expect(statuses.at(-1)).toBe(429);
  });
});

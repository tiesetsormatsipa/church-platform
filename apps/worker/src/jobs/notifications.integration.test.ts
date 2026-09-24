import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createWorkerTestContext, type WorkerTestContext } from '../test/harness.js';
import { contentPublished } from './content-published.js';
import { membershipDecided, membershipRequested } from './membership.js';

let ctx: WorkerTestContext;
let organizationId: string;
let branchId: string;
let otherBranchId: string;

beforeAll(async () => {
  ctx = await createWorkerTestContext();
  const organization = await ctx.context.organization();
  organizationId = organization.id;
  branchId = (await branch('fanout-main', 'Fanout Main')).id;
  otherBranchId = (await branch('fanout-other', 'Fanout Other')).id;
});

afterAll(async () => {
  await ctx?.close();
});

beforeEach(async () => {
  // The queue is shared with other files in this run; start each test from empty.
  await ctx.context.jobs.queue('email').drain(true);
});

let counter = 0;
const unique = () => `${Date.now().toString(36)}-${(counter += 1)}`;

async function branch(slug: string, name: string) {
  return ctx.db.branch.upsert({
    where: {
      id:
        (await ctx.db.branch.findFirst({ where: { slug } }))?.id ??
        '00000000-0000-0000-0000-000000000000',
    },
    create: { organizationId, slug, name },
    update: {},
    select: { id: true },
  });
}

async function member(options: { branchId?: string; verified?: boolean } = {}) {
  const user = await ctx.db.user.create({
    data: {
      email: `member-${unique()}@example.org`,
      status: 'ACTIVE',
      emailVerifiedAt: options.verified === false ? null : new Date(),
      profile: { create: { firstName: 'Mem', lastName: 'Ber' } },
      ...(options.branchId
        ? { memberships: { create: { branchId: options.branchId, status: 'ACTIVE' } } }
        : {}),
    },
    select: { id: true, email: true },
  });
  return user;
}

async function publishedContent(scope: 'GLOBAL' | 'BRANCH', onBranch?: string) {
  return ctx.db.contentItem.create({
    data: {
      organizationId,
      type: 'ANNOUNCEMENT',
      scope,
      branchId: onBranch ?? null,
      slug: `fanout-${unique()}`,
      title: 'Convention announced',
      summary: 'Join us in September.',
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
    select: { id: true, slug: true },
  });
}

async function notificationsFor(userId: string) {
  return ctx.db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

describe('contentPublished', () => {
  it('notifies every member about church-wide content', async () => {
    const reader = await member();
    const item = await publishedContent('GLOBAL');

    await contentPublished(ctx.job(), { contentId: item.id });

    const rows = await notificationsFor(reader.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      category: 'ANNOUNCEMENTS',
      title: 'Convention announced',
      body: 'Join us in September.',
      url: `/posts/${item.slug}`,
      dedupeKey: `content-published:${item.id}`,
      readAt: null,
    });
  });

  it("notifies only the branch's members about branch content", async () => {
    const inBranch = await member({ branchId });
    const elsewhere = await member({ branchId: otherBranchId });
    const item = await publishedContent('BRANCH', branchId);

    await contentPublished(ctx.job(), { contentId: item.id });

    expect(await notificationsFor(inBranch.id)).toHaveLength(1);
    expect(await notificationsFor(elsewhere.id)).toHaveLength(0);
  });

  it('writes nothing a second time when the job is retried', async () => {
    const reader = await member();
    const item = await publishedContent('GLOBAL');

    await contentPublished(ctx.job(), { contentId: item.id });
    await contentPublished(ctx.job(), { contentId: item.id });

    expect(await notificationsFor(reader.id)).toHaveLength(1);
  });

  it('skips content that is no longer published', async () => {
    const reader = await member();
    const item = await publishedContent('GLOBAL');
    await ctx.db.contentItem.update({ where: { id: item.id }, data: { status: 'DRAFT' } });

    await contentPublished(ctx.job(), { contentId: item.id });

    expect(await notificationsFor(reader.id)).toHaveLength(0);
  });

  it('respects a member who switched the category off', async () => {
    const reader = await member();
    await ctx.db.notificationPreference.create({
      data: { userId: reader.id, category: 'ANNOUNCEMENTS', inApp: false, email: false },
    });
    const item = await publishedContent('GLOBAL');

    await contentPublished(ctx.job(), { contentId: item.id });

    expect(await notificationsFor(reader.id)).toHaveLength(0);
  });

  it('never e-mails an address nobody has confirmed', async () => {
    const unverified = await member({ verified: false });
    await ctx.db.notificationPreference.create({
      data: { userId: unverified.id, category: 'ANNOUNCEMENTS', inApp: true, email: true },
    });
    const item = await publishedContent('GLOBAL');

    await contentPublished(ctx.job(), { contentId: item.id });

    const queued = await ctx.context.jobs.queue('email').getJobs(['waiting', 'delayed']);
    const addresses = queued.map((j) => (j.data as { message: { to: string } }).message.to);
    expect(addresses).not.toContain(unverified.email);
    // The in-app notification is still written.
    expect(await notificationsFor(unverified.id)).toHaveLength(1);
  });

  it('enqueues an e-mail for a member who asked for one', async () => {
    const reader = await member();
    await ctx.db.notificationPreference.create({
      data: { userId: reader.id, category: 'ANNOUNCEMENTS', inApp: true, email: true },
    });
    const item = await publishedContent('GLOBAL');

    await contentPublished(ctx.job(), { contentId: item.id });

    const queued = await ctx.context.jobs.queue('email').getJobs(['waiting', 'delayed']);
    const mine = queued.find(
      (j) => (j.data as { message: { to: string } }).message.to === reader.email,
    );
    expect(mine).toBeDefined();
    expect((mine?.data as { message: { template: string } }).message.template).toBe('notification');
  });
});

describe('membership', () => {
  it('tells the branch reviewers about a new request', async () => {
    const applicant = await member();
    const reviewer = await member();
    const role = await ctx.db.role.create({
      data: {
        organizationId,
        key: `reviewer-${unique()}`,
        name: 'Reviewer',
        scope: 'BRANCH',
        permissions: { create: { permission: 'membership.review' } },
      },
      select: { id: true },
    });
    await ctx.db.roleAssignment.create({
      data: { userId: reviewer.id, roleId: role.id, organizationId, branchId },
    });
    const membership = await ctx.db.branchMembership.create({
      data: { userId: applicant.id, branchId, status: 'PENDING' },
      select: { id: true },
    });

    await membershipRequested(ctx.job(), { membershipId: membership.id });

    const rows = await notificationsFor(reviewer.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.category).toBe('MEMBERSHIP');
    expect(rows[0]?.url).toBe('/admin/memberships');
  });

  it('tells the member about a decision, in-app and by e-mail, exactly once', async () => {
    const applicant = await member();
    const membership = await ctx.db.branchMembership.create({
      data: { userId: applicant.id, branchId, status: 'ACTIVE', decidedAt: new Date() },
      select: { id: true },
    });

    await membershipDecided(ctx.job(), { membershipId: membership.id });

    const rows = await notificationsFor(applicant.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toContain('Fanout Main');

    const queued = await ctx.context.jobs.queue('email').getJobs(['waiting', 'delayed']);
    const mine = queued.filter(
      (j) => (j.data as { message: { to: string } }).message.to === applicant.email,
    );
    // The dedicated template only: no duplicate generic notification e-mail.
    expect(mine).toHaveLength(1);
    expect((mine[0]?.data as { message: { template: string } }).message.template).toBe(
      'membership-decided',
    );
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MediaDto, MediaLibrary, UploadTicket } from '@church/shared';
import { MP3_BYTES, PNG_BYTES } from '@church/infrastructure/storage';
import { DEMO_PASSWORD, DEMO_USERS } from '@church/database/seed';
import { createTestContext, signIn, TestClient, type TestContext } from '../../test/harness.js';
import { ensureDemoData } from '../../test/demo.js';

let ctx: TestContext;
/** An ordinary member: may upload their own photograph and nothing else. */
let grace: TestClient;
/** An editor, who holds media.upload for a branch. */
let anele: TestClient;
/** The church administrator, who may manage the whole library. */
let admin: TestClient;
let anonymous: TestClient;

beforeAll(async () => {
  ctx = await createTestContext();
  await ensureDemoData(ctx.db);
  grace = new TestClient(ctx.app);
  await signIn(grace, DEMO_USERS.member, DEMO_PASSWORD);
  anele = new TestClient(ctx.app);
  await signIn(anele, DEMO_USERS.capeTownEditor, DEMO_PASSWORD);
  admin = new TestClient(ctx.app);
  await signIn(admin, DEMO_USERS.churchAdmin, DEMO_PASSWORD);
  anonymous = new TestClient(ctx.app);
});

afterAll(async () => {
  await ctx?.db.mediaAsset.deleteMany({ where: { originalFilename: { startsWith: 'test-' } } });
  await ctx?.close();
});

/** Ask for a ticket, then stand in for the browser's PUT to the signed URL. */
async function upload(
  client: TestClient,
  options: {
    purpose: string;
    filename?: string;
    contentType?: string;
    bytes?: Buffer;
    declaredSize?: number;
  },
) {
  const bytes = options.bytes ?? PNG_BYTES;
  const ticket = await client.post<UploadTicket>('/api/v1/media/uploads', {
    purpose: options.purpose,
    filename: options.filename ?? 'test-photo.png',
    contentType: options.contentType ?? 'image/png',
    sizeBytes: options.declaredSize ?? bytes.length,
  });
  if (ticket.status !== 201) return { ticket, media: null };

  const asset = await ctx.db.mediaAsset.findUniqueOrThrow({
    where: { id: ticket.body.mediaId },
    select: { storageKey: true },
  });
  ctx.storage.upload(asset.storageKey, bytes, options.contentType ?? 'image/png');
  return { ticket, media: ticket.body.mediaId };
}

describe('asking for somewhere to upload', () => {
  it('lets any member upload their own photograph', async () => {
    const ticket = await grace.post<UploadTicket>('/api/v1/media/uploads', {
      purpose: 'AVATAR',
      filename: 'test-me.png',
      contentType: 'image/png',
      sizeBytes: PNG_BYTES.length,
    });
    expect(ticket.status).toBe(201);
    expect(ticket.body.method).toBe('PUT');
    expect(ticket.body.url).toContain('https://');
    // The key never contains anything the person typed.
    const asset = await ctx.db.mediaAsset.findUniqueOrThrow({
      where: { id: ticket.body.mediaId },
      select: { storageKey: true, status: true },
    });
    expect(asset.storageKey).not.toContain('test-me');
    expect(asset.status).toBe('PENDING_UPLOAD');
  });

  it('refuses a member anything but their own photograph', async () => {
    // The right content type for each, so what is being tested is the permission and not
    // the shape of the request: a wrong type is refused as malformed, whoever sends it.
    const cases = [
      ['COVER', 'image/png'],
      ['GALLERY', 'image/png'],
      ['LEADER_PHOTO', 'image/png'],
      ['SERMON_AUDIO', 'audio/mpeg'],
      ['SONG_AUDIO', 'audio/mpeg'],
    ] as const;
    for (const [purpose, contentType] of cases) {
      const response = await grace.post('/api/v1/media/uploads', {
        purpose,
        filename: 'test-x',
        contentType,
        sizeBytes: PNG_BYTES.length,
      });
      expect(response.status, purpose).toBe(403);
    }
  });

  it('lets someone who may upload post a cover', async () => {
    const response = await anele.post<UploadTicket>('/api/v1/media/uploads', {
      purpose: 'COVER',
      filename: 'test-cover.png',
      contentType: 'image/png',
      sizeBytes: PNG_BYTES.length,
    });
    expect(response.status).toBe(201);
  });

  it('turns away anyone who is not signed in', async () => {
    const response = await anonymous.post('/api/v1/media/uploads', {
      purpose: 'AVATAR',
      filename: 'test.png',
      contentType: 'image/png',
      sizeBytes: 10,
    });
    expect(response.status).toBe(401);
  });

  it('refuses a kind of file that does not belong to the purpose', async () => {
    // A song where a photograph is expected.
    const response = await anele.post('/api/v1/media/uploads', {
      purpose: 'COVER',
      filename: 'test-song.mp3',
      contentType: 'audio/mpeg',
      sizeBytes: 1000,
    });
    expect(response.status).toBe(400);
  });

  it('refuses a file larger than its kind allows', async () => {
    const response = await grace.post('/api/v1/media/uploads', {
      purpose: 'AVATAR',
      filename: 'test-huge.png',
      contentType: 'image/png',
      sizeBytes: 50 * 1024 * 1024,
    });
    expect(response.status).toBe(400);
  });
});

describe('telling the API the upload finished', () => {
  it('accepts a real file and hands it to the worker', async () => {
    const { media } = await upload(grace, { purpose: 'AVATAR' });
    const done = await grace.post<MediaDto>(`/api/v1/media/${media}/complete`, {});
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('UPLOADED');
    expect(done.body.sizeBytes).toBe(PNG_BYTES.length);

    const queued = await ctx.jobs.queue('media').getJobs(['waiting', 'delayed', 'completed']);
    expect(queued.some((j) => (j.data as { mediaId: string }).mediaId === media)).toBe(true);
  });

  it('refuses a file that lies about what it is', async () => {
    // A song renamed to .png, declared as an image. The bytes tell the truth.
    const { media } = await upload(grace, { purpose: 'AVATAR', bytes: MP3_BYTES });
    const done = await grace.post<{ code: string }>(`/api/v1/media/${media}/complete`, {});
    expect(done.status).toBe(400);

    const row = await ctx.db.mediaAsset.findUniqueOrThrow({
      where: { id: media! },
      select: { status: true, storageKey: true },
    });
    expect(row.status).toBe('FAILED');
    // And it is not left sitting in the bucket.
    expect(ctx.storage.has(row.storageKey)).toBe(false);
  });

  it('refuses a file larger than the ticket was issued for', async () => {
    const big = Buffer.concat([PNG_BYTES, Buffer.alloc(13 * 1024 * 1024, 0)]);
    const { media } = await upload(grace, {
      purpose: 'AVATAR',
      bytes: big,
      declaredSize: PNG_BYTES.length,
    });
    const done = await grace.post(`/api/v1/media/${media}/complete`, {});
    expect(done.status).toBe(400);
  });

  it('refuses when nothing actually arrived', async () => {
    const ticket = await grace.post<UploadTicket>('/api/v1/media/uploads', {
      purpose: 'AVATAR',
      filename: 'test-never-sent.png',
      contentType: 'image/png',
      sizeBytes: PNG_BYTES.length,
    });
    const done = await grace.post<{ code: string }>(
      `/api/v1/media/${ticket.body.mediaId}/complete`,
      {},
    );
    expect(done.status).toBe(400);
    expect(done.body.code).toBe('upload_missing');
  });

  it('is not somebody else’s upload to finish', async () => {
    const { media } = await upload(grace, { purpose: 'AVATAR' });
    // 404, not 403: a file that is not yours should not be known to exist.
    const done = await anele.post(`/api/v1/media/${media}/complete`, {});
    expect(done.status).toBe(404);
  });
});

describe('the library', () => {
  it('shows an uploader their own files and an administrator everyone’s', async () => {
    const { media } = await upload(grace, { purpose: 'AVATAR', filename: 'test-mine.png' });
    await grace.post(`/api/v1/media/${media}/complete`, {});
    await ctx.db.mediaAsset.update({ where: { id: media! }, data: { status: 'READY' } });

    const mine = await grace.get<MediaLibrary>('/api/v1/media');
    expect(mine.body.items.map((m) => m.id)).toContain(media);

    // The editor uploaded nothing of Grace's, so it is not in their library.
    const theirs = await anele.get<MediaLibrary>('/api/v1/media');
    expect(theirs.body.items.map((m) => m.id)).not.toContain(media);

    // The administrator may manage the library, so they see it.
    const all = await admin.get<MediaLibrary>('/api/v1/media');
    expect(all.body.items.map((m) => m.id)).toContain(media);
  });

  it('lets a description be set for people who cannot see the picture', async () => {
    const { media } = await upload(grace, { purpose: 'AVATAR', filename: 'test-alt.png' });
    await grace.post(`/api/v1/media/${media}/complete`, {});
    const updated = await grace.patch<MediaDto>(`/api/v1/media/${media}`, {
      altText: 'Grace outside the Johannesburg branch',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.altText).toBe('Grace outside the Johannesburg branch');
  });

  it('takes a file out of the library without destroying the object', async () => {
    const { media } = await upload(grace, { purpose: 'AVATAR', filename: 'test-gone.png' });
    await grace.post(`/api/v1/media/${media}/complete`, {});
    const row = await ctx.db.mediaAsset.findUniqueOrThrow({
      where: { id: media! },
      select: { storageKey: true },
    });

    const removed = await grace.request('DELETE', `/api/v1/media/${media}`);
    expect(removed.status).toBe(204);

    const mine = await grace.get<MediaLibrary>('/api/v1/media');
    expect(mine.body.items.map((m) => m.id)).not.toContain(media);
    // Pages all over the schema may still point at it; a picture vanishing mid-page is
    // worse than a little unused storage.
    expect(ctx.storage.has(row.storageKey)).toBe(true);
  });
});

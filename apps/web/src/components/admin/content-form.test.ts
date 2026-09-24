import { ContentInput, type AdminContentDetail } from '@church/shared';
import { describe, expect, it } from 'vitest';
import { formPath, toFormValues, toInput } from './content-form';

const event: AdminContentDetail = {
  id: '0192f0e2-0000-7000-8000-000000000001',
  type: 'EVENT',
  scope: 'BRANCH',
  branch: { id: '0192f0e2-0000-7000-8000-000000000002', slug: 'durban', name: 'Durban' },
  slug: 'youth-evening',
  slugLocked: false,
  path: '/events/youth-evening',
  title: 'Youth evening',
  summary: null,
  body: 'Songs and testimonies.',
  authorName: null,
  status: 'DRAFT',
  publishedAt: null,
  isPinned: false,
  pinnedUntil: null,
  isFeatured: false,
  seoTitle: null,
  seoDescription: null,
  tags: ['Youth', 'Music'],
  event: {
    startsAt: '2026-09-29T15:00:00.000Z',
    endsAt: '2026-09-29T17:30:00.000Z',
    allDay: false,
    timezone: 'Africa/Johannesburg',
    category: 'YOUTH',
    eventStatus: 'SCHEDULED',
    statusNote: null,
    venueName: 'Durban branch hall',
    venueAddress: null,
    mapsUrl: null,
    onlineUrl: null,
    registrationUrl: null,
  },
  sermon: null,
  baptism: null,
  createdBy: 'Sipho Nkosi',
  updatedBy: null,
  createdAt: '2026-09-20T08:00:00.000Z',
  updatedAt: '2026-09-20T08:00:00.000Z',
  rights: { edit: true, submit: true, publish: false, archive: false },
};

describe('content editor mapping', () => {
  it('shows event times in the event’s own time zone', () => {
    const values = toFormValues(event, 'GLOBAL');
    expect(values.where).toBe('durban');
    expect(values.event.starts).toBe('2026-09-29T17:00');
    expect(values.event.ends).toBe('2026-09-29T19:30');
    expect(values.tags).toBe('Youth, Music');
  });

  it('round-trips to a payload the shared schema accepts', () => {
    const payload = toInput('EVENT', toFormValues(event, 'GLOBAL'));
    const parsed = ContentInput.safeParse(payload);
    expect(parsed.success).toBe(true);
    expect(payload).toMatchObject({
      scope: 'BRANCH',
      branch: 'durban',
      tags: ['Youth', 'Music'],
      event: {
        startsAt: '2026-09-29T15:00:00.000Z',
        endsAt: '2026-09-29T17:30:00.000Z',
        category: 'YOUTH',
      },
      sermon: null,
    });
  });

  it('builds church-wide sermons with minutes converted to seconds', () => {
    const values = toFormValues(null, 'GLOBAL');
    values.title = 'Faith that endures';
    values.sermon.preachedOn = '2026-09-03';
    values.sermon.durationMinutes = '52';
    const payload = toInput('SERMON', values);
    expect(payload).toMatchObject({
      scope: 'GLOBAL',
      branch: null,
      sermon: { durationSeconds: 3120, speaker: null },
    });
    expect(ContentInput.safeParse(payload).success).toBe(true);
  });

  it('reports a missing event start on the start field', () => {
    const values = toFormValues(null, 'durban');
    values.title = 'Picnic';
    const parsed = ContentInput.safeParse(toInput('EVENT', values));
    expect(parsed.success).toBe(false);
    const paths = parsed.error?.issues.map((i) => formPath(i.path.join('.')));
    expect(paths).toContain('event.starts');
  });
});

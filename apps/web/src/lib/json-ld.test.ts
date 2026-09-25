import type { ContentDetail } from '@church/shared';
import { describe, expect, it } from 'vitest';
import { contentJsonLd, isoDuration, serializeJsonLd } from './json-ld';

const site = { origin: 'https://church.example', organizationName: 'Test Church' };

const item: ContentDetail = {
  id: '0192f0e2-0000-7000-8000-000000000001',
  type: 'EVENT',
  slug: 'annual-convention',
  path: '/events/annual-convention',
  title: 'Annual Convention',
  summary: 'Our yearly gathering.',
  scope: 'GLOBAL',
  branch: null,
  publishedAt: '2026-09-01T08:00:00.000Z',
  isPinned: false,
  isFeatured: true,
  cover: null,
  authorName: 'Naledi Khumalo',
  tags: [],
  event: null,
  sermon: null,
  song: null,
  collection: 'LOCAL' as const,
  baptism: null,
  body: null,
  bodyFormat: 'MARKDOWN',
  seoTitle: null,
  seoDescription: null,
  updatedAt: '2026-09-02T08:00:00.000Z',
  gallery: [],
  eventDetail: {
    startsAt: '2027-08-06T07:00:00.000Z',
    endsAt: '2027-08-08T14:00:00.000Z',
    allDay: false,
    timezone: 'Africa/Johannesburg',
    category: 'CONFERENCE',
    eventStatus: 'CANCELLED',
    venueName: 'Main hall',
    statusNote: null,
    venueAddress: '1 Church Street',
    mapsUrl: null,
    onlineUrl: 'https://stream.example/live',
    registrationUrl: null,
  },
  sermonDetail: null,
  songDetail: null,
  baptismDetail: null,
  related: [],
};

describe('json-ld', () => {
  it('cannot break out of the script element', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>&' });
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script>&' });
  });

  it('formats durations', () => {
    expect(isoDuration(2880)).toBe('PT48M');
    expect(isoDuration(3725)).toBe('PT1H2M5S');
    expect(isoDuration(null)).toBeUndefined();
  });

  it('describes events with status, attendance mode and locations', () => {
    const data = contentJsonLd(item, site);
    expect(data).toMatchObject({
      '@type': 'Event',
      name: 'Annual Convention',
      url: 'https://church.example/events/annual-convention',
      eventStatus: 'https://schema.org/EventCancelled',
      eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
    });
    expect(data.location).toHaveLength(2);
  });

  it('describes news as NewsArticle', () => {
    const data = contentJsonLd({ ...item, type: 'NEWS', path: '/news/x', eventDetail: null }, site);
    expect(data).toMatchObject({
      '@type': 'NewsArticle',
      headline: 'Annual Convention',
      author: { name: 'Naledi Khumalo' },
    });
  });
});

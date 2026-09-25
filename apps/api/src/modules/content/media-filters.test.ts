import { describe, expect, it } from 'vitest';
import { collectionWhere, countryWhere, dateRange } from './media-filters.js';

describe('dateRange', () => {
  it('is null when nothing narrows the dates', () => {
    expect(dateRange({})).toBeNull();
  });

  it('covers a whole year', () => {
    const range = dateRange({ year: 2026 });
    expect(range?.gte?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(range?.lte?.toISOString()).toBe('2026-12-31T00:00:00.000Z');
  });

  it('covers a single month, ending on its real last day', () => {
    const february = dateRange({ year: 2026, month: 2 });
    expect(february?.gte?.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    // 2026 is not a leap year, so February ends on the 28th.
    expect(february?.lte?.toISOString()).toBe('2026-02-28T00:00:00.000Z');

    const leap = dateRange({ year: 2028, month: 2 });
    expect(leap?.lte?.toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });

  it('takes an open-ended range from either side', () => {
    expect(dateRange({ from: '2026-03-01' })?.lte).toBeUndefined();
    expect(dateRange({ until: '2026-03-01' })?.gte).toBeUndefined();
  });

  it('prefers a year over a from/until pair', () => {
    const range = dateRange({ year: 2025, from: '2026-01-01' });
    expect(range?.gte?.getUTCFullYear()).toBe(2025);
  });
});

describe('countryWhere', () => {
  it('does not narrow when no country is chosen', () => {
    expect(countryWhere({})).toBeNull();
  });

  it('treats "all" as the whole church', () => {
    expect(countryWhere({ country: 'ALL' })).toBeNull();
    expect(countryWhere({ country: 'all' })).toBeNull();
  });

  it('keeps church-wide content visible inside a country', () => {
    // A Namibian reader must still see what the whole church published.
    expect(countryWhere({ country: 'NA' })).toEqual({
      OR: [{ scope: 'GLOBAL' }, { branch: { countryCode: 'NA' } }],
    });
  });

  it('lets a named branch win over a country', () => {
    expect(countryWhere({ country: 'ZA', branch: 'windhoek' })).toBeNull();
  });
});

describe('collectionWhere', () => {
  it('does not narrow by default, so everything is shown together', () => {
    expect(collectionWhere({})).toBeNull();
  });

  it('separates the two standing sections from the branches', () => {
    expect(collectionWhere({ collection: 'TOG' })).toEqual({ collection: 'TOG' });
    expect(collectionWhere({ collection: 'HOLY_CONVOCATION' })).toEqual({
      collection: 'HOLY_CONVOCATION',
    });
    expect(collectionWhere({ collection: 'LOCAL' })).toEqual({ collection: 'LOCAL' });
  });
});

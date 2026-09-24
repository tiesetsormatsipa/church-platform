import { describe, expect, it } from 'vitest';
import { directionsUrl } from './maps';

describe('directionsUrl', () => {
  it('prefers a stored https maps link', () => {
    expect(
      directionsUrl({ mapsUrl: 'https://maps.example/x', latitude: 1, longitude: 2, address: [] }),
    ).toBe('https://maps.example/x');
  });
  it('ignores non-https links and falls back to coordinates, then address', () => {
    expect(
      directionsUrl({
        mapsUrl: 'javascript:alert(1)',
        latitude: -26.2,
        longitude: 28.04,
        address: [],
      }),
    ).toBe('https://www.google.com/maps/search/?api=1&query=-26.2,28.04');
    expect(
      directionsUrl({
        mapsUrl: null,
        latitude: null,
        longitude: null,
        address: ['1 Main Rd', 'Durban'],
      }),
    ).toBe('https://www.google.com/maps/search/?api=1&query=1%20Main%20Rd%2C%20Durban');
    expect(
      directionsUrl({ mapsUrl: null, latitude: null, longitude: null, address: [] }),
    ).toBeNull();
  });
});

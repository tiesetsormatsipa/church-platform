import { describe, expect, it } from 'vitest';
import { COUNTRIES, countryHue, countryInfo, countryName, isKnownCountry } from './countries.js';

describe('country reference data', () => {
  it('keys every entry by its own code, in upper case', () => {
    for (const [key, info] of Object.entries(COUNTRIES)) {
      expect(info.code).toBe(key);
      expect(key).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('places every country somewhere real', () => {
    for (const info of Object.values(COUNTRIES)) {
      expect(info.latitude).toBeGreaterThanOrEqual(-90);
      expect(info.latitude).toBeLessThanOrEqual(90);
      expect(info.longitude).toBeGreaterThanOrEqual(-180);
      expect(info.longitude).toBeLessThanOrEqual(180);
      expect(info.name.trim()).not.toBe('');
    }
  });

  it('knows the countries the church is actually in', () => {
    // South Africa and Namibia are named in the owner's description of the hierarchy.
    expect(isKnownCountry('ZA')).toBe(true);
    expect(isKnownCountry('NA')).toBe(true);
    expect(countryName('ZA')).toBe('South Africa');
    expect(countryName('NA')).toBe('Namibia');
  });

  it('accepts a lower-case code', () => {
    expect(isKnownCountry('za')).toBe(true);
    expect(countryName('za')).toBe('South Africa');
  });

  it('falls back to the code itself for a country it does not know', () => {
    const info = countryInfo('QQ');
    expect(info).toEqual({ code: 'QQ', name: 'QQ', latitude: 0, longitude: 0 });
    expect(isKnownCountry('QQ')).toBe(false);
  });

  it('gives each country a stable hue on the colour wheel', () => {
    const first = countryHue('ZA');
    expect(countryHue('ZA')).toBe(first);
    expect(countryHue('za')).toBe(first);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(360);
  });

  it('does not give neighbouring countries the same hue', () => {
    // Adjacent entries must be visually distinct on the globe; the palette guarantees it.
    expect(countryHue('ZA')).not.toBe(countryHue('NA'));
    expect(countryHue('NA')).not.toBe(countryHue('BW'));
  });

  it('still produces a usable hue for an unknown code', () => {
    const hue = countryHue('QQ');
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
    expect(countryHue('QQ')).toBe(hue);
  });
});

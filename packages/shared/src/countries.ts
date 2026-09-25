/**
 * Countries the platform knows how to place on the globe.
 *
 * A country is "on the platform" when at least one branch sits in it, so this is reference
 * data rather than state: the name to show, a point to fly the globe to, and a stable colour
 * so that a country's branches are always drawn the same way. Adding a country here does not
 * make it appear; adding a branch does.
 *
 * Coordinates are a representative point for the country, not its exact centroid: they only
 * need to be good enough to centre the camera.
 */

export interface CountryInfo {
  /** ISO 3166-1 alpha-2, upper case. Matches `branches.country_code`. */
  code: string;
  name: string;
  /** Adjectival form, for phrases like "South African branches". */
  demonym?: string;
  latitude: number;
  longitude: number;
}

/**
 * The countries the church is in or expects to be in. Extend as the church grows; a code
 * that is missing here still works (the branch's own coordinates are used and the code is
 * shown in place of a name), it simply has no camera target of its own.
 */
export const COUNTRIES = {
  ZA: {
    code: 'ZA',
    name: 'South Africa',
    demonym: 'South African',
    latitude: -28.48,
    longitude: 24.68,
  },
  NA: { code: 'NA', name: 'Namibia', demonym: 'Namibian', latitude: -22.56, longitude: 17.08 },
  BW: { code: 'BW', name: 'Botswana', demonym: 'Botswanan', latitude: -22.33, longitude: 24.68 },
  ZW: { code: 'ZW', name: 'Zimbabwe', demonym: 'Zimbabwean', latitude: -19.02, longitude: 29.15 },
  MZ: { code: 'MZ', name: 'Mozambique', demonym: 'Mozambican', latitude: -18.67, longitude: 35.53 },
  LS: { code: 'LS', name: 'Lesotho', demonym: 'Basotho', latitude: -29.61, longitude: 28.23 },
  SZ: { code: 'SZ', name: 'Eswatini', demonym: 'Swazi', latitude: -26.52, longitude: 31.47 },
  ZM: { code: 'ZM', name: 'Zambia', demonym: 'Zambian', latitude: -13.13, longitude: 27.85 },
  MW: { code: 'MW', name: 'Malawi', demonym: 'Malawian', latitude: -13.25, longitude: 34.3 },
  KE: { code: 'KE', name: 'Kenya', demonym: 'Kenyan', latitude: -0.02, longitude: 37.91 },
  NG: { code: 'NG', name: 'Nigeria', demonym: 'Nigerian', latitude: 9.08, longitude: 8.68 },
  GH: { code: 'GH', name: 'Ghana', demonym: 'Ghanaian', latitude: 7.95, longitude: -1.02 },
  US: {
    code: 'US',
    name: 'United States',
    demonym: 'American',
    latitude: 39.83,
    longitude: -98.58,
  },
  GB: { code: 'GB', name: 'United Kingdom', demonym: 'British', latitude: 54.0, longitude: -2.0 },
  CA: { code: 'CA', name: 'Canada', demonym: 'Canadian', latitude: 56.13, longitude: -106.35 },
  AU: { code: 'AU', name: 'Australia', demonym: 'Australian', latitude: -25.27, longitude: 133.78 },
  IN: { code: 'IN', name: 'India', demonym: 'Indian', latitude: 20.59, longitude: 78.96 },
  JM: { code: 'JM', name: 'Jamaica', demonym: 'Jamaican', latitude: 18.11, longitude: -77.3 },
} as const satisfies Record<string, CountryInfo>;

export type CountryCode = keyof typeof COUNTRIES;

export function isKnownCountry(code: string): code is CountryCode {
  return Object.hasOwn(COUNTRIES, code.toUpperCase());
}

/** The country's details, or a usable stand-in built from the code itself. */
export function countryInfo(code: string): CountryInfo {
  const upper = code.toUpperCase();
  if (isKnownCountry(upper)) return COUNTRIES[upper];
  return { code: upper, name: upper, latitude: 0, longitude: 0 };
}

export function countryName(code: string): string {
  return countryInfo(code).name;
}

/**
 * Hues (in degrees) assigned to countries, so that every branch of a country is drawn in the
 * same colour and neighbouring countries do not collide. The palette is walked in a fixed
 * order by country code, which keeps a country's colour stable as others are added.
 */
const HUES = [212, 150, 28, 280, 340, 92, 190, 250, 12, 320, 66, 172] as const;

/** A stable hue for a country, for the globe's dots and a country's accents. */
export function countryHue(code: string): number {
  const upper = code.toUpperCase();
  const known = Object.keys(COUNTRIES);
  const index = known.indexOf(upper);
  if (index >= 0) return HUES[index % HUES.length] ?? HUES[0];
  // Unknown code: derive a hue from its letters so it is at least consistent.
  let hash = 0;
  for (const char of upper) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

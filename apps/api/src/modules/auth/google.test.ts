import { describe, expect, it } from 'vitest';
import { decodeIdToken, readProfile } from './google.service.js';

const CLIENT_ID = '601678970197-example.apps.googleusercontent.com';
const NONCE = 'a-nonce-we-sent';
const NOW = new Date('2026-09-27T20:00:00Z');

function claims(overrides: Record<string, unknown> = {}) {
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: '1234567890',
    exp: Math.floor(NOW.getTime() / 1000) + 600,
    nonce: NONCE,
    email: 'Grace.Dlamini@Example.ORG',
    email_verified: true,
    given_name: 'Grace',
    family_name: 'Dlamini',
    name: 'Grace Dlamini',
    ...overrides,
  };
}

const expected = { clientId: CLIENT_ID, nonce: NONCE };

describe('reading what Google says about someone', () => {
  it('accepts a token meant for us and normalises the address', () => {
    const profile = readProfile(claims(), expected, NOW);
    expect(profile).toEqual({
      subject: '1234567890',
      email: 'grace.dlamini@example.org',
      emailVerified: true,
      firstName: 'Grace',
      lastName: 'Dlamini',
    });
  });

  it('accepts an audience given as a list', () => {
    expect(readProfile(claims({ aud: [CLIENT_ID] }), expected, NOW).subject).toBe('1234567890');
  });

  it('falls back to the full name when the parts are missing', () => {
    const profile = readProfile(
      claims({ given_name: undefined, family_name: undefined, name: 'Sipho Nkosi' }),
      expected,
      NOW,
    );
    expect(profile.firstName).toBe('Sipho');
    expect(profile.lastName).toBe('Nkosi');
  });
});

describe('tokens that must be refused', () => {
  it('refuses one from another issuer', () => {
    expect(() => readProfile(claims({ iss: 'https://evil.example' }), expected, NOW)).toThrow();
  });

  it('refuses one minted for a different application', () => {
    expect(() => readProfile(claims({ aud: 'someone-else' }), expected, NOW)).toThrow();
  });

  it('refuses one that has expired', () => {
    const stale = claims({ exp: Math.floor(NOW.getTime() / 1000) - 1 });
    expect(() => readProfile(stale, expected, NOW)).toThrow();
  });

  it('refuses one whose nonce is not the one we sent', () => {
    // This is what stops a token captured elsewhere being replayed into our callback.
    expect(() => readProfile(claims({ nonce: 'someone-elses' }), expected, NOW)).toThrow();
  });

  it('refuses an address Google has not confirmed', () => {
    // Otherwise anyone could claim an existing account by asserting its address.
    expect(() => readProfile(claims({ email_verified: false }), expected, NOW)).toThrow();
    expect(() => readProfile(claims({ email_verified: undefined }), expected, NOW)).toThrow();
  });

  it('refuses one with no subject or no address', () => {
    expect(() => readProfile(claims({ sub: undefined }), expected, NOW)).toThrow();
    expect(() => readProfile(claims({ email: undefined }), expected, NOW)).toThrow();
  });
});

describe('decoding the token', () => {
  it('reads the payload of a well-formed token', () => {
    const payload = Buffer.from(JSON.stringify({ sub: 'abc' })).toString('base64url');
    expect(decodeIdToken(`header.${payload}.signature`)).toEqual({ sub: 'abc' });
  });

  it('refuses anything that is not one', () => {
    expect(() => decodeIdToken('not-a-token')).toThrow();
    expect(() => decodeIdToken('header.not-base64-json.signature')).toThrow();
  });
});

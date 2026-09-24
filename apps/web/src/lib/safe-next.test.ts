import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it('keeps same-site paths with query and hash', () => {
    expect(safeNext('/profile')).toBe('/profile');
    expect(safeNext('/events?branch=pretoria#soon')).toBe('/events?branch=pretoria#soon');
  });

  it.each([
    [undefined],
    [''],
    ['https://evil.example/'],
    ['//evil.example/path'],
    ['/\\evil.example'],
    ['javascript:alert(1)'],
    ['/%0d%0aSet-Cookie:x'.replace('%0d%0a', '\r\n')],
    ['/sign-in?next=/profile'],
    ['/reset-password?token=abc'],
  ])('falls back for %j', (value) => {
    expect(safeNext(value)).toBe('/');
  });

  it('uses the given fallback', () => {
    expect(safeNext('//x', '/profile')).toBe('/profile');
  });
});

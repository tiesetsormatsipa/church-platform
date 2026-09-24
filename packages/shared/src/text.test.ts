import { describe, expect, it } from 'vitest';
import { excerpt, normalizeEmail, slugify, uniqueSlug } from './text.js';

describe('slugify', () => {
  it('produces readable, URL-safe slugs', () => {
    expect(slugify('Annual Convention 2026')).toBe('annual-convention-2026');
    expect(slugify('  Cape Town — Sunday Service! ')).toBe('cape-town-sunday-service');
    expect(slugify('Café & Fellowship')).toBe('cafe-and-fellowship');
    expect(slugify('???')).toBe('item');
  });

  it('caps the length without leaving a trailing hyphen', () => {
    const slug = slugify('word '.repeat(40));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('uniqueSlug', () => {
  it('adds a numeric suffix when taken', async () => {
    const taken = new Set(['easter', 'easter-2']);
    expect(await uniqueSlug('Easter', async (s) => taken.has(s))).toBe('easter-3');
    expect(await uniqueSlug('Pentecost', async (s) => taken.has(s))).toBe('pentecost');
  });
});

describe('excerpt', () => {
  it('strips Markdown and truncates on a word boundary', () => {
    expect(excerpt('## Hello\n\nThis is **bold** and a [link](https://x.y).')).toBe(
      'Hello This is bold and a link.',
    );
    const long = excerpt('lorem ipsum '.repeat(50), 40);
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long.endsWith('…')).toBe(true);
    expect(excerpt(null)).toBe('');
  });
});

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Grace.D@Example.ORG ')).toBe('grace.d@example.org');
  });
});

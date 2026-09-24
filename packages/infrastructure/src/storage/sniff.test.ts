import { describe, expect, it } from 'vitest';
import { isCompatibleMimeType, sniffMimeType } from './sniff.js';

const bytes = (...values: number[]) => Buffer.from(values);
const text = (s: string, pad = 16) => Buffer.concat([Buffer.from(s, 'latin1'), Buffer.alloc(pad)]);

describe('sniffMimeType', () => {
  it.each([
    ['image/jpeg', bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0)],
    ['image/png', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0)],
    ['image/gif', text('GIF89a')],
    [
      'image/webp',
      Buffer.concat([Buffer.from('RIFF'), bytes(0, 0, 0, 0), Buffer.from('WEBPVP8 ')]),
    ],
    ['audio/wav', Buffer.concat([Buffer.from('RIFF'), bytes(0, 0, 0, 0), Buffer.from('WAVEfmt ')])],
    ['application/pdf', text('%PDF-1.7')],
    ['audio/ogg', text('OggS')],
    ['audio/mpeg', text('ID3\u0004')],
    ['audio/mpeg', bytes(0xff, 0xfb, 0x90, 0x64)],
    ['audio/aac', bytes(0xff, 0xf1, 0x50, 0x80)],
    ['video/webm', bytes(0x1a, 0x45, 0xdf, 0xa3, 0, 0)],
    ['video/mp4', Buffer.concat([bytes(0, 0, 0, 0x18), Buffer.from('ftypisom'), Buffer.alloc(8)])],
    ['audio/mp4', Buffer.concat([bytes(0, 0, 0, 0x18), Buffer.from('ftypM4A '), Buffer.alloc(8)])],
    [
      'video/quicktime',
      Buffer.concat([bytes(0, 0, 0, 0x14), Buffer.from('ftypqt  '), Buffer.alloc(8)]),
    ],
    ['image/avif', Buffer.concat([bytes(0, 0, 0, 0x1c), Buffer.from('ftypavif'), Buffer.alloc(8)])],
  ])('detects %s', (expected, head) => {
    expect(sniffMimeType(head)).toBe(expected);
  });

  it('returns null for unknown content (e.g. an HTML file renamed to .jpg)', () => {
    expect(sniffMimeType(text('<!doctype html><script>'))).toBeNull();
    expect(sniffMimeType(Buffer.alloc(0))).toBeNull();
  });
});

describe('isCompatibleMimeType', () => {
  it('accepts equal and equivalent container types only', () => {
    expect(isCompatibleMimeType('image/png', 'image/png')).toBe(true);
    expect(isCompatibleMimeType('audio/x-m4a', 'video/mp4')).toBe(true);
    expect(isCompatibleMimeType('image/png', 'image/jpeg')).toBe(false);
    expect(isCompatibleMimeType('image/png', null)).toBe(false);
  });
});

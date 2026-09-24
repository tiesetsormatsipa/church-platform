/**
 * Detect a file's real type from its first bytes ("magic numbers"). Uploads whose content
 * does not match the declared MIME type are rejected by the worker.
 * Returns null when the signature is not recognised.
 */
export function sniffMimeType(head: Buffer): string | null {
  const b = head;
  const ascii = (start: number, end: number) => b.subarray(start, end).toString('latin1');
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (
    b.length >= 8 &&
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png';
  if (b.length >= 6 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')) return 'image/gif';
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return 'audio/wav';
  if (b.length >= 5 && ascii(0, 5) === '%PDF-') return 'application/pdf';
  if (b.length >= 4 && ascii(0, 4) === 'OggS') return 'audio/ogg';
  if (b.length >= 4 && b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])))
    return 'video/webm';
  if (b.length >= 3 && ascii(0, 3) === 'ID3') return 'audio/mpeg';
  // ADTS AAC: 12-bit sync word 0xFFF with layer bits 00.
  if (b.length >= 2 && b[0] === 0xff && ((b[1] ?? 0) & 0xf6) === 0xf0) return 'audio/aac';
  // MPEG audio frame without an ID3 tag: 11-bit sync, layer bits not 00.
  if (
    b.length >= 2 &&
    b[0] === 0xff &&
    ((b[1] ?? 0) & 0xe0) === 0xe0 &&
    ((b[1] ?? 0) & 0x06) !== 0
  ) {
    return 'audio/mpeg';
  }
  // ISO base media (MP4 / M4A / MOV / AVIF / HEIC): "ftyp" box at offset 4.
  if (b.length >= 12 && ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (brand === 'qt  ') return 'video/quicktime';
    if (brand.startsWith('M4A') || brand === 'M4B ') return 'audio/mp4';
    return 'video/mp4';
  }
  return null;
}

/** Declared types that are acceptable for a sniffed type (containers are ambiguous). */
export function isCompatibleMimeType(declared: string, sniffed: string | null): boolean {
  if (!sniffed) return false;
  if (declared === sniffed) return true;
  const groups = [
    ['audio/mp4', 'audio/x-m4a', 'video/mp4'],
    ['audio/wav', 'audio/x-wav'],
    ['audio/mpeg', 'audio/mp3'],
  ];
  return groups.some((g) => g.includes(declared) && g.includes(sniffed));
}

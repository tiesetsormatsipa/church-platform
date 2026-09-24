/**
 * Object key layout: `{public|private}/{yyyy}/{mm}/{mediaId}/{name}.{ext}`.
 * Keys never contain user-supplied text.
 */
export const PUBLIC_PREFIX = 'public/';
export const PRIVATE_PREFIX = 'private/';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
};

export function extensionFor(mimeType: string): string {
  return EXTENSIONS[mimeType] ?? 'bin';
}

export function mediaKey(options: {
  visibility: 'PUBLIC' | 'PRIVATE';
  mediaId: string;
  name: string;
  mimeType: string;
  createdAt?: Date;
}): string {
  const date = options.createdAt ?? new Date();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const prefix = options.visibility === 'PUBLIC' ? PUBLIC_PREFIX : PRIVATE_PREFIX;
  if (!/^[a-z0-9_-]+$/.test(options.name)) throw new Error(`Invalid media key name: ${options.name}`);
  return `${prefix}${yyyy}/${mm}/${options.mediaId}/${options.name}.${extensionFor(options.mimeType)}`;
}

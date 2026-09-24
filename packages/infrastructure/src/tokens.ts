import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** A URL-safe random token with `bytes` bytes of entropy (default 256 bits). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Lower-case hex SHA-256, used to store tokens without storing the tokens themselves. */
export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Constant-time string comparison. */
export function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

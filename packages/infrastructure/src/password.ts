/**
 * Password hashing.
 *
 * New hashes are argon2id (OWASP baseline: m = 19 MiB, t = 2, p = 1). Hashes imported from
 * legacy systems are verified in their original format and must be re-hashed after a
 * successful login (`needsRehash`). See ADR-009.
 */
import { pbkdf2, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { hash as argon2Hash, parseOptions, verify as argon2Verify, type Options } from '@node-rs/argon2';
import bcrypt from 'bcryptjs';

const pbkdf2Async = promisify(pbkdf2);
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/** Argon2id; `algorithm: 2` is `Algorithm.Argon2id` (a const enum, not importable here). */
export const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const satisfies Options;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 256;

export type PasswordHashFormat =
  | 'argon2id'
  | 'bcrypt'
  | 'django-pbkdf2'
  | 'werkzeug-pbkdf2'
  | 'werkzeug-scrypt'
  | 'passlib-pbkdf2'
  | 'unknown';

export async function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, ARGON2_OPTIONS);
}

export function detectHashFormat(stored: string): PasswordHashFormat {
  if (stored.startsWith('$argon2id$')) return 'argon2id';
  if (/^\$2[aby]\$\d{2}\$/.test(stored)) return 'bcrypt';
  if (/^pbkdf2_sha(1|256)\$\d+\$/.test(stored)) return 'django-pbkdf2';
  if (/^pbkdf2:sha(1|256|512):\d+\$/.test(stored)) return 'werkzeug-pbkdf2';
  if (/^scrypt:\d+:\d+:\d+\$/.test(stored)) return 'werkzeug-scrypt';
  if (/^\$pbkdf2-sha(1|256|512)\$\d+\$/.test(stored)) return 'passlib-pbkdf2';
  return 'unknown';
}

/** True when a stored hash should be replaced with a fresh argon2id hash. */
export function needsRehash(stored: string): boolean {
  if (detectHashFormat(stored) !== 'argon2id') return true;
  try {
    const opts = parseOptions(stored);
    return (
      opts.memoryCost < ARGON2_OPTIONS.memoryCost ||
      opts.timeCost < ARGON2_OPTIONS.timeCost ||
      opts.parallelism !== ARGON2_OPTIONS.parallelism
    );
  } catch {
    return true;
  }
}

/**
 * Verify `password` against a stored hash of any supported format.
 * Returns false (never throws) for malformed or unknown hashes.
 */
export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  if (password.length > PASSWORD_MAX_LENGTH) return false;
  try {
    switch (detectHashFormat(stored)) {
      case 'argon2id':
        return await argon2Verify(stored, password);
      case 'bcrypt':
        // bcryptjs understands $2a$/$2b$; $2y$ (PHP) is the same algorithm.
        return await bcrypt.compare(password, stored.replace(/^\$2y\$/, '$2b$'));
      case 'django-pbkdf2':
        return await verifyDjangoPbkdf2(stored, password);
      case 'werkzeug-pbkdf2':
        return await verifyWerkzeugPbkdf2(stored, password);
      case 'werkzeug-scrypt':
        return await verifyWerkzeugScrypt(stored, password);
      case 'passlib-pbkdf2':
        return await verifyPasslibPbkdf2(stored, password);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * A valid argon2id hash of a random password. Verifying against it when an account does not
 * exist keeps login timing independent of whether the e-mail is registered.
 */
let dummyHash: Promise<string> | undefined;
export function timingDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(`dummy-${Math.random()}-${Date.now()}`);
  return dummyHash;
}

// ---------------------------------------------------------------------------
// Legacy formats
// ---------------------------------------------------------------------------

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

function digestName(algo: string): 'sha1' | 'sha256' | 'sha512' {
  if (algo === 'sha1' || algo === 'sha256' || algo === 'sha512') return algo;
  throw new Error(`Unsupported digest ${algo}`);
}

/** Django: `pbkdf2_sha256$<iterations>$<salt>$<base64 hash>` */
async function verifyDjangoPbkdf2(stored: string, password: string): Promise<boolean> {
  const [algorithm, iterations, salt, encoded] = stored.split('$');
  if (!algorithm || !iterations || salt === undefined || !encoded) return false;
  const digest = digestName(algorithm.replace('pbkdf2_', ''));
  const expected = Buffer.from(encoded, 'base64');
  const actual = await pbkdf2Async(password, salt, Number(iterations), expected.length, digest);
  return safeEqual(actual, expected);
}

/** Werkzeug: `pbkdf2:sha256:<iterations>$<salt>$<hex hash>` */
async function verifyWerkzeugPbkdf2(stored: string, password: string): Promise<boolean> {
  const [method, salt, hex] = stored.split('$');
  if (!method || salt === undefined || !hex) return false;
  const [, algo, iterations] = method.split(':');
  if (!algo || !iterations) return false;
  const expected = Buffer.from(hex, 'hex');
  const actual = await pbkdf2Async(password, salt, Number(iterations), expected.length, digestName(algo));
  return safeEqual(actual, expected);
}

/** Werkzeug ≥ 3: `scrypt:<N>:<r>:<p>$<salt>$<hex hash>` */
async function verifyWerkzeugScrypt(stored: string, password: string): Promise<boolean> {
  const [method, salt, hex] = stored.split('$');
  if (!method || salt === undefined || !hex) return false;
  const [, n, r, p] = method.split(':').map(Number);
  if (!n || !r || !p) return false;
  const expected = Buffer.from(hex, 'hex');
  const actual = await scryptAsync(password, salt, expected.length, {
    N: n,
    r,
    p,
    maxmem: 132 * n * r * p,
  });
  return safeEqual(actual, expected);
}

/** passlib: `$pbkdf2-sha256$<iterations>$<ab64 salt>$<ab64 hash>` */
async function verifyPasslibPbkdf2(stored: string, password: string): Promise<boolean> {
  const [, scheme, iterations, salt, hash] = stored.split('$');
  if (!scheme || !iterations || salt === undefined || !hash) return false;
  const digest = digestName(scheme.replace('pbkdf2-', ''));
  const decode = (ab64: string) => Buffer.from(ab64.replace(/\./g, '+'), 'base64');
  const expected = decode(hash);
  const actual = await pbkdf2Async(password, decode(salt), Number(iterations), expected.length, digest);
  return safeEqual(actual, expected);
}

import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { detectHashFormat, hashPassword, needsRehash, verifyPassword } from './password.js';

const PASSWORD = 'Legacy-Pass-2024';

// Vectors produced independently with Python's hashlib (see docs/DATA_MIGRATION.md §6).
const VECTORS = {
  'django-pbkdf2': 'pbkdf2_sha256$1000$Nq6ZlKTb1k3v$UUGEFIV5gXl1ex+BNKm2qGEzJjKZNrpQeHfJsyx4Lfc=',
  'werkzeug-pbkdf2':
    'pbkdf2:sha256:1000$a1B2c3D4e5F6g7H8$9799bb40d961926c3f9f31c9c46eab13d9da0b853ac16cfff8604ce7f1ffc14d',
  'werkzeug-scrypt':
    'scrypt:1024:8:1$Zx9Yw8Vu7Ts6Rq5P$d27c551dd4f7644d51208dfa93445303801c823d5655d08ebca479917cb1aaaa6345f2533a5680b31e348b5860254d287db0b1a4d8db5ea1be9f63c699e19cbd',
  'passlib-pbkdf2':
    '$pbkdf2-sha256$1000$AQIDBHNhbHR5c2FsdA$PPc6/4X8yy187GErWdY5hSoR5MH2ztGytqD/oZTwNWk',
} as const;

describe('argon2id', () => {
  it('hashes and verifies, and does not need a rehash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true);
    expect(await verifyPassword(hash, 'Correct horse battery staple')).toBe(false);
    expect(needsRehash(hash)).toBe(false);
  });
});

describe('legacy formats', () => {
  it.each(Object.entries(VECTORS))('%s verifies and requests a rehash', async (format, stored) => {
    expect(detectHashFormat(stored)).toBe(format);
    expect(await verifyPassword(stored, PASSWORD)).toBe(true);
    expect(await verifyPassword(stored, `${PASSWORD}x`)).toBe(false);
    expect(needsRehash(stored)).toBe(true);
  });

  it('verifies bcrypt hashes from the legacy TypeScript app, including $2y$', async () => {
    const stored = await bcrypt.hash('Church@123', 4);
    expect(detectHashFormat(stored)).toBe('bcrypt');
    expect(await verifyPassword(stored, 'Church@123')).toBe(true);
    expect(await verifyPassword(stored.replace(/^\$2[ab]\$/, '$2y$'), 'Church@123')).toBe(true);
    expect(await verifyPassword(stored, 'church@123')).toBe(false);
  });

  it('rejects unknown and malformed hashes without throwing', async () => {
    expect(detectHashFormat('md5$abc')).toBe('unknown');
    expect(await verifyPassword('md5$abc', PASSWORD)).toBe(false);
    expect(await verifyPassword('pbkdf2_sha256$x$y', PASSWORD)).toBe(false);
    expect(await verifyPassword('$argon2id$garbage', PASSWORD)).toBe(false);
  });

  it('rejects absurdly long passwords before hashing', async () => {
    const hash = await hashPassword('short-enough-password');
    expect(await verifyPassword(hash, 'x'.repeat(10_000))).toBe(false);
  });
});

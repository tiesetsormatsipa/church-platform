/**
 * Environment parsing. Every process validates its environment at start-up and refuses to
 * run with missing or malformed configuration (fail fast, never fall back to insecure
 * defaults in production).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { z } from 'zod';

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment configuration:\n  - ${issues.join('\n  - ')}`);
    this.name = 'EnvValidationError';
  }
}

export function loadEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined> = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    // Only names and messages; never echo values (they may be secrets).
    const issues = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new EnvValidationError(issues);
  }
  return result.data;
}

/** "true" / "false" / "1" / "0" → boolean. */
export const envBoolean = (defaultValue: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => (v === undefined ? defaultValue : v === 'true' || v === '1'));

export const envPort = (defaultValue: number) =>
  z.coerce.number().int().min(1).max(65_535).default(defaultValue);

/** Comma-separated list → string[] (empty entries dropped). */
export const envList = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

export const NodeEnv = z.enum(['development', 'test', 'production']).default('development');

export const LogLevel = z
  .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  .default('info');

/** Secrets must be long enough to be unguessable. */
export const envSecret = (minLength = 32) =>
  z
    .string()
    .min(
      minLength,
      `must be at least ${minLength} characters (generate with: openssl rand -base64 48)`,
    );

/**
 * Development convenience: load `.env` from the working directory or the nearest ancestor
 * that contains `pnpm-workspace.yaml`. Variables already set in the environment win.
 * In production, configuration comes from the real environment (Docker/systemd).
 */
export function loadDotEnv(startDir: string = process.cwd()): string | null {
  let dir = resolve(startDir);
  for (;;) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) {
      const parsed = parseEnv(readFileSync(candidate, 'utf8'));
      for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
      return candidate;
    }
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

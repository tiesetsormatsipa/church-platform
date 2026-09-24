/**
 * Environment parsing. Every process validates its environment at start-up and refuses to
 * run with missing or malformed configuration (fail fast, never fall back to insecure
 * defaults in production).
 */
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

export const envPort = (defaultValue: number) => z.coerce.number().int().min(1).max(65_535).default(defaultValue);

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

export const LogLevel = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info');

/** Secrets must be long enough to be unguessable. */
export const envSecret = (minLength = 32) =>
  z.string().min(minLength, `must be at least ${minLength} characters (generate with: openssl rand -base64 48)`);

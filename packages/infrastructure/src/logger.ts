/**
 * Structured JSON logging (pino). Secrets and personal credentials are redacted.
 */
import { pino, type Logger, type LoggerOptions } from 'pino';

export type { Logger };

/** Paths redacted from every log line (request objects and common payload fields). */
export const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-csrf-token"]',
  'req.headers["x-internal-token"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.passwordHash',
  '*.token',
  '*.tokenHash',
  '*.secret',
  '*.secretAccessKey',
];

export interface CreateLoggerOptions {
  name: string;
  level?: string;
  /** Human-readable output (development only; requires pino-pretty to be installed). */
  pretty?: boolean;
  base?: Record<string, unknown>;
}

export function loggerOptions(options: CreateLoggerOptions): LoggerOptions {
  return {
    name: options.name,
    level: options.level ?? 'info',
    base: { service: options.name, ...options.base },
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    ...(options.pretty
      ? { transport: { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' } } }
      : {}),
  };
}

export function createLogger(options: CreateLoggerOptions): Logger {
  return pino(loggerOptions(options));
}

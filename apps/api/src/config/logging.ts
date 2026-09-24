import { randomUUID } from 'node:crypto';
import { loggerOptions } from '@church/infrastructure/logger';
import type { IncomingMessage } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { AppConfig } from './env.js';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

/** Accept a well-formed upstream X-Request-Id (from Nginx or the web app), else generate one. */
export function requestId(request: IncomingMessage): string {
  const header = request.headers['x-request-id'];
  const value = Array.isArray(header) ? header[0] : header;
  return value && REQUEST_ID_PATTERN.test(value) ? value : randomUUID();
}

export function httpLoggerOptions(config: AppConfig): Params {
  return {
    pinoHttp: {
      ...loggerOptions({ name: 'api', level: config.env.LOG_LEVEL, pretty: config.env.LOG_PRETTY }),
      // Fastify assigns request.id (see main.ts); reuse it for log correlation.
      genReqId: (req) => (req as IncomingMessage & { id?: string }).id ?? requestId(req),
      customProps: (req) => {
        const principal = (req as unknown as { principal?: { userId: string } }).principal;
        return principal ? { userId: principal.userId } : {};
      },
      autoLogging: { ignore: (req) => (req.url ?? '').startsWith('/api/health') },
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    },
  };
}

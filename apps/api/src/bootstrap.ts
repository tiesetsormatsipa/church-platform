import 'reflect-metadata';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import { StandardSchemaValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { resolveClient } from './common/http/client.js';
import { Errors } from './common/http/errors.js';
import { APP_CONFIG, type AppConfig } from './config/env.js';
import { requestId } from './config/logging.js';

export interface CreateAppOptions {
  /** Buffer logs until the pino logger is attached (default true). */
  bufferLogs?: boolean;
}

/** Build a fully configured (but not listening) application. */
export async function createApp(options: CreateAppOptions = {}): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    genReqId: requestId,
    bodyLimit: 1024 * 1024,
    trustProxy: process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1',
    logger: false,
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: options.bufferLogs ?? true,
  });
  app.useLogger(app.get(Logger));
  const config = app.get<AppConfig>(APP_CONFIG);

  await app.register(fastifyCookie);
  await app.register(fastifyHelmet, {
    // JSON API: nothing is rendered, so forbid everything except the Swagger UI in development.
    contentSecurityPolicy: config.apiDocsEnabled
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
            frameAncestors: ["'none'"],
          },
        }
      : { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
    hsts: config.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  });
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', async (request) => {
    request.client = resolveClient(request, config.env.INTERNAL_API_TOKEN);
  });
  fastify.addHook('onSend', async (request, reply) => {
    void reply.header('x-request-id', request.id);
  });

  if (config.env.ALLOWED_ORIGINS.length > 0) {
    app.enableCors({ origin: config.trustedOrigins, credentials: true });
  }

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      exceptionFactory: (issues) =>
        Errors.validation(
          issues.map((issue) => ({
            path: (issue.path ?? [])
              .map((segment) =>
                typeof segment === 'object' && segment !== null ? segment.key : segment,
              )
              .map(String)
              .join('.'),
            message: issue.message,
          })),
        ),
    }),
  );
  app.enableShutdownHooks();

  if (config.apiDocsEnabled) {
    SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app));
  }
  return app;
}

export function buildOpenApiDocument(app: NestFastifyApplication): OpenAPIObject {
  const document = new DocumentBuilder()
    .setTitle('Church Platform API')
    .setDescription(
      'REST API of the Church Platform. Authentication uses an HttpOnly session cookie; unsafe methods also require the CSRF token cookie echoed in the X-CSRF-Token header.',
    )
    .setVersion('1')
    .addCookieAuth('cp_session')
    .build();
  return SwaggerModule.createDocument(app, document);
}

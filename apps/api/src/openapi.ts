/**
 * Writes the OpenAPI document without connecting to any service:
 *   node dist/openapi.js <output.json>
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

process.env.OPENAPI_EXPORT = '1';
process.env.API_DOCS_ENABLED = 'false';
const defaults: Record<string, string> = {
  APP_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://openapi:openapi@localhost:5432/openapi',
  REDIS_URL: 'redis://localhost:6379',
  S3_BUCKET: 'openapi',
  S3_ACCESS_KEY_ID: 'openapi',
  S3_SECRET_ACCESS_KEY: 'openapi',
  MEDIA_PUBLIC_BASE_URL: 'http://localhost:9000/openapi',
  LOG_LEVEL: 'warn',
};
for (const [key, value] of Object.entries(defaults)) process.env[key] ??= value;

const { createApp, buildOpenApiDocument } = await import('./bootstrap.js');
const app = await createApp({ bufferLogs: false });
await app.init();
const document = buildOpenApiDocument(app);
const output = resolve(process.argv[2] ?? 'openapi.json');
await writeFile(output, `${JSON.stringify(document, null, 2)}\n`);
await app.close();
console.warn(`OpenAPI document written to ${output}`);

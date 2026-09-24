import { defineConfig } from 'prisma/config';

// Prisma 7 reads the datasource URL from here rather than from schema.prisma.
// Defaults target the local development databases from infra/docker/compose.dev.yml so that
// `prisma generate` and drift checks work without an env file.
const url = process.env.DATABASE_URL ?? 'postgresql://church:church@localhost:5432/church';
const shadowDatabaseUrl =
  process.env.SHADOW_DATABASE_URL ?? 'postgresql://church:church@localhost:5432/church_shadow';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url,
    shadowDatabaseUrl,
  },
});

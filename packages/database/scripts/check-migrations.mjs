#!/usr/bin/env node
// Fails when prisma/schema.prisma and prisma/migrations disagree, i.e. someone changed the
// schema without creating a migration (or edited a migration so it no longer matches).
// Requires a scratch shadow database (SHADOW_DATABASE_URL, see prisma.config.ts).
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'prisma',
  [
    'migrate',
    'diff',
    '--from-migrations',
    'prisma/migrations',
    '--to-schema',
    'prisma/schema.prisma',
    '--script',
    '--exit-code',
  ],
  { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', shell: process.platform === 'win32' },
);

if (result.status === 0) {
  console.log('Migrations match schema.prisma.');
  process.exit(0);
}
if (result.status === 2) {
  console.error('schema.prisma has changes that no migration covers:\n');
  console.error(result.stdout);
  console.error('Create a migration: pnpm db:migrate --name <change> (see CLAUDE.md).');
  process.exit(1);
}
console.error(result.stdout);
process.exit(result.status ?? 1);

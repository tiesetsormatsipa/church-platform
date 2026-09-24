# Legacy implementation (read-only reference)

This directory contains the previous TypeScript implementation of the platform
(Next.js 14 + NestJS 10 + Prisma 5), moved here unchanged by the rewrite.

* It is **not** part of the pnpm workspace and is not built, linted or tested.
* It is kept for reference and because `tools/legacy-migration` reads its Prisma
  schema to extract data from the legacy database.
* Do not modify it. See `docs/LEGACY_AUDIT.md` for the analysis and
  `docs/DATA_MIGRATION.md` for how its data is migrated.

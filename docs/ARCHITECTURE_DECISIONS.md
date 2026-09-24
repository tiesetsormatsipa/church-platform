# Architecture Decision Records

Each record lists the context, the decision and its consequences. Records marked
**Deviation** depart from the baseline stack in the original brief.

| # | Title | Status |
| --- | --- | --- |
| 001 | Modular monolith with a separate worker process | Accepted |
| 002 | pnpm workspaces without Turborepo | Accepted (Deviation: optional tool not adopted) |
| 003 | TypeScript 6.0, not 7.0 | Accepted |
| 004 | ESM throughout; the API is an ES module | Accepted |
| 005 | Zod 4 through Nest's native Standard Schema support | Accepted |
| 006 | UUIDv7 primary keys + slugs | Accepted |
| 007 | Prisma 7 stable with the `pg` driver adapter | Accepted |
| 008 | Server-side sessions in HttpOnly cookies instead of JWTs | Accepted |
| 009 | Transparent re-hashing of legacy password hashes | Accepted |
| 010 | One `ContentItem` table with typed detail tables | Accepted |
| 011 | Owned components on Base UI instead of a component registry | Accepted |
| 012 | Vitest for all automated tests except E2E | Accepted (Deviation from Nest's Jest default) |
| 013 | The worker is plain TypeScript, not a Nest application | Accepted |
| 014 | Markdown as the content body format | Accepted |
| 015 | Self-hosted fonts | Accepted |
| 016 | Deferred legacy modules (marketplace, jobs, messaging, praise songs) | Proposed: needs owner confirmation |
| 017 | Own Redis storage for rate limiting | Accepted |
| 018 | PostgreSQL full-text search behind an interface | Accepted |
| 019 | Typed organisation settings instead of a feature-flag engine | Accepted |
| 020 | Mailpit for local e-mail | Accepted |
| 021 | Reads via Server Components, writes via the browser straight to the API | Accepted |
| 022 | S3 presigned **PUT** uploads with signed size and type | Accepted (revised) |
| 023 | RustFS instead of MinIO for local S3 | Accepted (Deviation) |

---

## ADR-001 Modular monolith with a separate worker process

**Context.** The brief asks for scalability without microservices. Media processing and
notification fan-out are slow and CPU-heavy, and must not block API requests.

**Decision.** One NestJS API with strict domain modules, one Next.js web app, and one worker
process consuming BullMQ queues. All three share Postgres, Redis and object storage.

**Consequences.** One deployable unit per role, simple local development, horizontal scaling
of each process independently. Module boundaries (no cross-module table access, exported
services only) keep future extraction possible.

## ADR-002 pnpm workspaces without Turborepo

**Context.** The brief allows Turborepo only if it adds real value. The workspace has about
ten packages. pnpm already runs scripts in topological order (`pnpm -r build`) and can
filter dependents (`--filter ...^`).

**Decision.** Use pnpm workspaces alone. Root scripts orchestrate `build`, `lint`,
`typecheck`, `test`.

**Consequences.** One tool fewer. No remote build cache: CI builds everything (a few
minutes). Turborepo can be added later without restructuring if build times grow.

## ADR-003 TypeScript 6.0, not 7.0

**Context.** TypeScript 7.0 (the native Go port) is the `latest` npm tag. `@nestjs/cli` 12
and `@nestjs/swagger` 12 declare `typescript ~6.0` / `^5.5 || ^6.0` as peers and rely on the
JavaScript compiler API, which 7.0 does not provide in the same form. Nest also depends on
`emitDecoratorMetadata`.

**Decision.** Pin TypeScript `~6.0` across the workspace.

**Consequences.** Full compatibility with the Nest toolchain. Move to 7.x when Nest supports
it. `tsgo` can already be tried for type-checking speed.

## ADR-004 ESM throughout

**Context.** `@nestjs/core` 12 is published as ESM (`"type": "module"`). Prisma 7's
`prisma-client` generator emits ESM. Next.js is ESM-first.

**Decision.** Every package is `"type": "module"`, TypeScript uses
`module`/`moduleResolution: nodenext`, and relative imports carry `.js` extensions. Prisma is
generated with `moduleFormat = "esm"` and `importFileExtension = "js"`.

**Consequences.** A single module system with no dual-package hazards. Tooling that assumes
CommonJS (Jest without flags, `ts-node`) is avoided (see ADR-012).

## ADR-005 Zod 4 through Nest's native Standard Schema support

**Context.** The legacy API used `@Body() body: any`, so `ValidationPipe` whitelisting never
applied and mass assignment was possible. The brief asks for "Zod or the current
Nest-compatible schema validation strategy". Nest 12 ships a `StandardSchemaValidationPipe`,
`@Body({ schema })` / `@Query({ schema })` options, a Standard Schema serializer
interceptor, and `@nestjs/swagger` 12 converts Standard (JSON) Schemas into OpenAPI.
`nestjs-zod` does not yet support Nest 12.

**Decision.** Define request and response contracts as Zod 4 schemas in `packages/shared`.
The API validates through Nest's built-in Standard Schema pipe (unknown keys stripped) and
documents through Swagger's standard-schema converter. The web app reuses the same schemas
for form validation.

**Consequences.** One definition per contract, shared by browser and server. No decorators
duplicating types. OpenAPI stays accurate by construction.

## ADR-006 UUIDv7 primary keys + slugs

**Context.** The legacy app used random UUIDv4 strings and exposed them in URLs.

**Decision.** `uuid` columns defaulting to UUIDv7 (`@default(uuid(7))`), which is
time-ordered and gives better B-tree locality than v4 while staying safe to expose. Public
URLs use human slugs (`/branches/cape-town`, `/events/annual-convention-2026`).

**Consequences.** Stable, non-enumerable ids. Slugs must be unique per organisation, and
they are generated and de-duplicated by the API.

## ADR-007 Prisma 7 stable with the `pg` driver adapter

**Context.** The npm `latest` tag for `prisma` points at an 8.0 release candidate. The brief
explicitly asks for Prisma 7 stable.

**Decision.** Pin `prisma`, `@prisma/client` and `@prisma/adapter-pg` to the 7.x line
(7.10.0 at the time of writing). Use `prisma.config.ts` for datasource and migrations, the
`prisma-client` generator, and `@prisma/adapter-pg` (node-postgres pool). Constraints Prisma
cannot express (CHECK constraints, partial and GIN indexes, generated `tsvector`,
`NULLS NOT DISTINCT`) are written as SQL in migrations.

**Consequences.** Stable engine. Hand-written SQL in migrations must be preserved when
regenerating (documented in `CLAUDE.md`).

## ADR-008 Server-side sessions in HttpOnly cookies instead of JWTs

**Context.** Legacy JWTs sat in `localStorage` and could not be revoked. The web app and the
API share an origin behind Nginx.

**Decision.** Opaque random session tokens in `__Host-` HttpOnly cookies, with the SHA-256
of the token stored in Postgres. Every request validates the session (one indexed lookup,
cacheable in Redis later). CSRF is handled by an Origin check plus a double-submit token.

**Consequences.** Instant revocation, no token exposed to JavaScript, simple mental model.
Requires same-site deployment of web and API (true for this architecture). Mobile apps can
later use the same sessions with a bearer header variant.

## ADR-009 Transparent re-hashing of legacy password hashes

**Context.** Imported users must not be forced through a reset when their legacy hash can be
verified. The legacy TypeScript app uses bcrypt. Python frameworks typically use PBKDF2
(Django `pbkdf2_sha256$…`, Werkzeug `pbkdf2:sha256:…`) or scrypt.

**Decision.** `PasswordService.verify` recognises argon2id, bcrypt, Django PBKDF2 and
Werkzeug PBKDF2/scrypt formats. After a successful login with a non-argon2id hash, it
re-hashes with argon2id. Unknown formats force a password reset.

**Consequences.** Seamless migration. Legacy verifiers are isolated and can be deleted once
no legacy hashes remain (the admin dashboard reports the count).

## ADR-010 One `ContentItem` table with typed detail tables

**Context.** The feed mixes announcements, news, events, sermons and baptism stories. Scope
(global or branch), publishing, authorship, search and SEO are common to all of them. The
legacy app duplicated announcements across two tables.

**Decision.** Class-table inheritance: `content_items` holds the shared columns. The 1–1
tables `event_details`, `sermon_details` and `baptism_details` hold type-specific structure.

**Consequences.** One indexed query per feed page, one search index, one publishing
workflow. Type-specific queries join a single detail table. Adding a type is cheap.

## ADR-011 Owned components on Base UI instead of a component registry

**Context.** The brief suggests shadcn/ui with Base UI primitives where appropriate. shadcn
is a copy-in pattern rather than a dependency.

**Decision.** `packages/ui` contains our own shadcn-style components (CVA variants, Tailwind
tokens), built directly on `@base-ui/react` primitives for anything with behaviour (dialog,
drawer, menu, popover, select, tabs, tooltip, toast, switch, checkbox), and on plain
semantic HTML for the rest.

**Consequences.** Full ownership of markup and accessibility. One primitive library. The
components are shared by the public site and the admin.

## ADR-012 Vitest for all automated tests except E2E

**Context.** The Nest 12 template uses Jest under `--experimental-vm-modules` for ESM. The
web and shared packages are naturally served by Vitest.

**Decision.** Vitest everywhere (API tests compile decorators with SWC through
`unplugin-swc`). Playwright for E2E.

**Consequences.** One runner, native ESM and TypeScript, fast watch mode. Nest's testing
utilities (`@nestjs/testing`) work unchanged.

## ADR-013 The worker is plain TypeScript, not a Nest application

**Context.** The worker needs Prisma, S3, mail, sharp/ffmpeg and the Socket.IO emitter, but
no HTTP layer or DI graph.

**Decision.** A small TypeScript process with one BullMQ `Worker` per queue. It uses
`packages/database` and `packages/infrastructure` directly.

**Consequences.** Fast start, low memory, and no coupling to API internals. Shared logic
lives in packages, not in `apps/api`.

## ADR-014 Markdown as the content body format

**Context.** Legacy content is plain text. Editors are non-technical. Stored HTML is an XSS
risk.

**Decision.** Store Markdown (`body_format = MARKDOWN`). Render it on the server with raw
HTML disabled and a sanitising rehype pipeline. The admin editor is a Markdown textarea with
a formatting toolbar and live preview.

**Consequences.** Safe by construction, diff-friendly, portable. A rich-text JSON format can
be added later through `body_format`.

## ADR-015 Self-hosted fonts

**Context.** `next/font/google` downloads fonts at build time from Google, which fails in
restricted build environments and adds a third party.

**Decision.** Use `@fontsource-variable/*` packages loaded with `next/font/local`.

**Consequences.** Reproducible offline builds, no third-party font requests, a simpler CSP.

## ADR-016 Deferred legacy modules

**Context.** Marketplace, jobs, messaging and praise songs exist in the legacy code but were
disabled by default and never launched. They contain critical defects (client-controlled
prices), and they are absent from the live product described in the brief.

**Decision (proposed).** Do not rebuild them in v1. Export their data to a JSON archive
during migration. Keep the realtime, media and notification infrastructure generic so they
can come back as separate bounded contexts.

**Consequences.** A much smaller v1 attack surface and faster delivery of the core product.
**Needs owner confirmation.**

## ADR-017 Own Redis storage for rate limiting

**Context.** `@nest-lab/throttler-storage-redis` does not declare Nest 12 support. The
throttling needs are specific (per-account login limits, progressive lockout).

**Decision.** A small `RateLimitService` on Redis (atomic `INCR` + `PEXPIRE` via Lua) used
by a `@RateLimit()` guard and directly by the auth service.

**Consequences.** Works across replicas. About 100 lines of well-tested code instead of a
dependency.

## ADR-018 PostgreSQL full-text search behind an interface

**Context.** Content volume is small to medium. The brief asks to avoid Elasticsearch
initially.

**Decision.** Generated `tsvector` + GIN, and `pg_trgm` for names, behind `SearchService`.

**Consequences.** No extra infrastructure. The provider can be swapped for Meilisearch later.

## ADR-019 Typed organisation settings instead of a feature-flag engine

**Context.** The legacy feature-flag engine (rollout rules, percentages) served modules that
are now deferred, and its lookup was broken.

**Decision.** `organizations.settings` (JSONB) validated by a Zod schema: registration open,
baptism enquiries enabled, default notification preferences, social links. Changes are
audit-logged.

**Consequences.** Simple, typed operational toggles. A flag service can be introduced if
gradual rollouts become necessary.

## ADR-020 Mailpit for local e-mail

**Context.** Mailhog is unmaintained.

**Decision.** Mailpit (SMTP on 1025, UI on 8025) in local compose. The SMTP provider is also
used in production with a real relay, until an HTTP provider (Resend, Postmark, SES) is
configured.

## ADR-021 Reads via Server Components, writes via the browser straight to the API

**Context.** Two write paths (Server Actions and the REST API) would duplicate auth, CSRF
and validation.

**Decision.** Server Components read from the API server-to-server. Interactive writes go
from the browser to `/api/v1/*` on the same origin (Nginx in production, a Next rewrite in
development), so cookies and CSRF behave identically everywhere. Server Actions are not used
for domain mutations.

**Consequences.** The API is the single enforcement point for auth, permissions and
validation. Mobile clients can use the same API.

## ADR-022 S3 presigned PUT uploads with signed size and type

**Context.** Uploads must not pass through the API process, and oversized or mistyped
uploads must be rejected. The first draft chose presigned POST policies, but Cloudflare R2
(a named target) does not support POST Object, and self-hosted S3 servers vary in how well
they support it.

**Decision.** Presigned **PUT** URLs that sign `Content-Type` and `Content-Length`. The
storage service rejects any upload whose size or type differs from what the API approved
(verified against RustFS: wrong length → 403, wrong type → 403). The SDK client disables
default request checksums (`requestChecksumCalculation: WHEN_REQUIRED`), which browsers
cannot reproduce. The worker then validates magic bytes.

**Consequences.** Works on AWS S3, R2, MinIO, RustFS and Garage. The browser must send
exactly the declared file, which it does naturally.

## ADR-023 RustFS instead of MinIO for local S3

**Context.** The brief asks for MinIO locally. MinIO no longer publishes community Docker
images (`minio/minio` is gone from Docker Hub), so a fresh checkout cannot pull it.

**Decision.** Local development uses **RustFS** (Apache-2.0, S3-compatible, MinIO-style
access/secret keys and console) through `S3_IMAGE`, which defaults to `rustfs/rustfs:1.0.0`.
The application only speaks the S3 API, so MinIO (if you have an image), Garage,
SeaweedFS, AWS S3 or R2 work unchanged.

**Consequences.** No code depends on the choice. Production can use managed storage (R2/S3)
or self-hosted RustFS/MinIO behind Nginx.

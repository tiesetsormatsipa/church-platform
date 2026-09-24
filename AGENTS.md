# AGENTS.md: working on the Church Platform

This is the operating manual for AI coding agents (and humans) working in this repository.
Read it fully before changing anything. Current status and next steps are in
[`docs/HANDOVER.md`](docs/HANDOVER.md). Update that file whenever you finish a piece of
work.

---

## 1. What this is

A church community platform: a public site with a feed, events, news, sermons, baptism and
branch information, member accounts, and an administration area. The church has several
branches (Johannesburg, Pretoria, Cape Town, Durban, Kimberley, …). Content is either
**church-wide** (`scope = GLOBAL`) or belongs to **one branch** (`scope = BRANCH`).

It is a **modular monolith** in a pnpm monorepo:

| Path | What |
| --- | --- |
| `apps/web` | Next.js 16 (App Router, React Server Components by default). UI only; talks to the API. |
| `apps/api` | NestJS 12 on Fastify (ESM). REST `/api/v1`, OpenAPI, auth, RBAC, domain logic, Socket.IO. |
| `apps/worker` | BullMQ workers: e-mail, notifications fan-out, media processing, cache revalidation. |
| `packages/shared` | Browser-safe contracts: Zod schemas, enums, permission catalogue, job payloads, helpers. |
| `packages/database` | Prisma 7 schema, migrations, generated client, seeds. |
| `packages/infrastructure` | Server-only adapters: password hashing, tokens, env, logging, Redis/BullMQ, S3 storage, mail. |
| `packages/api-client` | OpenAPI document + generated types + typed fetch client. |
| `packages/ui` | Design system: tokens (`globals.css`) and components built on Base UI. |
| `packages/config` | Shared TypeScript configs. |
| `tools/legacy-migration` | Legacy data extract → validate → import → verify CLI. |
| `infra/docker` | Compose files (dev and prod), Dockerfiles, Nginx, backups. |
| `legacy/` | The previous implementation. **Read-only reference. Never modify, never build.** |
| `docs/` | Architecture, ADRs, audit, migration, API, security, deployment, UX system, handover. |

Key docs: [`ARCHITECTURE.md`](docs/ARCHITECTURE.md),
[`ARCHITECTURE_DECISIONS.md`](docs/ARCHITECTURE_DECISIONS.md) (ADRs),
[`LEGACY_AUDIT.md`](docs/LEGACY_AUDIT.md), [`DATA_MIGRATION.md`](docs/DATA_MIGRATION.md),
[`UX_SYSTEM.md`](docs/UX_SYSTEM.md), [`SECURITY.md`](docs/SECURITY.md),
[`API.md`](docs/API.md), [`DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## 2. Things you must never do

1. **Never** modify anything under `legacy/`.
2. **Never** reset, drop or truncate a database you did not create in the same run. Prisma
   blocks `migrate reset` for AI agents; do not bypass that guard. Integration tests create
   and drop their own uniquely named database (see §8).
3. **Never** hand-edit generated files: `packages/database/src/generated/**`,
   `packages/api-client/src/schema.d.ts`, `packages/api-client/openapi.json`. Regenerate
   them instead.
4. **Never** edit a migration that has been merged to `main`. Add a new migration.
5. **Never** trust client input: every body and query is validated by a Zod schema from
   `packages/shared`, and every mutation checks permissions **on the server** against the
   concrete target (branch or church-wide).
6. **Never** hard-code branch ids, slugs or names in logic. Branches are data.
7. **Never** return Prisma rows directly from controllers. Map them to a shared DTO and
   declare it with `@ApiResult(schema)`. The serializer strips undeclared fields.
8. **Never** log or return secrets, password hashes, tokens or session ids.
9. **Never** use `$queryRawUnsafe` / `$executeRawUnsafe`. Use tagged `$queryRaw`.
10. **Never** render user-supplied HTML. Content bodies are Markdown rendered without raw HTML.
11. **Never** import `@church/database` or `@church/infrastructure` from `apps/web`,
    `packages/ui` or `packages/shared` (ESLint enforces this).
12. **Never** commit `.env` files, credentials, data bundles or personal data.
13. **Never** push to `main` directly. See §11.
14. **Never** skip, disable or weaken a test to get green. Fix the cause.
15. **Never** add a dependency without checking its current version, licence and peer ranges.
    Prefer the platform and existing dependencies.

---

## 3. Commands

Requirements: Node ≥ 22.12 (24 LTS in production), pnpm 10, Docker.

```bash
cp .env.example .env              # local configuration (git-ignored)
pnpm install
pnpm infra:up                     # Postgres 18, Redis 7, RustFS (S3), Mailpit
pnpm db:generate && pnpm build:packages
pnpm db:migrate:deploy            # apply migrations
pnpm db:seed:demo                 # organisation, roles, demo branches/users/content
pnpm dev                          # web :3000, api :4000 (+ package watchers)
```

| Task | Command |
| --- | --- |
| Lint (whole repo) | `pnpm lint` |
| Type-check everything | `pnpm typecheck` |
| Unit tests (all packages) | `pnpm test` |
| API integration tests (real Postgres + Redis) | `pnpm test:integration` |
| End-to-end tests (Playwright) | `pnpm test:e2e` |
| Build everything | `pnpm build` |
| Full gate | `pnpm check` (lint → typecheck → test → build) |
| New migration after editing `schema.prisma` | `pnpm --filter @church/database migrate:create --name <change>`, review and complete the SQL, then `pnpm db:migrate:deploy` |
| Migration drift check | `pnpm --filter @church/database migrate:check` |
| Regenerate OpenAPI + typed client | `pnpm api:openapi` |
| API docs (dev) | http://localhost:4000/api/docs |
| Mail inbox (dev) | http://localhost:8025 |
| Storage console (dev) | http://localhost:9001 (church-dev / church-dev-secret) |

Demo accounts (after `pnpm db:seed:demo`), password `Church-Demo-2026!`:
`superadmin@example.org`, `admin@example.org` (church admin), `jhb.admin@example.org`
(Johannesburg branch admin), `ct.editor@example.org` (Cape Town editor),
`member@example.org`, `newmember@example.org` (pending membership).

---

## 4. Conventions

* **TypeScript 6, `strict`**, `noUncheckedIndexedAccess`. No `any` (lint error). Prefer
  inference and `satisfies`.
* **ESM everywhere.** Relative imports in `apps/api`, `apps/worker` and `packages/*` end in
  `.js` (`import { x } from './x.js'`). The web app uses the `@/` alias.
* **Contracts first.** Request/response shapes live in `packages/shared/src/schemas/*` as
  Zod 4 schemas. Top-level response schemas get `.meta({ id: 'Name' })` so OpenAPI has
  named components. Types come from `z.infer` / `z.input` / `z.output`.
* **Naming:** files `kebab-case.ts`; React components `PascalCase`; DB tables/columns
  `snake_case` via `@@map`/`@map`; permission keys `domain.action`; audit actions
  `domain.verb`; job names `queue` + `kebab-name`.
* **Errors:** throw `Errors.*` from `apps/api/src/common/http/errors.ts`. Clients receive
  RFC 9457 problem details with a stable `code`. Messages must be safe to show to users.
* **Logging:** use the Nest logger (pino underneath). Pass objects (`{ err, id }`), not
  interpolated strings. Never log personal data beyond ids.
* **Comments:** explain *why*, not *what*. Keep them short.
* **Formatting:** Prettier (`pnpm format`); 100 columns, single quotes, trailing commas.

---

## 5. Backend (apps/api)

Structure: `src/modules/<domain>/` with `*.controller.ts`, `*.service.ts`, `*.module.ts`,
optional `*.select.ts` (Prisma selects), `*.mapper.ts` (row → DTO), tests next to the code.
Cross-cutting pieces live in `src/common/` (decorators, errors, principal) and
`src/infrastructure/` (DB/Redis/S3/queue providers).

Request pipeline: **SessionAuthGuard** (resolves the cookie; routes are private unless
`@Public()`) → **RateLimitGuard** → **CsrfGuard** (unsafe methods need Origin + token) →
**PermissionGuard** (`@RequirePermission`) → Standard Schema validation → handler →
schema serializer → `ProblemDetailsFilter` on errors.

Adding an endpoint:

1. Define request/response schemas in `packages/shared/src/schemas/…`, export them from
   `index.ts`, then run `pnpm --filter @church/shared build`.
2. Controller: `@Body({ schema })`, `@Query({ schema })`, `@Param('x', { schema })`,
   `@ApiResult(ResponseSchema)`. Add `@Public()` only for anonymous endpoints, and
   `@RateLimit()` for anything abusable.
3. Service: load the target, then `access.assert(principal, 'perm', target)` (or
   `assertContent`). Global content is an organisation target. Record privileged actions
   with `AuditService.record()`.
4. Tests: an integration test in `*.integration.test.ts` using `TestClient` from
   `src/test/harness.ts`. Cover success, validation, permission denial across branches,
   and the anonymous case.
5. `pnpm api:openapi`, then commit the regenerated `openapi.json` and `schema.d.ts`.

Adding a permission: extend `PERMISSIONS` in `packages/shared/src/permissions.ts`, map it
into `SYSTEM_ROLES`, re-run the seed (roles sync their permissions), and add tests in
`permissions.test.ts`.

Background work: define the job in `packages/shared/src/jobs.ts`, enqueue with
`JobProducer.enqueue('jobKey', payload)` **after** the database commit, and implement the
processor in `apps/worker`. Jobs must be idempotent (retries happen).

---

## 6. Frontend (apps/web)

Read [`docs/UX_SYSTEM.md`](docs/UX_SYSTEM.md) and `apps/web/AGENTS.md` (Next.js 16 notes)
first.

* **Server Components by default.** Add `'use client'` only for interactivity (menus,
  forms, load-more, player controls, live notifications).
* **Reads:** Server Components call the API through `src/lib/api/server.ts`. Anonymous
  content is cached with `next: { revalidate, tags }` using the tags from `CacheTags` in
  `@church/shared`.
* **Writes:** Client Components call the API from the browser via `src/lib/api/client.ts`,
  which adds the CSRF header. No Server Actions for domain mutations (ADR-021).
* **Branch context** is the `?branch=<slug>` search parameter. Keep it when linking
  between listing pages (`withBranch()` helper).
* **UI:** compose components from `@church/ui/*`. Use semantic tokens (`bg-surface`,
  `text-muted`, `text-link`, `border-border`), never raw colours. Icons come from
  `lucide-react`, never emoji.
* **Accessibility is required:** semantic landmarks and headings, labelled controls
  (`Field`), visible focus, keyboard support, `aria-current` on active navigation, alt text
  (empty for decorative), reduced-motion respected, and at least 4.5:1 contrast (the token
  contrast test enforces this for the palette).
* **Every page** needs loading, empty, error and not-found states, plus metadata
  (`generateMetadata`) and JSON-LD where applicable.
* Mobile first: test at 360 px width. The bottom navigation must not cover content.

---

## 7. Database rules

* The schema is `packages/database/prisma/schema.prisma`. Keep enum values in sync with
  `packages/shared/src/enums.ts` (a test fails on drift).
* Create migrations with `--create-only`, **read the SQL**, and add anything Prisma cannot
  express, marked `-- [manual]`: CHECK constraints, triggers, `NULLS NOT DISTINCT`.
  Partial and trigram indexes *can* be expressed in the schema (`where: raw(...)`,
  `ops: raw("gin_trgm_ops")`). Write partial-index predicates with `=`/`OR`, not `IN`,
  so Postgres' normalised form matches and there is no drift.
* After any schema change, `migrate:check` must report no drift.
* Every table has UUIDv7 ids, `timestamptz` timestamps and snake_case names. Use soft
  delete (`deleted_at`) for user-facing entities.
* Queries: select only the columns you need (shared `*_SELECT` constants), no N+1, keyset
  pagination for feeds, and indexes for every list query.

---

## 8. Testing requirements

Write tests for what you change, in the same commit.

| Layer | Tool | Location |
| --- | --- | --- |
| Pure logic (shared, infrastructure, schedules, permissions) | Vitest | `*.test.ts` next to the code |
| API endpoints (real DB + Redis) | Vitest + Nest `app.inject` | `apps/api/src/**/*.integration.test.ts` |
| UI components, tokens | Vitest + Testing Library (jsdom) | `packages/ui/src/**/*.test.tsx` |
| User flows | Playwright | `apps/web/e2e/*.spec.ts` |

Integration tests (`pnpm test:integration`) need `pnpm infra:up`. The global setup creates
a fresh database `church_it_<random>`, applies migrations, seeds, and drops that database
afterwards. It never touches `church` or `church_test`. Each `TestClient` has its own IP,
so rate limits don't interfere between tests.

---

## 9. Security checklist for every change

Input validated by a shared schema · permission checked against the concrete target ·
audit log for privileged actions · no sensitive fields in responses · rate limit on
abusable endpoints · no raw HTML · safe redirects (relative paths only) · errors carry no
internals · new env vars validated in the config schema (never with insecure defaults in
production). See [`docs/SECURITY.md`](docs/SECURITY.md).

---

## 10. Verify before you commit

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm build
pnpm --filter @church/database migrate:check      # if the schema changed
pnpm test:e2e                                     # if a user flow changed
```

"It compiles" is not done. Exercise the changed flow (integration test, Playwright, or a
real request against `pnpm dev`) and report what you verified.

---

## 11. Git workflow

* Work on the session or feature branch. Commit coherent units with descriptive messages
  (imperative subject ≤ 72 chars, body explains why).
* **Milestones go to `main`:** when a phase or feature is complete **and** the full gate
  in §10 is green, fast-forward `main` to the branch and push (agreed with the owner). Do
  not push unverified work to `main`.
* Update `docs/HANDOVER.md` (status, next steps, known issues) in the same push.

---

## 12. Deployment rules

Docker Compose on a VPS (see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)). Migrations run
through the one-shot `migrate` service (`prisma migrate deploy`), never `migrate dev` or
`reset` in production. Configuration comes from the environment. Every service needs a
health check.

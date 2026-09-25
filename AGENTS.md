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

| Path                      | What                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `apps/web`                | Next.js 16 (App Router, React Server Components by default). UI only; talks to the API.                                  |
| `apps/api`                | NestJS 12 on Fastify (ESM). REST `/api/v1`, OpenAPI, auth, RBAC, domain logic, Socket.IO.                                |
| `apps/worker`             | BullMQ workers: e-mail, notifications, cache revalidation (media in Phase 8). Plain TypeScript, ADR-013.                 |
| `packages/shared`         | Browser-safe contracts: Zod schemas, enums, permission catalogue, job payloads, helpers.                                 |
| `packages/database`       | Prisma 7 schema, migrations, generated client, seeds.                                                                    |
| `packages/infrastructure` | Server-only adapters: password hashing, tokens, env, logging, Redis/BullMQ, S3 storage, mail.                            |
| `packages/api-client`     | OpenAPI document + generated types + typed fetch client.                                                                 |
| `packages/ui`             | Design system: tokens (`globals.css`) and components built on Base UI.                                                   |
| `packages/config`         | Shared TypeScript configs.                                                                                               |
| `tools/legacy-migration`  | Legacy data extract → validate → import → verify CLI. **Planned (Phase 9).**                                             |
| `infra/docker`            | Dev compose, the production Dockerfile and `compose.prod.yml`. Nginx in `infra/nginx`, deploy scripts in `infra/deploy`. |
| `legacy/`                 | The previous implementation. **Read-only reference. Never modify, never build.**                                         |
| `docs/`                   | Architecture, ADRs, audit, migration, API, security, deployment, UX system, handover.                                    |

**Where things stand and what to do next: [`docs/HANDOVER.md`](docs/HANDOVER.md)** (code map,
known gaps, the plan for phases 7–11).

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

| Task                                          | Command                                                                                                                     |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Lint (whole repo)                             | `pnpm lint`                                                                                                                 |
| Type-check everything                         | `pnpm typecheck`                                                                                                            |
| Unit tests (all packages)                     | `pnpm test`                                                                                                                 |
| API integration tests (real Postgres + Redis) | `pnpm test:integration`                                                                                                     |
| End-to-end tests (Playwright)                 | `pnpm test:e2e`                                                                                                             |
| Build everything                              | `pnpm build`                                                                                                                |
| Full gate                                     | `pnpm check` (format → lint → typecheck → test → build)                                                                     |
| New migration after editing `schema.prisma`   | `pnpm --filter @church/database migrate:create --name <change>`, review and complete the SQL, then `pnpm db:migrate:deploy` |
| Migration drift check                         | `pnpm --filter @church/database migrate:check`                                                                              |
| Regenerate OpenAPI + typed client             | `pnpm api:openapi`                                                                                                          |
| API docs (dev)                                | http://localhost:4000/api/docs                                                                                              |
| Mail inbox (dev)                              | http://localhost:8025                                                                                                       |
| Worker health (dev)                           | http://localhost:4100/health                                                                                                |
| Storage console (dev)                         | http://localhost:9001 (church-dev / church-dev-secret)                                                                      |

End-to-end tests run against the **built** apps and the demo data: `pnpm build`, then
`pnpm test:e2e` (Playwright starts the API, the **worker** and the web app, or reuses running
ones — the worker is needed because the suite asserts on delivered e-mail and on cache
revalidation). If port 3000 is taken, set `WEB_PORT=3100 APP_ORIGIN=http://localhost:3100
WEB_INTERNAL_URL=http://localhost:3100`. `E2E_BASE_URL` points the suite at an already
deployed environment and starts nothing locally. In the cloud sandbox set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

Demo accounts (after `pnpm db:seed:demo`), password `Church-Demo-2026!`:
`superadmin@example.org`, `admin@example.org` (church admin), `jhb.admin@example.org`
(Johannesburg branch admin), `ct.editor@example.org` (Cape Town editor),
`member@example.org`, `newmember@example.org` (pending membership).

---

## 4. Conventions

- **TypeScript 6, `strict`**, `noUncheckedIndexedAccess`. No `any` (lint error). Prefer
  inference and `satisfies`.
- **ESM everywhere.** Relative imports in `apps/api`, `apps/worker` and `packages/*` end in
  `.js` (`import { x } from './x.js'`). The web app uses the `@/` alias.
- **Contracts first.** Request/response shapes live in `packages/shared/src/schemas/*` as
  Zod 4 schemas. Top-level response schemas get `.meta({ id: 'Name' })` so OpenAPI has
  named components. Types come from `z.infer` / `z.input` / `z.output`.
- **Naming:** files `kebab-case.ts`; React components `PascalCase`; DB tables/columns
  `snake_case` via `@@map`/`@map`; permission keys `domain.action`; audit actions
  `domain.verb`; job names `queue` + `kebab-name`.
- **Errors:** throw `Errors.*` from `apps/api/src/common/http/errors.ts`. Clients receive
  RFC 9457 problem details with a stable `code`. Messages must be safe to show to users.
- **Logging:** use the Nest logger (pino underneath). Pass objects (`{ err, id }`), not
  interpolated strings. Never log personal data beyond ids.
- **Comments:** explain _why_, not _what_. Keep them short.
- **Formatting:** Prettier (`pnpm format`); 100 columns, single quotes, trailing commas.

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

Admin endpoints (`apps/api/src/modules/admin-*`): controllers carry
`@RequireVerifiedEmail()` and a coarse `@RequirePermission()`; services check the concrete
item with the shared helpers (`contentRights`, `canAssignRole`, `can`) so the UI can show
exactly the same rights. Items outside the caller's scope answer **404, not 403**. Lists use
offset pages (`{ items, page, pageSize, total }`). Changes that affect public pages enqueue
`revalidateWeb` with the relevant `CacheTags`.

Adding a permission: extend `PERMISSIONS` in `packages/shared/src/permissions.ts`, map it
into `SYSTEM_ROLES`, re-run the seed (roles sync their permissions), and add tests in
`permissions.test.ts`.

Roles are ranked: a smaller `rank` means more authority (`ROLE_RANK`). Anything that acts on
another person must pass **both** the reach rule (the target is inside your branch scope) and
`canActOnRank` (you are strictly more senior). A role may also list `contentTypes`; an empty
list means no limit, and a non-empty one — the auxiliaries — restricts that grant to those
types. Use `canForType`/`contentRights(…, type)` rather than `can()` for content, so the API
and the admin UI reach the same answer.

Background work: define the job in `packages/shared/src/jobs.ts`, enqueue with
`JobProducer.enqueue('jobKey', payload)` **after** the database commit, and implement the
processor in `apps/worker`. Jobs must be idempotent (retries happen).

---

## 5a. The worker (apps/worker)

A plain Node process, not a Nest application (ADR-013). `src/main.ts` validates the
environment, builds one `WorkerContext` (database, Redis, logger, mail, job producer, the
cached organisation) and starts one BullMQ `Worker` per queue that has a handler.

Adding a job:

1. Define its contract in `packages/shared/src/jobs.ts` and build the package.
2. Write `src/jobs/<name>.ts` as `(context: JobContext, payload) => Promise<void>`. Handlers
   are plain functions of their arguments, which is what makes them testable.
3. Register it in `src/jobs/index.ts`. Anything unregistered fails permanently rather than
   retrying, so the gap is visible.
4. Add an integration test in `src/**/*.integration.test.ts` (own throwaway database and
   Redis DB 2, `pnpm --filter @church/worker test:integration`).

Rules:

- **Idempotency is required.** Retries happen. Use `context.jobKey` (`"<queue>:<jobId>"`) for
  a natural key, a `dedupeKey` for notifications, or a deterministic BullMQ `jobId` when
  enqueueing from a handler — note BullMQ **forbids `:` in a custom job id**.
- Re-read state at the start of a handler and exit quietly when the event no longer applies
  (content unpublished again, membership undecided). Enqueueing happens after the commit, but
  the world can still have moved on.
- **Never log addresses, message bodies or tokens**; ids and template names only.
- Notifications go through `deliver()`, which applies each person's preferences and the
  organisation defaults, and never e-mails an unconfirmed address. Pass `skipEmail` when a
  dedicated template says more than the generic notification e-mail, so nobody gets two.

---

## 6. Frontend (apps/web)

Read [`docs/UX_SYSTEM.md`](docs/UX_SYSTEM.md) and `apps/web/AGENTS.md` (Next.js 16 notes)
first.

- **Server Components by default.** Add `'use client'` only for interactivity (menus,
  forms, load-more, player controls, live notifications).
- **Reads:** Server Components call the API through `src/lib/api/server.ts`:
  `publicApi()` for cacheable anonymous reads (`next: { revalidate, tags }` with
  `CacheTags`), `visitorApi()` for uncached per-visitor reads such as search, and
  `userApi()` for signed-in reads (forwards the cookie). All three send the
  `INTERNAL_API_TOKEN`, and the last two the visitor's IP, so API rate limits apply per
  visitor rather than to the web server.
- **Writes:** Client Components call the API from the browser via `src/lib/api/client.ts`,
  which adds the CSRF header. No Server Actions for domain mutations (ADR-021).
- **Branch context** is the `?branch=<slug>` search parameter. Keep it when linking
  between listing pages (`withBranch()` helper).
- **UI:** compose components from `@church/ui/*`. Use semantic tokens (`bg-surface`,
  `text-muted`, `text-link`, `border-border`), never raw colours. Icons come from
  `lucide-react`, never emoji.
- **Accessibility is required:** semantic landmarks and headings, labelled controls
  (`Field`), visible focus, keyboard support, `aria-current` on active navigation, alt text
  (empty for decorative), reduced-motion respected, and at least 4.5:1 contrast (the token
  contrast test enforces this for the palette).
- **Every page** needs loading, empty, error and not-found states, plus metadata
  (`generateMetadata`) and JSON-LD where applicable.
- **Status codes:** a `loading.tsx` wraps its segment in Suspense, and streaming starts
  with HTTP 200, so `notFound()`/`redirect()` inside it become soft (200 + meta refresh).
  Therefore only listing pages get `loading.tsx`, inside a route group (`events/(list)/`),
  and detail pages stay outside any Suspense boundary. Listing pages ignore unknown
  `?branch=` values instead of 404ing.
- **Forms:** use `SubmitButton` (disabled until hydration, so nothing submits natively and
  puts personal data in the URL), `method="post"`, and render default values in the server
  HTML (`defaultValue`), because react-hook-form only fills fields after hydration.
- **Layout traps on phones** (all caught by the E2E reflow check):
  horizontally scrolling rows (`-mx-4 overflow-x-auto …`) must be `relative`, otherwise
  absolutely positioned children such as `sr-only` text escape and widen the page; grids
  with a sidebar need a base `grid-cols-[minmax(0,1fr)]`, because an implicit column grows
  to its widest child.
- **Dialogs and sheets:** pass the trigger's label as children
  (`<DialogTrigger render={<Button … />}>Label</DialogTrigger>`), not inside the `render`
  element. Icon-only or repeated buttons get an `sr-only` suffix naming their item
  ("Remove <b>Sunday service</b>").
- **Admin pages** start with `await requireArea('<area>')` (`lib/admin.ts`), read with
  `userApi()`, and after a mutation call `router.refresh()` so server data reloads.
- **Hydration:** Client Components rendered on the server must not format dates or numbers
  with `Intl` when the output can differ between Node's and the browser's ICU data. Render
  such parts in Server Components (see `event-timeline.tsx`) or only after mount
  (`useSyncExternalStore` with a server snapshot, see `countdown.tsx`).
- Mobile first: test at 360 px width. The bottom navigation must not cover content.

---

## 7. Database rules

- The schema is `packages/database/prisma/schema.prisma`. Keep enum values in sync with
  `packages/shared/src/enums.ts` (a test fails on drift).
- Create migrations with `--create-only`, **read the SQL**, and add anything Prisma cannot
  express, marked `-- [manual]`: CHECK constraints, triggers, `NULLS NOT DISTINCT`.
  Partial and trigram indexes _can_ be expressed in the schema (`where: raw(...)`,
  `ops: raw("gin_trgm_ops")`). Write partial-index predicates with `=`/`OR`, not `IN`,
  so Postgres' normalised form matches and there is no drift.
- After any schema change, `migrate:check` must report no drift.
- Every table has UUIDv7 ids, `timestamptz` timestamps and snake_case names. Use soft
  delete (`deleted_at`) for user-facing entities.
- Queries: select only the columns you need (shared `*_SELECT` constants), no N+1, keyset
  pagination for feeds, and indexes for every list query.

---

## 8. Testing requirements

Write tests for what you change, in the same commit.

| Layer                                                       | Tool                             | Location                                |
| ----------------------------------------------------------- | -------------------------------- | --------------------------------------- |
| Pure logic (shared, infrastructure, schedules, permissions) | Vitest                           | `*.test.ts` next to the code            |
| API endpoints (real DB + Redis)                             | Vitest + Nest `app.inject`       | `apps/api/src/**/*.integration.test.ts` |
| UI components, tokens                                       | Vitest + Testing Library (jsdom) | `packages/ui/src/**/*.test.tsx`         |
| User flows                                                  | Playwright                       | `apps/web/e2e/*.spec.ts`                |

End-to-end tests (`apps/web/e2e`): every page test ends with `expectAccessible(page)`
(axe, WCAG 2.2 AA). Wait for hydration before typing into a form (e.g.
`await expect(submitButton).toBeEnabled()`). Desktop and mobile projects run in parallel
with **different** demo users (`userFor(testInfo)`), so tests never edit the same record.
Stub rate-limited endpoints with `page.route()` when the real call is already covered by
an API integration test.

Admin E2E tests run as the church administrator on desktop and the Johannesburg branch
administrator on mobile (`adminFor(testInfo)`). Every E2E test cleans up what it creates
(unique titles, delete afterwards, restore edited fields): the tests use the dev database.

The one exception is the sign-up test, which necessarily leaves an account behind: signing
up needs an address nobody has used, and there is no self-service account deletion to undo
it with. Those accounts are named `e2e-signup-<project>-<id>@example.org`. Clear them, and
anything a failed run left behind, with:

```sql
DELETE FROM users WHERE email LIKE 'e2e-signup-%';
DELETE FROM content_items WHERE title LIKE 'E2E %';
DELETE FROM branch_schedules WHERE title LIKE 'E2E %';
```

Integration tests use the helpers in `src/test/harness.ts`: `signIn(client, email,
password)` for demo accounts (`DEMO_USERS`, `DEMO_PASSWORD` from `@church/database/seed`,
loaded with `ensureDemoData`) and `signUpVerified(ctx, client)` for fresh accounts. Test
files share one database and run sequentially, so never assert an exact list that another
file could add to.

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
pnpm build:packages                               # first: the rest type-checks against dist/
pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm build
pnpm --filter @church/database migrate:check      # if the schema changed
pnpm test:e2e                                     # if a user flow changed
```

`pnpm typecheck` resolves `@church/*` through each package's **built** `dist/`, so a stale
build hides errors caused by a contract you just changed. Build the packages first, or the
first thing that catches the mismatch will be `pnpm build` (or CI).

"It compiles" is not done. Exercise the changed flow (integration test, Playwright, or a
real request against `pnpm dev`) and report what you verified.

---

## 11. Git workflow

- Work on the session or feature branch. Commit coherent units with descriptive messages
  (imperative subject ≤ 72 chars, body explains why).
- **Milestones go to `main`:** when a phase or feature is complete **and** the full gate
  in §10 is green, fast-forward `main` to the branch and push (agreed with the owner). Do
  not push unverified work to `main`.
- Update `docs/HANDOVER.md` (status, next steps, known issues) in the same push.

---

## 12. Deployment rules

Docker Compose on a VPS (see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)). Migrations run
through the one-shot `migrate` service (`prisma migrate deploy`), never `migrate dev` or
`reset` in production. Configuration comes from the environment. Every service needs a
health check.

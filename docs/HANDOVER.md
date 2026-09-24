# Handover: where we are, where we're going

> **Keep this file current.** Every agent or developer updates it at the end of a work
> session: phase status, what changed, what's next, open questions. Newest session notes
> go at the top of §6.

Last updated: 2026-09-24

---

## 1. One-paragraph summary

The legacy church app (a TypeScript prototype, now in `legacy/`, plus a Python live site
we could not access) is being rewritten as a pnpm monorepo: **Next.js 16** web, **NestJS 12
(Fastify, ESM)** API, **BullMQ** worker, **PostgreSQL 18 + Prisma 7**, **Redis**, and
S3-compatible storage. The foundation is in place: domain model and migrations, auth
(sessions, CSRF, rate limits, lockout, legacy password upgrade), scoped RBAC, the public
content API (feed, events, news, sermons, baptism, branches, home, search), the design
tokens and UI kit, and the web app shell with the home and feed pages. **Current focus:
the remaining public pages (Phase 4–5).**

---

## 2. Phase status

| Phase | Scope                                                                                                        | Status                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Legacy audit (`docs/LEGACY_AUDIT.md`)                                                                        | ✅ Done                                                                                                                                |
| 1     | Monorepo, tooling, dev infra (`infra/docker/compose.dev.yml`)                                                | ✅ Done (CI workflow still to add)                                                                                                     |
| 2     | Domain model, migrations, seeds (`packages/database`)                                                        | ✅ Done                                                                                                                                |
| 3     | Auth + RBAC (`apps/api/src/modules/auth`, `access`)                                                          | ✅ Done. Role-management endpoints come with Phase 6.                                                                                  |
| 4     | Core public UI: shell, branch context, design system                                                         | ✅ Done: tokens, `packages/ui`, web shell (header, branch switcher, account menu, mobile tab bar, footer, theme, error/loading states) |
| 5     | Feed / events / news / sermons / baptism                                                                     | 🟡 API done and tested; home and feed pages done, others pending                                                                       |
| 6     | Admin (content CRUD, branches, users/roles, memberships, baptism requests, service records, audit, settings) | ⏳ Not started                                                                                                                         |
| 7     | Notifications + realtime (Socket.IO + Redis adapter/emitter)                                                 | ⏳ Not started (jobs are already enqueued by the API)                                                                                  |
| 8     | Media uploads + worker (presigned PUT, sharp, ffprobe)                                                       | ⏳ Not started (storage adapter done and tested against RustFS)                                                                        |
| 9     | Legacy data migration CLI (`tools/legacy-migration`)                                                         | ⏳ Not started (plan in `DATA_MIGRATION.md`)                                                                                           |
| 10    | Hardening: CSP nonces, performance, accessibility audit                                                      | ⏳                                                                                                                                     |
| 11    | Production deployment (Dockerfiles, prod compose, Nginx, backups, CI)                                        | ⏳                                                                                                                                     |

---

## 3. What exists and is verified

| Area                                                                   | Evidence                                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Shared contracts, permissions, text helpers                            | `pnpm --filter @church/shared test` (16 tests)                                      |
| Password hashing incl. legacy formats, tokens, MIME sniffing           | `pnpm --filter @church/infrastructure test` (28 tests)                              |
| DB/shared enum parity                                                  | `pnpm --filter @church/database test` (20 tests)                                    |
| Migrations match the schema (no drift)                                 | `pnpm --filter @church/database migrate:check`                                      |
| Auth flows, CSRF, lockout, sessions                                    | `apps/api/src/modules/auth/auth.integration.test.ts` (15 tests)                     |
| Public content, context filtering, pagination, search, baptism enquiry | `apps/api/src/modules/content/public-content.integration.test.ts` (12 tests)        |
| Schedule resolution                                                    | `apps/api/src/modules/branches/schedules.test.ts` (4 tests)                         |
| Design-token contrast (WCAG AA, light and dark), Button/Field a11y     | `pnpm --filter @church/ui test` (57 tests)                                          |
| Web formatting (dates, en-GB/SAST), context helpers                    | `pnpm --filter @church/web test` (6 tests)                                          |
| Web build, home and feed pages render (1280 px and 390 px)             | `pnpm build`; screenshots checked manually                                          |
| S3 presigned PUT enforces size and type; public/private prefixes       | Manual smoke test against RustFS (to be turned into an integration test in Phase 8) |

---

## 4. Next steps (in order)

1. **Public pages:** events + detail (+ .ics), news + article, sermons + detail (player),
   baptism (enquiry form), posts, branches + detail, search, metadata/JSON-LD/sitemap/robots.
   Home and feed are done; follow their patterns (`apps/web/src/app/page.tsx`,
   `apps/web/src/app/feed/page.tsx`).
2. **Auth pages:** sign-in, sign-up, verify-email, forgot/reset password. **Account page:**
   profile, membership request, notification preferences, security (password, devices).
3. Playwright E2E for the flows above, run against the seeded demo data.
4. Phase 6 admin → 7 notifications/realtime (+ worker) → 8 media → 9 migration CLI →
   10 hardening → 11 deployment + CI.

---

## 5. Open questions for the owner

1. **Python live site source/DB** for `church.techtursolutions.com` is needed for the data
   extractor and URL redirects (the host is blocked from the build environment).
   See LEGACY_AUDIT §1.2.
2. Confirm the **deferred modules** (marketplace, jobs, messaging, praise songs), ADR-016.
3. Canonical name for **"PTA"** (the seed uses Pretoria).
4. Church branding: the name comes from the `organizations` row (seed:
   "First Church of Our Lord Jesus Christ", short name "Truth of God"). Is a logo file
   available?

---

## 6. Session log (newest first)

### 2026-09-24: session 1, milestone 1 (merged to `main`)

- Full gate green: lint, typecheck, unit tests (131), API integration tests (27), build.
- Web app shell, home page and feed page done. `main` fast-forwarded to this point.

### 2026-09-24: session 1 (initial rewrite)

- Audited the repository. The live Python site and truthofgod host were blocked by the
  egress policy.
- Moved the legacy code to `legacy/`. Built config, shared, infrastructure, database, api,
  api-client and ui packages.
- Decisions recorded as ADR-001…022. Notable ones: TypeScript 6 (Nest CLI peer), ESM
  (Nest 12 is ESM-only), Zod via Nest's native Standard Schema support, RustFS instead of
  MinIO locally (MinIO no longer publishes images), presigned **PUT** with signed
  Content-Length/Type (R2 has no POST policy support).
- The owner asked for regular pushes, tests with every change and up-to-date handover
  docs. Agreed workflow: work on the session branch and fast-forward `main` at verified
  milestones.

---

## 7. Environment notes and gotchas

- **Docker images:** Docker Hub rate-limits the sandbox. Pull `mirror.gcr.io/library/postgres:18-alpine`
  and `mirror.gcr.io/library/redis:7-alpine`, then tag them as `postgres:18-alpine` /
  `redis:7-alpine`. RustFS (`rustfs/rustfs`) and Mailpit (`axllent/mailpit`) pull directly.
  The Docker daemon may need starting (`dockerd &`).
- **Prisma AI guard:** `prisma migrate reset` is refused for agents. Use
  `migrate deploy` on fresh databases; tests create their own.
- **`next build` needs no running API** for pages that read `searchParams`. Keep public
  data fetching resilient (see `apps/web/src/lib/api/server.ts`).
- Node in the sandbox is 22.x. Production images use Node 24.
- Adding dependencies: pnpm 10 blocks install scripts except the packages listed in
  `pnpm-workspace.yaml` → `onlyBuiltDependencies`.

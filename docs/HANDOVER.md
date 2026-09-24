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
content API, account API (profile, membership, notification preferences), the design
tokens and UI kit, and the **complete public website and member account area**: home,
feed, events, news, sermons, baptism, branches, search, sign-in/up, e-mail verification,
password reset and profile, covered by Playwright E2E with automated accessibility checks.
Phase 6, **administration**, is also done (API + UI). **Next: Phase 7, the worker (e-mail delivery, cache revalidation, notifications).**

---

## 2. Phase status

| Phase | Scope                                                                                             | Status                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Legacy audit (`docs/LEGACY_AUDIT.md`)                                                             | ✅ Done                                                                                                                                     |
| 1     | Monorepo, tooling, dev infra (`infra/docker/compose.dev.yml`)                                     | ✅ Done (CI workflow still to add)                                                                                                          |
| 2     | Domain model, migrations, seeds (`packages/database`)                                             | ✅ Done                                                                                                                                     |
| 3     | Auth + RBAC (`apps/api/src/modules/auth`, `access`)                                               | ✅ Done. Role-management endpoints come with Phase 6.                                                                                       |
| 4     | Core public UI: shell, branch context, design system                                              | ✅ Done: tokens, `packages/ui`, web shell (header, branch switcher, account menu, mobile tab bar, footer, theme, error/loading states)      |
| 5     | Feed / events / news / sermons / baptism                                                          | ✅ Done: all public pages, detail pages (.ics, JSON-LD), search, sitemap/robots, auth pages, account area                                   |
| 6     | Admin (content workflow, branches, people/roles, memberships, baptism enquiries, audit, settings) | ✅ Done: `/api/v1/admin/**` (20 integration tests) and `/admin` UI (E2E on desktop and mobile). Service records (attendance) not built yet. |
| 7     | Notifications + realtime (Socket.IO + Redis adapter/emitter)                                      | ⏳ Not started (jobs are already enqueued by the API)                                                                                       |
| 8     | Media uploads + worker (presigned PUT, sharp, ffprobe)                                            | ⏳ Not started (storage adapter done and tested against RustFS)                                                                             |
| 9     | Legacy data migration CLI (`tools/legacy-migration`)                                              | ⏳ Not started (plan in `DATA_MIGRATION.md`)                                                                                                |
| 10    | Hardening: CSP nonces, performance, accessibility audit                                           | ⏳                                                                                                                                          |
| 11    | Production deployment (Dockerfiles, prod compose, Nginx, backups, CI)                             | ⏳                                                                                                                                          |

---

## 3. What exists and is verified

| Area                                                                   | Evidence                                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Shared contracts, permissions, text helpers, enum labels               | `pnpm --filter @church/shared test` (23 tests)                                      |
| Password hashing incl. legacy formats, tokens, MIME sniffing           | `pnpm --filter @church/infrastructure test` (28 tests)                              |
| DB/shared enum parity                                                  | `pnpm --filter @church/database test` (20 tests)                                    |
| Migrations match the schema (no drift)                                 | `pnpm --filter @church/database migrate:check`                                      |
| Auth flows, CSRF, lockout, sessions                                    | `apps/api/src/modules/auth/auth.integration.test.ts` (15 tests)                     |
| Public content, context filtering, pagination, search, baptism enquiry | `apps/api/src/modules/content/public-content.integration.test.ts` (12 tests)        |
| Schedule resolution                                                    | `apps/api/src/modules/branches/schedules.test.ts` (4 tests)                         |
| Design-token contrast (WCAG AA, light and dark), Button/Field a11y     | `pnpm --filter @church/ui test` (57 tests)                                          |
| Account API: profile, memberships, notification preferences            | `apps/api/src/modules/account/account.integration.test.ts` (6 tests)                |
| Legacy links, sitemap                                                  | `apps/api/src/modules/links/links.integration.test.ts` (3 tests)                    |
| Per-visitor rate limiting for server-side calls (ADR-024)              | `apps/api/src/common/http/client*.test.ts` (3 unit + 2 integration)                 |
| Web helpers: formatting, ICS, JSON-LD, safe redirects, forms, UA, maps | `pnpm --filter @church/web test` (41 tests)                                         |
| Public site, auth, account and admin flows, desktop + mobile, axe      | `pnpm test:e2e` (45 Playwright tests)                                               |
| Correct HTTP status codes (404, 308 canonical/legacy redirects)        | E2E `public.spec.ts` + manual `curl` checks                                         |
| Admin API: content workflow, scoping, people/roles, branches, settings | `apps/api/src/modules/admin-*/*.integration.test.ts` (20 tests)                     |
| Admin UI flows, no horizontal overflow on phones                       | `apps/web/e2e/admin.spec.ts` (desktop church admin, mobile branch admin)            |
| S3 presigned PUT enforces size and type; public/private prefixes       | Manual smoke test against RustFS (to be turned into an integration test in Phase 8) |

---

## 4. Next steps (in order)

1. **Phase 7, worker** (`apps/worker`): e-mail sending (templates for verification, reset,
   membership decisions, baptism enquiries; Mailpit locally), notification fan-out,
   `/me/notifications` + notification centre page, Socket.IO live updates. Until the worker
   exists, **no e-mails are delivered** (jobs wait in Redis), so sign-up cannot be finished
   locally except through the API tests.
2. **Phase 8, media:** presigned uploads, image renditions (sharp), audio/video metadata,
   admin media picker.
3. **Phase 9:** legacy migration CLI. **Phase 10:** CSP nonces via `proxy.ts`, performance
   budget, manual screen-reader pass. **Phase 11:** Dockerfiles, production compose, Nginx
   (must set `X-Real-IP`), backups, GitHub Actions CI running `pnpm check`,
   `test:integration` and `test:e2e`, and `docs/DEPLOYMENT.md`.

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
5. **Privacy notice and terms** (`/privacy`, `/terms`) are factual drafts describing what
   the platform does. The church (and its POPIA information officer) must review them
   before launch. The baptism page's "What to expect" steps also need the church's wording.

---

## 6. Session log (newest first)

### 2026-09-24: session 1, milestone 3 (merged to `main`)

- Phase 6 administration: API modules `admin-content`, `admin-people`, `admin-org`
  and the `/admin` area (content editor for every type, workflow with review and
  scheduling, memberships, baptism inbox, people and roles, branches with service times
  and leaders, audit log, settings).
- Mobile bugs found by the new E2E reflow check and fixed: page-widening scroll rows
  (sr-only text escaping), dialogs whose content overlapped their buttons.
- Known gap: public listings stay cached for up to 60 s after publishing because nothing
  processes the `revalidateWeb` jobs yet; the worker (next) fixes that.
- Gate: format, lint, typecheck, unit (185), integration (58), build, E2E (45).

### 2026-09-24: session 1, milestone 2 (merged to `main`)

- All public pages, auth pages and the account area; account and links API modules.
- Found and fixed along the way: soft 404s/redirects caused by a root `loading.tsx`
  (ADR-025), shared per-IP rate limits for server-side calls (ADR-024), an ICU hydration
  mismatch on the events page, form values missing from server HTML, forms submittable
  before hydration, `<dl>` markup rejected by axe, an `.ics` escaping bug.
- Repository formatted with Prettier; `pnpm check` now includes `format:check`.
- Playwright auth state had been committed (ignore pattern anchored to the root); removed
  and the pattern fixed. It only held sessions for local demo accounts.
- New docs: `API.md`, `SECURITY.md`, `UX_SYSTEM.md`, `apps/web/AGENTS.md`.
- Gate: format, lint, typecheck, unit (176), integration (38), build, E2E (31 + 1 desktop-skipped mobile test) all green.

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
- **Playwright:** the sandbox's Chromium is at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; export
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to it. The config passes `--no-proxy-server` (the
  sandbox's HTTPS proxy otherwise intercepts localhost). Build first (`pnpm build`).
- **Local rate limits:** in development every browser request reaches the API through the
  Next.js proxy from 127.0.0.1, so repeated sign-ins share one bucket (30 per 15 min). If
  E2E sign-ins start failing with "too many attempts", delete the local keys:
  `docker exec church-platform-dev-redis-1 sh -c "redis-cli --scan --pattern 'rl:login*' | xargs -r redis-cli del"`
  (development Redis only).
- **Shell heredocs:** when writing files through a shell heredoc, check that escape
  sequences such as `'\\;'` survived; one was silently collapsed once. Prefer the editor
  tools for code containing backslashes.
- `pgrep -f`/`pkill -f` with a pattern that appears in your own command line kills your
  shell. Match on `ps -eo pid,args` output instead.

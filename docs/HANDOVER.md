# Handover: where we are, where we're going

> **Keep this file current.** Every agent or developer updates it at the end of a work
> session: phase status, what changed, what's next, open questions. Newest session notes
> go at the top of §8. Read [`AGENTS.md`](../AGENTS.md) first for the rules and commands.

Last updated: 2026-09-24 (end of session 1, after milestone 3)

---

## 1. Summary

The legacy church app (a TypeScript prototype, kept read-only in `legacy/`, plus a Python
live site we could not access) is being rewritten as a pnpm monorepo: **Next.js 16** web,
**NestJS 12 (Fastify, ESM)** API, **PostgreSQL 18 + Prisma 7**, **Redis 7**, BullMQ and
S3-compatible storage.

**Done (phases 0–6):** the domain model and migrations; auth (server sessions, CSRF, rate
limits, lockout, legacy password upgrade); branch-scoped RBAC; the complete **public site**
(home, feed, events, news, sermons, baptism, branches, search, SEO); the **member area**
(sign-up, e-mail verification, sign-in, password reset, profile, branch membership,
notification preferences, devices); and the **administration area** (content workflow for
every content type, memberships, baptism enquiries, people and roles, branches with service
times and leaders, audit log, settings). Everything is covered by unit, API integration and
Playwright end-to-end tests (desktop and phone, with automated accessibility checks).

**Not done yet (phases 7–11):** the background **worker** (so e-mails are not delivered and
public listings refresh only when their 60-second cache expires), notifications and live
updates, media uploads, the legacy data migration tool, security hardening (CSP nonces),
and production deployment (Dockerfiles, Nginx, CI). See §5 for the plan.

**Git:** work happens on `claude/optimistic-albattani-mw95pf`; `main` is fast-forwarded
at verified milestones (last: milestone 3, commit `cf707f9`). Both are pushed and equal.

---

## 2. Getting started in five minutes

```bash
cp .env.example .env
pnpm install
pnpm infra:up                  # Postgres, Redis, RustFS (S3), Mailpit — see §9 for Docker tips
pnpm setup                     # generate, build packages, migrate, seed demo data
pnpm dev                       # web http://localhost:3000, API http://localhost:4000/api/docs
```

Demo accounts (password `Church-Demo-2026!`):

| E-mail                   | Role                              | Good for trying                                      |
| ------------------------ | --------------------------------- | ---------------------------------------------------- |
| `superadmin@example.org` | Super administrator               | Everything incl. `/admin/settings`                   |
| `admin@example.org`      | Church administrator              | Church-wide content, all branches, people, audit log |
| `jhb.admin@example.org`  | Johannesburg branch administrator | Branch-scoped admin (sees only Johannesburg)         |
| `ct.editor@example.org`  | Cape Town editor                  | Drafts and "submit for review" (cannot publish)      |
| `member@example.org`     | Member (Johannesburg)             | Account area                                         |
| `newmember@example.org`  | Pending member (Cape Town)        | Membership waiting for review                        |

Quality gate before any push to `main`: `pnpm check` (format, lint, typecheck, unit tests,
build) + `pnpm test:integration` + `pnpm test:e2e` (after `pnpm build`; see §9 for the
sandbox's Chromium path).

---

## 3. Phase status

| Phase | Scope                                                                      | Status                                                                                                                |
| ----- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 0     | Legacy audit (`docs/LEGACY_AUDIT.md`)                                      | ✅ Done (the Python live site could not be inspected; see §7)                                                         |
| 1     | Monorepo, tooling, dev infra (`infra/docker/compose.dev.yml`)              | ✅ Done. **CI workflow not added yet** (Phase 11).                                                                    |
| 2     | Domain model, migrations, seeds (`packages/database`)                      | ✅ Done                                                                                                               |
| 3     | Auth + RBAC (`apps/api/src/modules/auth`, `access`)                        | ✅ Done. OAuth (Google) is schema-ready but not enabled.                                                              |
| 4     | Core public UI: shell, branch context, design system (`packages/ui`)       | ✅ Done                                                                                                               |
| 5     | Public content pages, search, SEO, auth pages, account area                | ✅ Done                                                                                                               |
| 6     | Administration: API `/api/v1/admin/**` + `/admin` UI                       | ✅ Done. **Branch service records (attendance/offering reports) not built** (model exists: `branch_service_records`). |
| 7     | Worker: e-mail, cache revalidation, notifications, realtime                | ⏳ **Next.** Jobs are already enqueued by the API.                                                                    |
| 8     | Media uploads + processing                                                 | ⏳ Storage adapter done and smoke-tested against RustFS.                                                              |
| 9     | Legacy data migration CLI (`tools/legacy-migration`)                       | ⏳ Plan in `DATA_MIGRATION.md`; directory not created yet.                                                            |
| 10    | Hardening: CSP nonces, performance budget, manual accessibility review     | ⏳                                                                                                                    |
| 11    | Production: Dockerfiles, prod compose, Nginx, backups, CI, `DEPLOYMENT.md` | ⏳                                                                                                                    |

---

## 4. What exists

### 4.1 Code map (what lives where)

| Area                                                     | API (`apps/api/src/modules/…`)                                                                              | Web (`apps/web/src/…`)                                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Sessions, sign-in, sign-up, verification, reset, devices | `auth/`                                                                                                     | `app/(auth)/*`, `components/auth/*`                                                          |
| Public content, home, search                             | `content/`, `branches/`, `organization/`                                                                    | `app/(home)`, `feed`, `events`, `news`, `sermons`, `posts`, `search`, `components/content/*` |
| Baptism enquiry (public form)                            | `baptism/`                                                                                                  | `app/baptism`, `components/forms/baptism-request-form.tsx`                                   |
| Legacy URL resolution, sitemap                           | `links/`                                                                                                    | `lib/content.ts`, `app/branches/[slug]`, `app/sitemap.ts`, `lib/redirects.ts`                |
| Member account                                           | `account/` (`/me/*`)                                                                                        | `app/profile/*`, `components/account/*`                                                      |
| Admin: content                                           | `admin-content/`                                                                                            | `app/admin/content/*`, `components/admin/content-editor.tsx`, `content-form.ts`              |
| Admin: memberships, baptism inbox, people, roles         | `admin-people/`                                                                                             | `app/admin/{memberships,baptism,people}`, `components/admin/*`                               |
| Admin: branches, audit, settings, dashboard              | `admin-org/`                                                                                                | `app/admin/{branches,audit,settings}`, `app/admin/page.tsx`                                  |
| Cross-cutting                                            | `common/` (decorators, errors, client IP), `core/` (audit, rate limit, organisation, media URLs), `access/` | `lib/api/*` (server/browser clients), `lib/session.ts`, `lib/admin.ts`                       |

Contracts for all of the above are Zod schemas in `packages/shared/src/schemas/*`
(`public.ts`, `auth.ts`, `account.ts`, `admin-content.ts`, `admin.ts`, `baptism.ts`); the
permission catalogue and pure access rules (`can`, `contentRights`, `canAssignRole`) are in
`packages/shared/src/permissions.ts`.

### 4.2 Verified by tests

| Area                                                                                                                                                               | Evidence                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Shared contracts, permissions (incl. `contentRights`), text helpers, enum labels                                                                                   | `pnpm --filter @church/shared test` (25)                     |
| Password hashing incl. legacy formats, tokens, MIME sniffing                                                                                                       | `pnpm --filter @church/infrastructure test` (28)             |
| DB/shared enum parity; migrations match the schema                                                                                                                 | `pnpm --filter @church/database test` (20); `migrate:check`  |
| Design-token contrast (WCAG AA, light/dark), Button/Field a11y                                                                                                     | `pnpm --filter @church/ui test` (57)                         |
| Web helpers: dates/zones, ICS, JSON-LD, safe redirects, forms, editor mapping                                                                                      | `pnpm --filter @church/web test` (48)                        |
| API unit: schedules, client-IP trust                                                                                                                               | `pnpm --filter @church/api test` (7)                         |
| API integration (real Postgres + Redis): auth (15), public content (12), account (6), links (3), client IP (2), admin content (8), admin people (6), admin org (6) | `pnpm test:integration` (58)                                 |
| End-to-end, desktop + phone, axe WCAG 2.2 AA + no horizontal scroll on every page checked                                                                          | `pnpm test:e2e` (45 + 1 mobile-only test skipped on desktop) |
| Presigned S3 PUT enforces size and type                                                                                                                            | Manual smoke test against RustFS (automate in Phase 8)       |

---

## 5. Next steps (in order, with acceptance criteria)

### 5.1 Phase 7: the worker (highest priority — the site cannot onboard people without it)

Create `apps/worker` as plain TypeScript (ADR-013), reusing `@church/infrastructure`
(`createRedis`, queue helpers, mail providers, logger, env) and `@church/database`.
Queues and payloads are already defined in `packages/shared/src/jobs.ts`
(`QUEUE_NAMES = media, notifications, email, web`); validate every payload with its schema.

1. **`email` queue → `sendEmail`.** Render the templates in `EmailMessage`
   (`verify-email`, `account-exists`, `password-reset`, `password-changed`,
   `membership-decided`, `baptism-request-confirmation`, `baptism-request-received`,
   `notification`) as plain-text + simple HTML (church name from the organisation row),
   send through the SMTP provider (Mailpit locally: http://localhost:8025), and record an
   `email_deliveries` row (status, attempts, provider id, last error). Retries with
   backoff; never log message bodies or tokens.
   _Done when:_ signing up in the browser delivers the verification e-mail to Mailpit and
   the link signs the person in; an E2E test covers it by reading Mailpit's API.
2. **`web` queue → `revalidateWeb`.** Add a web route handler, e.g.
   `apps/web/src/app/internal/revalidate/route.ts` (**not** under `/api`, which is proxied
   to the API; not under `_internal`, which Next ignores), that checks
   `Authorization: Bearer ${REVALIDATE_SECRET}` in constant time and calls
   `revalidateTag(tag, 'max')` for each tag. The worker POSTs the job's tags to it
   (`WEB_INTERNAL_URL` env). _Done when:_ publishing in `/admin` shows the item on `/feed`
   immediately; then restore the public-page assertions in `e2e/admin.spec.ts` (feed after
   publish/delete, public branch page after adding a service time).
3. **`notifications` queue.** `contentPublished` (fan out to members of the item's branch,
   or everyone for church-wide content, respecting `notification_preferences` and the
   organisation defaults; `dedupeKey` makes retries idempotent), `membershipRequested`
   (branch reviewers), `membershipDecided` (the member: in-app + e-mail),
   `baptismRequestReceived` (branch baptism managers + confirmation e-mail to the enquirer).
   Batch large fan-outs.
4. **API + web notification centre.** `GET /me/notifications` (cursor pages, unread count),
   `POST /me/notifications/read` (ids or all). Build `app/notifications/page.tsx` — the
   header bell, account menu and mobile "More" sheet **already link to `/notifications`,
   which is currently a 404**. Show an unread badge on the bell.
5. **Realtime (optional in this phase).** Socket.IO gateway in the API with the Redis
   adapter; the worker emits `notification:new` to `user:<id>` rooms via the Redis emitter;
   the web app refreshes the badge. Authenticate the socket with the session cookie.
6. Add the worker to `pnpm dev` and to Playwright's `webServer` list.

### 5.2 Phase 8: media

Presigned upload endpoint (`POST /media/uploads` → key + signed PUT; `POST /media/{id}/complete`),
`processMedia` job (sniff type, sharp renditions + dominant colour for images, ffprobe
duration for audio/video, private vs public prefixes), admin media picker, and wiring into
the editor: content cover image and gallery, sermon audio/video, branch cover and gallery,
leader photos, profile avatar. Integration test against RustFS.

### 5.3 Phase 9: legacy data migration

`tools/legacy-migration` CLI exactly as specified in `DATA_MIGRATION.md` (extract →
validate → import → verify, idempotent via `legacy_id_map`; entity types `branch` and
`content_item` are what `/api/v1/legacy-links` resolves). A Python-site extractor needs the
owner's source/database (§7).

### 5.4 Phase 10: hardening

CSP with nonces through `apps/web/src/proxy.ts` (Next 16 replaces middleware), review of
`SECURITY.md` §7 checklist, performance budget (Lighthouse on home/feed/event on a slow
phone profile), a manual screen-reader pass (NVDA/VoiceOver) of sign-up, baptism form and
the content editor, and branch service records if the owner wants them.

### 5.5 Phase 11: production

Multi-stage Dockerfiles (API, worker, web `output: 'standalone'`, Node 24), production
compose with a one-shot `migrate` service, Nginx (TLS, `/api` straight to the API,
`X-Real-IP` and `X-Forwarded-For` set — the web server relies on them, ADR-024; set
`TRUST_PROXY=true`), encrypted Postgres backups with a tested restore, GitHub Actions CI
running `pnpm check`, `pnpm test:integration` and `pnpm test:e2e`, and
`docs/DEPLOYMENT.md` (currently referenced but not written).

---

## 6. Known gaps and limitations (be aware before demoing)

- **No e-mails are delivered** (they wait in the `email` queue until the worker exists).
  New sign-ups cannot confirm their address outside the automated tests; use the demo
  accounts.
- **Public listings lag up to 60 s** after admin changes (cache revalidation jobs are not
  processed yet). Detail pages of new items are fresh.
- **`/notifications` is a 404** although it is linked from the header and menus.
- **No uploads:** covers, galleries, avatars, leader photos and sermon audio/video cannot
  be added yet (the UI shows placeholders; sermon video links to external sites work).
- **Privacy notice and terms** are factual drafts that the church must review (§7).
- The baptism page's "What to expect" steps are placeholder wording for the church to edit.
- API docs (`/api/docs`) are enabled in development only.

---

## 7. Open questions for the owner

1. **Python live site source/DB** for `church.techtursolutions.com` is needed for the data
   extractor and for redirects from its URLs (the host was blocked from the build
   environment). See LEGACY_AUDIT §1.2.
2. Confirm the **deferred modules** (marketplace, jobs, messaging, praise songs), ADR-016.
3. Canonical name for **"PTA"** (the seed uses Pretoria).
4. **Branding:** name and short name come from the organisation settings (`/admin/settings`).
   Is there a logo file?
5. **Privacy notice, terms and baptism wording** need the church's review (POPIA
   information officer for the privacy notice).
6. Which **e-mail provider** for production (any SMTP works; e.g. the church's mail host,
   Postmark, Amazon SES)? Which **object storage** (Cloudflare R2, S3, or self-hosted)?
7. Are **branch service records** (attendance/offering reports from the legacy app) still
   needed?

---

## 8. Session log (newest first)

### 2026-09-24: session 1, pause after milestone 3 (owner asked to pause and document)

- Documentation brought up to date: this file (rewritten with code map, known gaps and a
  detailed plan for phases 7–11), `AGENTS.md` (new UI/testing rules), `README.md`,
  `API.md` (admin endpoints).
- No code changes after milestone 3; `main` = branch = `cf707f9` plus the docs commit.

### 2026-09-24: session 1, milestone 3 (merged to `main`)

- Phase 6 administration: API modules `admin-content`, `admin-people`, `admin-org` and
  the `/admin` area.
- Mobile bugs found by the new E2E reflow check and fixed: page-widening scroll rows
  (sr-only text escaping its scroll container), dialogs whose content overlapped their
  buttons, grid columns growing to their content.
- Gate: format, lint, typecheck, unit (185), integration (58), build, E2E (45).

### 2026-09-24: session 1, milestone 2 (merged to `main`)

- All public pages, auth pages and the account area; account and links API modules.
- Fixed: soft 404s/redirects from a root `loading.tsx` (ADR-025), shared per-IP rate
  limits for server-side calls (ADR-024), an ICU hydration mismatch, form values missing
  from server HTML, forms submittable before hydration, `<dl>` markup, an `.ics` escaping bug.
- Repository formatted with Prettier; `pnpm check` includes `format:check`.
- Playwright auth state had been committed; removed and the ignore pattern fixed (it held
  sessions for local demo accounts only).

### 2026-09-24: session 1, milestone 1 (merged to `main`)

- Monorepo foundation, database, auth/RBAC, public content API, UI kit, web shell, home
  and feed pages.

### 2026-09-24: session 1 (initial rewrite)

- Audited the repository (the live Python site and truthofgod host were blocked).
- Moved the legacy code to `legacy/`. Decisions recorded as ADR-001…023 (later 024–025).
- The owner asked for regular pushes, tests with every change and up-to-date handover
  docs. Agreed workflow: work on the session branch, fast-forward `main` at verified
  milestones.

---

## 9. Environment notes and gotchas

- **Docker images:** Docker Hub rate-limits the sandbox. Pull
  `mirror.gcr.io/library/postgres:18-alpine` and `mirror.gcr.io/library/redis:7-alpine`,
  then tag them as `postgres:18-alpine` / `redis:7-alpine`. RustFS (`rustfs/rustfs`) and
  Mailpit (`axllent/mailpit`) pull directly. The Docker daemon may need starting
  (`dockerd &`).
- **Prisma AI guard:** `prisma migrate reset` is refused for agents; never bypass it. Use
  `migrate deploy` on fresh databases. Integration tests create and drop their own
  database (`church_it_<random>`); test files run one after another against it, so
  assertions must tolerate data created by other test files.
- **`next build` needs no running API** (pages call `connection()` before fetching).
- Node in the sandbox is 22.x; production images use Node 24.
- **Dependencies:** pnpm 10 blocks install scripts except packages listed in
  `pnpm-workspace.yaml` → `onlyBuiltDependencies`.
- **Playwright:** export
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
  The config passes `--no-proxy-server` (the sandbox proxy otherwise intercepts
  localhost). Run `pnpm build` first; Playwright starts or reuses the API (:4000) and web
  (:3000) servers.
- **Local rate limits:** in development every browser request reaches the API through the
  Next.js proxy from 127.0.0.1, so sign-ins share one bucket (30 per 15 min). If E2E
  sign-ins fail with "too many attempts", clear the local keys:
  `docker exec church-platform-dev-redis-1 sh -c "redis-cli --scan --pattern 'rl:login*' | xargs -r redis-cli del"`
  (development Redis only).
- **E2E data hygiene:** E2E tests run against the dev database and must clean up after
  themselves (unique titles, delete what they create, restore profile fields). If a run
  is interrupted, leftovers are named `E2E …`.
- **Shell heredocs** once silently collapsed `'\\;'`; prefer the editor tools for code
  containing backslashes and re-read the result.
- `pgrep -f`/`pkill -f` with a pattern from your own command line kills your shell. Match
  on `ps -eo pid,args` output instead.

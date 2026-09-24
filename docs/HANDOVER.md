# Handover: where we are, where we're going

> **Keep this file current.** Every agent or developer updates it at the end of a work
> session: phase status, what changed, what's next, open questions. Newest session notes
> go at the top of §8. Read [`AGENTS.md`](../AGENTS.md) first for the rules and commands.

Last updated: 2026-09-25 (session 2: the worker, and the first production deployment)

---

## 1. Summary

The legacy church app (a TypeScript prototype, kept read-only in `legacy/`, plus the live
Flask site that served the domain until 2026-09-25, now archived — see §7.1) has been
rewritten as a pnpm monorepo: **Next.js 16** web,
**NestJS 12 (Fastify, ESM)** API, **PostgreSQL 18 + Prisma 7**, **Redis 7**, BullMQ and
S3-compatible storage.

**Done (phases 0–7, and most of 11):** the domain model and migrations; auth (server
sessions, CSRF, rate limits, lockout, legacy password upgrade); branch-scoped RBAC; the
complete **public site** (home, feed, events, news, sermons, baptism, branches, search,
SEO); the **member area** (sign-up, e-mail verification, sign-in, password reset, profile,
branch membership, notification preferences, devices); the **administration area** (content
workflow for every content type, memberships, baptism enquiries, people and roles, branches
with service times and leaders, audit log, settings); the **background worker** (e-mail
delivery, cache revalidation, notification fan-out) and the **notification centre**; and a
**production deployment** on the VPS with push-to-deploy. Everything is covered by unit,
API integration, worker integration and Playwright end-to-end tests.

**Not done yet:** media uploads (phase 8), the legacy data migration tool (phase 9),
security hardening such as CSP nonces (phase 10), and Socket.IO live updates. See §5.

**Git:** work happens on `work/phase-7-worker`; `main` is fast-forwarded at verified
milestones. There are three remotes: `origin` (GitHub), `production`
(`root@88.223.95.252:/srv/church-platform.git`, whose hook deploys on push to `main`) and
the local bundle. **Pushing to GitHub was blocked by an account limit during this session**,
so the deployed history reached the server through `production` (§9).

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
| 1     | Monorepo, tooling, dev infra (`infra/docker/compose.dev.yml`)              | ✅ Done. CI workflows added in Phase 11 but **never run** (GitHub was unreachable).                                   |
| 2     | Domain model, migrations, seeds (`packages/database`)                      | ✅ Done                                                                                                               |
| 3     | Auth + RBAC (`apps/api/src/modules/auth`, `access`)                        | ✅ Done. OAuth (Google) is schema-ready but not enabled.                                                              |
| 4     | Core public UI: shell, branch context, design system (`packages/ui`)       | ✅ Done                                                                                                               |
| 5     | Public content pages, search, SEO, auth pages, account area                | ✅ Done                                                                                                               |
| 6     | Administration: API `/api/v1/admin/**` + `/admin` UI                       | ✅ Done. **Branch service records (attendance/offering reports) not built** (model exists: `branch_service_records`). |
| 7     | Worker: e-mail, cache revalidation, notifications, realtime                | ✅ Done except **Socket.IO live updates** (the badge refreshes on navigation instead).                                |
| 8     | Media uploads + processing                                                 | ⏳ **Next.** Storage adapter done; RustFS now runs in production too.                                                 |
| 9     | Legacy data migration CLI (`tools/legacy-migration`)                       | ⏳ Plan in `DATA_MIGRATION.md`. **The legacy source and database are now available** (see §7).                        |
| 10    | Hardening: CSP nonces, performance budget, manual accessibility review     | ⏳                                                                                                                    |
| 11    | Production: Dockerfiles, prod compose, Nginx, backups, CI, `DEPLOYMENT.md` | ✅ Deployed and documented. Backups are scripted but **not yet scheduled**; CI workflows exist but have not run.      |

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

| Area                                                                                                                                                                                   | Evidence                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Shared contracts, permissions (incl. `contentRights`), text helpers, enum labels                                                                                                       | `pnpm --filter @church/shared test` (25)                    |
| Password hashing incl. legacy formats, tokens, MIME sniffing                                                                                                                           | `pnpm --filter @church/infrastructure test` (28)            |
| DB/shared enum parity; migrations match the schema                                                                                                                                     | `pnpm --filter @church/database test` (20); `migrate:check` |
| Design-token contrast (WCAG AA, light/dark), Button/Field a11y                                                                                                                         | `pnpm --filter @church/ui test` (57)                        |
| Web helpers: dates/zones, ICS, JSON-LD, safe redirects, forms, editor mapping                                                                                                          | `pnpm --filter @church/web test` (48)                       |
| API unit: schedules, client-IP trust                                                                                                                                                   | `pnpm --filter @church/api test` (7)                        |
| API integration (real Postgres + Redis): auth (15), public content (12), account (6), notifications (11), links (3), client IP (2), admin content (8), admin people (6), admin org (6) | `pnpm test:integration` (69)                                |
| Worker: e-mail rendering and every template (13); e-mail delivery, idempotency and failure recording (5); notification fan-out, scoping, preferences and dedupe (9)                    | `pnpm test:integration` (worker: 14) + unit (13)            |
| End-to-end, desktop + phone, axe WCAG 2.2 AA + no horizontal scroll on every page checked, incl. sign-up e-mail read from Mailpit and publish→feed revalidation                        | `pnpm test:e2e`                                             |
| Presigned S3 PUT enforces size and type                                                                                                                                                | Manual smoke test against RustFS (automate in Phase 8)      |
| The deployed site: sign-in, e-mail delivery, publish→feed, fan-out, refused `/internal/`                                                                                               | Verified by hand against production, session 2 (§8)         |

---

## 5. Next steps (in order, with acceptance criteria)

### 5.0 Immediate: make the live site usable

1. **Choose an e-mail provider and set it** (§7.6). Until then no visitor can confirm an
   address on the live site. Four lines in `/srv/church-platform.env`, then redeploy;
   `DEPLOYMENT.md` §5.
2. **Decide what the live site should start with.** The legacy database holds 7 branches
   with addresses, service times, history text and member counts (plus 5 users and 6 posts).
   Either import them (phase 9) or enter the branches by hand in `/admin/branches`; the site
   has none at the moment, and content is branch-scoped. Note the legacy data contains both
   a `Pretoria` and a `PTA` branch at nearly the same address in Pretoria west — they look
   like duplicates and the owner should say whether they are one branch (§7.3).
3. **Schedule backups** (`DEPLOYMENT.md` §6) and **change the seeded administrator password**
   (`/root/church-admin-password.txt` on the server; change it in the app, then delete that file).

### 5.1 Phase 7 (done, except realtime)

Delivered this session; see §8. The one piece left is **step 5, Socket.IO live updates**: a
gateway in the API with the Redis adapter, the worker emitting `notification:new` to
`user:<id>` rooms through the Redis emitter, and the badge subscribing. `socket.io`,
`@nestjs/websockets` and `@socket.io/redis-adapter` are already dependencies of the API, and
Nginx already proxies `/socket.io/`. Authenticate the socket with the session cookie.

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

### 5.5 Phase 11: production (done; what is left)

The stack, Nginx, deploy automation and `DEPLOYMENT.md` are in place and live. Remaining:
**schedule the Postgres and storage backups** and test a restore; **run CI at least once**
(the workflows exist but GitHub was unreachable); and consider moving media to Cloudflare R2
or S3 if self-hosted RustFS is not wanted long term.

## 6. Known gaps and limitations (be aware before demoing)

- **Production sends no e-mail to the outside world yet.** The worker delivers correctly,
  but no SMTP provider has been chosen for the church, so production points at a local
  catch-all inbox. **Nobody can complete a sign-up on the live site until this is set**
  (§7.6). Read what was caught: `ssh -L 8026:127.0.0.1:8026 root@88.223.95.252`, then
  http://localhost:8026. Switching is four lines in `/srv/church-platform.env` and a
  redeploy; see `DEPLOYMENT.md` §5.
- **The live site starts empty** apart from the seeded organisation, roles and branches.
  The legacy content has not been imported (phase 9).
- **No uploads:** covers, galleries, avatars, leader photos and sermon audio/video cannot
  be added yet (the UI shows placeholders; sermon video links to external sites work).
- **No live updates:** the unread badge refreshes when the visitor navigates, not instantly.
  The Socket.IO gateway (phase 7 step 5) was left for later; its dependencies are installed.
- **Backups are not scheduled.** `DEPLOYMENT.md` §6 has the command; nothing runs it yet.
- **CI has never run**, because pushing to GitHub was blocked during this session.
- **Privacy notice and terms** are factual drafts that the church must review (§7).
- The baptism page's "What to expect" steps are placeholder wording for the church to edit.
- API docs (`/api/docs`) are enabled in development only.

---

## 7. Open questions for the owner

1. ~~**Python live site source/DB**~~ **Answered.** The owner gave SSH access to the VPS.
   The legacy site was a **Flask** application (not the assumed framework) on **MySQL**
   (`church_platform`), at `/var/www/church.techtursolutions.com`. It is small: 5 users,
   7 branches, 8 branch leaders, 6 posts, 3 post media, 6 roles, plus marketplace and
   messaging tables (6 products, 17 orders, 16 conversations, 42 messages) belonging to the
   modules deferred by ADR-016. A complete archive (source, uploads, MySQL dump, Nginx block
   and systemd unit) is a git bundle **outside this repository**, held by the owner, because
   it contains credentials and personal data. Phase 9 can now be written against the real
   schema.
2. Confirm the **deferred modules** (marketplace, jobs, messaging, praise songs), ADR-016.
3. Canonical name for **"PTA"** (the seed uses Pretoria).
4. **Branding:** name and short name come from the organisation settings (`/admin/settings`).
   Is there a logo file?
5. **Privacy notice, terms and baptism wording** need the church's review (POPIA
   information officer for the privacy notice).
6. **Which e-mail provider for production? This one is now blocking real sign-ups.** Any
   SMTP works (the church's mail host, Postmark, Amazon SES, Resend…). Until it is set,
   production delivers to a local catch-all and no visitor can confirm an address. Object
   storage is self-hosted (RustFS) on the VPS for now; say if you would rather use
   Cloudflare R2 or S3.
7. Are **branch service records** (attendance/offering reports from the legacy app) still
   needed?

---

## 8. Session log (newest first)

### 2026-09-25: session 2, the worker and the first production deployment

**Phase 7 (worker).** Created `apps/worker` (plain TypeScript, ADR-013): one BullMQ worker
per queue, dispatching by job name, with every payload revalidated against its contract and
permanently failing anything that can never be valid.

- `sendEmail` renders all eight templates, sends over SMTP and records `email_deliveries`.
  A new `job_key` column keys the row to the job so a retry cannot send twice (ADR-027).
- `revalidateWeb` posts cache tags to a new secret-protected `/internal/revalidate` route in
  the web app, which compares the bearer token in constant time. It uses
  `revalidateTag(tag, { expire: 0 })`, not the plan's `'max'`, because `'max'` serves stale
  content on the next request and would not satisfy "appears straight away" (ADR-026).
- Notification fan-out for `contentPublished`, `membershipRequested`, `membershipDecided`
  and `baptismRequestReceived`, honouring preferences and organisation defaults, never
  e-mailing unconfirmed addresses, idempotent through `dedupeKey`.
- API: `GET /me/notifications`, `GET /me/notifications/unread`, `POST /me/notifications/read`.
- Web: the `/notifications` page (previously a 404 linked from the header) and an unread
  badge on the bell.

**Phase 11 (production).** Multi-stage Dockerfile with `api`/`worker`/`web`/`migrate`
targets, `compose.prod.yml`, the Nginx server block, `infra/deploy/` and `DEPLOYMENT.md`.
**The site is live at https://church.techtursolutions.com.**

**Deployed and verified in production:** admin sign-in with full grants; a password-reset
e-mail through queue → worker → SMTP, recorded `SENT`; publishing an announcement appearing
on `/feed` at once and disappearing again on delete; the fan-out writing its notification;
`/internal/` refused from the internet; `/api/docs` off; HTTP redirecting to HTTPS.

**The old Flask site** was archived first (source, uploads, MySQL dump, Nginx block, systemd
unit) as a git bundle held by the owner outside this repository. Its service is stopped and
disabled but its files and database are untouched, so it can be restored.

**Push-to-deploy** works three ways, all running the same `infra/deploy/deploy.sh`:
`git push production main` (used throughout this session), a systemd timer polling GitHub
every two minutes (enabled on the server), and a GitHub Actions workflow for when pushing to
GitHub is possible again.

**Not done, and why:** Socket.IO live updates (phase 7 step 5) were left out for time; the
badge refreshes on navigation. The legacy data was not imported — the owner declined to
decide on it, so the live site starts with the organisation, roles and the owner's
administrator account only.

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

- **A machine without Docker.** Session 2 ran on a workstation with no Docker and no sudo.
  The dev stores were run natively instead, under `~/.local/share/church-platform-dev/`:
  PostgreSQL **18.6** from the distribution's server binaries (`/usr/lib/postgresql/18/bin`,
  own cluster on **port 55433**), Redis **8.0.5** extracted from the Ubuntu archive with
  `apt-get download` + `dpkg-deb -x` (no root needed), and the Mailpit static binary. Only
  RustFS was missing, which mattered only for the storage health check. `pnpm infra:up`
  remains the documented path where Docker exists.
- **The Prisma CLI does not read `.env`.** `prisma.config.ts` falls back to the compose
  defaults, which is why `migrate deploy` silently targets `localhost:5432` unless
  `DATABASE_URL` is exported. Run Prisma commands with
  `set -a && . ./.env && set +a` first.
- **`prisma migrate dev` needs a TTY** and hangs in a non-interactive shell. To create a
  migration without one, generate the SQL with
  `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script`,
  write it into a new `prisma/migrations/<timestamp>_<name>/migration.sql`, apply it with
  `migrate deploy`, then confirm with `migrate:check`.
- **BullMQ rejects `:` in a custom job id**, so deterministic ids derived from a `dedupeKey`
  must substitute it (`apps/worker/src/notifications/deliver.ts`).
- **Ports on the dev machine.** An unrelated project held 3000 and 3001 throughout session 2,
  so the E2E suite was run against servers started by hand on port 3100 with
  `E2E_BASE_URL`/`APP_ORIGIN` set to match. Note that `next start` warns under
  `output: 'standalone'`; it still serves correctly for testing.

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

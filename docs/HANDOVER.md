# Handover: where we are, where we're going

> **Keep this file current.** Every agent or developer updates it at the end of a work
> session: phase status, what changed, what's next, open questions. Newest session notes
> go at the top of §8. Read [`AGENTS.md`](../AGENTS.md) first for the rules and commands.

Last updated: 2026-09-25 (session 4: the globe, songs, the hierarchy of authority, messaging)

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
the local bundle. The GitHub limit that had blocked pushing lifted during the
session, so `main` is pushed to GitHub, CI runs there, and the server deploys from it.

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

| Phase | Scope                                                                      | Status                                                                                                                          |
| ----- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Legacy audit (`docs/LEGACY_AUDIT.md`)                                      | ✅ Done (the Python live site could not be inspected; see §7)                                                                   |
| 1     | Monorepo, tooling, dev infra (`infra/docker/compose.dev.yml`)              | ✅ Done, including GitHub Actions CI (check, integration, end-to-end), green on `main`.                                         |
| 2     | Domain model, migrations, seeds (`packages/database`)                      | ✅ Done                                                                                                                         |
| 3     | Auth + RBAC (`apps/api/src/modules/auth`, `access`)                        | ✅ Done, including role seniority (`rank`) and content-type-scoped auxiliaries. OAuth (Google) is schema-ready but not enabled. |
| 4     | Core public UI: shell, branch context, design system (`packages/ui`)       | ✅ Done                                                                                                                         |
| 5     | Public content pages, search, SEO, auth pages, account area                | ✅ Done                                                                                                                         |
| 6     | Administration: API `/api/v1/admin/**` + `/admin` UI                       | ✅ Done. **Branch service records (attendance/offering reports) not built** (model exists: `branch_service_records`).           |
| 7     | Worker: e-mail, cache revalidation, notifications, realtime                | ✅ Done except **Socket.IO live updates** (the badge refreshes on navigation instead).                                          |
| 8     | Media uploads + processing                                                 | ⏳ **Next.** Storage adapter done; RustFS now runs in production too.                                                           |
| 9     | Legacy data migration CLI (`tools/legacy-migration`)                       | ⏳ Plan in `DATA_MIGRATION.md`. **The legacy source and database are now available** (see §7).                                  |
| 10    | Hardening: CSP nonces, performance budget, manual accessibility review     | ⏳                                                                                                                              |
| 11    | Production: Dockerfiles, prod compose, Nginx, backups, CI, `DEPLOYMENT.md` | ✅ Deployed, documented, CI green. Backups are scripted but **not yet scheduled**.                                              |

---

## 4. What exists

### 4.1 Code map (what lives where)

| Area                                                     | API (`apps/api/src/modules/…`)                                                                              | Web (`apps/web/src/…`)                                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Sessions, sign-in, sign-up, verification, reset, devices | `auth/`                                                                                                     | `app/(auth)/*`, `components/auth/*`                                                          |
| Public content, home, search                             | `content/`, `branches/`, `organization/`                                                                    | `app/(home)`, `feed`, `events`, `news`, `sermons`, `posts`, `search`, `components/content/*` |
| Songs and the player                                     | `content/` (`songs`, `albums`, `mediaFacets`)                                                               | `app/songs/*`, `components/songs/*`                                                          |
| Geography, the globe, baptism statistics                 | `geography/`                                                                                                | `app/globe`, `components/globe/*`, `components/content/baptism-stat.tsx`                     |
| Messaging between members                                | `messaging/` (`/me/messages/*`)                                                                             | `app/messages/*`, `components/messaging/*`                                                   |
| Legacy URL resolution, sitemap                           | `links/`                                                                                                    | `lib/content.ts`, `app/branches/[slug]`, `app/sitemap.ts`, `lib/redirects.ts`                |
| Member account                                           | `account/` (`/me/*`)                                                                                        | `app/profile/*`, `app/notifications`, `components/account/*`                                 |
| Admin: content                                           | `admin-content/`                                                                                            | `app/admin/content/*`, `components/admin/content-editor.tsx`, `content-form.ts`              |
| Admin: memberships, people, roles, baptism numbers       | `admin-people/`, `geography/admin-baptisms.*`                                                               | `app/admin/{memberships,people,records}`, `components/admin/*`                               |
| Admin: branches, audit, settings, dashboard              | `admin-org/`                                                                                                | `app/admin/{branches,audit,settings}`, `app/admin/page.tsx`                                  |
| Cross-cutting                                            | `common/` (decorators, errors, client IP), `core/` (audit, rate limit, organisation, media URLs), `access/` | `lib/api/*` (server/browser clients), `lib/session.ts`, `lib/admin.ts`                       |

Contracts for all of the above are Zod schemas in `packages/shared/src/schemas/*`
(`public.ts`, `auth.ts`, `account.ts`, `geography.ts`, `messaging.ts`, `admin-content.ts`,
`admin.ts`); the permission catalogue and pure access rules (`can`, `contentRights`,
`canAssignRole`, `canForType`, `canGrantRank`) are in `packages/shared/src/permissions.ts`.

### 4.2 Verified by tests

| Area                                                                                                                                                                                                                                                    | Evidence                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Shared contracts, permissions (`contentRights`, rank, content-type grants), countries, languages, text helpers                                                                                                                                          | `pnpm --filter @church/shared test` (46)                    |
| Password hashing incl. legacy formats, tokens, MIME sniffing                                                                                                                                                                                            | `pnpm --filter @church/infrastructure test` (28)            |
| DB/shared enum parity; migrations match the schema                                                                                                                                                                                                      | `pnpm --filter @church/database test` (19); `migrate:check` |
| Design-token contrast (WCAG AA, light/dark), Button/Field a11y                                                                                                                                                                                          | `pnpm --filter @church/ui test` (57)                        |
| Web helpers: dates/zones, ICS, JSON-LD, safe redirects, forms, editor mapping, globe projection                                                                                                                                                         | `pnpm --filter @church/web test` (72)                       |
| API unit: schedules, client-IP trust, media filters                                                                                                                                                                                                     | `pnpm --filter @church/api test` (18)                       |
| API integration (real Postgres + Redis): auth (15), public content (12), account (6), notifications (11), links (3), client IP (2), admin content (8), admin people (6), admin org (6), baptism records (8), roles and auxiliaries (12), messaging (20) | `pnpm test:integration` (109)                               |
| Worker: e-mail rendering and every template (13); e-mail delivery, idempotency and failure recording (5); notification fan-out, scoping, preferences and dedupe (9); message notifications carrying no message text (6)                                 | `pnpm test:integration` (worker: 14) + unit (13)            |
| End-to-end, desktop + phone, axe WCAG 2.2 AA + no horizontal scroll on every page checked, incl. sign-up e-mail read from Mailpit and publish→feed revalidation                                                                                         | `pnpm test:e2e`                                             |
| Presigned S3 PUT enforces size and type                                                                                                                                                                                                                 | Manual smoke test against RustFS (automate in Phase 8)      |
| The deployed site: sign-in, e-mail delivery, publish→feed, fan-out, refused `/internal/`                                                                                                                                                                | Verified by hand against production, session 2 (§8)         |

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
  The legacy content has not been imported (phase 9). **Production now has the real branch
  tree** (Johannesburg and Cape Town, with Pretoria, Durban and Windhoek under the first and
  Kimberley, Upington, Springbok and Victoria West under the second), inserted directly and
  idempotently; it has no baptism numbers yet, so the home-page stat stays hidden until the
  church enters some at `/admin/records`.
- **Still to build from ROADMAP_V2**: jobs (§7). Everything else the owner asked for is
  built apart from the marketplace, which he deferred. Two gaps worth naming: an auxiliary
  has no portal of its own yet (the rules are enforced, but it sees the ordinary admin
  screens), and messages carry no attachments until uploads land in phase 8.
- **Messaging has no live delivery.** A new message shows on the next navigation, like the
  notification badge. Socket.IO is still the missing piece of phase 7.
- **Who may message whom is a decision the church should confirm**: a member can write to
  anyone with an active membership of a branch they themselves are an active member of.
  There is deliberately no church-wide directory (§7.8).
- **Songs have no audio yet.** They carry an external URL for anything already hosted, and
  wait on phase 8 for uploads; the player says so rather than failing silently.
- **Production is switched off** to keep the shared VPS free while the platform is built —
  the domain serves a static holding page and the deploy timer is disabled. `DEPLOYMENT.md`
  §5a has the one command to bring it back up, and the one to put it away again.
- **No uploads:** covers, galleries, avatars, leader photos and sermon audio/video cannot
  be added yet (the UI shows placeholders; sermon video links to external sites work).
- **No live updates:** the unread badge refreshes when the visitor navigates, not instantly.
  The Socket.IO gateway (phase 7 step 5) was left for later; its dependencies are installed.
- **Backups are not scheduled.** `DEPLOYMENT.md` §6 has the command; nothing runs it yet.
- **The sign-up end-to-end test leaves an account behind** (`e2e-signup-…@example.org`):
  signing up needs an unused address and there is no self-service deletion to undo it.
  AGENTS.md §8 has the SQL to clear those and any other leftovers.
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
8. **Messaging reach.** A member can write to anyone who has an active membership of a branch
   they belong to, and there is no church-wide directory. Is that the right circle? The
   alternatives are narrower (only the branch's leaders) or wider (everyone in the church),
   and the wider one means publishing a membership list, which POPIA makes a real decision
   rather than a setting.

---

## 8. Session log (newest first)

### 2026-09-25: session 4, the globe, the song library, and the hierarchy of authority

**The globe (ROADMAP_V2 §3).** `/globe` draws the Earth on a canvas with an orthographic
projection (d3-geo over the 110 KB world-atlas TopoJSON, loaded only in the browser). Every
branch is a dot in its country's colour, a main branch larger than a sub-branch; names appear
as you zoom in, main branches first. Dragging spins it, the wheel zooms, clicking a dot opens
the branch with its saints, baptism numbers, the people in charge and their contact details.
The canvas is `aria-hidden` and the same data is a real list beside it, so the page works
with a keyboard and a screen reader. The geometry is pure functions in `projection.ts` with
16 tests, which is what let the drawing code stay small.

**Songs (§4).** A `SONG` content type with its own detail row, a `/songs` library with a
queue player (play, skip, shuffle, repeat, seek, mute) and the same filters as the sermons:
branch, country, collection, language, date range and text. `ContentCollection` gives **TOG**
and **Holy Convocation** their own standing sections without a second content model.

**The hierarchy of authority (§5).** Every role now has an integer `rank` — smaller means
more senior — and may list the `contentTypes` it covers. `canActOnRank` requires the actor to
be strictly more senior than the target, so an administrator cannot suspend a peer or hand
out a role at or above their own. Three auxiliary roles are seeded (`songs_auxiliary`,
`sermons_auxiliary`, `media_auxiliary`): appointed to a branch, they may draft their one kind
of content for that one branch and submit it, and nothing else. `canForType` is the single
helper the API and the admin UI both consult, so the buttons and the server cannot disagree.

**Verified:** `auxiliaries.integration.test.ts` proves the refusals rather than assuming
them — a songs auxiliary drafting a sermon, news, a song for another branch and a church-wide
song all get 403, while its own branch song is created as a DRAFT it may submit but not
publish; a church administrator is refused when handing out `church_admin` or `super_admin`,
and cannot suspend a super administrator, who can act on them. Gate green: format, lint,
typecheck, unit 251, API integration 87, worker integration 17.

**Messaging (§6).** Ported from the old platform: `conversations`,
`conversation_participants` and `messages`, with `PERSONAL` and `JOB` contexts (the store
waits for the marketplace). A `direct_key` — both member ids, sorted — is unique per pair, so
two people writing at the same moment land in one thread rather than two. `/messages` lists
and searches threads, `/messages/[id]` reads one oldest-first and pages backwards, and the
account menu carries the unread count beside the bell.

Two privacy decisions, neither of them in the brief. There is **no church-wide directory**:
you can write to someone with an active membership of a branch you are an active member of,
and the picker shows a name, a picture and a branch, never an address or a telephone number.
And the **notification carries no part of the message** — "Grace wrote to you" and a link —
because an e-mail sits on a mail server for years and what one member writes to another is
not ours to copy there. A worker test asserts that a message about someone's mother in
hospital never reaches the notification row or the queued e-mail.

**Next:** jobs (§7) is the last item in the owner's brief. The marketplace stays deferred.

### 2026-09-25: session 3, geography and baptism statistics

The owner read the deployed site and redirected the shape of the product. His whole brief is
written up in [`ROADMAP_V2.md`](ROADMAP_V2.md); this session delivered the first two parts.

**Geography.** He described "global → country → main branch → sub branch" and then a case
that breaks it: Namibia falls under South Africa and specifically under Johannesburg, with
one branch of its own. So the branch tree is the source of truth at arbitrary depth and
country is an attribute, not a level (ADR in ROADMAP_V2 §1). `GET /geography` returns
countries, branches, depth, per-country colours and both totals. The demo seed now builds
the real tree — Johannesburg and Cape Town standing on their own, Pretoria, Durban and
Windhoek (NA) beneath Johannesburg, Kimberley, Upington, Springbok and Victoria West beneath
Cape Town — with coordinates taken from the branches' addresses in the legacy system.

**Baptism became a statistic and stopped being a page.** The church holds no baptism days and
takes no applications, so the enquiry form was wrong from the start. `branch_baptism_records`
holds what is actually kept: a branch adds a number after a service. Totals roll up the tree
(`own` vs `total`) and group by country, and the home page leads with the year's figure.
Everything belonging to the old flow was removed, down to the table and the permission.

**Verified:** the aggregation is right in both directions — Johannesburg's subtree total
includes Windhoek, while Namibia's country total counts it separately, and no branch is
counted twice church-wide. Gate green: unit 211, API integration 77, worker integration 17,
E2E 47 (+1 skipped).

**Next, in ROADMAP_V2 order:** the globe (§3), then the role hierarchy and auxiliaries (§5),
songs and the sermon filters with TOG and Holy Convocation (§4), messaging (§6) and jobs (§7).
The marketplace is deferred by the owner.

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

**Push to main deploys, verified twice end to end:** `8044250` and `2fdae87` each reached
the server from a GitHub push with no manual step, through the polling timer. CI's first run
failed all three jobs (nothing built before typechecking; the integration Postgres service
creates only one database; the end-to-end job had no worker consuming the queues); all three
were fixed and the next run was green.

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

- **`pnpm build` straight after `pnpm test` is flaky on a small machine.** On the 4-core,
  7 GB workstation this was built on, a `next build` that follows the whole test suite in the
  same shell kills a prerender worker: `TypeError: Cannot read properties of null (reading
'useContext')`, on a different page each run, followed by `Next.js build worker exited with
code: 1`. It is not a code fault — `pnpm build` from clean passes, `next typegen` then build
  passes, and CI (which runs exactly `pnpm check`) is green. Run the build as its own command
  after the tests have exited, or let CI be the judge.

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

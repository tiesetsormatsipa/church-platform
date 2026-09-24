# Legacy Audit

Status: complete for the repository; **incomplete for the live reference site** (see §1.2).
Audit date: 2026-09-24.
Legacy code location: after Phase 1 the legacy implementation lives, unchanged, under
[`/legacy`](../legacy). Paths below are given relative to that folder
(`legacy/apps/api/...`). Nothing was deleted.

---

## 1. Scope and sources

### 1.1 What was inspected

| Source | Result |
| --- | --- |
| Every file in the repository (145 files, 7 commits, both branches) | Read in full (API, web, schema, seed, tests, Docker, PM2, Nginx, env examples). |
| Git history, all branches | 7 commits (2026-05-28 → 2026-06-03); one large initial commit plus deployment fixes. No Python code has ever existed in this repository. |
| Other repositories owned by the account | None of them contains a church application. |
| Live reference site `https://church.techtursolutions.com/` | **Blocked** by the build environment's network egress policy (HTTP 403 at the proxy). Also blocked: `truthofgod.techtursolutions.com` (this repo's deployment target) and `web.archive.org`. |
| Production database | Not accessible from the build environment. |

### 1.2 Critical finding: the repository is not the Python application

The brief describes the legacy system as a Python web application whose public UI is centred
on a **Feed** with **Events, News, Baptism and Sermons** sections, emoji-heavy navigation,
branch tabs `Global · CapeTown · Kimberley · Johanessburg · Durban · PTA`, and empty states
such as *"The feed is quiet for now"*.

The repository contains something different:

* a **TypeScript** monorepo (Next.js 14 + NestJS 10 + Prisma 5 + PostgreSQL), deployed with
  PM2/Nginx to `truthofgod.techtursolutions.com`;
* a UI centred on Home / Branches / Global map / Sermons / Praise Songs / Marketplace / Jobs /
  Messages, using Lucide icons rather than emoji;
* no Feed, News or Baptism pages, no `Durban` or `PTA` branch (seed data has Johannesburg,
  Cape Town and a Kimberley sub-branch), and none of the quoted copy.

The Python code behind the live site therefore lives somewhere else (probably only on the
VPS). Consequences:

1. The functional inventory of the live site in §9 comes **from the brief only** and could
   not be verified.
2. The Python database schema is unknown, so the migration tool uses a documented,
   source-independent *bundle* format (see [`DATA_MIGRATION.md`](DATA_MIGRATION.md)). The
   extractor for the Prisma schema in this repository is implemented. The extractor for the
   Python database needs its source code or a schema dump.
3. Live-site URLs could not be inventoried. The redirect map is data-driven so the real URLs
   can be added without code changes (see §12 and [`ARCHITECTURE.md`](ARCHITECTURE.md#url-compatibility)).

**Owner action required:** provide the Python repository (or a `pg_dump --schema-only` /
`sqlite3 .schema` of its database plus the list of its routes), or allow network access to
`church.techtursolutions.com` for the build environment.

---

## 2. Existing architecture (repository)

```
                 Browser (SPA-style Next.js pages, JWT in localStorage)
                        │
                 Nginx :80  (deploy/nginx/truthofgod.techtursolutions.com.conf)
     ┌──────────────────┼───────────────────────────┬────────────────┐
     │ /                │ /api/  /socket.io/        │ /media/        │
 Next.js 14 :3010   NestJS 10 (Express) :4010   express.static(STORAGE_LOCAL_ROOT)
 (PM2 fork)         (PM2 fork)                   (served by the API process)
                        │
        ┌───────────────┼───────────────┐
   PostgreSQL 16     Redis (Bull 4)   Local disk /var/www/truthofgod/media
   (Prisma 5)        queues declared,
                     2 of 3 processors registered
```

| Concern | Legacy implementation |
| --- | --- |
| Monorepo | Yarn workspaces (`apps/*`, `packages/*`); a root `yarn.lock` in Yarn Berry format **and** a `package-lock.json` in each app. Both apps declare `"church-platform": "file:../.."`, a circular dependency on the root. |
| Frontend | Next.js 14.2 App Router, React 18, Tailwind 3, Radix, TanStack Query, Zustand, framer-motion, next-pwa, react-globe.gl/three.js. **Every page is a Client Component**, including the home page. |
| Backend | NestJS 10 on Express, Passport (Google OAuth + JWT), class-validator (effectively unused, see §10), Swagger at `/api/docs`, Bull 4, Socket.IO, Nodemailer. |
| Database | PostgreSQL + Prisma 5.14. 60 models, 13 enums. **No migrations are committed** (the README says `prisma/migrations/` exists; it does not). |
| Storage | `StorageAdapter` writes to the local filesystem and serves everything publicly through `/media`. MinIO is in docker-compose but never used. |
| Realtime | Socket.IO namespace `/messaging` (JWT in handshake). |
| Jobs | Bull queues `media-processing`, `order-processing`, `email`. The `email` processor is not registered in any module, so queued e-mails are never sent. The media processor is a stub. |
| E-mail | Nodemailer SMTP adapter with DB-stored templates and an `EmailLog` table. |
| Tests | 3 unit specs and 1 e2e spec (the e2e accepts both 200 and 503 as passing). No frontend tests, no CI. |
| TypeScript | `strict` off in the web app; `strictNullChecks`/`noImplicitAny` off in the API. No ESLint configuration file, although `lint` scripts exist. |
| Deployment | PM2 (`ecosystem.config.cjs`) + Nginx on the VPS. The Dockerfiles and `docker-compose.yml` are **not buildable** (see §10.4). |

---

## 3. Routes

### 3.1 Web routes (Next.js)

| Route | Purpose | Notes |
| --- | --- | --- |
| `/` | Home: hero, countdown, announcements, branch highlights, quick links | Fully client-rendered. The countdown calls a non-existent endpoint and falls back to hard-coded text. |
| `/auth/signin` | Google sign-in, plus an e-mail/password form | The e-mail/password form has no submit handler, and no password-login endpoint exists. |
| `/auth/callback` | Receives `accessToken`/`refreshToken` **in the query string** and saves them to `localStorage` | Token leakage (§10.1). |
| `/branches` | Branch directory with filters | |
| `/branches/[id]` | Branch detail: tabs Info, Services, Leadership, Notices, Gallery | Uses UUIDs in URLs. |
| `/regions` | 3D globe and country status map | |
| `/sermons` | Audio sermon library | Behind the `sermons` flag (off by default). |
| `/songs` | Praise songs library with likes | Behind the `praise_songs` flag (off). |
| `/marketplace`, `/marketplace/products/[id]` | Marketplace | Flag off. "Add to cart" calls a non-existent endpoint. |
| `/jobs`, `/jobs/[id]` | Job board | Flag off. |
| `/messaging` | WhatsApp-style chat (members / market / jobs tabs) | Flag off. |
| `/profile` | Profile, membership verification | |
| `/admin` (+ `/branches`, `/features`, `/geo`, `/marketplace`, `/moderation`, `/users`) | Admin panel | Client-side role check only. |
| Linked but missing | `/announcements`, `/terms`, `/privacy` | Return 404. |

### 3.2 API endpoints (NestJS, prefix `/api/v1`)

Global guards, in order: Throttler (in-memory) → JWT (skipped by `@Public`) → Roles →
Feature flag. "Roles" lists the required role slugs; `global-super-admin` bypasses every
role check.

| Method & path | Auth / roles | Flag |
| --- | --- | --- |
| `GET /auth/google`, `GET /auth/google/callback` | public | |
| `POST /auth/refresh` | public (refresh JWT in the body) | |
| `POST /auth/logout`, `GET /auth/me` | JWT | |
| `GET/PATCH /users/me/profile`, `POST /users/me/verification` | JWT | |
| `GET /users/admin/list`, `GET /users/admin/verification-queue` | super-admin, platform-admin, branch-admin, membership-verifier | |
| `POST /users/admin/:id/verify`, `POST /users/admin/:id/reject` | super-admin, platform-admin, membership-verifier | |
| `POST /users/admin/:userId/roles` | super-admin, platform-admin | |
| `GET /branches`, `GET /branches/:id`, `GET /branches/:id/service-times` | public | |
| `POST /branches` | branch-admin, country-admin, regional-admin, super-admin | |
| `PATCH /branches/:id` | branch-admin, country-admin, super-admin (**not scoped to the admin's branch**) | |
| `GET /branches/:id/records` | branch-admin, country-admin, super-admin, minister | |
| `POST /branches/:id/records`, `PATCH /branches/:branchId/records/:recordId` | branch-admin, minister, super-admin | |
| `GET /geo/overview`, `/geo/continents`, `/geo/regions`, `/geo/countries`, `/geo/countries/:id`, `/geo/countries/:id/provinces` | public | |
| `POST /geo/continents` · `POST /geo/regions` · `POST /geo/countries` | super/platform (+ continental, regional) admins | |
| `PATCH /geo/countries/:id/status`, `GET /geo/:entityType/:entityId/status-history` | super-admin, platform-admin (+ regional-admin for history) | |
| `GET /features/navigation` | public | |
| `GET /features` | JWT | |
| `GET /announcements`, `GET /announcements/home/countdown` | public | |
| `POST /announcements`, `PATCH /announcements/:id` | super-admin, platform-admin, branch-admin, branch-moderator | |
| `POST /announcements/:id/publish`, `DELETE /announcements/:id` (archives) | super-admin, platform-admin, branch-admin | |
| `PATCH /announcements/admin/countdown` | super-admin, platform-admin | |
| `GET /sermons`, `GET /sermons/:id` | public (the detail route also returns drafts) | sermons |
| `POST /sermons` | minister, overseer, super-admin, platform-admin | sermons |
| `PATCH /sermons/:id/publish` | super-admin, platform-admin, branch-moderator | sermons |
| `GET /songs`, `GET /songs/:id` | public | praise_songs |
| `POST /songs` | song-uploader, verified-member, super-admin | praise_songs |
| `POST /songs/:id/like` | JWT | praise_songs |
| `GET /songs/admin/pending`, `POST /songs/admin/:id/approve`, `POST /songs/admin/:id/reject` | super-admin, platform-admin, branch-moderator | praise_songs |
| `GET /messaging/conversations`, `GET /messaging/conversations/:id/messages`, `POST /messaging/messages`, `POST /messaging/conversations/direct`, `POST /messaging/conversations/:id/read` | JWT | messaging |
| `GET /marketplace/categories`, `GET /marketplace/products`, `GET /marketplace/products/:id` | public | marketplace |
| `GET /marketplace/my-store` · `POST /marketplace/stores` · `POST /marketplace/products` | seller / verified-member / super-admin | marketplace |
| `GET /marketplace/admin/pending-products`, `POST /marketplace/admin/products/:id/approve` | super-admin, platform-admin, branch-moderator | marketplace |
| `POST /marketplace/orders`, `GET /marketplace/orders`, `GET /marketplace/orders/:id` | JWT | marketplace |
| `POST /marketplace/orders/:id/confirm-payment` | super-admin, platform-admin | marketplace |
| `GET /jobs`, `GET /jobs/:id` | public | jobs |
| `POST /jobs` | job-poster, marketplace-seller, verified-member, super-admin | jobs |
| `PATCH /jobs/:id` | JWT + owner check | jobs |
| `POST /jobs/:id/apply` | verified-member, branch-admin, super-admin | jobs |
| `GET /jobs/admin/pending`, `POST /jobs/admin/:id/approve`, `POST /jobs/admin/:id/reject` | super-admin, platform-admin, branch-moderator | jobs |
| `POST /media/upload/:context` (image, audio, document, chat_pdf, profile) | JWT | |
| `GET /media/:id/url` | JWT (any user, any asset) | |
| `DELETE /media/:id` | super-admin, platform-admin | |
| `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `POST /notifications/mark-all-read` | JWT | |
| `GET /admin/stats` | super/platform/branch/country/regional admins | |
| `GET /admin/brand-settings` | public | |
| `PATCH /admin/brand-settings` | super-admin, platform-admin | |
| `GET /admin/feature-flags` | super-admin, platform-admin | |
| `PATCH /admin/feature-flags/:key`, `POST /admin/feature-flags/:key/rollout-rules` | global-super-admin, super-admin | |
| `GET/POST /admin/moderation/cases`, `POST /admin/moderation/cases/:id/action` | super-admin, platform-admin, branch-moderator | |
| `GET /admin/audit-logs` | super-admin, platform-admin | |
| `GET /api/docs` | public Swagger UI (also in production) | |
| `GET /media/*` | public static files (**every upload**, including "private" ones) | |

WebSocket namespace `/messaging`: client events `send_message`, `mark_read`, `typing`;
server events `new_message`, `notification`, `user_typing`.

Frontend calls to endpoints that **do not exist**: `GET /api/v1/home/countdown`,
`POST /api/v1/marketplace/cart`, `POST /api/v1/marketplace/admin/products/:id/reject`.

---

## 4. Entities and relationships

The legacy schema (`legacy/apps/api/prisma/schema.prisma`) has 60 models in 13 groups:

| Group | Models | Key relationships |
| --- | --- | --- |
| Tenancy | `Tenant`, `TenantSettings`, `BrandSettings`, `TenantMember` | Tenant 1–1 settings/brand; Tenant N–M User through TenantMember. |
| Identity | `User`, `Profile`, `DeviceSession` | User 1–1 Profile. Profile → Country, Province, Branch (home branch). Profile holds `baptismDate`, `baptismPlace` and POPIA consent flags. |
| RBAC | `Role`, `Permission`, `RolePermission`, `UserRole`, `GeoRoleAssignment` | Roles are global. `GeoRoleAssignment(scopeType, scopeId)` exists but is **never read**. `Permission` rows are never seeded or checked. |
| Geography | `Continent`, `Region`, `Country`, `Province`, `City`, `GeoStatus_Record`, `CountryComplianceProfile` | Continent → Region → Country → Province → City → Branch. |
| Branches | `Branch` (self-referencing parent/sub), `BranchServiceTime`, `BranchTemporaryServiceTime`, `BranchPrayerSchedule`, `BranchFastingSchedule`, `BranchLeadership`, `BranchAnnouncement`, `BranchRecord`, `BranchRecordEdit`, `BranchMedia` | Branch belongs to Tenant, and optionally to Country/Province/City and a parent Branch. |
| Content | `Announcement` (`isGlobal`, `targetScope`/`targetId` are free strings with no FK), `EventCountdownConfig` | Not linked to branches by FK. |
| Verification | `VerificationRequest`, `DocumentUpload` | User 1–1 VerificationRequest; documents → MediaAsset. |
| Messaging | `Conversation`, `ConversationParticipant`, `Message`, `MessageAttachment` | Conversation `orderId`/`subOrderId`/`jobId` are strings with no FK. |
| Marketplace | `MarketplaceStore`, `ProductCategory`, `Product`, `ProductImage`, `ProductApproval`, `Order`, `SubOrder`, `OrderItem`, `PaymentIntentStub`, `GeneratedOrderDocument` | `Order.buyerId` has no FK. |
| Jobs | `JobPost`, `JobApproval`, `JobApplication` | |
| Sermons/Songs | `Sermon` (`minister` free text, `branchId`/`countryId`/`regionId` without FK, `tab`, `keywords[]`), `Song`, `SongApproval`, `Like` (polymorphic `entityType`/`entityId` plus an optional `songId`) | Sermon/Song → MediaAsset (audio). |
| Media | `MediaAsset`, `MediaProcessingJob` | |
| Platform | `FeatureFlag`, `FeatureFlagHistory`, `RolloutRule`, `EmailTemplate`, `EmailLog`, `AuditLog`, `Notification`, `AbuseReport`, `ModerationCase`, `ModerationCaseAction`, `AnalyticsEvent`, `BackupJob` | |

Schema quality issues:

* IDs are `uuid()` v4 strings; timestamps are `timestamp(3)` **without time zone**.
* **No secondary indexes** anywhere (feeds, notifications, audit logs and messages all scan).
* Many actor columns are plain strings with no foreign key: `createdBy`, `reviewedBy`,
  `approvedBy`, `grantedBy`, `changedBy`, `performedBy`, `Announcement.tenantId`,
  `Sermon.tenantId`, and others.
* No `CHECK` constraints. Emails are case-sensitive `unique`.
* Content statuses are shared across unrelated domains, and approval is modelled twice
  (`status` on the entity plus a separate `*Approval` row).
* No soft delete on most content. Some models have `deletedAt`, but nothing filters on it
  consistently.

---

## 5. Permissions (as implemented)

* 21 seeded roles: `global-super-admin`, `super-admin`, `platform-admin`,
  `continental-admin`, `regional-admin`, `country-admin`, `province-admin`, `branch-admin`,
  `branch-moderator`, `membership-verifier`, `overseer`, `minister`, `deacon`,
  `auxiliary-leader`, `auxiliary-member`, `marketplace-seller`, `job-poster`,
  `song-uploader`, `verified-member`, `unverified-member`, `public-visitor`.
* Enforcement is a role-slug allow-list per route (`@Roles`). There are **no permission checks
  and no scope checks**. A `branch-admin` of Kimberley can edit Cape Town's branch, post
  announcements for the whole church and read any branch's financial records.
* Church offices (overseer, minister, deacon, auxiliary) are modelled as RBAC roles, which
  mixes pastoral titles with system permissions.
* The frontend hides admin UI by role, but its check reads `user.roles` while `/auth/me`
  returns `userRoles`, so the Admin link never appears.

---

## 6. Existing functionality: status

| Area | Behaviour | Status |
| --- | --- | --- |
| Sign-in | Google OAuth only. An e-mail/password form is displayed but does nothing. Seeded users have bcrypt password hashes that no endpoint ever checks. | Partially working. Nobody can sign in on production unless Google credentials are configured (`.env.production.example` leaves them empty). |
| Sign-out | Button without a handler. The API logout deletes one session, but the refresh token stays valid for 7 days. | Broken |
| Profile | Edit name, DOB, phone, country, branch, baptism date/place, photo. "Profile complete" requires baptism date and place. | Working, with a mass-assignment flaw (§10.1) |
| Membership verification | Submit → admin approves (grants `verified-member`) or rejects | Working (no document upload UI) |
| Branch directory/detail | List, filters, detail with service times (plus temporary overrides), prayer/fasting schedules, leadership, notices, gallery | Working **only if** `NEXT_PUBLIC_TENANT_ID` holds the tenant UUID; otherwise the tenant filter matches nothing (§10.2) |
| Branch records | Attendance, duration, preacher, offering, baptised count, per-field edit history | API only, no UI |
| Announcements | Category filter (general, baptism, event, important, changes), pinned, global flag | Same tenant bug. The `branchId` filter is ignored server-side. Branch notices use a separate `BranchAnnouncement` table that no UI can write to. |
| Event countdown | Single configurable countdown (Annual Convention, booking + maps links) | The frontend calls the wrong URL and shows hard-coded fallback text |
| Global map | 3D globe of country statuses | Working (heavy client bundle: three.js) |
| Sermons | Audio library, search, minister filter, "tabs" | Flag off by default. The API also returns 503 when the flag is on (§10.2). |
| Praise songs | Upload, like, approval queue | Flag off. The approval queue is always empty (status mismatch). |
| Messaging | Real-time chat, PDF-only attachments | Flag off |
| Marketplace | Stores, products, approval, multi-seller orders, payment stub, receipts | Flag off. Critical pricing bug. E-mails never sent. |
| Jobs | Post, approve, apply, applicant chat | Flag off. Posters can self-publish via PATCH. |
| Media | Upload with per-context MIME/size rules | Everything is public. Processing is a stub. |
| Notifications | Model, list, mark read | Nothing creates notifications. The bell icon shows a static red dot. |
| Admin | Stats, feature flags + rollout rules, users + verification, moderation cases, audit logs, geo, marketplace approvals | Partially working |
| Feature flags | Tenant-scoped flags with rollout rules (role, country, verification, percentage) | Broken lookup (tenant slug vs UUID) |
| E-mail | Template engine and log | Only order e-mails exist, and they are never processed |
| PWA | Manifest plus next-pwa runtime caching | Icons use a JPEG labelled maskable |

---

## 7. Background jobs, scheduled jobs, e-mail

* Queue `media-processing` → `MediaProcessor`: stub that marks assets `READY`.
* Queue `order-processing` → `OrderProcessor`: creates a `GeneratedOrderDocument` row (no PDF)
  and enqueues `email:send-order-confirmation`.
* Queue `email` → `EmailProcessor`: **not registered**, so jobs accumulate in Redis forever.
* No scheduled or cron jobs. The `BackupJob` model is unused.
* E-mail templates stored in DB: `order-confirmation`, `welcome`, `verification-approved`.
  Only the first is ever referenced. Interpolation does not HTML-escape.

---

## 8. Configuration and deployment

* Env files: `.env.example` (dev) and `.env.production.example` (VPS). JWT secrets fall back
  to hard-coded defaults when unset (`dev-jwt-secret-change-me`).
* VPS layout: `/var/www/truthofgod/current` (code), `/var/www/truthofgod/media` (uploads),
  `/var/www/truthofgod/logs`; PM2 apps `truthofgod-api` (:4010) and `truthofgod-web` (:3010).
* Nginx: port 80 only in the repo (TLS presumably added by certbot on the host);
  `client_max_body_size 160m`; `/media` cached for 30 days.
* `docker-compose.yml`: Postgres 16, Redis 7, MinIO, Mailhog, and build targets for api/web.
  The build targets do not work (§10.4).

---

## 9. Live reference site (from the brief, unverified)

| Section | Described behaviour |
| --- | --- |
| Feed | Chronological community feed. Empty state: "The feed is quiet for now". |
| Events | Event listing |
| News | News listing |
| Baptism | A page/feed for baptism content |
| Sermons | Sermon listing |
| Branch context | Tabs: Global, CapeTown, Kimberley, Johanessburg (sic), Durban, PTA |
| Auth | Basic authentication (details unknown) |
| Navigation | Emoji used as icons |
| Media | Posts carry images |

Entities implied: users, branches (with "Global" apparently treated as a pseudo-branch),
posts, events, news, sermons, baptism content, images. The new domain model covers all of
them (see [`ARCHITECTURE.md`](ARCHITECTURE.md#domain-model)).

---

## 10. Bugs and technical debt

### 10.1 Security

| # | Severity | Finding |
| --- | --- | --- |
| S1 | Critical | **Mass assignment.** Handlers take `@Body() body: any` and spread it into Prisma `create`/`update`. The global `ValidationPipe` cannot whitelist untyped bodies. Examples: a job poster can `PATCH /jobs/:id {"status":"PUBLISHED"}` and skip approval; `PATCH /users/me/profile` accepts any Profile column (including `userId`); branch/announcement/brand/geo writes accept arbitrary columns (`tenantId`, `createdBy`, `status`). |
| S2 | Critical | **Client-controlled prices.** `POST /marketplace/orders` computes totals from the client-supplied `unitPrice`. There is no stock check. |
| S3 | High | **Roles are unscoped.** Branch-level roles act organisation-wide (§5). `GeoRoleAssignment` is never evaluated. |
| S4 | High | **Tenant chosen by the client.** `x-tenant-id` comes from a request header. |
| S5 | High | **Token handling.** Access and refresh JWTs are passed in the OAuth redirect **query string** (browser history, logs, `Referer`) and kept in `localStorage` (readable by any XSS). |
| S6 | High | **Refresh tokens cannot be revoked.** `/auth/refresh` only verifies the JWT signature and never checks `DeviceSession`, and tokens are not rotated. Logout does not invalidate the refresh token. |
| S7 | High | **Notification IDOR.** `PATCH /notifications/:id/read` updates by id without checking ownership. |
| S8 | High | **"Private" media is public.** Every upload, including verification documents, is served by `express.static('/media')`. `getSignedUrl` returns the public URL, and `GET /media/:id/url` lets any signed-in user resolve any asset. |
| S9 | Medium | Unpublished sermons and songs are returned by their public detail routes, and every GET increments view/play counters. |
| S10 | Medium | E-mail template variables are not HTML-escaped (profile names are injected into HTML). |
| S11 | Medium | Uploads of up to 150 MB are buffered in memory by multer. MIME type comes from the client header (no magic-byte check). The "virus scan hook" mentioned in the README does not exist. |
| S12 | Medium | Moderators can suspend or ban any account, including administrators. |
| S13 | Medium | Hard-coded fallback JWT secrets. docker-compose ships default passwords. |
| S14 | Medium | Rate limiting is in-memory only (per process). There are no auth-specific limits, no lockout and no brute-force protection. |
| S15 | Medium | WebSocket `typing` events are relayed to any conversation room without a participation check. Rooms are joined only at connect time. |
| S16 | Low | Swagger UI is public in production. There is no CSP on the web app. |
| S17 | Low | Logout runs bcrypt comparisons over every session of the user (O(n)). |

### 10.2 Correctness

| # | Finding |
| --- | --- |
| C1 | No password login exists, although the UI, README and seed imply it. |
| C2 | Sign-out does nothing. |
| C3 | Tenant mismatch: `DEFAULT_TENANT_ID` and `NEXT_PUBLIC_TENANT_ID` default to the **slug** `main-church`, but every `tenantId` column stores the tenant **UUID**. Tenant-filtered lists (`/branches`, `/announcements`) return nothing, and `FeatureGuard` never finds a flag, so every `@Feature` module returns 503 even when enabled. |
| C4 | Frontend → API URL mismatches (§3.2): countdown, cart, product reject. |
| C5 | Two announcement models (`Announcement`, `BranchAnnouncement`). No UI writes branch notices. The `branchId` filter is ignored. |
| C6 | Song approval queue filters `PENDING_REVIEW`, but songs are created as `DRAFT`. |
| C7 | The e-mail queue processor is never registered. |
| C8 | Media processing is a stub. `sharp` and `fluent-ffmpeg` are installed but unused. |
| C9 | No committed migrations, so `prisma migrate deploy` is a no-op. The production schema was created some other way, which risks drift. |
| C10 | Profile completion requires baptism date and place, so unbaptised members can never be verified. |
| C11 | Links to missing pages: `/announcements`, `/terms`, `/privacy`. |
| C12 | The notification bell is static. The admin link is never shown (§5). |
| C13 | Percentage rollout hashes by summing character codes (not uniform). Rollout rules are evaluated on public routes where there is no user. |
| C14 | Branch record edits are not audit-logged. The date filter works only when both `from` and `to` are given. |

### 10.3 Performance

* No indexes (§4).
* N+1 queries: unread counts per conversation, and product lookups per order line.
* Every authenticated request loads user, profile, roles and geo roles from the DB
  (`JwtStrategy.validate`).
* Home page ships framer-motion, and `/regions` ships three.js. Nothing is server-rendered.
* The branch detail query eagerly loads about 10 relations.

### 10.4 Build, tooling and operations

* `apps/web/tailwind.config.ts` requires `@tailwindcss/typography` and `@tailwindcss/forms`,
  which are neither dependencies nor in the lockfile, so `next build` fails on a clean
  install.
* `apps/web/Dockerfile` copies `.next/standalone`, but `next.config.js` does not set
  `output: 'standalone'`.
* `docker-compose.yml` builds with `context: ./apps/api` while the Dockerfile copies
  root-relative paths (`apps/api/package.json`), so the compose build fails.
* Three lockfiles in two formats, and a circular `file:../..` dependency.
* No lint config, no CI, weak TypeScript strictness, `console.log` logging (winston is
  installed but unused).
* No health checks, no backups (`BackupJob` is unused), no log rotation configuration.

---

## 11. Data that must be preserved

From the **repository's database** (Prisma schema above; production instance on the VPS):

| Must migrate | Archive only (JSON export, not imported) |
| --- | --- |
| Users (email, Google id, status, created/last-login timestamps) | Marketplace stores/products/orders/payment stubs |
| Profiles (names, DOB, phone, home branch, baptism date/place, consent) | Job posts/applications |
| Role assignments (mapped to the new roles) | Messaging conversations/messages |
| Verification requests → branch memberships | Songs, song approvals, likes |
| Branches incl. hierarchy, address, maps URL, schedules, temporary schedules, prayer/fasting schedules, leadership, gallery | Geo hierarchy statuses, compliance profiles |
| Branch announcements and global announcements | Feature flags, rollout rules, flag history |
| Event countdown configs (→ featured events) | Moderation cases, abuse reports, analytics events |
| Sermons (+ audio files) | Email templates, email logs |
| Branch records + edit history | Device sessions (security: not migrated, users sign in again) |
| Media assets + files under `/var/www/truthofgod/media` | |
| Notifications, audit logs | |

From the **live Python application**: users, branches (including the "Global" pseudo-branch,
which becomes `scope = GLOBAL`), posts/feed items, events, news, baptism content, sermons,
images, authorship, timestamps. Schema unknown (§1.2).

---

## 12. Unfinished functionality and gaps

* **Unfinished:** payments (stub), receipts (no PDF), media processing, notification
  creation, push notifications (VAPID keys only), backups, virus scanning, analytics,
  document upload for verification.
* **In the backend but not in the UI:** branch records and edit history, temporary service
  times (read-only in UI), `BranchAnnouncement` writes, event countdown admin, rollout rules
  (partially), abuse reports, e-mail templates and logs, analytics events, geo status
  history.
* **In the UI but not implemented in the backend:** e-mail/password sign-in, sign-out,
  cart, product rejection, `/announcements`, notification badge, legal pages.

---

## 13. Recommended replacement architecture (summary)

Full detail: [`ARCHITECTURE.md`](ARCHITECTURE.md) and
[`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md).

* **pnpm monorepo, modular monolith:** `apps/web` (Next.js 16, RSC-first), `apps/api`
  (NestJS 12 on Fastify, ESM), `apps/worker` (BullMQ), and packages `database` (Prisma 7),
  `shared` (Zod contracts, permissions), `api-client` (generated from OpenAPI),
  `infrastructure` (storage, mail, queues, logging), `ui` (design system), `config`.
* **One content model** (`ContentItem` plus typed detail tables for events, sermons and
  baptism reports) with explicit `scope = GLOBAL | BRANCH`. Branches are database rows, and
  "Global" is a scope, not a branch.
* **Server-side sessions** in HttpOnly cookies, argon2id, CSRF double-submit + Origin
  checks, Redis rate limits, progressive lockout, e-mail verification, password reset,
  session revocation, and an OAuth-ready identity table.
* **Permission-based RBAC** with organisation- or branch-scoped role assignments, enforced
  by a server-side policy service.
* **Presigned uploads** to S3-compatible storage with worker-side validation and processing.
* **Notifications** as a first-class domain: DB + BullMQ fan-out + Socket.IO (Redis
  adapter/emitter).
* **Idempotent legacy importer** that works from a validated bundle format.

---

## 14. Legacy → new mapping

Legend: **KEEP** (same behaviour) · **IMPROVE** (same intent, better implementation) ·
**REPLACE** (different mechanism) · **DEPRECATE** (removed; data archived) · **DEFER** (not
rebuilt in v1; data archived; module boundary reserved; needs owner confirmation, see §15).

| Legacy feature | Decision | New implementation |
| --- | --- | --- |
| Tenant / TenantSettings / BrandSettings | IMPROVE | `Organization` (name, slug, tagline, contact, timezone, locale, logo). Resolved server-side from config, never from a client header. Brand colours move to the design system. |
| Google OAuth | IMPROVE (later) | `AuthIdentity` table + provider interface. Google can be re-enabled without schema changes. Legacy `googleId` is migrated into `AuthIdentity`. |
| E-mail/password (UI only) | REPLACE | Full register/login/logout/reset/verify flow with argon2id; legacy bcrypt/PBKDF2 hashes are verified and re-hashed on first login. |
| JWT in localStorage + refresh JWT | REPLACE | Opaque server-side sessions in `HttpOnly; Secure; SameSite=Lax` cookies; revocable. |
| DeviceSession | REPLACE | `Session` (hashed token, idle + absolute expiry, IP/UA, revocation). |
| User / Profile | IMPROVE | `User` (normalised e-mail, status, lockout fields) + `Profile` (names, avatar media, phone, DOB, bio, baptism date/place, consent timestamps). Baptism fields are optional. |
| VerificationRequest / membership verification | IMPROVE | `BranchMembership` (PENDING → ACTIVE/REJECTED), verified by admins of that branch. |
| 21 global roles | REPLACE | Permission catalogue in code + DB roles (`member`, `branch_editor`, `branch_admin`, `church_admin`, `super_admin`) assigned **per organisation or per branch**. Church offices become `BranchLeader` positions, not permissions. |
| GeoRoleAssignment | REPLACE | `RoleAssignment(scope, branchId)` |
| Continent/Region/Country/Province/City + statuses + globe | DEPRECATE (globe) / REPLACE (addresses) | Branches store country code, province/region, city and coordinates. The 3D globe is replaced by the branch directory. Geo reference data is archived. |
| Branch (+ hierarchy) | IMPROVE | `Branch` with slug URLs, `parentBranchId`, status, contact, address, cover image, sort order, soft delete. `displayName` handles presentation fixes ("Johannesburg") while `legacyLabel` keeps the original value. |
| Service times / temporary times / prayer / fasting schedules | IMPROVE | Unified `BranchSchedule` (kind SERVICE/PRAYER/FASTING/BIBLE_STUDY/OTHER, weekday, times, effective date range for temporary changes). |
| BranchLeadership | KEEP | `BranchLeader` |
| BranchMedia (gallery) | KEEP | `BranchGalleryItem` → `MediaAsset` |
| BranchRecord + edit history | IMPROVE | `BranchServiceRecord` + `BranchServiceRecordRevision`, permission `branch_record.manage`, branch-scoped, audit-logged. |
| Announcement + BranchAnnouncement | REPLACE | `ContentItem(type=ANNOUNCEMENT, scope=GLOBAL|BRANCH)`: one model, no duplication. |
| Announcement category "baptism" | REPLACE | `ContentItem(type=BAPTISM)` + `BaptismDetail`. |
| EventCountdownConfig | REPLACE | `ContentItem(type=EVENT)` + `EventDetail` with `isFeatured`. The featured upcoming event drives the home countdown. |
| (Live) Feed | IMPROVE | `/feed`: cursor-paginated stream of all published content types for the current context. |
| (Live) Events | IMPROVE | `/events`, `/events/[slug]` with structured date/time/venue/status, JSON-LD `Event`. |
| (Live) News | IMPROVE | `/news`, `/news/[slug]` as long-form articles, JSON-LD `NewsArticle`. |
| (Live) Baptism | IMPROVE | `/baptism`: explainer, upcoming baptism services, celebrations (reports), and a baptism enquiry form (`BaptismRequest` workflow for branch admins). |
| Sermons | IMPROVE | `ContentItem(type=SERMON)` + `SermonDetail` (speaker, series, scripture, audio/video/external video, duration, language, transcript-ready), `Speaker`, `SermonSeries`, tags, full-text search. |
| Praise songs | DEFER | Media architecture supports audio. Songs, likes and approvals are archived. |
| Marketplace (stores, products, orders, payments) | DEFER | Never launched (flag off, payment stub, critical pricing bug). Data archived. Can return as a separate bounded context. |
| Jobs board | DEFER | Never launched. Data archived. |
| Messaging | DEFER | Never launched. Socket.IO + Redis infrastructure is in place for it. Data archived. |
| Media upload via API server, public disk | REPLACE | Presigned POST to S3/MinIO, public/private prefixes, signed GET URLs, worker validation (magic bytes), image variants (sharp), audio/video metadata (ffprobe), video thumbnails; HLS-ready variant model. |
| MediaProcessingJob | REPLACE | BullMQ job state + `MediaAsset.status` / `processingError`. |
| Notifications (unused) | IMPROVE | Created by domain events. Fan-out in the worker, realtime push, unread counts, preferences, optional e-mail. |
| Feature flags + rollout rules | REPLACE | Small `FeatureFlag` table (key, enabled) for operational toggles. Rollout rules are deprecated. |
| EmailTemplate (DB) / EmailLog | REPLACE / KEEP | Templates in code (typed, escaped, tested). `EmailDelivery` log is kept. Provider interface (SMTP now; Resend/SES/Postmark later). |
| AuditLog | IMPROVE | Structured `AuditLog` (actor, action, entity, branch, redacted diff, IP, UA, request id), indexed and filterable in admin. |
| Moderation cases / abuse reports | REPLACE | Admin user management: suspend/reactivate with reason, audit-logged, scope-checked. Reporting returns if comments are introduced. |
| AnalyticsEvent, BackupJob, CountryComplianceProfile | DEPRECATE | Replaced by structured logs/metrics and ops backup scripts. Data archived. |
| PWA manifest | IMPROVE | Web app manifest with proper PNG icons. Offline shell considered in Phase 10. |
| Swagger | IMPROVE | OpenAPI at `/api/docs` (disabled in production unless enabled explicitly). Typed client generated from it. |
| PM2 + Nginx | REPLACE | Docker Compose (nginx, web, api, worker, postgres, redis, minio, backup), health checks, restart policies. |

---

## 15. Open questions for the owner

1. Where is the Python source and database for `church.techtursolutions.com`? Needed for the
   Python extractor and for URL redirects.
2. Is the TypeScript app at `truthofgod.techtursolutions.com` live with real users? If so,
   both sources may need importing (the bundle format supports merging by e-mail).
3. Confirm the **DEFER** decisions (marketplace, jobs, messaging, praise songs). They were
   never enabled in the legacy app, but they may matter commercially.
4. Canonical branch names: is "PTA" Pretoria (e.g. "Pretoria" or "Tshwane")? The importer
   keeps the raw label in `legacyLabel` and uses a configurable display-name map, which
   defaults to `PTA → Pretoria` pending confirmation.
5. Church identity: the legacy app is branded "Truth of God — First Church of Our Lord Jesus
   Christ". The new app reads the name from the `Organization` row, and the seed uses that
   name.

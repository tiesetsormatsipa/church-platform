# Architecture

This document describes the target architecture of the rewritten Church Platform. Decisions
that deviate from the original brief, or that needed a real trade-off, are recorded as ADRs
in [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md). The legacy system is described
in [`LEGACY_AUDIT.md`](LEGACY_AUDIT.md).

---

## 1. Shape of the system

A **modular monolith**: one API process, one worker process and one web process that share a
PostgreSQL database, a Redis instance and an S3-compatible bucket. Each domain module in the
API owns its tables, services and HTTP surface, and talks to other modules through their
exported services, never through their tables. This keeps the option of extracting a module
later without paying the cost of microservices now.

```
                           Internet
                              │  HTTPS
                        ┌─────▼─────┐
                        │   Nginx   │  TLS, gzip, security headers, static caching,
                        └─┬───┬───┬─┘  /api → api, /socket.io → api, / → web, /media → bucket/CDN
            ┌─────────────┘   │   └───────────────┐
      ┌─────▼─────┐     ┌─────▼──────┐     ┌──────▼──────┐
      │  web      │────▶│   api      │     │  object     │
      │ Next.js 16│ RSC │ NestJS 12  │     │  storage    │
      │ (Node 24) │fetch│ Fastify    │     │ MinIO / S3 /│
      └───────────┘     │ Socket.IO  │     │ R2          │
                        └─┬───┬───┬──┘     └──────▲──────┘
                          │   │   │ enqueue       │ presigned PUT/POST from browser,
                          │   │   ▼               │ variants written by worker
                          │   │ ┌─────────┐       │
                          │   │ │  Redis  │◀──────┼─────┐
                          │   │ │ BullMQ  │       │     │ Socket.IO redis emitter
                          │   │ │ pub/sub │       │     │
                          │   │ └────┬────┘       │     │
                          │   │      │ jobs       │     │
                        ┌─▼───▼─┐  ┌─▼────────────┴─┐   │
                        │Postgres│◀─│  worker        │───┘
                        │   18   │  │ media, e-mail, │
                        └────────┘  │ notifications  │
                                    └────────────────┘
```

| Process       | Responsibility                                                                                                                                               | Scales by                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `apps/web`    | Rendering (React Server Components first), routing, SEO, the design system, client interactivity where needed. Holds **no business rules and no DB access**. | Adding replicas (stateless).                                                                         |
| `apps/api`    | REST `/api/v1`, OpenAPI, authentication, authorization, validation, domain logic, persistence, Socket.IO gateway.                                            | Adding replicas. Socket.IO uses the Redis adapter, throttling uses Redis, sessions live in Postgres. |
| `apps/worker` | Media processing (sharp, ffprobe/ffmpeg), notification fan-out, e-mail delivery, cache revalidation webhooks.                                                | Adding replicas or raising per-queue concurrency.                                                    |

---

## 2. Repository layout

```
/
├── apps/
│   ├── web/                  Next.js 16 App Router (RSC by default)
│   ├── api/                  NestJS 12 + Fastify, ESM
│   └── worker/               BullMQ processors (plain TypeScript, no Nest)
├── packages/
│   ├── config/               tsconfig bases, ESLint flat config, Prettier config
│   ├── shared/               Zod schemas (API contracts), enums, permission catalogue,
│   │                         queue names + job payloads, pure helpers (slugs, dates)
│   ├── database/             Prisma 7 schema, migrations, generated client, seed
│   ├── infrastructure/       Server-only adapters: S3 storage, mail providers, Redis/BullMQ
│   │                         connections, logger factory, env parsing
│   ├── api-client/           OpenAPI document + generated types + typed fetch client
│   └── ui/                   Design system: tokens (CSS), primitives on Base UI, icons
├── tools/
│   └── legacy-migration/     Extract → validate → import → verify CLI
├── infra/
│   ├── docker/               Dockerfiles, compose files, Nginx, backup scripts
│   └── ...
├── legacy/                   The previous implementation, untouched, for reference
└── docs/
```

Dependency rules (enforced by ESLint `no-restricted-imports` and by package boundaries):

- `shared` depends on nothing internal. It is safe for the browser.
- `database`, `infrastructure` → server-only. Never imported by `web` client code.
- `ui` → may depend on `shared`, never on server packages.
- `web` → `ui`, `shared`, `api-client`. **Never** `database`.
- `api`, `worker` → `shared`, `database`, `infrastructure`.
- `apps/*` never import from other `apps/*`.

---

## 3. Technology

| Layer                    | Choice                                                                                                 | Version (resolved at build time)                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Runtime                  | Node.js                                                                                                | 24 LTS (Docker images, `.nvmrc`). Code runs on ≥ 22.12. |
| Language                 | TypeScript, `strict`                                                                                   | 6.0 (see ADR-003)                                       |
| Package manager          | pnpm workspaces                                                                                        | 10                                                      |
| Web                      | Next.js App Router, React                                                                              | 16.x, 19.x                                              |
| Styling                  | Tailwind CSS (CSS-first config), CSS variables as design tokens                                        | 4.x                                                     |
| UI primitives            | Base UI (`@base-ui/react`) wrapped in shadcn-style owned components; Lucide icons                      | 1.x                                                     |
| Forms                    | React Hook Form + Zod resolver                                                                         |                                                         |
| Client server-state      | TanStack Query (only in interactive islands: admin tables, notifications, uploads)                     | 5.x                                                     |
| API                      | NestJS on Fastify, ESM                                                                                 | 12.x                                                    |
| Validation               | Zod 4 through Nest's native **Standard Schema** pipe (`@Body({ schema })`), which also feeds OpenAPI   | Zod 4.x                                                 |
| API docs                 | `@nestjs/swagger` → OpenAPI 3.1 → `openapi-typescript` + `openapi-fetch`                               |                                                         |
| Database                 | PostgreSQL                                                                                             | 18                                                      |
| ORM                      | Prisma (`prisma-client` generator, `@prisma/adapter-pg`)                                               | 7.x stable (not 8 RC)                                   |
| Cache / queues / pub-sub | Redis + BullMQ                                                                                         | 7+, 6.x                                                 |
| Realtime                 | Socket.IO + `@socket.io/redis-adapter` (API) + `@socket.io/redis-emitter` (worker)                     | 4.x                                                     |
| Object storage           | S3 API (`@aws-sdk/client-s3`): RustFS locally (ADR-023), S3/R2/any S3-compatible service in production |                                                         |
| Media                    | sharp (images), ffprobe/ffmpeg (audio/video) in the worker image                                       |                                                         |
| E-mail                   | Provider interface: SMTP (Mailpit locally) now, HTTP providers pluggable                               |                                                         |
| Logging                  | pino (`nestjs-pino`), JSON, request-id correlation, redaction                                          |                                                         |
| Tests                    | Vitest (unit/integration everywhere), Playwright (E2E)                                                 |                                                         |

---

## 4. Domain model

Diagram of the core aggregates. The source of truth is
[`packages/database/prisma/schema.prisma`](../packages/database/prisma/schema.prisma).

```
Organization 1─┬─* Branch 1─┬─* BranchSchedule        (services, prayer, fasting; temporary via date range)
               │            ├─* BranchLeader
               │            ├─* BranchGalleryItem ──▶ MediaAsset
               │            ├─* BranchServiceRecord 1─* BranchServiceRecordRevision
               │            └─* BranchMembership *─1 User
               │
               ├─* ContentItem ─┬─ 0..1 EventDetail
               │   (scope, type)├─ 0..1 SermonDetail ──▶ Speaker, SermonSeries, MediaAsset(audio/video)
               │                ├─ 0..1 BaptismDetail
               │                ├─* ContentTag ──▶ Tag
               │                └─* ContentMedia ──▶ MediaAsset
               │
               ├─* Role 1─* RolePermission(permission key)
               │     └─* RoleAssignment(user, org-wide or branch)
               ├─* BaptismRequest
               └─* AuditLog

User 1─1 Profile   User 1─* Session   User 1─* AuthIdentity   User 1─* AuthToken
User 1─* Notification   User 1─* NotificationPreference
MediaAsset 1─* MediaVariant
LegacyIdMap, MigrationRun (import bookkeeping)
```

### 4.1 Key modelling decisions

- **Organization** is the tenant root. There is one row today. It is resolved server-side
  from configuration (`ORGANIZATION_SLUG`), never from a client header.
- **Branches are data.** No branch id or name appears in code. "Global" is **not** a branch:
  it is `ContentItem.scope = GLOBAL`. The legacy pseudo-branch "Global" maps to that scope
  during import.
- **Branch naming.** `name` is the canonical, corrected presentation name ("Johannesburg",
  "Pretoria"). `legacyLabel` keeps the exact legacy value ("Johanessburg", "PTA"), so
  corrections are explicit and reversible, never silent.
- **One content table.** `ContentItem` holds everything common to published content: type,
  scope, branch, slug, title, summary, body, status, publish time, pinning, featuring,
  cover, author, audit fields, soft delete and a generated full-text `search_vector`.
  Type-specific structure lives in 1–1 detail tables (`EventDetail`, `SermonDetail`,
  `BaptismDetail`). The feed, search, notifications and SEO therefore work across all types
  with one indexed query, and content is never duplicated per branch.
- **Scope invariant** enforced by a database `CHECK`:
  `(scope = 'GLOBAL' AND branch_id IS NULL) OR (scope = 'BRANCH' AND branch_id IS NOT NULL)`.
- **Status and time.** `status ∈ {DRAFT, PENDING_REVIEW, PUBLISHED, ARCHIVED}`. Content is
  publicly visible when `status = PUBLISHED AND published_at <= now() AND deleted_at IS NULL`.
  A future `published_at` schedules the item. A delayed job sends notifications when it goes
  live.
- **Body format.** Markdown, rendered on the server with raw HTML disabled
  (`react-markdown` + `rehype-sanitize`). `body_format` leaves room for a rich-text JSON
  format later.
- **Identifiers.** UUIDv7 primary keys (time-ordered, index-friendly, safe to expose). Slugs
  for public URLs. See ADR-006.
- **Time.** Every timestamp is `timestamptz`. Dates that have no time (sermon date, date of
  birth, service record date) are `date`. Event display uses the event's own `timezone`,
  which defaults to the organisation's (`Africa/Johannesburg`).
- **Soft delete** (`deleted_at`) on content, branches, users and media. Hard deletes are
  reserved for join rows and tokens.
- **Audit fields** (`created_by_id`, `updated_by_id`, `published_by_id`) are real foreign
  keys to `users`.
- **Money** (service-record offerings) is `numeric(12,2)` + ISO currency.

### 4.2 Membership vs. permissions

- `BranchMembership` records that a person belongs to a branch (PENDING → ACTIVE/REJECTED/LEFT,
  one primary branch per user). Admins of that branch review it. It replaces the legacy
  "verified member" role.
- Church offices (overseer, minister, deacon) are **pastoral titles**. They live in
  `BranchLeader` (and optionally as a Speaker for sermons), not in RBAC.
- **RBAC** controls what someone can do in the system. See §6.

---

## 5. Authentication

| Aspect                | Design                                                                                                                                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credentials           | E-mail + password. Password hashing: **argon2id** (`@node-rs/argon2`; m = 19 MiB, t = 2, p = 1; parameters live in code so they can be raised). Legacy bcrypt and PBKDF2 hashes are verified once, then re-hashed to argon2id at login (ADR-009).                      |
| Session               | Opaque 256-bit random token in cookie `__Host-cp_session` (`HttpOnly; Secure; SameSite=Lax; Path=/`). Only `SHA-256(token)` is stored in `sessions`. Idle timeout 14 days, absolute 60 days (30 days without "remember me"). Rotated at login and at privilege change. |
| Revocation            | Per session ("sign out this device"), all others, or all sessions (automatic on password change/reset and on suspension).                                                                                                                                              |
| CSRF                  | All unsafe methods require (1) an `Origin`/`Sec-Fetch-Site` check against the allow-list **and** (2) a double-submit token: cookie `__Host-cp_csrf` echoed in the `X-CSRF-Token` header. The cookie is readable by same-origin JS and rotated with the session.        |
| Rate limiting         | Redis sliding windows: login per IP and per account, registration per IP, password reset per account and per IP, baptism enquiries per IP; a general API limit per IP.                                                                                                 |
| Brute force           | Progressive account lock: after 5 failures within 15 minutes the account locks for 1, 2, 4 … 60 minutes. Responses are identical and timing-equalised whether or not the account exists.                                                                               |
| E-mail verification   | Required before joining a branch or doing anything that sends notifications to others. Signed-in but unverified users can browse and edit their profile.                                                                                                               |
| Password reset        | Single-use token (hash stored), valid for 30 minutes. It revokes all sessions.                                                                                                                                                                                         |
| OAuth-ready           | `auth_identities(provider, provider_user_id)` + a provider interface. Adding Google needs no schema change. Legacy `googleId` values are imported there.                                                                                                               |
| What the browser sees | Never a token, hash or internal flag. `GET /api/v1/auth/session` returns a minimal session DTO (user id, names, avatar, e-mail-verified flag, effective permissions per scope).                                                                                        |

---

## 6. Authorization (RBAC with scopes)

- A **permission catalogue** lives in `packages/shared/src/permissions.ts` (code, typed).
  Examples: `content.create`, `content.update`, `content.publish`, `content.archive`,
  `media.upload`, `media.manage`, `branch.create`, `branch.update`, `branch_record.read`,
  `branch_record.manage`, `membership.review`, `baptism_request.manage`, `user.read`,
  `user.manage`, `role.assign`, `role.manage`, `audit.read`, `settings.manage`,
  `notification.broadcast`.
- **Roles** are DB rows with a set of permission keys, so they can be edited by super
  admins without a deploy. System roles are seeded:

  | Role            | Assignable at | Permissions (summary)                                                                                                                                                         |
  | --------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `branch_editor` | branch        | Create and edit content in the branch, submit for review, upload media                                                                                                        |
  | `branch_admin`  | branch        | Editor + publish/archive branch content, branch profile/schedules/leaders/gallery, service records, membership review, baptism requests, assign `branch_editor` in the branch |
  | `church_admin`  | organisation  | All content (global + every branch), branches, memberships, baptism requests, users (read/suspend), assign branch roles, audit read                                           |
  | `super_admin`   | organisation  | Everything, including role definitions and settings                                                                                                                           |

- **RoleAssignment** = (user, role, organisation, `branch_id` or NULL). NULL means
  organisation-wide.
- **Policy evaluation** (`AccessPolicyService.can(principal, permission, target)`), where
  target is `{ scope: 'ORGANIZATION' }` or `{ scope: 'BRANCH', branchId }`:
  - an org-wide assignment satisfies both kinds of target;
  - a branch assignment satisfies only a target in the same branch;
  - GLOBAL content is an organisation target, so branch admins cannot create or edit it;
  - seeing a branch never implies being able to modify it.
- **Escalation guard:** `role.assign` can only grant roles whose permissions are a subset of
  the granter's own permissions at that scope.
- Enforcement happens in the API: a `@RequirePermission()` decorator + guard for
  route-level checks, and explicit `policy.assert(...)` calls in services when the target is
  only known after loading the entity (e.g. the content item's branch). The web UI only
  **mirrors** permissions to hide controls it knows will be refused.

---

## 7. Content experience and information architecture

### 7.1 Context model: "Global" and branches

- Every listing page accepts `?branch=<slug>`. Without it the context is **Global**.
- **Global context** shows everything published across the church. Every card carries a
  scope badge (globe icon + "Church-wide", or pin icon + branch name). A segmented filter
  offers _All · Church-wide · Branches_.
- **Branch context** shows that branch's content plus church-wide content, with the same
  badges and a _This branch only_ filter.
- The branch switcher (header on desktop, bottom sheet on mobile) changes `?branch=` and
  remembers the choice in a non-essential preference cookie, which is used only to
  _suggest_ the branch on the next visit, never to silently filter. URLs stay shareable
  and cacheable.
- Signed-in members with a primary branch see a "Your branch: X" shortcut.

### 7.2 Routes

| Route                                                                          | Page                                                                                                                                                |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                            | Home: context header, featured event countdown, "Happening soon", latest updates, latest sermon, news highlights, branch info card (branch context) |
| `/feed`                                                                        | Chronological feed of all types for the context (cursor-paginated)                                                                                  |
| `/events`, `/events/[slug]`                                                    | Upcoming/past events; detail with date/time/venue/map/status; JSON-LD `Event`                                                                       |
| `/news`, `/news/[slug]`                                                        | Article index; long-form article; JSON-LD `NewsArticle`                                                                                             |
| `/sermons`, `/sermons/[slug]`                                                  | Media library (search, speaker, series, branch); player page; JSON-LD `AudioObject`/`VideoObject`                                                   |
| `/baptism`                                                                     | What baptism means, upcoming baptism services, recent celebrations, enquiry form                                                                    |
| `/posts/[slug]`                                                                | Announcement / community post / baptism story detail                                                                                                |
| `/branches`, `/branches/[slug]`                                                | Directory; branch page (service times, leaders, location, gallery, its latest content)                                                              |
| `/search`                                                                      | Cross-content search                                                                                                                                |
| `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email` | Authentication                                                                                                                                      |
| `/profile`                                                                     | Account: profile, membership, notification preferences, security (password, sessions)                                                               |
| `/notifications`                                                               | Notification centre                                                                                                                                 |
| `/admin/**`                                                                    | Administration (separate shell, same design system)                                                                                                 |

### 7.3 URL compatibility

Legacy (this repository) routes are handled by `apps/web/src/lib/redirects.ts`, a data file
applied in `next.config.ts` and, for UUID → slug lookups, in route handlers:

| Legacy                                                | New                                          | Type |
| ----------------------------------------------------- | -------------------------------------------- | ---- |
| `/auth/signin`                                        | `/sign-in`                                   | 308  |
| `/auth/callback`                                      | `/sign-in`                                   | 307  |
| `/branches/<uuid>`                                    | `/branches/<slug>` (looked up)               | 308  |
| `/regions`                                            | `/branches`                                  | 308  |
| `/announcements`                                      | `/feed?type=announcement`                    | 308  |
| `/songs`, `/marketplace/**`, `/jobs/**`, `/messaging` | `/` (deferred modules, see LEGACY_AUDIT §14) | 307  |
| `/profile`, `/sermons`, `/branches`                   | unchanged                                    |      |

The routes of the live Python site could not be inventoried (LEGACY_AUDIT §1.2). The new
paths use the most likely names (`/feed`, `/events`, `/news`, `/baptism`, `/sermons`); any
other legacy URL can be added to the redirect table without code changes.

---

## 8. API design

- Base path `/api/v1`, URI versioning. JSON only. Errors use RFC 9457 problem details
  (`type`, `title`, `status`, `detail`, `code`, `errors[]`, `requestId`).
- **Contracts are Zod schemas in `packages/shared`.** Nest validates request bodies and
  queries against them through the Standard Schema pipe (unknown keys are stripped, which
  closes the legacy mass-assignment class of bugs). The same schemas generate the OpenAPI
  document and serialise responses, so internal fields cannot leak.
- Pagination: cursor-based (`?cursor=&limit=`, opaque base64url of `(published_at, id)`)
  for feeds and notifications; page-based for admin tables that need totals.
- Public vs management surfaces: public reads (`/feed`, `/events`, `/sermons`, …) only ever
  return published, visible content. Management lives under `/api/v1/admin/*` behind
  permission checks, and can see drafts.
- OpenAPI is served at `/api/docs` (disabled in production unless `API_DOCS_ENABLED=true`)
  and exported to `packages/api-client/openapi.json` by `pnpm api:openapi`. The web app uses
  the generated, typed client, so request/response types are never written by hand.

Endpoint inventory: [`API.md`](API.md).

---

## 9. Realtime

- Socket.IO on the API process, path `/socket.io`, namespace `/realtime`.
- Handshake authentication with the same session cookie (validated like HTTP). Anonymous
  sockets are allowed only in public rooms.
- Rooms: `user:{id}` (notifications, unread count), `org` (public "new content published"
  signal that drives a "New posts, refresh" pill on the feed).
- The API uses `@socket.io/redis-adapter`, so any replica can deliver to any socket. The
  worker publishes through `@socket.io/redis-emitter` without holding sockets itself.
- WebSockets are used only for push. All reads and writes stay on REST.

---

## 10. Notifications

1. A domain action commits (e.g. content published, membership approved).
2. The API enqueues a job (`notifications.fanout`) with the event payload. Scheduled
   content uses a delayed job at `published_at`.
3. The worker resolves recipients in batches:
   - GLOBAL content → active users who opted in for that category;
   - BRANCH content → active members and followers of that branch who opted in;
   - direct events → the affected user.

   It then bulk-inserts `notifications`, emits `notification.created` to `user:{id}` rooms,
   and enqueues e-mails for users with e-mail enabled for that category.

4. Unread count comes from a partial index (`WHERE read_at IS NULL`).

Categories: `announcements`, `events`, `news`, `sermons`, `baptism`, `membership`,
`account` (the last is always on).

---

## 11. Media pipeline

```
browser ── POST /api/v1/media/uploads {filename, size, mime, purpose}
        ◀─ {mediaId, upload: {url, method: PUT, headers}}  (presigned PUT: Content-Length
                                                            and Content-Type are signed)
browser ── PUT file directly to the bucket
browser ── POST /api/v1/media/uploads/{id}/complete
api     ── HEAD object (size), status UPLOADED, enqueue media.process
worker  ── GET first bytes → magic-number check → reject/mark FAILED on mismatch
        ── image: sharp → strip metadata, orient, dimensions, dominant colour,
                  variants (webp 320/640/1280/1920), status READY
        ── audio: ffprobe → duration, bitrate, codec → READY
        ── video: ffprobe → duration, dimensions; ffmpeg poster frame → READY
                  (HLS renditions: MediaVariant rows 'hls_*', job reserved for later)
```

- Purposes carry their own rules (allowed types, max size, public/private): e.g. `cover`
  (image ≤ 15 MB, public), `avatar` (image ≤ 5 MB, public), `sermon_audio`
  (mp3/m4a/aac/ogg/wav ≤ 300 MB, public), `sermon_video` (mp4/webm/mov ≤ 4 GB, public),
  `document` (pdf ≤ 20 MB, private).
- Keys: `{public|private}/{yyyy}/{mm}/{uuidv7}/{variant}.{ext}`. Names never come from user
  input.
- Public objects are served through `MEDIA_PUBLIC_BASE_URL` (Nginx → bucket, or a CDN).
  Private objects are served only through short-lived signed GET URLs issued after a
  permission check.
- Content is usable while processing runs: cards fall back to the original or to a neutral
  placeholder, and players wait for `READY`.

---

## 12. Search

`SearchService` interface with a PostgreSQL provider:

- `content_items.search_vector`: a generated `tsvector` (title A, summary B, body C,
  `english` config) with a GIN index, ranked with `ts_rank_cd` + recency.
- Branches, speakers and (admin only) users: `pg_trgm` trigram indexes for fuzzy name
  search.

A Meilisearch or OpenSearch provider can replace it later behind the same interface, fed by
the same domain events.

---

## 13. Caching and performance

- Public pages are Server Components. Anonymous API reads are fetched **without cookies**
  and cached by Next with `revalidate` + tags (`content`, `branch:{slug}`, …). When content
  changes, the worker calls the web app's authenticated revalidation endpoint, and a short
  `revalidate` window bounds staleness if that call fails.
- The account-specific header area (avatar, unread count) is a small client island, so
  public pages stay cacheable.
- The database has composite indexes for every list query (see the schema), partial indexes
  for hot predicates, `pg_trgm`/GIN for search, and connection pooling in `pg`.
- No N+1 queries: list endpoints use a single query with `select` projections plus batched
  relation loads.
- Images go through `next/image` with explicit sizes, using the worker's variants.

---

## 14. Observability

- JSON logs (pino) with `requestId` (from `X-Request-Id` or generated), user id, route,
  latency and status. Cookies, authorization headers, passwords and tokens are redacted.
- The request id propagates web → API (header) → jobs (payload) → worker logs.
- Health: `/api/health/live` (process) and `/api/health/ready` (Postgres + Redis). The
  worker exposes the same on a small HTTP port for Docker health checks.
- Error-tracking hook: an `ErrorReporter` interface (no-op by default, Sentry-compatible).
- Metrics-ready: an OpenTelemetry-compatible structure. BullMQ has optional OTel support
  (`bullmq-otel`).

---

## 15. Security summary

See [`SECURITY.md`](SECURITY.md). Highlights: server-side validation of every input with
strict Zod schemas; permission checks in the API; argon2id; HttpOnly session cookies; CSRF
double-submit + Origin check; Redis rate limits and progressive lockout; parameterised
queries only (Prisma, plus `$queryRaw` tagged templates, never `$queryRawUnsafe`); Markdown
rendered without raw HTML; strict CSP with nonces on the web app; presigned uploads with
signed size and type, re-validated by magic bytes; private media only through signed
URLs; audit log for privileged actions; secrets only through environment variables.

---

## 16. Deployment

Docker Compose on a Linux VPS. See [`DEPLOYMENT.md`](DEPLOYMENT.md). Services: `nginx`,
`web`, `api`, `worker`, `postgres`, `redis`, `minio` (optional when using external S3/R2),
`migrate` (one-shot `prisma migrate deploy`), `backup` (scheduled `pg_dump` + retention).
Each service has a health check, a restart policy and bounded logging.

---

## 17. Extending the platform

| To add…                              | Touch                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A new content type (e.g. devotional) | `ContentType` enum + migration, optional detail table, Zod schemas in `shared`, API module or content sub-module, web route + card variant |
| A new permission                     | `shared/permissions.ts`, seed role mapping, guard/policy call                                                                              |
| A new background job                 | queue + payload in `shared/queues.ts`, processor in `worker`, producer in API                                                              |
| A new storage/mail/search provider   | implement the interface in `infrastructure` (or `api/search`), switch by env                                                               |
| Messaging / marketplace (deferred)   | new API module + tables, reuse the realtime, media and notification infrastructure                                                         |

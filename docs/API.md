# API

The API is a NestJS 12 application on Fastify (`apps/api`). It serves JSON under
`/api/v1` and describes itself with OpenAPI 3.1:

- Interactive docs (development): http://localhost:4000/api/docs
- Machine-readable document: `packages/api-client/openapi.json` (generated, committed)
- Typed client: `@church/api-client` (`createApiClient()` on top of `openapi-fetch`)

Regenerate the document and client after any contract change with `pnpm api:openapi`.

---

## 1. Conventions

| Topic          | Rule                                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Versioning     | URI versioning: `/api/v1/…`. Breaking changes get `/api/v2` for the affected routes; `v1` keeps working until clients move. Health checks are unversioned (`/api/health/live`, `/api/health/ready`).         |
| Contracts      | Every request body, query and path parameter is validated by a Zod schema from `@church/shared`. Every response is serialised through its declared schema, so undeclared fields never leave the server.      |
| Naming         | Resources are plural nouns (`/branches`, `/events`); the signed-in user's own resources live under `/me`. JSON fields are `camelCase`. Enum values are `UPPER_CASE`; query-string filters accept lower case. |
| IDs and slugs  | Records have UUIDv7 ids. Public URLs use slugs (`/content/{slug}`, `/branches/{slug}`).                                                                                                                      |
| Dates          | Timestamps are ISO 8601 with offset (`2026-10-06T10:30:00.000Z`). Calendar dates are `YYYY-MM-DD`. Wall-clock times are `HH:MM` in the branch's time zone.                                                   |
| Pagination     | Feeds use keyset cursors: `?limit=20&cursor=<opaque>` → `{ items, nextCursor }`. `nextCursor` is `null` on the last page. Admin tables (later) use `?page=&pageSize=` → `{ items, page, pageSize, total }`.  |
| Branch context | Public listings accept `?branch=<slug>` (that branch plus church-wide content) and `?scope=all\|global\|branch`.                                                                                             |
| Caching        | Public reads send `Cache-Control: public` with short lifetimes (content 30 s + 120 s stale-while-revalidate, branches 60 s + 300 s). Personal and auth responses send `no-store`.                            |
| Errors         | RFC 9457 problem details (below).                                                                                                                                                                            |

### Errors

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "code": "VALIDATION_FAILED",
  "detail": "Some fields need attention.",
  "requestId": "01J…",
  "errors": [{ "path": "email", "message": "Enter a valid e-mail address" }]
}
```

`code` is stable and safe to branch on; `detail` and field messages are written for end
users. Common codes: `VALIDATION_FAILED`, `UNAUTHENTICATED`, `INVALID_CREDENTIALS`,
`EMAIL_NOT_VERIFIED`, `FORBIDDEN`, `CSRF_REJECTED`, `NOT_FOUND`, `RATE_LIMITED` (with
`Retry-After`), `TOKEN_INVALID`, `MEMBERSHIP_EXISTS`, `MEMBERSHIP_ELSEWHERE`,
`REGISTRATION_CLOSED`, `BAPTISM_REQUESTS_CLOSED`. Every response carries `x-request-id`.

### Authentication and CSRF

- Sessions are opaque tokens in an HttpOnly cookie (`__Host-cp_session` in production,
  `cp_session` locally). There are no bearer tokens (ADR-008).
- Unsafe methods (POST/PUT/PATCH/DELETE) need the double-submit CSRF token: read the
  `cp_csrf` cookie (or `GET /api/v1/auth/csrf`) and send it as `x-csrf-token`. The
  `Origin`/`Sec-Fetch-Site` headers must also be same-site. The browser client in
  `apps/web/src/lib/api/client.ts` does this automatically.
- Routes are private unless marked `@Public()`. Permissions are checked against the
  concrete target (a branch or the whole church); see `docs/SECURITY.md`.

### Rate limits

Redis fixed windows per client IP (or per user for signed-in actions). A global ceiling of
600 requests/minute per IP applies to every route; sensitive routes have stricter rules
(login 30/15 min per IP plus progressive lockout per account, registration 10/h, password
reset 10/h, baptism enquiry 5/h, search 60/min, profile updates 30/h per user).

Server-side rendering calls the API from the web server. Those requests carry the shared
`INTERNAL_API_TOKEN` and name the visitor in `x-client-ip`, so limits apply per visitor
(ADR-024). Without a valid token, `x-client-ip` is ignored.

---

## 2. Endpoint inventory (`/api/v1`)

Legend: 🌐 public · 🔑 signed in · 🛡 permission required.

### Auth (`auth`)

| Method | Path                           | Access | Purpose                                                     |
| ------ | ------------------------------ | ------ | ----------------------------------------------------------- |
| GET    | `/auth/session`                | 🌐     | Current user (or `null`); issues the CSRF cookie            |
| GET    | `/auth/csrf`                   | 🌐     | CSRF token                                                  |
| POST   | `/auth/register`               | 🌐     | Create an account (always 202; e-mail confirmation follows) |
| POST   | `/auth/verify-email`           | 🌐     | Confirm e-mail with the token and sign in                   |
| POST   | `/auth/verify-email/resend`    | 🌐     | New confirmation link (always 202)                          |
| POST   | `/auth/login`                  | 🌐     | Sign in (`rememberMe` for a 60-day session)                 |
| POST   | `/auth/logout`                 | 🔑     | Sign out this device                                        |
| POST   | `/auth/password/forgot`        | 🌐     | Reset link (always 202)                                     |
| POST   | `/auth/password/reset`         | 🌐     | Set a new password with the token; signs out other sessions |
| POST   | `/auth/password/change`        | 🔑     | Change password (current password required)                 |
| GET    | `/auth/sessions`               | 🔑     | Signed-in devices                                           |
| DELETE | `/auth/sessions/{id}`          | 🔑     | Sign out one device                                         |
| POST   | `/auth/sessions/revoke-others` | 🔑     | Sign out every other device                                 |

### Account (`account`)

| Method | Path                           | Access | Purpose                                                              |
| ------ | ------------------------------ | ------ | -------------------------------------------------------------------- |
| GET    | `/me/profile`                  | 🔑     | Profile, home branch and memberships                                 |
| PATCH  | `/me/profile`                  | 🔑     | Partial update (`null` clears optional fields)                       |
| POST   | `/me/memberships`              | 🔑     | Ask to join a branch (verified e-mail; one branch at a time)         |
| DELETE | `/me/memberships/{id}`         | 🔑     | Withdraw a request or leave a branch                                 |
| GET    | `/me/notification-preferences` | 🔑     | Per-category in-app / e-mail choices (organisation defaults applied) |
| PUT    | `/me/notification-preferences` | 🔑     | Save choices; `ACCOUNT` e-mails always stay on                       |

### Public content (`organization`, `branches`, `content`, `baptism`, `links`)

| Method | Path                                         | Access | Purpose                                                                         |
| ------ | -------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| GET    | `/organization`                              | 🌐     | Name, tagline, contact, public settings                                         |
| GET    | `/branches`                                  | 🌐     | Active branches with current weekly services                                    |
| GET    | `/branches/{slug}`                           | 🌐     | Branch detail: schedules (temporary changes applied), leaders, gallery, contact |
| GET    | `/home?branch=`                              | 🌐     | Everything the home page needs in one call                                      |
| GET    | `/content?branch=&scope=&types=&tag=`        | 🌐     | Feed, newest first (pinned first)                                               |
| GET    | `/content/{slug}`                            | 🌐     | One published item with detail, gallery and related items                       |
| GET    | `/events?when=upcoming\|past&category=`      | 🌐     | Events, soonest first (or latest first for past)                                |
| GET    | `/sermons?speaker=&series=&tag=&q=`          | 🌐     | Sermon library                                                                  |
| GET    | `/sermons/facets`                            | 🌐     | Speakers, series and tags with published sermons                                |
| GET    | `/search?q=&types=&branch=`                  | 🌐     | Full-text search over content and branch names                                  |
| POST   | `/baptism-requests`                          | 🌐     | Baptism enquiry to the chosen branch (202)                                      |
| GET    | `/legacy-links/{branch\|content}/{legacyId}` | 🌐     | Current path of an imported legacy record (old URLs)                            |
| GET    | `/sitemap`                                   | 🌐     | Paths and last-modified times for `sitemap.xml`                                 |

### Operations (`health`)

| Method | Path                | Purpose                                                    |
| ------ | ------------------- | ---------------------------------------------------------- |
| GET    | `/api/health/live`  | Process is up (no dependencies checked)                    |
| GET    | `/api/health/ready` | Postgres and Redis reachable; used by Docker health checks |

Planned (see `docs/HANDOVER.md`): admin endpoints under `/api/v1/admin/**` (content,
branches, schedules, memberships, baptism requests, users and roles, audit log, settings),
notifications (`/me/notifications`), media uploads (`/media/uploads`), and Socket.IO
events for live notifications.

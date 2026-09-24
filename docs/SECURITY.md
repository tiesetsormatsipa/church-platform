# Security

This document describes the security model of the platform, the controls that are in
place (with the code that implements them), and what is still planned. The legacy system's
findings (S1–S17) are in [`LEGACY_AUDIT.md`](LEGACY_AUDIT.md) §6; §6 below maps each one
to its fix.

The platform holds personal information of church members in South Africa, so the
**Protection of Personal Information Act (POPIA)** applies: collect only what is needed,
protect it, and let people see and correct it.

---

## 1. Threat model (summary)

| Asset                               | Main threats                                                                |
| ----------------------------------- | --------------------------------------------------------------------------- |
| Member accounts                     | Credential stuffing, password guessing, session theft, account enumeration  |
| Personal data (profiles, enquiries) | Unauthorised access across branches, IDOR, leaks through logs or URLs       |
| Content and branch data             | Unauthorised edits (privilege escalation between branches), stored XSS      |
| Availability                        | Abuse of public forms and search, expensive queries                         |
| Media (later phase)                 | Malicious uploads, content-type confusion, public exposure of private files |

Actors: anonymous visitors, members, branch editors/admins (scoped to their branch),
church-wide admins, super admins. The web server is trusted by the API only through the
shared internal token.

---

## 2. Authentication

| Control             | Implementation                                                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Password hashing    | argon2id (m=19 MiB, t=2, p=1) via `@node-rs/argon2`, `packages/infrastructure/src/password.ts`. Legacy bcrypt/scrypt hashes are verified and upgraded on the next sign-in (ADR-009).                                                                                                       |
| Password policy     | 10–256 characters, no composition rules (NIST 800-63B).                                                                                                                                                                                                                                    |
| Sessions            | Opaque 256-bit tokens; only the SHA-256 is stored (`sessions.token_hash`). HttpOnly, `SameSite=Lax`, `Secure` + `__Host-` prefix in production. Idle timeout 14 days (sliding), absolute 1 day (default) or 60 days ("keep me signed in"). `apps/api/src/modules/auth/session.service.ts`. |
| Revocation          | Sign out one device, all other devices, or everything on password reset/change. Sessions of suspended users stop working immediately.                                                                                                                                                      |
| Brute force         | Per-IP login limit (30 / 15 min), per-account failure counter with progressive lockout (from 5 failures, doubling up to the cap), constant-time dummy hash for unknown accounts. `auth.service.ts`.                                                                                        |
| Enumeration         | Registration, resend-verification and forgot-password always answer 202 with the same message; existing accounts get an e-mail instead of an error. Login errors do not say which part was wrong.                                                                                          |
| E-mail verification | Required before signing in. Single-use tokens (hashed at rest), 24 hours for verification and 30 minutes for password reset; issuing a new token invalidates older ones.                                                                                                                   |
| Token hygiene       | Tokens arrive in URLs only from e-mails; the web app removes them from the address bar immediately and sets `Referrer-Policy: no-referrer` on those pages.                                                                                                                                 |
| OAuth               | Schema-ready (`auth_identities`), not enabled yet.                                                                                                                                                                                                                                         |

## 3. Authorisation

- **Permission catalogue** in code: `packages/shared/src/permissions.ts`. Roles are data;
  each `role_assignment` is either church-wide (`branch_id = NULL`) or for one branch.
- **Server-side checks against the concrete target:** `AccessService.assert(principal,
permission, target)` in `apps/api/src/modules/access/access.service.ts`. Church-wide
  content is an organisation target, so a branch editor cannot edit it.
- **Anti-escalation:** a user can only grant roles whose permissions they hold for the
  same scope (`canAssignRole`).
- **Own-resource endpoints** (`/me/**`) always act on the session's user id; ids from the
  client are re-checked for ownership (membership withdrawal returns 404 for others'
  records, never 403, to avoid confirming existence).
- The web app only **hides** controls a user cannot use; the API enforces.

## 4. Request security

| Control          | Implementation                                                                                                                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CSRF             | Double-submit token (`cp_csrf` cookie ↔ `x-csrf-token` header, compared in constant time) **plus** `Origin`/`Sec-Fetch-Site` same-site check on every unsafe method. `csrf.guard.ts`.                                         |
| Input validation | Zod schemas from `@church/shared` on every body, query and path parameter; unknown keys are stripped.                                                                                                                         |
| Output filtering | Responses are serialised through their declared schema; undeclared fields (hashes, internal notes) cannot leak.                                                                                                               |
| Mass assignment  | Update DTOs list the editable fields explicitly; ownership and status fields are never client-settable.                                                                                                                       |
| Rate limiting    | Redis fixed windows (`rate-limit.guard.ts`, ADR-017). Global 600/min per IP plus per-route rules.                                                                                                                             |
| Client IP        | Behind Nginx, `TRUST_PROXY=true` and the proxy sets `X-Real-IP`/`X-Forwarded-For`. Server-side rendering names the visitor with `x-client-ip`, trusted only with the `INTERNAL_API_TOKEN` (ADR-024, `common/http/client.ts`). |
| SQL injection    | Prisma queries; raw SQL only through tagged `$queryRaw`. `$queryRawUnsafe` is banned.                                                                                                                                         |
| XSS              | React escapes output. Content bodies are Markdown rendered with `skipHtml` and `rehype-sanitize` (ADR-014). JSON-LD is serialised with `<`, `>` and `&` escaped. External links get `rel="noopener noreferrer nofollow"`.     |
| Open redirects   | `?next=` accepts same-site paths only (`apps/web/src/lib/safe-next.ts`, unit-tested against `//host`, `/\host`, control characters). Maps links must be `https:`.                                                             |
| Forms            | Submit buttons stay disabled until hydration and forms use `method="post"`, so personal data can never end up in a URL through a native GET submission.                                                                       |
| Headers (API)    | Helmet: strict CSP (`default-src 'none'`), `frame-ancestors 'none'`, HSTS in production, CORP `same-site`.                                                                                                                    |
| Headers (web)    | `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, restrictive `Permissions-Policy`. **CSP with nonces is planned (Phase 10).**                                           |

## 5. Data protection

- **Minimal collection** and purposes as described in the privacy notice (`/privacy`).
- **Audit log** (`audit_logs`) for privileged and security-relevant actions, with actor,
  target, IP and request id. Profile changes record field names only, never values.
- **Logs** (pino) redact cookies, authorization, CSRF and internal-token headers, and any
  `password`, `token`, `secret` or `hash` fields (`packages/infrastructure/src/logger.ts`).
- **Secrets** come from the environment and are validated at start-up (minimum lengths);
  nothing secret is committed. `.env` is git-ignored; `.env.example` holds development
  values only.
- **Storage:** public and private objects use separate key prefixes; private objects are
  only reachable through short-lived presigned URLs. Uploads use presigned PUT with signed
  `Content-Type` and `Content-Length` (ADR-022), and the worker sniffs the real type.
- **Backups** (Phase 11) are encrypted and restore-tested.

## 6. Legacy findings and their fixes

| Legacy finding (LEGACY_AUDIT §6)                                | Fix in the new platform                                                                  |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Mass assignment on updates                                      | Explicit Zod update schemas; server-owned fields never accepted                          |
| Client-controlled prices / flags                                | Server derives all state; deferred marketplace not ported (ADR-016)                      |
| Unscoped roles (any admin edits any branch)                     | Scoped role assignments + target-based checks                                            |
| Tokens in URLs and `localStorage`; non-revocable refresh tokens | HttpOnly server-side sessions, revocable per device                                      |
| Notification IDOR                                               | `/me/**` scoped to the session user (notifications arrive in Phase 7 with the same rule) |
| "Private" media served publicly                                 | Private prefix + presigned GET only                                                      |
| Weak password storage                                           | argon2id with transparent upgrade                                                        |
| No rate limiting / lockout                                      | Redis rate limits + progressive lockout                                                  |
| HTML injection in content                                       | Markdown without raw HTML, sanitised                                                     |

## 7. Operational checklist (production)

- `NODE_ENV=production`, `COOKIE_SECURE=true`, `TRUST_PROXY=true`, HTTPS only (HSTS).
- Long random values for `INTERNAL_API_TOKEN`, `REVALIDATE_SECRET`, database and S3
  credentials; rotate on staff changes.
- API docs disabled (`API_DOCS_ENABLED=false`) unless protected.
- Postgres and Redis not exposed publicly; S3 bucket policy allows public reads of the
  `public/` prefix only.
- Keep dependencies patched (`pnpm audit`), and review the audit log for repeated lockouts.

## 8. Reporting a vulnerability

Please report security issues privately to the church office (the address in the site
footer) rather than in a public issue. Include steps to reproduce. We will acknowledge
within a few days.

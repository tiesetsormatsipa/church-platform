# Data Migration

How data moves from the legacy systems into the new platform: safely, repeatably and with a
report. Tooling lives in [`tools/legacy-migration`](../tools/legacy-migration).

> Status: the pipeline, the bundle format, the importer and the extractor for the legacy
> **TypeScript/Prisma** database are implemented. The extractor for the **Python** site at
> `church.techtursolutions.com` is blocked on its source code or schema (see
> [LEGACY_AUDIT §1.2](LEGACY_AUDIT.md#12-critical-finding-the-repository-is-not-the-python-application)).

---

## 1. Principles

1. **Never copy by hand.** Every record goes through extract → transform → validate →
   import.
2. **Never mutate the source.** Extractors use read-only connections (a read-only role or
   `SET TRANSACTION READ ONLY`).
3. **Idempotent.** Every imported row is recorded in `legacy_id_map (source, entity_type,
   legacy_id) → new_id`. Re-running updates mapped rows instead of duplicating them.
   Unchanged rows are skipped by checksum.
4. **Explicit transformations.** Renames and corrections (e.g. `Johanessburg` →
   `Johannesburg`) come from a reviewed mapping file. The original value is kept
   (`branches.legacy_label`), and every transformation appears in the report.
5. **Fail loudly, continue safely.** Invalid records are skipped and listed with reasons.
   Each entity batch runs in its own transaction.
6. **Verify before cutover.** Counts, checksums and spot checks must pass. The legacy
   database is kept (read-only) until sign-off.

---

## 2. Pipeline

```
 legacy DB ──extract──▶ bundle/ (JSONL per entity + manifest.json with sha256)
                         │
                         ├─validate──▶ zod schemas → validation-report.json
                         │
                         ├─import────▶ new DB (transactions per batch, legacy_id_map, migration_runs)
                         │               └─ media: copy files → object storage, create media_assets
                         │
                         └─verify────▶ counts / relationship integrity / sample diff → verify-report.md
```

CLI (`pnpm --filter @church/legacy-migration cli <command>`):

| Command | What it does |
| --- | --- |
| `extract --source prisma-legacy --url $LEGACY_DATABASE_URL --out ./bundle` | Reads the legacy TypeScript app DB into a bundle |
| `extract --source python-legacy …` | **To be written** once the Python schema is known (see §6) |
| `validate --bundle ./bundle` | Schema-validates every record. Non-zero exit on errors. |
| `import --bundle ./bundle [--dry-run] [--only users,branches] [--media-root /var/www/truthofgod/media]` | Imports in dependency order. Dry-run runs everything inside a transaction that is rolled back. |
| `verify --bundle ./bundle` | Compares bundle counts with mapped rows and checks referential completeness |
| `report --run <id>` | Prints the stored report of a run |

---

## 3. Bundle format (source-independent contract)

A bundle is a directory:

```
bundle/
  manifest.json            { source, extractedAt, tool version, entities: { name: { file, count, sha256 } } }
  organization.jsonl
  users.jsonl
  branches.jsonl
  branch_schedules.jsonl
  branch_leaders.jsonl
  branch_memberships.jsonl
  role_assignments.jsonl
  content.jsonl            announcements, news, posts, events, sermons, baptism stories
  media.jsonl              file references (path or URL) + metadata
  service_records.jsonl
  notifications.jsonl
  audit_logs.jsonl
  archive/                 deferred-module data, copied verbatim (not imported)
```

Every record has `legacyId` (string, unique per entity in the source) plus the fields defined
by the Zod schemas in `tools/legacy-migration/src/bundle/schema.ts`. Relationships use the
**legacy** ids of the other entity (`branchLegacyId`, `authorLegacyId`, `mediaLegacyIds`).
The importer resolves them through `legacy_id_map`.

Branch scope: content records carry `scope: "GLOBAL" | "BRANCH"` and `branchLegacyId`. An
extractor that finds a pseudo-branch such as "Global" must emit `scope: "GLOBAL"`, not a
branch.

---

## 4. Mapping: legacy TypeScript app → new schema

| Legacy (Prisma) | New | Transformation |
| --- | --- | --- |
| `tenants` (+ settings, brand) | `organizations` | Name, slug, timezone, locale; brand colours dropped (design system). |
| `users` | `users` | E-mail lower-cased and trimmed (duplicates after normalisation are reported and merged by most recent login); `status` ACTIVE/PENDING_VERIFICATION → ACTIVE, SUSPENDED/BANNED → SUSPENDED, INACTIVE → DEACTIVATED; `passwordHash` (bcrypt) kept for transparent re-hash (ADR-009); `isEmailVerified` → `email_verified_at` (= `created_at` when true); `googleId` → `auth_identities(GOOGLE)` |
| `profiles` | `profiles` | `surname` → `last_name`; `profilePictureUrl` → imported as media when local, else dropped with a report line; `branchId` → `home_branch_id`; consent flags → timestamps |
| `user_roles` | `role_assignments` | `global-super-admin`, `super-admin` → `super_admin` (org); `platform-admin` → `church_admin` (org); `country/regional/continental/province-admin` → `church_admin` (org); `branch-admin` → `branch_admin` at the user's home branch, or org-level `church_admin` **only if** mapped explicitly in `role-map.json` (never widened silently); `branch-moderator` → `branch_editor` (home branch); `membership-verifier` → `branch_admin` (home branch, reported for review); `minister`, `overseer`, `deacon`, `auxiliary-*` → no RBAC role (reported; leaders come from `branch_leadership`); `verified-member` → `branch_memberships` ACTIVE at the home branch; `unverified-member`, `public-visitor`, seller/job/song roles → none |
| `verification_requests` | `branch_memberships` | PENDING → PENDING, VERIFIED → ACTIVE, REJECTED → REJECTED, at the user's home branch; users without a home branch are reported |
| `branches` | `branches` | Slug kept; `name` via `branch-names.json` (canonical) with `legacy_label` = original; type MAIN/SUB/SATELLITE/ONLINE kept; city/province/country from the geo tables → text/ISO code; `isActive=false` → INACTIVE |
| `branch_service_times` | `branch_schedules` (kind SERVICE) | weekday, times, label |
| `branch_temp_service_times` | `branch_schedules` (SERVICE, effective range, `replaces_regular = true`) | |
| `branch_prayer_schedules` | `branch_schedules` (PRAYER) | `frequency` → `recurrence_text` |
| `branch_fasting_schedules` | `branch_schedules` (FASTING) | `pattern` → `recurrence_text` |
| `branch_leadership` | `branch_leaders` | |
| `branch_media` | `branch_gallery_items` + `media_assets` | |
| `branch_announcements` | `content_items` (ANNOUNCEMENT, BRANCH) | status mapping below |
| `announcements` | `content_items` (ANNOUNCEMENT / BAPTISM when `category = baptism`) | `isGlobal` or no target → GLOBAL; `targetScope = BRANCH` → BRANCH; `imageUrl` → cover media; `isPinned` kept |
| `event_countdown_configs` | `content_items` (EVENT, GLOBAL, featured) + `event_details` | `bookingUrl` → `registration_url`, `mapsUrl` kept |
| `sermons` | `content_items` (SERMON) + `sermon_details` | `minister` → `speakers` (deduplicated by normalised name); `date` → `preached_on`; `keywords` → tags; audio → media; `branchId` → scope BRANCH, otherwise GLOBAL |
| `branch_records` + `branch_record_edits` | `branch_service_records` + revisions | |
| `media_assets` | `media_assets` | Files copied from `STORAGE_LOCAL_ROOT/<storedKey>` to the bucket under new keys; sha256 recorded; missing files reported |
| `notifications` | `notifications` | type → category mapping; `isRead` → `read_at` |
| `audit_logs` | `audit_logs` | action enum → dotted action string (`CREATE` on `Announcement` → `content.create`), metadata kept |
| `songs`, `likes`, marketplace, jobs, messaging, geo, feature flags, moderation, analytics, email templates/logs | `archive/*.jsonl` | Not imported (ADR-016) |
| `device_sessions` | not migrated | Users sign in again |

Status mapping for content: DRAFT → DRAFT, PENDING_REVIEW/APPROVED → PENDING_REVIEW,
PUBLISHED → PUBLISHED (`published_at` = `publishedAt ?? createdAt`), REJECTED → DRAFT (with an
import note), ARCHIVED → ARCHIVED. `expiresAt` in the past → ARCHIVED.

Slugs: generated from titles and de-duplicated with a numeric suffix. The legacy id → slug
mapping is written to `redirects.generated.json` for URL compatibility.

---

## 5. Import order and integrity

1. organization
2. media (files + rows), so that other entities can reference them
3. users → profiles → auth identities
4. branches (two passes: rows, then `parent_branch_id`)
5. branch schedules, leaders, gallery
6. role assignments, memberships
7. speakers, tags, series
8. content items + details + tags + media links
9. service records + revisions
10. notifications, audit logs

Each step is a batch of 500 records in one transaction. It upserts by `legacy_id_map`, writes
the map entry in the same transaction, and records successes and failures in
`migration_runs.stats`.

---

## 6. The Python site (pending)

Needed from the owner: repository access, **or** a schema dump plus a data dump, **or**
network access to the live site's host for the build environment.

Plan once available:

1. Write `src/extractors/python-legacy.ts`, which maps its tables onto the bundle schema.
   Expected entities (from the brief): users, branches (Global, CapeTown, Kimberley,
   Johanessburg, Durban, PTA), posts/feed items, events, news, baptism items, sermons,
   images.
2. Use `branch-names.json` (defaults: `CapeTown → Cape Town`,
   `Johanessburg → Johannesburg`, `PTA → Pretoria`, `Global → (scope GLOBAL)`). **Confirm
   "PTA" before cutover.**
3. If both legacy systems hold data, import the Python bundle first (it is the live
   product), then the TypeScript bundle. Users are matched by normalised e-mail and
   branches by the name mapping. Conflicts are reported, not overwritten.
4. Add the Python site's URLs to the redirect table from the extractor's slug map.

---

## 7. Cutover runbook

1. **Rehearse** on a copy: restore the latest legacy backup into a scratch DB, run the full
   pipeline, and review the reports with the owner.
2. **Freeze** writes on the legacy site (maintenance banner, or read-only DB role).
3. Take a final **backup** of every legacy database and the media directory (keep it for at
   least 90 days).
4. Run `extract` → `validate` → `import` → `verify` against production.
5. Smoke test with real accounts: sign in (password re-hash path), browse the feed per
   branch, open migrated sermons (audio), check admin permissions of mapped roles.
6. **Switch DNS/Nginx** to the new stack. Legacy URLs are served by the redirect table.
7. Keep the legacy DB read-only and unreachable from the internet. Decommission only after
   owner sign-off.

**Rollback:** the legacy stack stays deployable until sign-off. Point Nginx back and unfreeze.
Content created on the new platform during the window would need a manual export (reported by
`created_at > cutover`).

---

## 8. Privacy (POPIA)

* Only personal data with a purpose is migrated. Device sessions, analytics and
  marketplace/job data are archived, not imported.
* Archives are encrypted at rest (`age` or GPG), stored off the web server, and have a
  documented retention period.
* Bundles contain personal data. Delete them after verification, and never commit them
  (`bundle/` is git-ignored).

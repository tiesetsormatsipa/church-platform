# Church Platform

A modern platform for a multi-branch church: public site (feed, events, news, sermons,
baptism, branches), member accounts, and administration. It replaces an earlier prototype
(kept read-only in [`legacy/`](legacy/LEGACY.md)).

> **Status:** live at <https://church.techtursolutions.com>. The public site, member area,
> administration and the background worker (e-mail delivery, cache refresh, notifications)
> are built and tested (phases 0–7 and 11). Next: media uploads, legacy data migration and
> hardening. See [`docs/HANDOVER.md`](docs/HANDOVER.md) for details, known gaps and next
> steps, and [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for how a change reaches production.
>
> **One thing is missing before the site can take real sign-ups:** no SMTP provider has been
> chosen yet, so production e-mail goes to a local catch-all and nobody can confirm an
> address. See `DEPLOYMENT.md` §5.

## Stack

|         |                                                                               |
| ------- | ----------------------------------------------------------------------------- |
| Web     | Next.js 16 (App Router, Server Components), React 19, Tailwind CSS 4, Base UI |
| API     | NestJS 12 on Fastify (ESM), Zod 4 contracts, OpenAPI                          |
| Worker  | BullMQ (e-mail, notifications, media processing)                              |
| Data    | PostgreSQL 18 + Prisma 7, Redis 7, S3-compatible object storage               |
| Runtime | Node.js 24 LTS, pnpm 10 workspaces, Docker Compose                            |

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm infra:up          # Postgres, Redis, S3 (RustFS), Mailpit
pnpm setup             # generate client, build packages, migrate, seed demo data
pnpm dev               # http://localhost:3000 (web), http://localhost:4000/api/docs (API)
```

Demo sign-in: `member@example.org` / `Church-Demo-2026!` (more accounts in
[`AGENTS.md`](AGENTS.md#3-commands)).

## Quality gate

```bash
pnpm check                 # format, lint, typecheck, unit tests, build
pnpm test:integration      # API and worker against real Postgres and Redis
pnpm test:e2e              # Playwright user flows (run `pnpm build` first)
```

## Documentation

| Document                                                         | Purpose                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md)                  | How to work in this repo (rules, commands, conventions)            |
| [docs/HANDOVER.md](docs/HANDOVER.md)                             | Current status, next steps, open questions                         |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                     | System design, domain model, flows                                 |
| [docs/ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md) | ADRs, including deviations from the original brief                 |
| [docs/LEGACY_AUDIT.md](docs/LEGACY_AUDIT.md)                     | What the old system did, its defects, and the legacy → new mapping |
| [docs/DATA_MIGRATION.md](docs/DATA_MIGRATION.md)                 | How legacy data is migrated                                        |
| [docs/UX_SYSTEM.md](docs/UX_SYSTEM.md)                           | Design system and UX principles                                    |
| [docs/API.md](docs/API.md)                                       | API conventions and endpoint inventory                             |
| [docs/SECURITY.md](docs/SECURITY.md)                             | Security model and controls                                        |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)                         | VPS deployment, push-to-deploy, e-mail, backups, operations        |

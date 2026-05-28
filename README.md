# Church Platform — Production-Ready Community Platform

A full-stack, production-grade church community platform supporting South Africa and future global expansion. Built with Next.js 14, NestJS, PostgreSQL/Prisma, Socket.IO, and a robust feature flag system.

---

## Architecture Overview

```
church-platform/
├── apps/
│   ├── api/            # NestJS backend (REST + WebSocket)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/           # JWT + Google OAuth
│   │   │   │   ├── users/          # Profiles + verification
│   │   │   │   ├── branches/       # Branch management + records
│   │   │   │   ├── geo/            # Continent/Region/Country/Province
│   │   │   │   ├── features/       # Feature flag engine
│   │   │   │   ├── messaging/      # WebSocket chat
│   │   │   │   ├── marketplace/    # Products + orders + sub-orders
│   │   │   │   ├── jobs/           # Job board
│   │   │   │   ├── sermons/        # Audio sermons
│   │   │   │   ├── songs/          # Praise songs
│   │   │   │   ├── admin/          # Admin + audit logs
│   │   │   │   ├── announcements/  # Church announcements
│   │   │   │   ├── media/          # File upload + processing
│   │   │   │   └── notifications/  # In-app notifications
│   │   │   ├── common/
│   │   │   │   ├── guards/         # JWT, Roles, Feature
│   │   │   │   ├── decorators/     # @Public, @Roles, @Feature
│   │   │   │   └── filters/        # Global exception filters
│   │   │   ├── config/             # App, auth, db, media, email configs
│   │   │   └── database/           # PrismaService
│   │   └── prisma/
│   │       ├── schema.prisma       # Full production data model
│   │       ├── migrations/
│   │       └── seed/               # Realistic test data
│   └── web/            # Next.js 14 frontend (App Router)
│       └── src/
│           ├── app/                # Routes: /, /branches, /regions, /admin...
│           ├── components/
│           │   ├── features/       # Page-specific components
│           │   ├── layout/         # Navigation, Footer
│           │   └── ui/             # Shared design system
│           ├── hooks/              # useAuth, useSocket, useFeatureFlags
│           ├── lib/                # API client, utils
│           └── store/              # Zustand state
├── packages/
│   ├── ui/             # Shared component library
│   ├── shared/         # Shared types and utilities
│   └── config/         # ESLint, TypeScript configs
├── docker-compose.yml
└── .env.example
```

---

## Quick Start (Local)

### Prerequisites
- Node.js ≥ 20
- Yarn ≥ 1.22
- Docker + Docker Compose

### 1. Clone and install
```bash
git clone <repo>
cd church-platform
cp .env.example .env
yarn install
```

### 2. Start infrastructure
```bash
docker-compose up -d postgres redis minio mailhog
```

### 3. Set up the database
```bash
yarn db:migrate     # Run Prisma migrations
yarn db:seed        # Seed with realistic test data
```

### 4. Start development servers
```bash
yarn dev            # Starts both API (port 4000) and Web (port 3000)
```

### 5. Access the platform
| URL | Service |
|-----|---------|
| http://localhost:3000 | Frontend |
| http://localhost:4000/api/docs | Swagger API docs |
| http://localhost:9001 | MinIO console (local S3) |
| http://localhost:8025 | Mailhog (email preview) |

---

## Test Accounts

All accounts use password: `Church@123`

| Email | Role | Access Level |
|-------|------|-------------|
| superadmin@church.org | Global Super Admin | Full platform access |
| admin@church.org | Platform Admin | Admin panel access |
| branchadmin@church.org | Branch Admin | Branch management |
| minister1@church.org | Minister | Ministry tools |
| member@church.org | Verified Member | Full member access |
| newmember@church.org | Unverified Member | Limited public access |
| seller@church.org | Marketplace Seller | Store management |

---

## Feature Flag System

### How it works
The platform ships with all modules in code but most are **disabled by default**. The Super Admin controls which modules are live.

**Always-on (cannot be disabled):**
- Home
- Profile
- Regions / Global Map

**Toggleable modules:**
- Messaging, Marketplace, Jobs, Sermons, Praise Songs, Announcements, Branches

**Enforcement levels:**
1. Frontend navigation — disabled modules are hidden
2. Frontend routing — direct URL access redirects to "Coming Soon"
3. API gateway — all endpoints for a disabled module return HTTP 503
4. Server-side — enforced by the `FeatureGuard` on every controller

**Rollout rules supported:**
- `ALL` — enable for everyone
- `ROLE` — enable only for a specific role
- `COUNTRY` — enable only for a specific country
- `VERIFICATION_STATUS` — verified members only
- `PERCENTAGE` — gradual % rollout (deterministic, based on user ID hash)

**Manage flags:**
```
Admin Panel → Feature Flags
or
PATCH /api/v1/admin/feature-flags/:key { "enabled": true/false }
```

All changes are audit-logged with who changed it, when, and why.

---

## Geographic Hierarchy

```
Global
└── Continent (e.g., Africa)
    └── Region (e.g., Southern African Region)
        └── Country (e.g., South Africa) [status: ACTIVE]
            └── Province (e.g., Gauteng)
                └── City (e.g., Johannesburg)
                    └── Branch (Main or Sub)
                        └── Sub-branch
```

**Country statuses (map colors):**
- `ACTIVE` — Gold — fully live
- `COMING_SOON` — Blue — launching soon
- `UNDER_DEVELOPMENT` — Blue — being set up
- `PLANNED` — Gray — future expansion
- `RESTRICTED` — Gray — temporarily restricted

**Seeded geo data:**
- ✅ South Africa (Active)
- 🔵 Namibia, Botswana, Zimbabwe (Coming Soon / Dev)
- ⬜ Lesotho, Mozambique, Eswatini (Planned)
- 🔵 United Kingdom (Coming Soon)

---

## Messaging System

WhatsApp-style layout with three tabs:
- **Members** — direct member-to-member
- **Marketplace** — buyer/seller per sub-order thread
- **Jobs** — applicant/poster threads

Rules:
- PDF attachments only (≤ 500 KB) for general messages
- Images allowed only in marketplace conversations
- No video or voice notes
- Real-time via Socket.IO with JWT auth on WS connection
- Messages persist in PostgreSQL, delivered via WebSocket room

---

## Order & Email Workflow

1. Buyer places order → sub-orders created per seller
2. Each sub-order gets its own conversation thread
3. Payment confirmation (stub) → triggers receipt generation
4. Receipt PDF generated → stored in media service
5. Email sent via adapter (Mailhog locally, configurable provider in prod)
6. Failed emails are queued with retry (BullMQ, up to 5 attempts)
7. Receipt accessible in user account order history

---

## Multi-tenancy

The platform is tenant-scoped from day one. Every branch, announcement, product, feature flag, and setting belongs to a tenant. This means multiple church organizations can use the same codebase without data cross-contamination.

The initial deployment creates one tenant: `main-church`.

---

## POPIA / Privacy Compliance (South Africa)

- Consent captured on profile creation
- Data retention metadata on all user records
- `deletedAt` soft-delete on users and content
- Country compliance profiles define per-country rules
- Business document requirements configurable per country
- Audit trail for all admin actions on user data
- Email: `privacy@church.org` (configurable via `POPIA_CONTACT_EMAIL`)

---

## Media Handling

All media goes through an **adapter interface** (`StorageAdapter`):
- Default: MinIO (local S3-compatible)
- Swap in: AWS S3, Cloudflare R2, Google Cloud Storage

Upload rules enforced server-side:
- Chat attachments: PDF only, ≤ 500 KB
- Images: JPEG/PNG/WebP only, ≤ 5 MB
- Audio: MP3/AAC/OGG only, ≤ 100 MB
- Virus scan hook: pluggable (ClamAV or cloud provider)

---

## Integration Stubs (Not Yet Wired)

| Stub | Location | Notes |
|------|----------|-------|
| Payment processing | `PaymentIntentStub` model + `PaymentAdapter` interface | Ready for Stripe / Ozow / Peach Payments |
| Cloud storage | `StorageAdapter` interface | Swap MinIO for S3/R2/GCS |
| Email provider | `EmailAdapter` interface | Swap Mailhog for Resend/SES/SendGrid |
| Push notifications | `PushAdapter` interface | Ready for Firebase / Web Push |
| SMS | `SmsAdapter` interface | Ready for Vonage / AWS SNS |
| Analytics | `AnalyticsEvent` model + hooks | Ready for PostHog / Segment |
| Virus scanning | `VirusScanAdapter` hook | ClamAV integration point |
| Backup automation | `BackupJob` model | Cron-triggered, restore validated |

---

## API Versioning

All endpoints are under `/api/v1/...`. When a mobile app requires breaking changes, `/api/v2/...` can be added without touching v1.

---

## Deployment

### Production checklist
1. Set all secrets in `.env` (generate with `openssl rand -base64 64`)
2. Run `yarn db:migrate:prod` (safe production migration)
3. Configure real email provider in `EMAIL_PROVIDER`
4. Configure real storage in `STORAGE_PROVIDER`
5. Set up Google OAuth credentials
6. Enable HTTPS (reverse proxy: Nginx / Caddy / Traefik)
7. Run `docker-compose up -d`

---

## What's Implemented (Phase 1 Complete)

- ✅ Monorepo with full folder structure
- ✅ Full PostgreSQL/Prisma data model (50+ models)
- ✅ Google OAuth + JWT auth with refresh tokens
- ✅ Full RBAC (21 roles, scoped permissions)
- ✅ Geographic hierarchy (Continent → Branch)
- ✅ Feature flag engine (server + client enforced)
- ✅ Multi-tenancy foundation
- ✅ Public home page with countdown, announcements, hero
- ✅ Branches page with full directory + filters
- ✅ Interactive globe / regions page
- ✅ Messaging page (WhatsApp-style layout)
- ✅ Admin panel (overview, feature flags, audit logs)
- ✅ Branch records with full edit history
- ✅ Audit logging throughout
- ✅ Seed data with all test accounts
- ✅ Docker Compose with Postgres, Redis, MinIO, Mailhog
- ✅ PWA manifest + offline shell structure
- ✅ POPIA / privacy consent foundations
- ✅ Order email workflow (queued, retried, document generated)

## What Requires Wiring (Integration Stubs)

- 🔌 Payment processing → connect real payment provider
- 🔌 Email provider → connect Resend / SES / SendGrid
- 🔌 Cloud storage → swap MinIO for production S3/R2
- 🔌 Google OAuth → add real credentials in `.env`
- 🔌 Push notifications → add VAPID keys / Firebase
- 🔌 Sermons/Songs audio streaming → connect audio CDN
- 🔌 Backup automation → configure cron + retention policy

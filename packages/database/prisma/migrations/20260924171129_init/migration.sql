-- Initial schema for the Church Platform.
--
-- Hand-written additions (not expressible in schema.prisma) are marked "[manual]".
-- Keep them when regenerating; see CLAUDE.md ("Database rules").

-- [manual] Trigram matching for fuzzy name search (branches, speakers, people).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "content_type" AS ENUM ('POST', 'ANNOUNCEMENT', 'NEWS', 'EVENT', 'SERMON', 'BAPTISM');

-- CreateEnum
CREATE TYPE "content_scope" AS ENUM ('GLOBAL', 'BRANCH');

-- CreateEnum
CREATE TYPE "content_status" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "body_format" AS ENUM ('MARKDOWN');

-- CreateEnum
CREATE TYPE "event_status" AS ENUM ('SCHEDULED', 'POSTPONED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "event_category" AS ENUM ('SERVICE', 'CONFERENCE', 'BAPTISM', 'YOUTH', 'PRAYER', 'OUTREACH', 'FELLOWSHIP', 'OTHER');

-- CreateEnum
CREATE TYPE "branch_type" AS ENUM ('MAIN', 'SUB', 'SATELLITE', 'ONLINE');

-- CreateEnum
CREATE TYPE "branch_status" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "schedule_kind" AS ENUM ('SERVICE', 'PRAYER', 'FASTING', 'BIBLE_STUDY', 'YOUTH', 'OTHER');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "membership_status" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'LEFT');

-- CreateEnum
CREATE TYPE "role_scope" AS ENUM ('ORGANIZATION', 'BRANCH');

-- CreateEnum
CREATE TYPE "media_kind" AS ENUM ('IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "media_status" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'PROCESSING', 'READY', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "media_visibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "media_purpose" AS ENUM ('COVER', 'AVATAR', 'GALLERY', 'SERMON_AUDIO', 'SERMON_VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "notification_category" AS ENUM ('ANNOUNCEMENTS', 'UPDATES', 'EVENTS', 'NEWS', 'SERMONS', 'BAPTISM', 'MEMBERSHIP', 'ACCOUNT');

-- CreateEnum
CREATE TYPE "baptism_request_status" AS ENUM ('NEW', 'CONTACTED', 'SCHEDULED', 'COMPLETED', 'CLOSED');

-- CreateEnum
CREATE TYPE "auth_token_purpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "auth_provider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "email_delivery_status" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "migration_run_status" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "short_name" VARCHAR(60),
    "tagline" VARCHAR(200),
    "description" TEXT,
    "email" VARCHAR(254),
    "phone" VARCHAR(40),
    "website_url" VARCHAR(2048),
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Africa/Johannesburg',
    "locale" VARCHAR(16) NOT NULL DEFAULT 'en-ZA',
    "logo_media_id" UUID,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "legacy_label" VARCHAR(120),
    "type" "branch_type" NOT NULL DEFAULT 'MAIN',
    "status" "branch_status" NOT NULL DEFAULT 'ACTIVE',
    "parent_branch_id" UUID,
    "description" TEXT,
    "address_line1" VARCHAR(200),
    "address_line2" VARCHAR(200),
    "city" VARCHAR(120),
    "province" VARCHAR(120),
    "postal_code" VARCHAR(20),
    "country_code" CHAR(2) NOT NULL DEFAULT 'ZA',
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "maps_url" VARCHAR(2048),
    "phone" VARCHAR(40),
    "email" VARCHAR(254),
    "cover_media_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_schedules" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "kind" "schedule_kind" NOT NULL,
    "title" VARCHAR(120),
    "day_of_week" SMALLINT,
    "start_time" VARCHAR(5),
    "end_time" VARCHAR(5),
    "recurrence_text" VARCHAR(200),
    "notes" VARCHAR(500),
    "effective_from" DATE,
    "effective_until" DATE,
    "replaces_regular" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "branch_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_leaders" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "user_id" UUID,
    "photo_media_id" UUID,
    "bio" VARCHAR(1000),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "branch_leaders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_gallery_items" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "caption" VARCHAR(300),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_gallery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_service_records" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "service_date" DATE NOT NULL,
    "service_label" VARCHAR(120),
    "attendance" INTEGER,
    "duration_minutes" INTEGER,
    "preacher_name" VARCHAR(120),
    "offering_amount" DECIMAL(12,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'ZAR',
    "baptisms_count" INTEGER,
    "notes" VARCHAR(2000),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "branch_service_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_service_record_revisions" (
    "id" UUID NOT NULL,
    "record_id" UUID NOT NULL,
    "changed_by_id" UUID,
    "reason" VARCHAR(500),
    "changes" JSONB NOT NULL,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_service_record_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "email_verified_at" TIMESTAMPTZ(3),
    "password_hash" TEXT,
    "password_changed_at" TIMESTAMPTZ(3),
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "status_reason" VARCHAR(500),
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "user_id" UUID NOT NULL,
    "first_name" VARCHAR(80) NOT NULL,
    "last_name" VARCHAR(80) NOT NULL,
    "display_name" VARCHAR(120),
    "avatar_media_id" UUID,
    "phone" VARCHAR(40),
    "date_of_birth" DATE,
    "bio" VARCHAR(1000),
    "home_branch_id" UUID,
    "baptism_date" DATE,
    "baptism_place" VARCHAR(200),
    "privacy_consent_at" TIMESTAMPTZ(3),
    "terms_accepted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "auth_provider" NOT NULL,
    "provider_user_id" VARCHAR(255) NOT NULL,
    "email" VARCHAR(254),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3),

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "remember_me" BOOLEAN NOT NULL DEFAULT false,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(512),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idle_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "absolute_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_reason" VARCHAR(64),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "auth_token_purpose" NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "sent_to" VARCHAR(254),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "scope" "role_scope" NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission" VARCHAR(64) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission")
);

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID,
    "granted_by_id" UUID,
    "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3),

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "status" "membership_status" NOT NULL DEFAULT 'PENDING',
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "message" VARCHAR(1000),
    "decision_note" VARCHAR(1000),
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(3),
    "decided_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "branch_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "type" "content_type" NOT NULL,
    "scope" "content_scope" NOT NULL,
    "branch_id" UUID,
    "slug" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "summary" VARCHAR(500),
    "body" TEXT,
    "body_format" "body_format" NOT NULL DEFAULT 'MARKDOWN',
    "status" "content_status" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinned_until" TIMESTAMPTZ(3),
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "cover_media_id" UUID,
    "cover_alt" VARCHAR(300),
    "author_id" UUID,
    "author_name" VARCHAR(120),
    "seo_title" VARCHAR(200),
    "seo_description" VARCHAR(300),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "published_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "search_vector" tsvector,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_details" (
    "content_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3),
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Africa/Johannesburg',
    "category" "event_category" NOT NULL DEFAULT 'OTHER',
    "event_status" "event_status" NOT NULL DEFAULT 'SCHEDULED',
    "status_note" VARCHAR(300),
    "venue_name" VARCHAR(200),
    "venue_address" VARCHAR(300),
    "maps_url" VARCHAR(2048),
    "online_url" VARCHAR(2048),
    "registration_url" VARCHAR(2048),

    CONSTRAINT "event_details_pkey" PRIMARY KEY ("content_id")
);

-- CreateTable
CREATE TABLE "sermon_details" (
    "content_id" UUID NOT NULL,
    "preached_on" DATE NOT NULL,
    "speaker_id" UUID,
    "speaker_name" VARCHAR(120),
    "series_id" UUID,
    "scripture" VARCHAR(300),
    "audio_media_id" UUID,
    "video_media_id" UUID,
    "external_video_url" VARCHAR(2048),
    "duration_seconds" INTEGER,
    "language" VARCHAR(16) NOT NULL DEFAULT 'en',
    "transcript" TEXT,

    CONSTRAINT "sermon_details_pkey" PRIMARY KEY ("content_id")
);

-- CreateTable
CREATE TABLE "baptism_details" (
    "content_id" UUID NOT NULL,
    "baptism_date" DATE,
    "candidates_count" INTEGER,
    "officiant_name" VARCHAR(120),
    "location" VARCHAR(200),

    CONSTRAINT "baptism_details_pkey" PRIMARY KEY ("content_id")
);

-- CreateTable
CREATE TABLE "speakers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "title" VARCHAR(120),
    "bio" VARCHAR(2000),
    "photo_media_id" UUID,
    "branch_id" UUID,
    "user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "speakers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sermon_series" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "cover_media_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sermon_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_tags" (
    "content_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "content_tags_pkey" PRIMARY KEY ("content_id","tag_id")
);

-- CreateTable
CREATE TABLE "content_media" (
    "content_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "caption" VARCHAR(300),

    CONSTRAINT "content_media_pkey" PRIMARY KEY ("content_id","media_id")
);

-- CreateTable
CREATE TABLE "baptism_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "user_id" UUID,
    "full_name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(40),
    "preferred_date" DATE,
    "message" VARCHAR(2000),
    "status" "baptism_request_status" NOT NULL DEFAULT 'NEW',
    "assigned_to_id" UUID,
    "scheduled_content_id" UUID,
    "internal_notes" VARCHAR(4000),
    "consent_at" TIMESTAMPTZ(3) NOT NULL,
    "handled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "baptism_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "uploaded_by_id" UUID,
    "kind" "media_kind" NOT NULL,
    "purpose" "media_purpose" NOT NULL,
    "status" "media_status" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "visibility" "media_visibility" NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(127) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" CHAR(64),
    "width" INTEGER,
    "height" INTEGER,
    "duration_seconds" INTEGER,
    "alt_text" VARCHAR(300),
    "dominant_color" CHAR(7),
    "metadata" JSONB,
    "processing_error" VARCHAR(1000),
    "processed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_variants" (
    "id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "mime_type" VARCHAR(127) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "size_bytes" BIGINT,
    "bitrate" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" "notification_category" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(500),
    "url" VARCHAR(2048),
    "data" JSONB,
    "dedupe_key" VARCHAR(200),
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "category" "notification_category" NOT NULL,
    "in_app" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id","category")
);

-- CreateTable
CREATE TABLE "email_deliveries" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "to_email" VARCHAR(254) NOT NULL,
    "template" VARCHAR(64) NOT NULL,
    "subject" VARCHAR(300) NOT NULL,
    "status" "email_delivery_status" NOT NULL DEFAULT 'QUEUED',
    "provider" VARCHAR(32),
    "provider_message_id" VARCHAR(255),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(3),

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "actor_id" UUID,
    "action" VARCHAR(64) NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" VARCHAR(64),
    "branch_id" UUID,
    "summary" VARCHAR(500),
    "changes" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(512),
    "request_id" VARCHAR(128),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_id_map" (
    "source" VARCHAR(40) NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "legacy_id" VARCHAR(128) NOT NULL,
    "new_id" UUID NOT NULL,
    "checksum" CHAR(64),
    "imported_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "legacy_id_map_pkey" PRIMARY KEY ("source","entity_type","legacy_id")
);

-- CreateTable
CREATE TABLE "migration_runs" (
    "id" UUID NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "command" VARCHAR(40) NOT NULL,
    "status" "migration_run_status" NOT NULL DEFAULT 'RUNNING',
    "dry_run" BOOLEAN NOT NULL DEFAULT false,
    "bundle_hash" CHAR(64),
    "stats" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "migration_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "branches_organization_id_status_sort_order_idx" ON "branches"("organization_id", "status", "sort_order");

-- CreateIndex
CREATE INDEX "branches_parent_branch_id_idx" ON "branches"("parent_branch_id");

-- CreateIndex
CREATE INDEX "branches_name_trgm_idx" ON "branches" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "branches_organization_id_slug_key" ON "branches"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "branch_schedules_branch_id_kind_is_active_idx" ON "branch_schedules"("branch_id", "kind", "is_active");

-- CreateIndex
CREATE INDEX "branch_leaders_branch_id_is_active_sort_order_idx" ON "branch_leaders"("branch_id", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "branch_gallery_items_branch_id_media_id_key" ON "branch_gallery_items"("branch_id", "media_id");

-- CreateIndex
CREATE INDEX "branch_service_records_branch_id_service_date_idx" ON "branch_service_records"("branch_id", "service_date" DESC);

-- CreateIndex
CREATE INDEX "branch_service_record_revisions_record_id_changed_at_idx" ON "branch_service_record_revisions"("record_id", "changed_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_trgm_idx" ON "users" USING GIN ("email" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "profiles_home_branch_id_idx" ON "profiles"("home_branch_id");

-- CreateIndex
CREATE INDEX "profiles_name_trgm_idx" ON "profiles" USING GIN ("first_name" gin_trgm_ops, "last_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "auth_identities_user_id_idx" ON "auth_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_provider_user_id_key" ON "auth_identities"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_absolute_expires_at_idx" ON "sessions"("absolute_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_tokens_user_id_purpose_idx" ON "auth_tokens"("user_id", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_key_key" ON "roles"("organization_id", "key");

-- CreateIndex
CREATE INDEX "role_assignments_branch_id_idx" ON "role_assignments"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_assignments_user_role_branch_key" ON "role_assignments"("user_id", "role_id", "branch_id") NULLS NOT DISTINCT; -- [manual] NULLS NOT DISTINCT

-- CreateIndex
CREATE INDEX "branch_memberships_branch_id_status_requested_at_idx" ON "branch_memberships"("branch_id", "status", "requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "branch_memberships_user_id_branch_id_key" ON "branch_memberships"("user_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_memberships_one_primary_idx" ON "branch_memberships"("user_id") WHERE (is_primary AND (status = 'PENDING' OR status = 'ACTIVE'));

-- CreateIndex
CREATE INDEX "content_items_search_idx" ON "content_items" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "content_items_feed_idx" ON "content_items"("organization_id", "published_at" DESC, "id" DESC) WHERE (status = 'PUBLISHED' AND deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "content_items_branch_feed_idx" ON "content_items"("branch_id", "published_at" DESC, "id" DESC) WHERE (status = 'PUBLISHED' AND deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "content_items_type_feed_idx" ON "content_items"("organization_id", "type", "published_at" DESC, "id" DESC) WHERE (status = 'PUBLISHED' AND deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "content_items_organization_id_type_status_updated_at_idx" ON "content_items"("organization_id", "type", "status", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "content_items_author_id_idx" ON "content_items"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_items_organization_id_slug_key" ON "content_items"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "event_details_starts_at_idx" ON "event_details"("starts_at");

-- CreateIndex
CREATE INDEX "sermon_details_speaker_id_preached_on_idx" ON "sermon_details"("speaker_id", "preached_on" DESC);

-- CreateIndex
CREATE INDEX "sermon_details_series_id_preached_on_idx" ON "sermon_details"("series_id", "preached_on" DESC);

-- CreateIndex
CREATE INDEX "sermon_details_preached_on_idx" ON "sermon_details"("preached_on" DESC);

-- CreateIndex
CREATE INDEX "speakers_name_trgm_idx" ON "speakers" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "speakers_organization_id_slug_key" ON "speakers"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "sermon_series_organization_id_slug_key" ON "sermon_series"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_organization_id_slug_key" ON "tags"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "content_tags_tag_id_idx" ON "content_tags"("tag_id");

-- CreateIndex
CREATE INDEX "content_media_media_id_idx" ON "content_media"("media_id");

-- CreateIndex
CREATE INDEX "baptism_requests_branch_id_status_created_at_idx" ON "baptism_requests"("branch_id", "status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_key_key" ON "media_assets"("storage_key");

-- CreateIndex
CREATE INDEX "media_assets_organization_id_kind_created_at_idx" ON "media_assets"("organization_id", "kind", "created_at" DESC);

-- CreateIndex
CREATE INDEX "media_assets_uploaded_by_id_idx" ON "media_assets"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "media_assets_pending_idx" ON "media_assets"("status", "created_at") WHERE (status = 'PENDING_UPLOAD' OR status = 'UPLOADED' OR status = 'PROCESSING');

-- CreateIndex
CREATE UNIQUE INDEX "media_variants_storage_key_key" ON "media_variants"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "media_variants_media_id_name_key" ON "media_variants"("media_id", "name");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_id_idx" ON "notifications"("user_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "notifications_unread_idx" ON "notifications"("user_id") WHERE (read_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "email_deliveries_created_at_idx" ON "email_deliveries"("created_at" DESC);

-- CreateIndex
CREATE INDEX "email_deliveries_user_id_idx" ON "email_deliveries"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_branch_id_created_at_idx" ON "audit_logs"("branch_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "legacy_id_map_entity_type_new_id_idx" ON "legacy_id_map"("entity_type", "new_id");

-- CreateIndex
CREATE INDEX "migration_runs_started_at_idx" ON "migration_runs"("started_at" DESC);

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_logo_media_id_fkey" FOREIGN KEY ("logo_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_parent_branch_id_fkey" FOREIGN KEY ("parent_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_schedules" ADD CONSTRAINT "branch_schedules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_leaders" ADD CONSTRAINT "branch_leaders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_leaders" ADD CONSTRAINT "branch_leaders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_leaders" ADD CONSTRAINT "branch_leaders_photo_media_id_fkey" FOREIGN KEY ("photo_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_gallery_items" ADD CONSTRAINT "branch_gallery_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_gallery_items" ADD CONSTRAINT "branch_gallery_items_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_service_records" ADD CONSTRAINT "branch_service_records_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_service_records" ADD CONSTRAINT "branch_service_records_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_service_records" ADD CONSTRAINT "branch_service_records_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_service_record_revisions" ADD CONSTRAINT "branch_service_record_revisions_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "branch_service_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_service_record_revisions" ADD CONSTRAINT "branch_service_record_revisions_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_avatar_media_id_fkey" FOREIGN KEY ("avatar_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_home_branch_id_fkey" FOREIGN KEY ("home_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_memberships" ADD CONSTRAINT "branch_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_memberships" ADD CONSTRAINT "branch_memberships_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_memberships" ADD CONSTRAINT "branch_memberships_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_details" ADD CONSTRAINT "event_details_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_details" ADD CONSTRAINT "sermon_details_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_details" ADD CONSTRAINT "sermon_details_speaker_id_fkey" FOREIGN KEY ("speaker_id") REFERENCES "speakers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_details" ADD CONSTRAINT "sermon_details_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "sermon_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_details" ADD CONSTRAINT "sermon_details_audio_media_id_fkey" FOREIGN KEY ("audio_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_details" ADD CONSTRAINT "sermon_details_video_media_id_fkey" FOREIGN KEY ("video_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baptism_details" ADD CONSTRAINT "baptism_details_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speakers" ADD CONSTRAINT "speakers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speakers" ADD CONSTRAINT "speakers_photo_media_id_fkey" FOREIGN KEY ("photo_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speakers" ADD CONSTRAINT "speakers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speakers" ADD CONSTRAINT "speakers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_series" ADD CONSTRAINT "sermon_series_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermon_series" ADD CONSTRAINT "sermon_series_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_tags" ADD CONSTRAINT "content_tags_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_tags" ADD CONSTRAINT "content_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_media" ADD CONSTRAINT "content_media_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_media" ADD CONSTRAINT "content_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baptism_requests" ADD CONSTRAINT "baptism_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baptism_requests" ADD CONSTRAINT "baptism_requests_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baptism_requests" ADD CONSTRAINT "baptism_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baptism_requests" ADD CONSTRAINT "baptism_requests_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baptism_requests" ADD CONSTRAINT "baptism_requests_scheduled_content_id_fkey" FOREIGN KEY ("scheduled_content_id") REFERENCES "content_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_variants" ADD CONSTRAINT "media_variants_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- [manual] Full-text search vector, maintained by trigger
-- ---------------------------------------------------------------------------
CREATE FUNCTION "content_items_search_vector_update"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW."search_vector" :=
        setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW."summary", '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW."body", '')), 'C');
    RETURN NEW;
END
$$;

CREATE TRIGGER "content_items_search_vector_trigger"
    BEFORE INSERT OR UPDATE OF "title", "summary", "body" ON "content_items"
    FOR EACH ROW EXECUTE FUNCTION "content_items_search_vector_update"();

-- ---------------------------------------------------------------------------
-- [manual] CHECK constraints
-- ---------------------------------------------------------------------------

-- Scope invariant: global content has no branch, branch content must have one.
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_scope_branch_check" CHECK (
    ("scope" = 'GLOBAL' AND "branch_id" IS NULL) OR ("scope" = 'BRANCH' AND "branch_id" IS NOT NULL)
);
-- Published content always has a publication time.
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_published_at_check" CHECK (
    "status" <> 'PUBLISHED' OR "published_at" IS NOT NULL
);
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_slug_format_check" CHECK (
    "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
);
ALTER TABLE "branches" ADD CONSTRAINT "branches_slug_format_check" CHECK (
    "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
);
ALTER TABLE "branches" ADD CONSTRAINT "branches_country_code_check" CHECK ("country_code" ~ '^[A-Z]{2}$');
ALTER TABLE "branches" ADD CONSTRAINT "branches_not_own_parent_check" CHECK ("parent_branch_id" IS DISTINCT FROM "id");

-- E-mail addresses are stored normalised.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_check" CHECK ("email" = lower(btrim("email")));
ALTER TABLE "users" ADD CONSTRAINT "users_failed_login_count_check" CHECK ("failed_login_count" >= 0);

ALTER TABLE "branch_schedules" ADD CONSTRAINT "branch_schedules_day_of_week_check" CHECK (
    "day_of_week" IS NULL OR "day_of_week" BETWEEN 0 AND 6
);
ALTER TABLE "branch_schedules" ADD CONSTRAINT "branch_schedules_time_format_check" CHECK (
    ("start_time" IS NULL OR "start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') AND
    ("end_time" IS NULL OR "end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
ALTER TABLE "branch_schedules" ADD CONSTRAINT "branch_schedules_effective_range_check" CHECK (
    "effective_until" IS NULL OR "effective_from" IS NULL OR "effective_until" >= "effective_from"
);

ALTER TABLE "event_details" ADD CONSTRAINT "event_details_time_range_check" CHECK (
    "ends_at" IS NULL OR "ends_at" >= "starts_at"
);
ALTER TABLE "sermon_details" ADD CONSTRAINT "sermon_details_duration_check" CHECK (
    "duration_seconds" IS NULL OR "duration_seconds" >= 0
);
ALTER TABLE "baptism_details" ADD CONSTRAINT "baptism_details_candidates_check" CHECK (
    "candidates_count" IS NULL OR "candidates_count" >= 0
);

ALTER TABLE "branch_service_records" ADD CONSTRAINT "branch_service_records_non_negative_check" CHECK (
    ("attendance" IS NULL OR "attendance" >= 0) AND
    ("duration_minutes" IS NULL OR "duration_minutes" >= 0) AND
    ("offering_amount" IS NULL OR "offering_amount" >= 0) AND
    ("baptisms_count" IS NULL OR "baptisms_count" >= 0)
);

ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_size_check" CHECK ("size_bytes" >= 0);
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_dimensions_check" CHECK (
    ("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0)
);
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_key_format_check" CHECK (
    "permission" ~ '^[a-z_]+\.[a-z_]+$'
);

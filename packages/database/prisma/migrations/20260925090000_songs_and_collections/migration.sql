-- Songs, and the two collections that sit above the branches.
--
-- TOG is the headquarters' own material from the overseer; HOLY_CONVOCATION is what is
-- recorded while he travels. Both feed the sermons and the songs pages as sections of their
-- own, which is why the collection lives on the content item rather than on either detail.

-- CreateEnum
CREATE TYPE "content_collection" AS ENUM ('LOCAL', 'TOG', 'HOLY_CONVOCATION');

-- AlterEnum
ALTER TYPE "content_type" ADD VALUE 'SONG';

-- AlterTable
ALTER TABLE "content_items" ADD COLUMN     "collection" "content_collection" NOT NULL DEFAULT 'LOCAL';

-- CreateTable
CREATE TABLE "song_details" (
    "content_id" UUID NOT NULL,
    "artist" VARCHAR(160),
    "album" VARCHAR(200),
    "track_number" INTEGER,
    "audio_media_id" UUID,
    "external_audio_url" VARCHAR(2048),
    "duration_seconds" INTEGER,
    "language" VARCHAR(16) NOT NULL DEFAULT 'en',
    "lyrics" TEXT,
    "recorded_on" DATE,

    CONSTRAINT "song_details_pkey" PRIMARY KEY ("content_id")
);

-- CreateIndex
CREATE INDEX "song_details_album_track_number_idx" ON "song_details"("album", "track_number");

-- CreateIndex
CREATE INDEX "song_details_language_idx" ON "song_details"("language");

-- CreateIndex
CREATE INDEX "content_items_collection_idx" ON "content_items"("organization_id", "collection", "type", "published_at" DESC) WHERE (status = 'PUBLISHED' AND deleted_at IS NULL);

-- AddForeignKey
ALTER TABLE "song_details" ADD CONSTRAINT "song_details_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_details" ADD CONSTRAINT "song_details_audio_media_id_fkey" FOREIGN KEY ("audio_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;


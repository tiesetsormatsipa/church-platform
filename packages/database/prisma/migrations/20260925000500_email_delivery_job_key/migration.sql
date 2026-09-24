-- Idempotency key for the worker's e-mail job: "<queue>:<jobId>".
-- A retry after a crash between sending and bookkeeping finds the existing row and skips
-- the send instead of delivering a second copy.
-- AlterTable
ALTER TABLE "email_deliveries" ADD COLUMN     "job_key" VARCHAR(128);

-- CreateIndex
CREATE UNIQUE INDEX "email_deliveries_job_key_key" ON "email_deliveries"("job_key");

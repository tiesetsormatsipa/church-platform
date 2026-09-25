-- CreateTable
CREATE TABLE "branch_baptism_records" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "occurred_on" DATE NOT NULL,
    "count" INTEGER NOT NULL,
    "note" VARCHAR(500),
    "recorded_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "branch_baptism_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branch_baptism_records_branch_idx" ON "branch_baptism_records"("branch_id", "occurred_on" DESC) WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "branch_baptism_records_period_idx" ON "branch_baptism_records"("occurred_on") WHERE (deleted_at IS NULL);

-- AddForeignKey
ALTER TABLE "branch_baptism_records" ADD CONSTRAINT "branch_baptism_records_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_baptism_records" ADD CONSTRAINT "branch_baptism_records_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- [manual] A baptism entry records people actually baptised, so the number must be positive.
ALTER TABLE "branch_baptism_records"
  ADD CONSTRAINT "branch_baptism_records_count_positive" CHECK ("count" > 0);


-- CreateEnum
CREATE TYPE "employment_type" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP', 'VOLUNTEER');

-- AlterEnum
ALTER TYPE "content_type" ADD VALUE 'JOB';

-- CreateTable
CREATE TABLE "job_details" (
    "content_id" UUID NOT NULL,
    "employer_name" VARCHAR(200) NOT NULL,
    "location" VARCHAR(200) NOT NULL,
    "employment_type" "employment_type" NOT NULL DEFAULT 'FULL_TIME',
    "salary_range" VARCHAR(120),
    "apply_email" VARCHAR(254),
    "apply_url" VARCHAR(2048),
    "apply_note" VARCHAR(500),
    "closes_on" DATE,

    CONSTRAINT "job_details_pkey" PRIMARY KEY ("content_id")
);

-- CreateIndex
CREATE INDEX "job_details_closes_on_idx" ON "job_details"("closes_on");

-- AddForeignKey
ALTER TABLE "job_details" ADD CONSTRAINT "job_details_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- [manual] A posting nobody can answer is not a posting: exactly one way to apply.
ALTER TABLE "job_details"
  ADD CONSTRAINT "job_details_one_way_to_apply"
  CHECK (("apply_email" IS NOT NULL) <> ("apply_url" IS NOT NULL));

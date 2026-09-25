-- The church holds no baptism days and takes no applications: someone who wants to be
-- baptised shows up at a service and is asked afterwards. The enquiry form therefore never
-- matched how the church works, and is replaced by branch_baptism_records (the number that
-- is actually kept). Production held no enquiries when this was applied.

-- DropForeignKey
ALTER TABLE "baptism_requests" DROP CONSTRAINT "baptism_requests_assigned_to_id_fkey";

-- DropForeignKey
ALTER TABLE "baptism_requests" DROP CONSTRAINT "baptism_requests_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "baptism_requests" DROP CONSTRAINT "baptism_requests_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "baptism_requests" DROP CONSTRAINT "baptism_requests_scheduled_content_id_fkey";

-- DropForeignKey
ALTER TABLE "baptism_requests" DROP CONSTRAINT "baptism_requests_user_id_fkey";

-- DropTable
DROP TABLE "baptism_requests";

-- DropEnum
DROP TYPE "baptism_request_status";


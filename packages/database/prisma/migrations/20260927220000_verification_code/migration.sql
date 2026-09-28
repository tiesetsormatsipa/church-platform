
-- AlterTable
ALTER TABLE "auth_tokens" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "code_hash" CHAR(64);



-- CreateEnum
CREATE TYPE "sex" AS ENUM ('MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "sex" "sex";


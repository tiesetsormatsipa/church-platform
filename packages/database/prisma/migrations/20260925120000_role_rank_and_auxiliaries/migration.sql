-- Seniority and auxiliary teams.
--
-- rank: lower is more senior. A role may only be granted by someone ranked strictly above
-- it, so an administrator cannot clone their own authority or promote someone past them.
-- The default of 50 is the auxiliary rank, which is the safest thing for any role that
-- existed before this migration: least authority until someone says otherwise.
--
-- content_types: empty means every type. An auxiliary is appointed to one job, such as
-- posting the songs, and holds content.create for that type alone.

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "content_types" "content_type"[],
ADD COLUMN     "rank" INTEGER NOT NULL DEFAULT 50;


-- [manual] The roles that already exist are the church's own, and the seed re-applies their
-- real ranks on the next run. Set them here too so an unseeded deployment is correct.
UPDATE "roles" SET "rank" = 10 WHERE "key" = 'super_admin';
UPDATE "roles" SET "rank" = 20 WHERE "key" = 'church_admin';
UPDATE "roles" SET "rank" = 30 WHERE "key" = 'branch_admin';
UPDATE "roles" SET "rank" = 40 WHERE "key" = 'branch_editor';

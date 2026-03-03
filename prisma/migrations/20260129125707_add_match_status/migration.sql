-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "MatchStatus" AS ENUM ('NONE', 'SHORTLISTED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable: MatchResult
ALTER TABLE "MatchResult"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "MatchResult"
  ADD COLUMN IF NOT EXISTS "status" "MatchStatus" NOT NULL DEFAULT 'NONE';

ALTER TABLE "MatchResult"
  ADD COLUMN IF NOT EXISTS "statusUpdatedAt" TIMESTAMP(3);

ALTER TABLE "MatchResult"
  ADD COLUMN IF NOT EXISTS "statusUpdatedBy" TEXT;

-- Backfill for safety (even though defaults handle it)
UPDATE "MatchResult"
SET "updatedAt" = COALESCE("updatedAt", NOW())
WHERE "updatedAt" IS NULL;

UPDATE "MatchResult"
SET "status" = COALESCE("status", 'NONE'::"MatchStatus")
WHERE "status" IS NULL;
-- AlterTable
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "resumeParseTimeoutSeconds" INTEGER NOT NULL DEFAULT 30;

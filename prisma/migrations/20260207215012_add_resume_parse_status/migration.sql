-- CreateEnum
CREATE TYPE "ResumeParseStatus" AS ENUM ('QUEUED', 'EXTRACTING', 'SAVED', 'NEEDS_REVIEW', 'FAILED');

-- AlterTable
ALTER TABLE "Resume" ADD COLUMN     "parseError" TEXT,
ADD COLUMN     "parseModel" TEXT,
ADD COLUMN     "parseStatus" "ResumeParseStatus" NOT NULL DEFAULT 'QUEUED',
ADD COLUMN     "parsedAt" TIMESTAMP(3),
ADD COLUMN     "promptVersion" TEXT;

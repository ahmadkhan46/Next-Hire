-- CreateEnum
CREATE TYPE "UploadBatchStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIAL_FAILED', 'FAILED');

-- AlterEnum
ALTER TYPE "UploadItemStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "UploadItemStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "UploadItemStatus" ADD VALUE IF NOT EXISTS 'SKIPPED';

-- AlterTable
ALTER TABLE "ResumeUploadBatch"
ADD COLUMN "targetJobId" TEXT,
ADD COLUMN "status" "UploadBatchStatus" NOT NULL DEFAULT 'QUEUED',
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ResumeUploadBatch_orgId_status_createdAt_idx" ON "ResumeUploadBatch"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ResumeUploadBatch_orgId_targetJobId_createdAt_idx" ON "ResumeUploadBatch"("orgId", "targetJobId", "createdAt");

-- AddForeignKey
ALTER TABLE "ResumeUploadBatch" ADD CONSTRAINT "ResumeUploadBatch_targetJobId_fkey" FOREIGN KEY ("targetJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

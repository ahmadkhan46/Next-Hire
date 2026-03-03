-- CreateEnum
CREATE TYPE "UploadSourceType" AS ENUM ('CSV', 'ZIP', 'PDF_DOCX');

-- CreateEnum
CREATE TYPE "UploadItemStatus" AS ENUM ('CREATED', 'UPDATED', 'FAILED');

-- CreateTable
CREATE TABLE "ResumeUploadBatch" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sourceType" "UploadSourceType" NOT NULL,
    "sourceName" TEXT,
    "uploadedBy" TEXT,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeUploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeUploadItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "candidateId" TEXT,
    "resumeId" TEXT,
    "status" "UploadItemStatus" NOT NULL,
    "note" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeUploadItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResumeUploadBatch_orgId_createdAt_idx" ON "ResumeUploadBatch"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "ResumeUploadItem_batchId_createdAt_idx" ON "ResumeUploadItem"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "ResumeUploadItem_candidateId_idx" ON "ResumeUploadItem"("candidateId");

-- CreateIndex
CREATE INDEX "ResumeUploadItem_resumeId_idx" ON "ResumeUploadItem"("resumeId");

-- AddForeignKey
ALTER TABLE "ResumeUploadBatch" ADD CONSTRAINT "ResumeUploadBatch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeUploadItem" ADD CONSTRAINT "ResumeUploadItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ResumeUploadBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeUploadItem" ADD CONSTRAINT "ResumeUploadItem_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeUploadItem" ADD CONSTRAINT "ResumeUploadItem_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

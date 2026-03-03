-- CreateEnum
CREATE TYPE "CandidateActivityType" AS ENUM (
  'PROFILE_UPDATED',
  'RESUME_UPLOADED',
  'RESUME_PARSED',
  'RESUME_PARSE_FAILED',
  'MATCH_STATUS_CHANGED',
  'SKILL_ADDED',
  'SKILL_REMOVED',
  'EXPERIENCE_ADDED',
  'EXPERIENCE_UPDATED',
  'EXPERIENCE_REMOVED',
  'EDUCATION_ADDED',
  'EDUCATION_UPDATED',
  'EDUCATION_REMOVED',
  'PROJECT_ADDED',
  'PROJECT_UPDATED',
  'PROJECT_REMOVED',
  'NOTE_ADDED',
  'NOTE_UPDATED',
  'NOTE_REMOVED'
);

-- CreateTable
CREATE TABLE "CandidateActivity" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "type" "CandidateActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "actorId" TEXT,

    CONSTRAINT "CandidateActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateNote" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT,

    CONSTRAINT "CandidateNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandidateActivity_orgId_createdAt_idx" ON "CandidateActivity"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "CandidateActivity_candidateId_createdAt_idx" ON "CandidateActivity"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "CandidateNote_orgId_createdAt_idx" ON "CandidateNote"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "CandidateNote_candidateId_createdAt_idx" ON "CandidateNote"("candidateId", "createdAt");

-- AddForeignKey
ALTER TABLE "CandidateActivity" ADD CONSTRAINT "CandidateActivity_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateActivity" ADD CONSTRAINT "CandidateActivity_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateNote" ADD CONSTRAINT "CandidateNote_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateNote" ADD CONSTRAINT "CandidateNote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

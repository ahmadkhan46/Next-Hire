-- Extend candidate activity taxonomy for phase 4 workflow events
ALTER TYPE "CandidateActivityType" ADD VALUE IF NOT EXISTS 'INTERVIEW_SCHEDULED';
ALTER TYPE "CandidateActivityType" ADD VALUE IF NOT EXISTS 'INTERVIEW_UPDATED';
ALTER TYPE "CandidateActivityType" ADD VALUE IF NOT EXISTS 'INTERVIEW_COMPLETED';
ALTER TYPE "CandidateActivityType" ADD VALUE IF NOT EXISTS 'INTERVIEW_CANCELLED';
ALTER TYPE "CandidateActivityType" ADD VALUE IF NOT EXISTS 'COMMUNICATION_SENT';

-- Create interview status enum
CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- Create interviews table
CREATE TABLE "CandidateInterview" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "round" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 45,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "meetingType" TEXT NOT NULL DEFAULT 'Video',
    "meetingLink" TEXT,
    "location" TEXT,
    "interviewer" TEXT,
    "notes" TEXT,
    "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateInterview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CandidateInterview_orgId_scheduledAt_idx" ON "CandidateInterview"("orgId", "scheduledAt");
CREATE INDEX "CandidateInterview_candidateId_scheduledAt_idx" ON "CandidateInterview"("candidateId", "scheduledAt");
CREATE INDEX "CandidateInterview_orgId_status_scheduledAt_idx" ON "CandidateInterview"("orgId", "status", "scheduledAt");

ALTER TABLE "CandidateInterview" ADD CONSTRAINT "CandidateInterview_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateInterview" ADD CONSTRAINT "CandidateInterview_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

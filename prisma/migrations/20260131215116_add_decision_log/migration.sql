-- CreateTable
CREATE TABLE "MatchDecisionLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "fromStatus" "MatchStatus" NOT NULL,
    "toStatus" "MatchStatus" NOT NULL,
    "decidedBy" TEXT,

    CONSTRAINT "MatchDecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchDecisionLog_orgId_idx" ON "MatchDecisionLog"("orgId");

-- CreateIndex
CREATE INDEX "MatchDecisionLog_jobId_idx" ON "MatchDecisionLog"("jobId");

-- CreateIndex
CREATE INDEX "MatchDecisionLog_candidateId_idx" ON "MatchDecisionLog"("candidateId");

-- CreateIndex
CREATE INDEX "MatchDecisionLog_jobId_candidateId_idx" ON "MatchDecisionLog"("jobId", "candidateId");

-- AddForeignKey
ALTER TABLE "MatchDecisionLog" ADD CONSTRAINT "MatchDecisionLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchDecisionLog" ADD CONSTRAINT "MatchDecisionLog_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchDecisionLog" ADD CONSTRAINT "MatchDecisionLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

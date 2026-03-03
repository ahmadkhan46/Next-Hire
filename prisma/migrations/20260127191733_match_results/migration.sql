-- CreateTable
CREATE TABLE "MatchResult" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "matched" JSONB NOT NULL,
    "missing" JSONB NOT NULL,
    "matchedWeight" INTEGER NOT NULL,
    "totalWeight" INTEGER NOT NULL,

    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchResult_orgId_idx" ON "MatchResult"("orgId");

-- CreateIndex
CREATE INDEX "MatchResult_jobId_idx" ON "MatchResult"("jobId");

-- CreateIndex
CREATE INDEX "MatchResult_candidateId_idx" ON "MatchResult"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchResult_jobId_candidateId_key" ON "MatchResult"("jobId", "candidateId");

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
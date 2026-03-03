-- AlterTable
ALTER TABLE "MatchResult" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "MatchResult_orgId_status_idx" ON "MatchResult"("orgId", "status");

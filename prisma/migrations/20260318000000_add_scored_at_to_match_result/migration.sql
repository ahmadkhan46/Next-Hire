-- Add scoredAt to track when each match score was last calculated
ALTER TABLE "MatchResult" ADD COLUMN IF NOT EXISTS "scoredAt" TIMESTAMP;

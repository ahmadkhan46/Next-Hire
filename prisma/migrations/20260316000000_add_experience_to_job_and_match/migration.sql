-- Add required years of experience to Job
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "requiredYearsOfExperience" INTEGER;

-- Add experience score breakdown to MatchResult
ALTER TABLE "MatchResult" ADD COLUMN IF NOT EXISTS "experienceScore" DOUBLE PRECISION;

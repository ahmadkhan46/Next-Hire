-- Add embedding column as JSONB (fallback without pgvector)
ALTER TABLE "Resume" ADD COLUMN IF NOT EXISTS "embedding" JSONB;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "embedding" JSONB;

-- Add embedding metadata
ALTER TABLE "Resume" ADD COLUMN IF NOT EXISTS "embedding_model" TEXT;
ALTER TABLE "Resume" ADD COLUMN IF NOT EXISTS "embedding_tokens" INTEGER;
ALTER TABLE "Resume" ADD COLUMN IF NOT EXISTS "embedding_cost" DOUBLE PRECISION;
ALTER TABLE "Resume" ADD COLUMN IF NOT EXISTS "embedded_at" TIMESTAMP(3);

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "embedding_model" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "embedding_tokens" INTEGER;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "embedding_cost" DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "embedded_at" TIMESTAMP(3);

-- Create index on embedding for faster lookups
CREATE INDEX IF NOT EXISTS "Resume_embedding_idx" ON "Resume" USING gin ("embedding");
CREATE INDEX IF NOT EXISTS "Job_embedding_idx" ON "Job" USING gin ("embedding");

-- CreateTable
CREATE TABLE IF NOT EXISTS "llm_usage_logs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "org_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "duration" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "llm_usage_logs_org_id_idx" ON "llm_usage_logs"("org_id");
CREATE INDEX "llm_usage_logs_created_at_idx" ON "llm_usage_logs"("created_at");
CREATE INDEX "llm_usage_logs_org_id_created_at_idx" ON "llm_usage_logs"("org_id", "created_at");
CREATE INDEX "llm_usage_logs_model_idx" ON "llm_usage_logs"("model");

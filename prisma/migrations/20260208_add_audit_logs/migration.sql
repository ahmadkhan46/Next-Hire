-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "changes" JSONB,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_org_id_idx" ON "AuditLog"("org_id");
CREATE INDEX "AuditLog_user_id_idx" ON "AuditLog"("user_id");
CREATE INDEX "AuditLog_resource_type_idx" ON "AuditLog"("resource_type");
CREATE INDEX "AuditLog_resource_id_idx" ON "AuditLog"("resource_id");
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

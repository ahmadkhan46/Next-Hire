/*
  Warnings:

  - You are about to drop the column `embedded_at` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `embedding` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `embedding_cost` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `embedding_model` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `embedding_tokens` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `embedded_at` on the `Resume` table. All the data in the column will be lost.
  - You are about to drop the column `embedding` on the `Resume` table. All the data in the column will be lost.
  - You are about to drop the column `embedding_cost` on the `Resume` table. All the data in the column will be lost.
  - You are about to drop the column `embedding_model` on the `Resume` table. All the data in the column will be lost.
  - You are about to drop the column `embedding_tokens` on the `Resume` table. All the data in the column will be lost.
  - You are about to drop the `AuditLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `llm_usage_logs` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[orgId,externalId]` on the table `Candidate` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[orgId,fingerprint]` on the table `Candidate` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Job_embedding_idx";

-- DropIndex
DROP INDEX "Resume_embedding_idx";

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "fingerprint" TEXT,
ADD COLUMN     "githubUrl" TEXT,
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "portfolioUrl" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Job" DROP COLUMN "embedded_at",
DROP COLUMN "embedding",
DROP COLUMN "embedding_cost",
DROP COLUMN "embedding_model",
DROP COLUMN "embedding_tokens";

-- AlterTable
ALTER TABLE "Resume" DROP COLUMN "embedded_at",
DROP COLUMN "embedding",
DROP COLUMN "embedding_cost",
DROP COLUMN "embedding_model",
DROP COLUMN "embedding_tokens";

-- DropTable
DROP TABLE "AuditLog";

-- DropTable
DROP TABLE "llm_usage_logs";

-- CreateIndex
CREATE INDEX "Candidate_status_idx" ON "Candidate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_orgId_externalId_key" ON "Candidate"("orgId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_orgId_fingerprint_key" ON "Candidate"("orgId", "fingerprint");

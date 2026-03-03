import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createRoute } from "@/lib/api-middleware";
import { getOrgLLMStats, getOrgLLMStatsByModel } from "@/lib/llm-tracking";
import { getQueueMode } from "@/lib/queue-mode";
import { memoryQueues } from "@/lib/memory-queue";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

async function getRuntimeQueueStats() {
  const mode = getQueueMode();

  if (mode === "memory") {
    const [bulkWaiting, bulkActive, bulkCompleted, bulkFailed, resumeWaiting, resumeActive, resumeCompleted, resumeFailed] =
      await Promise.all([
        memoryQueues.bulkImport.getWaitingCount(),
        memoryQueues.bulkImport.getActiveCount(),
        memoryQueues.bulkImport.getCompletedCount(),
        memoryQueues.bulkImport.getFailedCount(),
        memoryQueues.resumeParse.getWaitingCount(),
        memoryQueues.resumeParse.getActiveCount(),
        memoryQueues.resumeParse.getCompletedCount(),
        memoryQueues.resumeParse.getFailedCount(),
      ]);

    return {
      mode,
      bulkImport: {
        waiting: bulkWaiting,
        active: bulkActive,
        completed: bulkCompleted,
        failed: bulkFailed,
        delayed: 0,
      },
      resumeParse: {
        waiting: resumeWaiting,
        active: resumeActive,
        completed: resumeCompleted,
        failed: resumeFailed,
        delayed: 0,
      },
    };
  }

  const { queues, getQueueStats } = await import("@/lib/queue");
  const [bulkImport, resumeParse] = await Promise.all([
    getQueueStats(queues.bulkImport),
    getQueueStats(queues.resumeParse),
  ]);
  return {
    mode,
    bulkImport,
    resumeParse,
  };
}

export const GET = createRoute<{ orgId: string }>(
  {
    requireAuth: true,
    requireOrg: true,
    permission: "analytics:read",
    validation: {
      query: querySchema,
    },
  },
  async (_req, { orgId, query }) => {
    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const days = (query as z.infer<typeof querySchema>)?.days ?? 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where = {
      orgId,
      createdAt: { gte: startDate },
    } satisfies Prisma.ResumeUploadBatchWhereInput;

    const [totals, sourceBreakdown, statusBreakdown, topFailures, queue, llmStats, llmByModel] =
      await Promise.all([
        prisma.resumeUploadBatch.aggregate({
          where,
          _count: { _all: true },
          _sum: {
            totalFiles: true,
            createdCount: true,
            updatedCount: true,
            failedCount: true,
          },
        }),
        prisma.resumeUploadBatch.groupBy({
          by: ["sourceType"],
          where,
          _count: { _all: true },
          _sum: {
            totalFiles: true,
            failedCount: true,
          },
        }),
        prisma.resumeUploadBatch.groupBy({
          by: ["status"],
          where,
          _count: { _all: true },
        }),
        prisma.$queryRaw<Array<{ reason: string; count: bigint }>>(
          Prisma.sql`
            SELECT
              COALESCE(NULLIF(i.error, ''), NULLIF(i.note, ''), 'Unknown failure') AS reason,
              COUNT(*)::bigint AS count
            FROM "ResumeUploadItem" i
            JOIN "ResumeUploadBatch" b ON b.id = i."batchId"
            WHERE b."orgId" = ${orgId}
              AND i.status = 'FAILED'
              AND i."createdAt" >= ${startDate}
            GROUP BY reason
            ORDER BY count DESC
            LIMIT 10
          `
        ),
        getRuntimeQueueStats(),
        getOrgLLMStats(orgId, days),
        getOrgLLMStatsByModel(orgId, days),
      ]);

    const totalFiles = Number(totals._sum.totalFiles ?? 0);
    const failedFiles = Number(totals._sum.failedCount ?? 0);
    const createdFiles = Number(totals._sum.createdCount ?? 0);
    const updatedFiles = Number(totals._sum.updatedCount ?? 0);
    const successFiles = createdFiles + updatedFiles;
    const failureRate = totalFiles > 0 ? failedFiles / totalFiles : 0;
    const successRate = totalFiles > 0 ? successFiles / totalFiles : 0;

    return NextResponse.json({
      periodDays: days,
      uploads: {
        batches: Number(totals._count._all ?? 0),
        files: {
          total: totalFiles,
          created: createdFiles,
          updated: updatedFiles,
          failed: failedFiles,
        },
        rates: {
          successRate: Number((successRate * 100).toFixed(2)),
          failureRate: Number((failureRate * 100).toFixed(2)),
        },
        sourceBreakdown: sourceBreakdown.map((row) => ({
          sourceType: row.sourceType,
          batches: row._count._all,
          files: Number(row._sum.totalFiles ?? 0),
          failed: Number(row._sum.failedCount ?? 0),
        })),
        statusBreakdown: statusBreakdown.map((row) => ({
          status: row.status,
          batches: row._count._all,
        })),
        topFailureReasons: topFailures.map((row) => ({
          reason: row.reason,
          count: Number(row.count),
        })),
      },
      queues: queue,
      llm: {
        summary: llmStats,
        byModel: llmByModel,
      },
      generatedAt: new Date().toISOString(),
    });
  }
);

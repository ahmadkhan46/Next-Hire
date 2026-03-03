import { NextResponse } from 'next/server';
import { createRoute } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { memoryQueues } from '@/lib/memory-queue';
import { logger } from '@/lib/logger';
import { getQueueMode } from '@/lib/queue-mode';

export const POST = createRoute(
  {
    requireAuth: true,
    requireOrg: true,
    permission: 'candidates:write',
  },
  async (req, { orgId, userId, params }) => {
    const correlationId = req.headers.get("x-correlation-id")?.trim() || crypto.randomUUID();
    const { batchId } = await params;

    const batch = await prisma.resumeUploadBatch.findFirst({
      where: { id: batchId, orgId: orgId! },
      include: {
        items: {
          where: { status: 'FAILED' },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    if (batch.items.length === 0) {
      return NextResponse.json({ error: 'No failed items to retry' }, { status: 400 });
    }

    await prisma.resumeUploadBatch.update({
      where: { id: batchId },
      data: {
        status: 'QUEUED',
        completedAt: null,
      },
    });

    const payload = {
      orgId: orgId!,
      batchId,
      userId: userId!,
      correlationId,
      failedItems: batch.items.map(item => ({
        fileName: item.fileName,
        resumeId: item.resumeId,
      })),
    };
    const queueMode = getQueueMode();
    const job =
      queueMode === 'redis'
        ? await (async () => {
            const { queues, addJob } = await import('@/lib/queue');
            return addJob(queues.resumeParse, 'retry-failed', payload);
          })()
        : await (async () => {
            await import('@/workers/memory-worker');
            return memoryQueues.resumeParse.add('retry-failed', payload);
          })();

    logger.info("Bulk resume retry queued", {
      orgId,
      userId,
      batchId,
      failedCount: batch.items.length,
      correlationId,
      queueMode,
      jobId: job.id,
    });
    const response = NextResponse.json({
      success: true,
      jobId: job.id,
      count: batch.items.length,
      correlationId,
      queueMode,
      message: `Queued ${batch.items.length} failed file(s) for retry`,
    });
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }
);

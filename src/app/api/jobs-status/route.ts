import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { memoryQueues } from '@/lib/memory-queue';
import { prisma } from '@/lib/prisma';
import { getQueueMode } from '@/lib/queue-mode';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jobId = request.nextUrl.searchParams.get('jobId');
  const queueName = request.nextUrl.searchParams.get('queue');

  if (!jobId || !queueName) {
    return NextResponse.json(
      { error: 'jobId and queue parameters required' },
      { status: 400 }
    );
  }

  try {
    const queueMode = getQueueMode();
    const queueKey = queueName === 'bulkImport' ? 'bulkImport' : 'resumeParse';
    const job =
      queueMode === 'memory'
        ? await (queueKey === 'bulkImport'
            ? memoryQueues.bulkImport.getJob(jobId)
            : memoryQueues.resumeParse.getJob(jobId))
        : await (async () => {
            const { queues, getJobStatus } = await import('@/lib/queue');
            return getJobStatus(
              queueKey === 'bulkImport' ? queues.bulkImport : queues.resumeParse,
              jobId
            );
          })();

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // SECURITY: Verify job belongs to user's org
    const orgId = job.data?.orgId;
    if (orgId) {
      const membership = await prisma.membership.findUnique({
        where: { userId_orgId: { userId, orgId } },
      });

      if (!membership) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const correlationId =
      (typeof (job.data as { correlationId?: unknown })?.correlationId === 'string'
        ? (job.data as { correlationId?: string }).correlationId
        : undefined) ||
      (typeof (job.returnvalue as { correlationId?: unknown })?.correlationId === 'string'
        ? (job.returnvalue as { correlationId?: string }).correlationId
        : undefined);

    return NextResponse.json({
      ...job,
      correlationId,
      queueMode,
    });
  } catch (error) {
    console.error('Failed to get job status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    );
  }
}

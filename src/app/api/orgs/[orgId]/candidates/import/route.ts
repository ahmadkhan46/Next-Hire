import { NextResponse } from 'next/server';
import { createRoute } from '@/lib/api-middleware';
import { candidateImportSchema } from '@/lib/validation';
import { memoryQueues } from '@/lib/memory-queue';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getQueueMode } from '@/lib/queue-mode';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizePhone(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  return digits || null;
}

export const POST = createRoute(
  {
    requireAuth: true,
    requireOrg: true,
    permission: 'candidates:write',
    rateLimit: {
      type: 'bulkImport',
      identifier: (_, __, orgId) => orgId || 'unknown',
    },
    validation: {
      body: candidateImportSchema,
    },
  },
  async (req, { orgId, userId, body }) => {
    const correlationId = req.headers.get("x-correlation-id")?.trim() || crypto.randomUUID();
    const { candidates } = body;
    const normalizedCandidates = candidates.map((candidate: Record<string, unknown>) => ({
      ...candidate,
      email:
        typeof candidate.email === "string" ? candidate.email.trim().toLowerCase() : candidate.email,
    }));

    const invalidEmailIndex = normalizedCandidates.findIndex((candidate: Record<string, unknown>) => {
      const email = typeof candidate.email === "string" ? candidate.email : "";
      return !EMAIL_REGEX.test(email);
    });
    if (invalidEmailIndex >= 0) {
      return NextResponse.json(
        { error: `Invalid or missing email at CSV row ${invalidEmailIndex + 2}` },
        { status: 400 }
      );
    }

    const duplicateEmail = new Set<string>();
    const duplicateExternalId = new Set<string>();
    const duplicatePhone = new Set<string>();
    for (const row of normalizedCandidates) {
      const email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : '';
      const externalId = typeof row.externalId === 'string' ? row.externalId.trim() : '';
      const phone = normalizePhone(typeof row.phone === 'string' ? row.phone : null) ?? '';
      if (email) {
        if (duplicateEmail.has(email)) {
          return NextResponse.json(
            { error: `Duplicate email in import file: ${email}` },
            { status: 400 }
          );
        }
        duplicateEmail.add(email);
      }
      if (externalId) {
        if (duplicateExternalId.has(externalId)) {
          return NextResponse.json(
            { error: `Duplicate externalId in import file: ${externalId}` },
            { status: 400 }
          );
        }
        duplicateExternalId.add(externalId);
      }
      if (phone) {
        if (duplicatePhone.has(phone)) {
          return NextResponse.json(
            { error: `Duplicate phone in import file: ${phone}` },
            { status: 400 }
          );
        }
        duplicatePhone.add(phone);
      }
    }

    const targetJobId =
      typeof body.targetJobId === "string" && body.targetJobId.trim()
        ? body.targetJobId.trim()
        : null;

    if (targetJobId) {
      const job = await prisma.job.findFirst({
        where: { id: targetJobId, orgId: orgId! },
        select: { id: true },
      });
      if (!job) {
        return NextResponse.json(
          { error: "Selected job was not found for this organization." },
          { status: 400 }
        );
      }
    }

    const batch = await prisma.resumeUploadBatch.create({
      data: {
        orgId: orgId!,
        targetJobId,
        sourceType: 'CSV',
        sourceName: 'bulk-import.csv',
        uploadedBy: userId!,
        status: "QUEUED",
        totalFiles: candidates.length,
      },
      select: { id: true },
    });

    const payload = {
      orgId: orgId!,
      candidates: normalizedCandidates,
      userId: userId!,
      batchId: batch.id,
      targetJobId,
      correlationId,
    };
    const queueMode = getQueueMode();
    const job =
      queueMode === 'redis'
        ? await (async () => {
            const { queues, addJob } = await import('@/lib/queue');
            return addJob(queues.bulkImport, 'bulk-import', payload);
          })()
        : await (async () => {
            await import('@/workers/memory-worker');
            return memoryQueues.bulkImport.add('bulk-import', payload);
          })();

    logger.info('Bulk import queued', {
      orgId,
      userId,
      jobId: job.id,
      batchId: batch.id,
      targetJobId,
      rowCount: normalizedCandidates.length,
      correlationId,
      queueMode,
    });

    const response = NextResponse.json({
      jobId: job.id,
      batchId: batch.id,
      correlationId,
      queueMode,
      status: 'queued',
      message: `Import job queued with ${normalizedCandidates.length} candidates${targetJobId ? ` for job ${targetJobId}` : ""}`,
    });
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }
);

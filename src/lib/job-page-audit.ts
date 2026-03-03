import { prisma } from "@/lib/prisma";
import type { JobPageAuditAction, Prisma } from "@prisma/client";

export async function logJobPageAudit(input: {
  orgId: string;
  jobId: string;
  action: JobPageAuditAction;
  actorId?: string | null;
  summary?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    await prisma.jobPageAuditEvent.create({
      data: {
        orgId: input.orgId,
        jobId: input.jobId,
        action: input.action,
        actorId: input.actorId ?? null,
        summary: input.summary ?? null,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (error) {
    console.error("Failed to write job page audit event:", error);
  }
}

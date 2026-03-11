export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { handleAPIError } from "@/lib/errors";
import { verifyResourceAccess } from "@/lib/api-middleware";
import { enforcePermission } from "@/lib/rbac";
import { logJobPageAudit } from "@/lib/job-page-audit";
import { recalculateJobMatches } from "@/lib/auto-matching";

type Context = { params: Promise<{ jobId: string }> };

export async function POST(_req: Request, context: Context) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await context.params;

    // SECURITY: Verify user has access to this job's org
    const orgId = await verifyResourceAccess(userId, undefined, jobId);
    await enforcePermission(userId, orgId, "matches:write");

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, orgId: true },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const { required, matches: matchesWithStatus, candidatesConsidered } =
      await recalculateJobMatches(job.id, job.orgId);

    await logJobPageAudit({
      orgId,
      jobId,
      actorId: userId,
      action: "JOB_MATCHING_RERUN",
      summary: "Re-ran job matching",
      metadata: {
        requiredSkills: required.length,
        candidatesConsidered,
        matchesPersisted: matchesWithStatus.length,
      },
    });

    return NextResponse.json({
      ok: true,
      jobId,
      jobTitle: job.title,
      required: required.map((r) => r.name),
      requiredWithWeights: required,
      matches: matchesWithStatus,
    });
  } catch (err: any) {
    const handled = handleAPIError(err);
    return NextResponse.json({ error: handled.error, code: handled.code }, { status: handled.statusCode });
  }
}

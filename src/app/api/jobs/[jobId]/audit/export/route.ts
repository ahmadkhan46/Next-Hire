export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { verifyResourceAccess } from "@/lib/api-middleware";
import { enforcePermission } from "@/lib/rbac";
import { handleAPIError } from "@/lib/errors";
import { buildJobAuditCsv, fetchJobAuditEvents } from "@/lib/job-audit";
import type { JobPageAuditAction } from "@prisma/client";

type Context = { params: Promise<{ jobId: string }> };

const ALLOWED_ACTIONS = new Set<JobPageAuditAction>([
  "JOB_DETAILS_UPDATED",
  "JOB_SKILLS_UPDATED",
  "JOB_SKILLS_GENERATED",
  "JOB_MATCHING_RERUN",
  "JOB_DELETED",
]);

export async function GET(req: Request, context: Context) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await context.params;
    const orgId = await verifyResourceAccess(userId, undefined, jobId);
    await enforcePermission(userId, orgId, "jobs:read");

    const url = new URL(req.url);
    const actionRaw = url.searchParams.get("action");
    const fromDate = url.searchParams.get("fromDate");
    const toDate = url.searchParams.get("toDate");
    const action =
      actionRaw && ALLOWED_ACTIONS.has(actionRaw as JobPageAuditAction)
        ? (actionRaw as JobPageAuditAction)
        : null;

    // Export a reasonable upper bound for browser download.
    const data = await fetchJobAuditEvents({
      orgId,
      jobId,
      take: 2000,
      action,
      fromDate,
      toDate,
    });

    const csv = buildJobAuditCsv(data.events);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="job-audit-${jobId}-${new Date()
          .toISOString()
          .split("T")[0]}.csv"`,
      },
    });
  } catch (err: any) {
    const handled = handleAPIError(err);
    return NextResponse.json({ error: handled.error, code: handled.code }, { status: handled.statusCode });
  }
}

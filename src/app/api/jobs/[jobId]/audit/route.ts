export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { verifyResourceAccess } from "@/lib/api-middleware";
import { enforcePermission } from "@/lib/rbac";
import { handleAPIError } from "@/lib/errors";
import { fetchJobAuditEvents } from "@/lib/job-audit";
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
    const take = Number(url.searchParams.get("take") ?? "25");
    const cursor = url.searchParams.get("cursor");
    const actionRaw = url.searchParams.get("action");
    const fromDate = url.searchParams.get("fromDate");
    const toDate = url.searchParams.get("toDate");

    const action =
      actionRaw && ALLOWED_ACTIONS.has(actionRaw as JobPageAuditAction)
        ? (actionRaw as JobPageAuditAction)
        : null;

    const data = await fetchJobAuditEvents({
      orgId,
      jobId,
      take,
      cursor,
      action,
      fromDate,
      toDate,
    });

    return NextResponse.json({
      ok: true,
      jobId,
      events: data.events,
      nextCursor: data.nextCursor,
      hasMore: data.hasMore,
    });
  } catch (err: any) {
    const handled = handleAPIError(err);
    return NextResponse.json({ error: handled.error, code: handled.code }, { status: handled.statusCode });
  }
}

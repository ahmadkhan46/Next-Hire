export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { MatchStatus } from "@prisma/client";
import { verifyResourceAccess } from "@/lib/api-middleware";

type Context = { params: Promise<{ jobId: string }> };

function parseStatus(raw: any): MatchStatus | null {
  const s = String(raw ?? "").toUpperCase();
  if (s === "NONE") return MatchStatus.NONE;
  if (s === "SHORTLISTED") return MatchStatus.SHORTLISTED;
  if (s === "REJECTED") return MatchStatus.REJECTED;
  return null;
}

export async function PATCH(req: Request, context: Context) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await context.params;
    await verifyResourceAccess(userId, undefined, jobId);

    const body = await req.json().catch(() => ({}));

    const status = parseStatus(body?.status);
    const candidateIdsRaw = body?.candidateIds;

    const candidateIds: string[] = Array.isArray(candidateIdsRaw)
      ? candidateIdsRaw.map(String).filter(Boolean)
      : [];

    if (!status) {
      return NextResponse.json(
        { error: "Invalid status. Use NONE | SHORTLISTED | REJECTED" },
        { status: 400 }
      );
    }

    if (candidateIds.length === 0) {
      return NextResponse.json(
        { error: "candidateIds must be a non-empty array" },
        { status: 400 }
      );
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, orgId: true },
    });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const now = new Date();

    const existing = await prisma.matchResult.findMany({
      where: {
        jobId,
        orgId: job.orgId,
        candidateId: { in: candidateIds },
      },
      select: { candidateId: true, status: true },
    });

    if (existing.length === 0) {
      return NextResponse.json({
        ok: true,
        changed: 0,
        statusUpdatedAt: now.toISOString(),
      });
    }

    const logs = existing
      .filter((m) => m.status !== status)
      .map((m) => ({
        orgId: job.orgId,
        jobId,
        candidateId: m.candidateId,
        fromStatus: m.status,
        toStatus: status,
        note: body?.note ? String(body.note) : null,
        decidedBy: null,
      }));

    const changed = logs.length;

    await prisma.$transaction(async (tx) => {
      await tx.matchResult.updateMany({
        where: {
          jobId,
          orgId: job.orgId,
          candidateId: { in: candidateIds },
        },
        data: {
          status,
          statusUpdatedAt: now,
          statusUpdatedBy: null,
        },
      });

      if (logs.length > 0) {
        await tx.matchDecisionLog.createMany({ data: logs });
      }
    });

    return NextResponse.json({
      ok: true,
      changed,
      statusUpdatedAt: now.toISOString(),
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

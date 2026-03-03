import { NextResponse } from "next/server";
import { createProtectedRoute } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";

type TimelineRow = {
  id: string;
  createdAt: Date;
  title: string;
  description: string | null;
  type: string;
  source: "activity" | "decision";
};

function toPositiveInt(input: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export const GET = createProtectedRoute(
  "candidates:read",
  async (req, { params }) => {
    const { orgId, candidateId } = await params;
    const page = toPositiveInt(req.nextUrl.searchParams.get("page"), 1, 1, 100000);
    const limit = toPositiveInt(req.nextUrl.searchParams.get("limit"), 15, 1, 50);
    const offset = (page - 1) * limit;

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, orgId },
      select: { id: true },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const activityRows = await prisma.candidateActivity.findMany({
      where: { orgId, candidateId },
      select: {
        id: true,
        createdAt: true,
        title: true,
        description: true,
        type: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const decisionRows = await prisma.matchDecisionLog.findMany({
      where: { orgId, candidateId },
      select: {
        id: true,
        createdAt: true,
        fromStatus: true,
        toStatus: true,
        note: true,
        job: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const merged: TimelineRow[] = [
      ...activityRows.map((activity) => ({
        id: `activity-${activity.id}`,
        createdAt: activity.createdAt,
        title: activity.title,
        description: activity.description,
        type: activity.type,
        source: "activity" as const,
      })),
      ...decisionRows.map((log) => ({
        id: `decision-${log.id}`,
        createdAt: log.createdAt,
        title: `Match status changed (${log.fromStatus} -> ${log.toStatus})`,
        description: log.note ?? `Updated for ${log.job?.title ?? "a job"}`,
        type: "MATCH_STATUS_CHANGED",
        source: "decision" as const,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const pageItems = merged.slice(offset, offset + limit);
    const hasMore = offset + limit < merged.length;

    return NextResponse.json({
      events: pageItems,
      pagination: {
        page,
        limit,
        total: merged.length,
        hasMore,
      },
    });
  }
);

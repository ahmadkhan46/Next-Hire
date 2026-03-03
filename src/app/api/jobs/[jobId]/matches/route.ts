export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { handleAPIError } from "@/lib/errors";
import { verifyResourceAccess } from "@/lib/api-middleware";

type Context = { params: Promise<{ jobId: string }> };

function explainDecision(match: {
  status: string;
  missingCritical: string[];
  score: number;
}) {
  if (match.status === "REJECTED") {
    if (match.missingCritical.length > 0) {
      return `Missing critical skills: ${match.missingCritical.join(", ")}`;
    }
    return "Low overall skill match";
  }

  if (match.status === "SHORTLISTED") {
    return "Meets all critical requirements with strong weighted match";
  }

  return null;
}

export async function GET(req: Request, context: Context) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await context.params;

    // SECURITY: Verify user has access to this job's org
    await verifyResourceAccess(userId, undefined, jobId);

    const { searchParams } = new URL(req.url);

    const take = Math.min(
      Math.max(Number(searchParams.get("take") ?? 50), 1),
      200
    );
    const cursor = searchParams.get("cursor");

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, orgId: true },
    });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const criticalSkills = await prisma.jobSkill.findMany({
      where: { jobId, weight: { gte: 4 } },
      select: { skill: { select: { name: true } } },
    });
    const criticalSet = new Set(criticalSkills.map((c) => c.skill.name));

    const results = await prisma.matchResult.findMany({
      where: { jobId, orgId: job.orgId },
      orderBy: [{ score: "desc" }, { id: "asc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        candidateId: true,
        score: true,
        matchedWeight: true,
        totalWeight: true,
        matched: true,
        missing: true,
        status: true,
        statusUpdatedAt: true,
        statusUpdatedBy: true,
        candidate: { select: { fullName: true, email: true } },
      },
    });

    const hasMore = results.length > take;
    const page = results.slice(0, take);
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    const matches = page.map((r) => ({
      candidateId: r.candidateId,
      fullName: r.candidate.fullName,
      email: r.candidate.email,
      score: r.score,
      matchedWeight: r.matchedWeight,
      totalWeight: r.totalWeight,
      matched: r.matched,
      missing: r.missing,
      missingCritical: Array.isArray(r.missing)
        ? r.missing.filter(
            (s): s is string => typeof s === "string" && criticalSet.has(s)
          )
        : [],
      status: r.status,
      statusUpdatedAt: r.statusUpdatedAt,
      statusUpdatedBy: r.statusUpdatedBy,
    }));

    const matchesWithReason = matches.map((m) => ({
      ...m,
      decisionReason: explainDecision({
        status: m.status,
        missingCritical: m.missingCritical,
        score: m.score,
      }),
    }));

    return NextResponse.json({
      ok: true,
      jobId,
      matches: matchesWithReason,
      nextCursor,
      hasMore,
    });
  } catch (err: any) {
    const handled = handleAPIError(err);
    return NextResponse.json({ error: handled.error, code: handled.code }, { status: handled.statusCode });
  }
}

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { MatchStatus } from "@prisma/client";
import { handleAPIError } from "@/lib/errors";
import { verifyResourceAccess } from "@/lib/api-middleware";
import { enforcePermission } from "@/lib/rbac";
import { logJobPageAudit } from "@/lib/job-page-audit";

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

    const jobSkills = await prisma.jobSkill.findMany({
      where: { jobId: job.id },
      include: { skill: true },
    });

    const required = jobSkills.map((js) => ({
      name: js.skill.name,
      weight: js.weight ?? 1,
    }));

    if (required.length === 0) {
      return NextResponse.json({
        ok: true,
        jobId,
        jobTitle: job.title,
        required: [],
        requiredWithWeights: [],
        matches: [],
      });
    }

    const totalWeight = required.reduce((sum, r) => sum + r.weight, 0);

    const candidates = await prisma.candidate.findMany({
      where: { orgId: job.orgId },
      select: {
        id: true,
        fullName: true,
        email: true,
        skills: { include: { skill: true } },
      },
      take: 200,
    });

    const matches = candidates.map((c) => {
      const candidateSkills = c.skills.map((cs) => cs.skill.name);
      const candidateSet = new Set(candidateSkills);

      const matchedReq = required.filter((r) => candidateSet.has(r.name));
      const missingReq = required.filter((r) => !candidateSet.has(r.name));

      const matchedWeight = matchedReq.reduce((sum, r) => sum + r.weight, 0);
      const score = totalWeight === 0 ? 0 : matchedWeight / totalWeight;

      const missingCritical = missingReq
        .filter((r) => r.weight >= 4)
        .map((r) => r.name);

      return {
        candidateId: c.id,
        fullName: c.fullName,
        email: c.email,
        score,
        matchedWeight,
        totalWeight,
        matched: matchedReq.map((r) => r.name),
        missing: missingReq.map((r) => r.name),
        missingCritical,
      };
    });

    matches.sort((a, b) => b.score - a.score);

    // Load existing decision state
    const existing = await prisma.matchResult.findMany({
      where: { jobId },
      select: {
        candidateId: true,
        status: true,
        statusUpdatedAt: true,
        statusUpdatedBy: true,
      },
    });

    const statusByCandidate = new Map(
      existing.map((r) => [
        r.candidateId,
        {
          status: r.status,
          statusUpdatedAt: r.statusUpdatedAt,
          statusUpdatedBy: r.statusUpdatedBy,
        },
      ])
    );

    const matchesWithStatus = matches.map((m) => {
      const prev = statusByCandidate.get(m.candidateId);
      return {
        ...m,
        status: prev?.status ?? MatchStatus.NONE,
        statusUpdatedAt: prev?.statusUpdatedAt ?? null,
        statusUpdatedBy: prev?.statusUpdatedBy ?? null,
      };
    });

    await prisma.$transaction(async (tx) => {
      const candidateIds = matchesWithStatus.map((m) => m.candidateId);

      // Delete stale results (candidates no longer considered)
      await tx.matchResult.deleteMany({
        where: { jobId, candidateId: { notIn: candidateIds } },
      });

      for (const m of matchesWithStatus) {
        await tx.matchResult.upsert({
          where: { jobId_candidateId: { jobId, candidateId: m.candidateId } },
          create: {
            jobId,
            candidateId: m.candidateId,
            orgId: job.orgId,
            score: m.score,
            matched: m.matched,
            missing: m.missing,
            matchedWeight: m.matchedWeight,
            totalWeight: m.totalWeight,
            status: m.status,
            statusUpdatedAt: m.statusUpdatedAt ?? undefined,
            statusUpdatedBy: m.statusUpdatedBy ?? undefined,
          },
          update: {
            score: m.score,
            matched: m.matched,
            missing: m.missing,
            matchedWeight: m.matchedWeight,
            totalWeight: m.totalWeight,
            // preserve status fields exactly
            status: m.status,
            statusUpdatedAt: m.statusUpdatedAt ?? undefined,
            statusUpdatedBy: m.statusUpdatedBy ?? undefined,
          },
        });
      }
    });

    await logJobPageAudit({
      orgId,
      jobId,
      actorId: userId,
      action: "JOB_MATCHING_RERUN",
      summary: "Re-ran job matching",
      metadata: {
        requiredSkills: required.length,
        candidatesConsidered: candidates.length,
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

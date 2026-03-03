export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { MatchStatus } from "@prisma/client";
import { validateStatusTransition } from "@/lib/workflow-engine";
import { generateCommunication, extractCandidateVariables } from "@/lib/communication-templates";
import { logCandidateActivity } from "@/lib/candidate-activity";
import { verifyResourceAccess } from "@/lib/api-middleware";

type Context = { params: Promise<{ jobId: string; candidateId: string }> };

function parseStatus(input: unknown): MatchStatus | null {
  const raw = String(input ?? "").toUpperCase();
  if (raw === "SHORTLISTED") return MatchStatus.SHORTLISTED;
  if (raw === "REJECTED") return MatchStatus.REJECTED;
  if (raw === "NONE") return MatchStatus.NONE;
  return null;
}

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

function autoDecisionNote(
  status: MatchStatus,
  match: {
    score: number;
    matchedWeight: number;
    totalWeight: number;
    missing: string[];
    missingCritical: string[];
  }
): string | null {
  const reason = explainDecision({
    status,
    missingCritical: match.missingCritical ?? [],
    score: match.score ?? 0,
  });

  if (status === MatchStatus.NONE) {
    return "Reset to unreviewed.";
  }

  if (reason) {
    if (status === MatchStatus.SHORTLISTED) {
      const scorePct = Math.round((match.score ?? 0) * 100);
      return `${reason}; score ${scorePct}%; matchedWeight ${match.matchedWeight}/${match.totalWeight}`;
    }
    return reason;
  }

  return null;
}

export async function PATCH(req: Request, context: Context) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId, candidateId } = await context.params;
    await verifyResourceAccess(userId, undefined, jobId);

    const body = await req.json().catch(() => ({}));

    const status = parseStatus(body?.status);
    if (!status) {
      return NextResponse.json(
        { error: "Invalid status. Use NONE | SHORTLISTED | REJECTED" },
        { status: 400 }
      );
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, orgId: true, title: true },
    });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const existing = await prisma.matchResult.findUnique({
      where: { jobId_candidateId: { jobId, candidateId } },
      select: {
        id: true,
        orgId: true,
        status: true,
        score: true,
        matchedWeight: true,
        totalWeight: true,
        missing: true,
        matched: true,
        candidate: {
          select: { fullName: true, email: true }
        }
      },
    });
    if (!existing) return NextResponse.json({ error: "Match not found" }, { status: 404 });

    const noteRaw = typeof body?.note === "string" ? body.note : "";
    const trimmedNote = noteRaw.trim();
    const missingList = Array.isArray(existing.missing)
      ? existing.missing.filter((s): s is string => typeof s === "string")
      : [];
    
    const criticalSkills = await prisma.jobSkill.findMany({
      where: { jobId, weight: { gte: 4 } },
      select: { skill: { select: { name: true } } },
    });
    const criticalSet = new Set(criticalSkills.map((c) => c.skill.name));
    
    const autoNote = autoDecisionNote(status, {
      score: existing.score,
      matchedWeight: existing.matchedWeight,
      totalWeight: existing.totalWeight,
      missing: missingList,
      missingCritical: missingList.filter((s) => criticalSet.has(s)),
    });

    const validationNote =
      trimmedNote.length > 0
        ? trimmedNote
        : autoNote ?? "Updated via matchboard";

    // Validate transition
    const validation = validateStatusTransition(
      existing.status,
      status,
      validationNote,
      "admin" // In real app, derive from auth/role
    );

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const note = trimmedNote.length > 0 ? trimmedNote : autoNote;

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.matchResult.update({
        where: { jobId_candidateId: { jobId, candidateId } },
        data: {
          status,
          statusUpdatedAt: now,
        },
        select: {
          jobId: true,
          candidateId: true,
          status: true,
          statusUpdatedAt: true,
        },
      });

      await tx.matchDecisionLog.create({
        data: {
          orgId: job.orgId,
          jobId,
          candidateId,
          fromStatus: existing.status,
          toStatus: status,
          note,
        },
      });

      return u;
    });

    await logCandidateActivity({
      orgId: job.orgId,
      candidateId,
      type: "MATCH_STATUS_CHANGED",
      title: "Match status changed",
      description: `${existing.status} -> ${status} for ${job.title}.`,
      metadata: { jobId, fromStatus: existing.status, toStatus: status, note },
    });

    // Generate communication if candidate has email
    let communication = null;
    if (existing.candidate.email && (status === 'SHORTLISTED' || status === 'REJECTED')) {
      const templateId = status === 'SHORTLISTED' ? 'shortlist-notification' : 'rejection-notification';
      const variables = extractCandidateVariables({
        fullName: existing.candidate.fullName,
        matched: existing.matched
      }, job);
      
      communication = generateCommunication(templateId, variables);
    }

    return NextResponse.json({ 
      ok: true, 
      ...updated,
      communication 
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { handleAPIError } from "@/lib/errors";
import { verifyResourceAccess } from "@/lib/api-middleware";
import { enforcePermission } from "@/lib/rbac";
import { logJobPageAudit } from "@/lib/job-page-audit";

type Context = { params: Promise<{ jobId: string }> };

function clampWeight(w: unknown) {
  if (typeof w !== "number" || !Number.isFinite(w)) return 1;
  return Math.max(1, Math.min(5, Math.round(w)));
}

function cleanName(s: unknown) {
  return String(s ?? "").trim();
}

export async function GET(_req: Request, context: Context) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await context.params;

    // SECURITY: Verify user has access to this job's org
    const orgId = await verifyResourceAccess(userId, undefined, jobId);
    await enforcePermission(userId, orgId, "jobs:read");

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const rows = await prisma.jobSkill.findMany({
      where: { jobId },
      include: { skill: true },
      orderBy: [{ weight: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      ok: true,
      jobId,
      skills: rows.map((r) => ({
        id: r.skill.id,
        name: r.skill.name,
        weight: r.weight ?? 1,
      })),
    });
  } catch (err: any) {
    const handled = handleAPIError(err);
    return NextResponse.json({ error: handled.error, code: handled.code }, { status: handled.statusCode });
  }
}


export async function PATCH(req: Request, context: Context) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await context.params;

    // SECURITY: Verify user has access to this job's org
    const orgId = await verifyResourceAccess(userId, undefined, jobId);
    await enforcePermission(userId, orgId, "jobs:write");

    const body = await req.json().catch(() => ({}));

    const input: Array<{ name: string; weight?: number }> = Array.isArray(body?.skills)
      ? body.skills
      : [];

    // Load job to enforce org scoping
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, orgId: true },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Normalize + dedupe by lowercase skill name (keep highest weight)
    const dedup = new Map<string, { name: string; weight: number }>();
    for (const s of input) {
      const name = cleanName(s?.name);
      if (!name) continue;

      const weight = clampWeight(s?.weight);
      const key = name.toLowerCase();

      const prev = dedup.get(key);
      if (!prev || weight > prev.weight) dedup.set(key, { name, weight });
    }

    const desired = Array.from(dedup.values());
    const desiredLower = new Set(desired.map((s) => s.name.toLowerCase()));

    // Current mappings for this job
    const existing = await prisma.jobSkill.findMany({
      where: { jobId },
      include: { skill: true },
    });

    await prisma.$transaction(async (tx) => {
      // Delete mappings removed in desired list
      const toDeleteIds = existing
        .filter((js) => !desiredLower.has(js.skill.name.toLowerCase()))
        .map((js) => js.id);

      if (toDeleteIds.length) {
        await tx.jobSkill.deleteMany({ where: { id: { in: toDeleteIds } } });
      }

      // Upsert each desired skill + mapping (org-scoped skills)
      for (const s of desired) {
        const skill = await tx.skill.upsert({
          where: { orgId_name: { orgId: job.orgId, name: s.name } },
          create: { orgId: job.orgId, name: s.name },
          update: {},
          select: { id: true, name: true },
        });

        await tx.jobSkill.upsert({
          where: { jobId_skillId: { jobId, skillId: skill.id } },
          create: {
            jobId,
            skillId: skill.id,
            weight: s.weight,
          },
          update: {
            weight: s.weight,
          },
        });
      }
    });

    const updated = await prisma.jobSkill.findMany({
      where: { jobId },
      include: { skill: true },
      orderBy: [{ weight: "desc" }, { createdAt: "asc" }],
    });

    const beforeMap = new Map(
      existing.map((item) => [
        item.skill.name.toLowerCase(),
        { name: item.skill.name, weight: item.weight ?? 1 },
      ])
    );
    const afterMap = new Map(
      updated.map((item) => [
        item.skill.name.toLowerCase(),
        { name: item.skill.name, weight: item.weight ?? 1 },
      ])
    );

    const added: string[] = [];
    const removed: string[] = [];
    const weightChanged: string[] = [];

    for (const [key, value] of afterMap.entries()) {
      if (!beforeMap.has(key)) added.push(value.name);
      else if ((beforeMap.get(key)?.weight ?? 1) !== value.weight) weightChanged.push(value.name);
    }
    for (const [key, value] of beforeMap.entries()) {
      if (!afterMap.has(key)) removed.push(value.name);
    }

    await logJobPageAudit({
      orgId,
      jobId,
      actorId: userId,
      action: "JOB_SKILLS_UPDATED",
      summary: "Updated job skills",
      metadata: {
        beforeCount: existing.length,
        afterCount: updated.length,
        added,
        removed,
        weightChanged,
      },
    });

    return NextResponse.json({
      ok: true,
      jobId,
      skills: updated.map((js) => ({
        id: js.skill.id,
        name: js.skill.name,
        weight: js.weight ?? 1,
      })),
    });
  } catch (err: any) {
    const handled = handleAPIError(err);
    return NextResponse.json({ error: handled.error, code: handled.code }, { status: handled.statusCode });
  }
}

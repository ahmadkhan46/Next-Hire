export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { handleAPIError } from "@/lib/errors";
import { verifyResourceAccess } from "@/lib/api-middleware";
import { enforcePermission } from "@/lib/rbac";
import {
  autoGenerateAndPersistJobSkills,
  suggestJobSkillsFromDescription,
} from "@/lib/job-skill-generation";
import { logJobPageAudit } from "@/lib/job-page-audit";

type Context = { params: Promise<{ jobId: string }> };

export async function POST(req: Request, context: Context) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await context.params;
    const orgId = await verifyResourceAccess(userId, undefined, jobId);
    await enforcePermission(userId, orgId, "jobs:write");

    const body = await req.json().catch(() => ({}));
    const maxSkillsRaw =
      body?.maxSkills === undefined || body?.maxSkills === null
        ? undefined
        : Number(body.maxSkills);
    const onlyWhenEmpty = Boolean(body?.onlyWhenEmpty);
    const previewOnly = Boolean(body?.preview);

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, orgId: true, description: true },
    });

    if (!job || job.orgId !== orgId) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (!job.description || !job.description.trim()) {
      return NextResponse.json(
        { error: "Job description is required to generate skills" },
        { status: 400 }
      );
    }

    const existingRows = await prisma.jobSkill.findMany({
      where: { jobId },
      include: { skill: true },
      orderBy: [{ weight: "desc" }, { createdAt: "asc" }],
    });

    const existingSkills = existingRows.map((row) => ({
      name: row.skill.name,
      weight: row.weight ?? 1,
    }));

    if (previewOnly) {
      if (onlyWhenEmpty && existingSkills.length > 0) {
        return NextResponse.json({
          ok: true,
          jobId,
          preview: {
            wouldChange: false,
            reason: "Skipped because onlyWhenEmpty=true and job already has skills",
            existingCount: existingSkills.length,
            generatedCount: 0,
            newSkills: [] as Array<{ name: string; weight: number }>,
            weightUpdates: [] as Array<{ name: string; from: number; to: number }>,
            unchangedCount: 0,
          },
        });
      }

      const generated = suggestJobSkillsFromDescription(job.description, {
        maxSkills: Number.isFinite(maxSkillsRaw) ? maxSkillsRaw : undefined,
      });

      const existingMap = new Map(
        existingSkills.map((item) => [item.name.toLowerCase(), item])
      );
      const newSkills = generated.filter(
        (item) => !existingMap.has(item.name.toLowerCase())
      );
      const weightUpdates = generated
        .filter((item) => {
          const existing = existingMap.get(item.name.toLowerCase());
          return existing && existing.weight !== item.weight;
        })
        .map((item) => ({
          name: item.name,
          from: existingMap.get(item.name.toLowerCase())?.weight ?? 1,
          to: item.weight,
        }));
      const unchangedCount = generated.filter((item) => {
        const existing = existingMap.get(item.name.toLowerCase());
        return existing && existing.weight === item.weight;
      }).length;

      return NextResponse.json({
        ok: true,
        jobId,
        preview: {
          wouldChange: newSkills.length > 0 || weightUpdates.length > 0,
          existingCount: existingSkills.length,
          generatedCount: generated.length,
          newSkills,
          weightUpdates,
          unchangedCount,
        },
      });
    }

    const result = await autoGenerateAndPersistJobSkills({
      orgId,
      jobId,
      description: job.description,
      onlyWhenEmpty,
      maxSkills: Number.isFinite(maxSkillsRaw) ? maxSkillsRaw : undefined,
      source: "MANUAL",
      triggeredBy: userId,
    });

    await logJobPageAudit({
      orgId,
      jobId,
      actorId: userId,
      action: "JOB_SKILLS_GENERATED",
      summary: "Generated skills from description",
      metadata: {
        source: "MANUAL",
        generatedCount: result.generated,
        onlyWhenEmpty,
        maxSkills: Number.isFinite(maxSkillsRaw) ? maxSkillsRaw : 15,
      },
    });

    return NextResponse.json({
      ok: true,
      jobId,
      generated: result.generated,
      skills: result.skills,
    });
  } catch (err: any) {
    const handled = handleAPIError(err);
    return NextResponse.json({ error: handled.error, code: handled.code }, { status: handled.statusCode });
  }
}

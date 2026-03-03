export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { handleAPIError } from "@/lib/errors";
import { verifyResourceAccess } from "@/lib/api-middleware";
import { enforcePermission } from "@/lib/rbac";
import { autoGenerateAndPersistJobSkills } from "@/lib/job-skill-generation";
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

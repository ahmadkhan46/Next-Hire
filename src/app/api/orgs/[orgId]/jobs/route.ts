export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRoute } from "@/lib/api-middleware";
import { autoMatchJobToCandidates } from "@/lib/auto-matching";
import { sanitizeForLog } from "@/lib/security";
import type { WorkMode } from "@prisma/client";
import { autoGenerateAndPersistJobSkills } from "@/lib/job-skill-generation";
import { logJobPageAudit } from "@/lib/job-page-audit";

function cleanSkillName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function clampWeight(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

/* --------------------------------------------------
   GET /api/orgs/[orgId]/jobs
   List jobs for an organization
-------------------------------------------------- */
export const GET = createRoute<{ orgId: string }>(
  {
    requireAuth: true,
    requireOrg: true,
    permission: "jobs:read",
    rateLimit: { type: "api" },
  },
  async (_req, { orgId }) => {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const jobs = await prisma.job.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        status: true,
        workMode: true,
        workModeOther: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, jobs });
  }
);

/* --------------------------------------------------
   POST /api/orgs/[orgId]/jobs
   Create a job in an organization
-------------------------------------------------- */
export const POST = createRoute<{ orgId: string }>(
  {
    requireAuth: true,
    requireOrg: true,
    permission: "jobs:write",
    rateLimit: { type: "api" },
  },
  async (req, { orgId, userId }) => {
    if (!orgId) {
      return NextResponse.json({ error: "Organization context missing" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    const title = String(body?.title ?? "").trim();
    const description =
      body?.description === null || body?.description === undefined
        ? null
        : String(body.description).trim() || null;
    const location =
      body?.location === null || body?.location === undefined
        ? null
        : String(body.location).trim() || null;
    const workModeRaw =
      body?.workMode === null || body?.workMode === undefined
        ? null
        : String(body.workMode).trim().toUpperCase();
    const workMode: WorkMode | null =
      workModeRaw === "REMOTE" ||
      workModeRaw === "ONSITE" ||
      workModeRaw === "HYBRID" ||
      workModeRaw === "OTHER"
        ? (workModeRaw as WorkMode)
        : null;
    const workModeOtherRaw =
      body?.workModeOther === null || body?.workModeOther === undefined
        ? null
        : String(body.workModeOther).trim();
    const workModeOther =
      workMode === "OTHER" ? workModeOtherRaw || "Other" : null;
    const rawSkills = Array.isArray(body?.skills) ? body.skills : [];

    const dedupSkills = new Map<string, { name: string; weight: number }>();
    for (const entry of rawSkills) {
      const name =
        typeof entry === "string"
          ? cleanSkillName(entry)
          : cleanSkillName((entry as { name?: unknown })?.name);
      if (!name) continue;
      const weight =
        typeof entry === "string"
          ? 3
          : clampWeight((entry as { weight?: unknown })?.weight);
      const key = name.toLowerCase();
      const prev = dedupSkills.get(key);
      if (!prev || weight > prev.weight) {
        dedupSkills.set(key, { name, weight });
      }
    }
    const normalizedSkills = Array.from(dedupSkills.values());

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const job = await prisma.$transaction(async (tx) => {
      const createdJob = await tx.job.create({
        data: {
          orgId,
          title,
          description,
          location,
          status: "OPEN",
          workMode,
          workModeOther,
        },
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          status: true,
          workMode: true,
          workModeOther: true,
          createdAt: true,
        },
      });

      for (const skillInput of normalizedSkills) {
        const skill = await tx.skill.upsert({
          where: { orgId_name: { orgId, name: skillInput.name } },
          create: { orgId, name: skillInput.name },
          update: {},
          select: { id: true },
        });
        await tx.jobSkill.upsert({
          where: { jobId_skillId: { jobId: createdJob.id, skillId: skill.id } },
          create: {
            jobId: createdJob.id,
            skillId: skill.id,
            weight: skillInput.weight,
          },
          update: {
            weight: skillInput.weight,
          },
        });
      }

      return createdJob;
    });

    let autoGeneratedSkills = 0;
    if (normalizedSkills.length === 0 && description) {
      const generated = await autoGenerateAndPersistJobSkills({
        orgId,
        jobId: job.id,
        description,
        onlyWhenEmpty: true,
        source: "AUTO_CREATE",
        triggeredBy: userId,
      });
      autoGeneratedSkills = generated.generated;
    }

    await logJobPageAudit({
      orgId,
      jobId: job.id,
      actorId: userId,
      action: "JOB_DETAILS_UPDATED",
      summary: "Created job",
      metadata: {
        created: true,
      },
    });

    if (normalizedSkills.length > 0) {
      await logJobPageAudit({
        orgId,
        jobId: job.id,
        actorId: userId,
        action: "JOB_SKILLS_UPDATED",
        summary: "Added initial job skills",
        metadata: {
          afterCount: normalizedSkills.length,
        },
      });
    }

    if (autoGeneratedSkills > 0) {
      await logJobPageAudit({
        orgId,
        jobId: job.id,
        actorId: userId,
        action: "JOB_SKILLS_GENERATED",
        summary: "Auto-generated skills from description",
        metadata: {
          source: "AUTO_CREATE",
          generatedCount: autoGeneratedSkills,
        },
      });
    }

    autoMatchJobToCandidates(job.id, orgId).catch((error) => {
      console.error("Auto-matching failed:", sanitizeForLog(String(error)));
    });

    return NextResponse.json({
      ok: true,
      job,
      skillsLinked: normalizedSkills.length,
      autoGeneratedSkills,
    });
  }
);

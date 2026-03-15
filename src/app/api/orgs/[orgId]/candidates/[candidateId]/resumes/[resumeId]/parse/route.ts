export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractCandidateProfile, ResumeParseError } from "@/lib/resume-llm";
import { buildCandidateUpdate } from "@/lib/resume-apply";
import { createRoute } from "@/lib/api-middleware";
import { autoMatchCandidateToJobs } from "@/lib/auto-matching";
import { logCandidateActivity } from "@/lib/candidate-activity";

export const POST = createRoute(
  {
    requireAuth: true,
    requireOrg: true,
    permission: "candidates:write",
    rateLimit: { type: "llm" },
  },
  async (req: NextRequest, { params, orgId, userId }) => {
    const { candidateId, resumeId } = params as {
      orgId: string;
      candidateId: string;
      resumeId: string;
    };
    const force = req.nextUrl.searchParams.get("force") === "true";

  const [resume, orgSettings] = await Promise.all([
    prisma.resume.findFirst({
      where: { id: resumeId, candidateId },
      select: {
        id: true,
        rawText: true,
        parseStatus: true,
        candidate: { select: { id: true, orgId: true, fullName: true } },
      },
    }),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { resumeParseTimeoutSeconds: true },
    }),
  ]);

  const timeoutMs = (orgSettings?.resumeParseTimeoutSeconds ?? 30) * 1000;

    if (!resume || resume.candidate.orgId !== orgId) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    if (resume.parseStatus === "SAVED" && !force) {
      return NextResponse.json({ ok: true, status: "SAVED", skipped: true });
    }

    if (!resume.rawText) {
      return NextResponse.json(
        { error: "Resume has no rawText to parse" },
        { status: 400 }
      );
    }

    await prisma.resume.update({
      where: { id: resume.id },
      data: { parseStatus: "EXTRACTING", parseError: null },
    });

    try {
      const llm = await extractCandidateProfile(resume.rawText, orgId, { timeoutMs });
      const extract = llm.extract;

      const { updateCandidate, experiences, projects, technologies, skills, educations } =
        buildCandidateUpdate(extract);

      await prisma.$transaction(async (tx) => {
        if (Object.keys(updateCandidate).length > 0) {
          await tx.candidate.update({
            where: { id: candidateId },
            data: updateCandidate,
          });
        }

        await tx.candidateExperience.deleteMany({ where: { candidateId } });
        await tx.candidateProject.deleteMany({ where: { candidateId } });
        await tx.candidateTechnology.deleteMany({ where: { candidateId } });
        await tx.candidateEducation.deleteMany({ where: { candidateId } });

        if (experiences.length) {
          await tx.candidateExperience.createMany({
            data: experiences.map((exp) => ({ ...exp, candidateId })),
          });
        }
        if (projects.length) {
          await tx.candidateProject.createMany({
            data: projects.map((project) => ({ ...project, candidateId })),
          });
        }
        if (technologies.length) {
          await tx.candidateTechnology.createMany({
            data: technologies.map((tech) => ({ ...tech, candidateId })),
          });
        }
        if (educations.length) {
          await tx.candidateEducation.createMany({
            data: educations.map((edu) => ({ ...edu, candidateId })),
          });
        }

        for (const name of skills) {
          const skill = await tx.skill.upsert({
            where: { orgId_name: { orgId, name } },
            update: {},
            create: { orgId, name },
          });

          await tx.candidateSkill.upsert({
            where: { candidateId_skillId: { candidateId, skillId: skill.id } },
            update: { source: "resume" },
            create: { candidateId, skillId: skill.id, source: "resume" },
          });
        }
      });

      await prisma.resume.update({
        where: { id: resume.id },
        data: {
          parseStatus: "SAVED",
          parseError: null,
          parsedAt: new Date(),
          parseModel: llm.model,
          promptVersion: llm.promptVersion,
          parsedJson: {
            ...extract,
            model: llm.model,
            promptVersion: llm.promptVersion,
            extractedAt: new Date().toISOString(),
            warnings: llm.warnings,
            usage: llm.usage ?? null,
          },
        },
      });

      await logCandidateActivity({
        orgId,
        candidateId,
        type: "RESUME_PARSED",
        title: "Resume parsed",
        description: "Candidate profile was updated from resume extraction.",
        actorId: userId,
        metadata: { resumeId, parseModel: llm.model, promptVersion: llm.promptVersion },
      });

      await autoMatchCandidateToJobs(candidateId, orgId);

      return NextResponse.json({ ok: true, status: "SAVED" });
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : "Parse failed";
      const isTimeout = rawMessage.toLowerCase().includes("timeout");
      const message = isTimeout
        ? `LLM timeout after ${orgSettings?.resumeParseTimeoutSeconds ?? 30} s. You can increase the limit in Organisation Settings → AI Settings.`
        : rawMessage;
      const status =
        err instanceof ResumeParseError ||
        (err instanceof Error && err.name === "ZodError")
          ? "NEEDS_REVIEW"
          : "FAILED";

      await prisma.resume.update({
        where: { id: resume.id },
        data: {
          parseStatus: status,
          parseError: message,
          parsedAt: new Date(),
          parsedJson: {
            error: message,
            failedAt: new Date().toISOString(),
            errorType:
              err instanceof ResumeParseError
                ? err.kind
                : err instanceof Error
                ? err.name
                : "UNKNOWN",
          },
        },
      });

      await logCandidateActivity({
        orgId,
        candidateId,
        type: "RESUME_PARSE_FAILED",
        title: "Resume parse failed",
        description: message,
        actorId: userId,
        metadata: { resumeId, status },
      });

      return NextResponse.json(
        { error: message, ...(isTimeout ? { code: "TIMEOUT", settingsPath: `/orgs/${orgId}/settings` } : {}) },
        { status: 500 }
      );
    }
  }
);

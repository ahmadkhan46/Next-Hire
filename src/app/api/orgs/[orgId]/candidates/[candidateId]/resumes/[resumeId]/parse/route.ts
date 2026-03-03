export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractCandidateProfile, ResumeParseError } from "@/lib/resume-llm";
import { buildCandidateUpdate } from "@/lib/resume-apply";
import { createRoute } from "@/lib/api-middleware";
import { autoMatchCandidateToJobs } from "@/lib/auto-matching";
import { logCandidateActivity } from "@/lib/candidate-activity";

function calculateNameSimilarity(name1: string, name2: string): number {
  const words1 = name1.split(/\s+/).filter(Boolean);
  const words2 = name2.split(/\s+/).filter(Boolean);
  
  let matches = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
        matches++;
        break;
      }
    }
  }
  
  return matches / Math.max(words1.length, words2.length);
}

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

  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, candidateId },
    select: {
      id: true,
      rawText: true,
      parseStatus: true,
      candidate: { select: { id: true, orgId: true, fullName: true } },
    },
  });

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
      const llm = await extractCandidateProfile(resume.rawText, orgId);
      const extract = llm.extract;

      // Check for name mismatch
      const parsedName = extract.personal?.fullName?.toLowerCase().trim();
      const candidateName = resume.candidate.fullName.toLowerCase().trim();
      
      if (parsedName && candidateName) {
        const similarity = calculateNameSimilarity(parsedName, candidateName);
        if (similarity < 0.5) {
          // Names don't match - add warning
          await prisma.resume.update({
            where: { id: resume.id },
            data: {
              parseStatus: "NEEDS_REVIEW",
              parseError: `Name mismatch: Resume shows "${extract.personal.fullName}" but candidate is "${resume.candidate.fullName}". This may be the wrong resume.`,
              parsedAt: new Date(),
              parsedJson: {
                ...extract,
                warning: 'NAME_MISMATCH',
                extractedName: extract.personal.fullName,
                candidateName: resume.candidate.fullName,
              },
            },
          });

          await logCandidateActivity({
            orgId,
            candidateId,
            type: "RESUME_PARSE_FAILED",
            title: "Resume needs review",
            description: `Name mismatch: parsed \"${extract.personal.fullName}\" vs candidate \"${resume.candidate.fullName}\".`,
            actorId: userId,
            metadata: { resumeId, code: "NAME_MISMATCH" },
          });

          return NextResponse.json({
            error: `Name mismatch detected. Resume shows "${extract.personal.fullName}" but candidate is "${resume.candidate.fullName}".`,
            code: 'NAME_MISMATCH',
          }, { status: 400 });
        }
      }

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
      const message = err instanceof Error ? err.message : "Parse failed";
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

      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
);

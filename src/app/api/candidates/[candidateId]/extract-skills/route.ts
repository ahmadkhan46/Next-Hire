export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { handleAPIError } from "@/lib/errors";
import { verifyResourceAccess } from "@/lib/api-middleware";

type Context = { params: Promise<{ candidateId: string }> };

function extractSkillsFromText(text: string): string[] {
  // v1 naive extraction:
  // 1) look for "Skills:" line
  // 2) split by commas
  // fallback: basic keyword scan
  const lower = text.toLowerCase();

  const skillsLineMatch = text.match(/skills\s*:\s*(.+)/i);
  if (skillsLineMatch?.[1]) {
    return skillsLineMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/\.$/, ""));
  }

  const known = ["react", "next.js", "nextjs", "postgresql", "prisma", "typescript", "javascript", "node.js", "tailwind"];
  const found = known.filter((k) => lower.includes(k));
  // normalize
  return found.map((s) => {
    if (s === "nextjs") return "Next.js";
    if (s === "node.js") return "Node.js";
    if (s === "postgresql") return "PostgreSQL";
    return s[0].toUpperCase() + s.slice(1);
  });
}

export async function POST(_req: Request, context: Context) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { candidateId } = await context.params;

    // SECURITY: Verify user has access to this candidate's org
    await verifyResourceAccess(userId, candidateId);

    // 1) Load candidate (to get orgId)
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { id: true, orgId: true },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // 2) Load latest resume
    const latestResume = await prisma.resume.findFirst({
      where: { candidateId },
      orderBy: { createdAt: "desc" },
      select: { id: true, rawText: true },
    });

    if (!latestResume?.rawText) {
      return NextResponse.json(
        { error: "No resume rawText found for candidate" },
        { status: 400 }
      );
    }

    // 3) Extract skills
    const extracted = extractSkillsFromText(latestResume.rawText)
      .map((s) => s.trim())
      .filter(Boolean);

    if (extracted.length === 0) {
      return NextResponse.json({ ok: true, extracted: [], linked: 0 });
    }

    // 4) Upsert skills + link to candidate
    const result = await prisma.$transaction(async (tx) => {
      let linked = 0;

      for (const name of extracted) {
        const skill = await tx.skill.upsert({
          where: { orgId_name: { orgId: candidate.orgId, name } },
          update: {},
          create: { orgId: candidate.orgId, name },
        });

        await tx.candidateSkill.upsert({
          where: { candidateId_skillId: { candidateId, skillId: skill.id } },
          update: {},
          create: { candidateId, skillId: skill.id, source: "resume" },
        });

        linked += 1;
      }

      return { linked };
    });

    return NextResponse.json({
      ok: true,
      resumeId: latestResume.id,
      extracted,
      linked: result.linked,
    });
  } catch (err: any) {
    const handled = handleAPIError(err);
    return NextResponse.json({ error: handled.error, code: handled.code }, { status: handled.statusCode });
  }
}

import { NextResponse } from "next/server";
import { createProtectedRoute } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { findSimilarCandidates } from "@/lib/semantic-search";

function toPositiveInt(input: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export const GET = createProtectedRoute(
  "candidates:read",
  async (req, { params }) => {
    const { orgId, candidateId } = await params;
    const limit = toPositiveInt(req.nextUrl.searchParams.get("limit"), 8, 1, 20);

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, orgId },
      select: { id: true },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    let semantic: Array<{
      id: string;
      similarity: number;
      data: { fullName?: string; email?: string; currentTitle?: string; overlapCount?: number };
    }> = [];
    try {
      semantic = await findSimilarCandidates(candidateId, orgId, limit);
    } catch {
      semantic = [];
    }

    const seen = new Set(semantic.map((s) => s.id));

    const sourceSkills = await prisma.candidateSkill.findMany({
      where: { candidateId },
      select: { skillId: true, skill: { select: { name: true } } },
    });
    const skillIds = sourceSkills.map((s) => s.skillId);
    const sourceSkillNames = new Set(sourceSkills.map((s) => s.skill.name.toLowerCase()));

    const overlap =
      skillIds.length === 0
        ? []
        : await prisma.candidate.findMany({
            where: {
              orgId,
              id: { not: candidateId },
              skills: { some: { skillId: { in: skillIds } } },
            },
            take: Math.max(12, limit * 2),
            select: {
              id: true,
              fullName: true,
              email: true,
              currentTitle: true,
              skills: {
                where: { skillId: { in: skillIds } },
                select: { skillId: true },
              },
            },
            orderBy: { updatedAt: "desc" },
          });

    const overlapMapped = overlap
      .filter((c) => !seen.has(c.id))
      .map((c) => ({
        id: c.id,
        similarity: Math.min(0.95, c.skills.length / Math.max(skillIds.length, 1)),
        data: {
          fullName: c.fullName,
          email: c.email,
          currentTitle: c.currentTitle,
          overlapCount: c.skills.length,
        },
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    const merged = [...semantic, ...overlapMapped]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    const candidateIds = merged.map((item) => item.id);
    if (candidateIds.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const [profiles, topMatchAggregate] = await Promise.all([
      prisma.candidate.findMany({
        where: { orgId, id: { in: candidateIds } },
        select: {
          id: true,
          fullName: true,
          email: true,
          currentTitle: true,
          yearsOfExperience: true,
          skills: {
            select: {
              skill: { select: { name: true } },
            },
          },
        },
      }),
      prisma.matchResult.groupBy({
        by: ["candidateId"],
        where: { orgId, candidateId: { in: candidateIds } },
        _max: { score: true },
      }),
    ]);

    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const topMatchById = new Map(
      topMatchAggregate.map((row) => [row.candidateId, Math.round((row._max.score ?? 0) * 100)])
    );

    const results = merged.map((item) => {
      const profile = profileById.get(item.id);
      const sharedSkills =
        profile?.skills
          .map((entry) => entry.skill.name)
          .filter((name) => sourceSkillNames.has(name.toLowerCase()))
          .slice(0, 12) ?? [];

      return {
        id: item.id,
        fullName: profile?.fullName ?? item.data?.fullName ?? "Unknown candidate",
        email: profile?.email ?? item.data?.email ?? null,
        currentTitle: profile?.currentTitle ?? item.data?.currentTitle ?? null,
        yearsOfExperience: profile?.yearsOfExperience ?? null,
        scorePercent: Math.round((item.similarity ?? 0) * 100),
        overlapCount: item.data?.overlapCount ?? sharedSkills.length,
        sharedSkills,
        topMatchPercent: topMatchById.get(item.id) ?? null,
        source: item.data?.overlapCount != null ? "skills" : "semantic",
      };
    });

    return NextResponse.json({ results });
  }
);

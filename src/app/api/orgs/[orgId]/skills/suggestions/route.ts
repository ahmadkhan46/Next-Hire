export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRoute } from "@/lib/api-middleware";
import { categorizeSkill, searchSkills } from "@/lib/skills-taxonomy";
import { mergeSkillCategory } from "@/lib/skill-category-merge";

export const GET = createRoute<{ orgId: string }>(
  {
    requireAuth: true,
    requireOrg: true,
    permission: "jobs:read",
    rateLimit: { type: "api" },
  },
  async (req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ error: "Organization context missing" }, { status: 400 });
    }

    const query = req.nextUrl.searchParams.get("query")?.trim() ?? "";
    const limit = Math.max(
      1,
      Math.min(25, Number(req.nextUrl.searchParams.get("limit") ?? 10))
    );

    if (!query) {
      return NextResponse.json({ ok: true, suggestions: [] });
    }

    const [orgSkills, taxonomySkills] = await Promise.all([
      prisma.skill.findMany({
        where: {
          orgId,
          name: { contains: query, mode: "insensitive" },
        },
        select: { name: true },
        orderBy: { name: "asc" },
        take: limit * 2,
      }),
      Promise.resolve(searchSkills(query).slice(0, limit * 3)),
    ]);

    const merged = new Map<
      string,
      { name: string; category: string; source: "org" | "taxonomy" }
    >();

    for (const skill of orgSkills) {
      const key = skill.name.toLowerCase();
      if (merged.has(key)) continue;
      merged.set(key, {
        name: skill.name,
        category: mergeSkillCategory(categorizeSkill(skill.name)),
        source: "org",
      });
    }

    for (const skill of taxonomySkills) {
      const key = skill.skill.toLowerCase();
      if (merged.has(key)) continue;
      merged.set(key, {
        name: skill.skill,
        category: mergeSkillCategory(skill.category),
        source: "taxonomy",
      });
    }

    const suggestions = Array.from(merged.values()).slice(0, limit);

    return NextResponse.json({ ok: true, suggestions });
  }
);

import { prisma } from "@/lib/prisma";
import { SKILLS_TAXONOMY } from "@/lib/skills-taxonomy";
import type { Prisma } from "@prisma/client";

export type GeneratedJobSkill = {
  name: string;
  weight: number;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

function normalize(value: string) {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countWordMatches(haystack: string, needle: string): number {
  if (!needle) return 0;
  const escaped = escapeRegex(needle);
  // For skills with only word chars, use \b boundaries.
  // For skills with special chars (C++, C#, .NET, ASP.NET), use lookahead/lookbehind
  // to ensure the match isn't embedded in a longer word-char sequence.
  const hasOnlyWordChars = /^\w+$/.test(needle);
  const pattern = hasOnlyWordChars
    ? `\\b${escaped}\\b`
    : `(?<![\\w])${escaped}(?![\\w])`;
  const regex = new RegExp(pattern, "g");
  const matches = haystack.match(regex);
  return matches ? matches.length : 0;
}

// Terms too generic to be meaningful as standalone extracted skills.
// These words appear in almost every JD and dilute the signal.
const GENERIC_SKILL_DENYLIST = new Set([
  "ai", "ml", "it", "qa", "hr", "bi", "ui", "ux", "api", "sdk",
  "audit", "compliance", "monitoring", "logging", "sales", "marketing",
]);

const MUST_HAVE_HINTS = [
  "must",
  "must-have",
  "required",
  "requirement",
  "minimum",
  "essential",
  "mandatory",
  "critical",
];

const NICE_TO_HAVE_HINTS = ["nice to have", "preferred", "bonus", "plus", "good to have"];

const TAXONOMY_SKILLS = Array.from(
  new Set(
    Object.values(SKILLS_TAXONOMY)
      .flat()
      .map((skill) => String(skill).trim())
      .filter(Boolean)
  )
);

function containsAny(haystack: string, terms: string[]) {
  return terms.some((term) => {
    const escaped = escapeRegex(term);
    return new RegExp(`(?<![\\w])${escaped}(?![\\w])`, "i").test(haystack);
  });
}

export function suggestJobSkillsFromDescription(
  description: string,
  opts?: { maxSkills?: number }
): GeneratedJobSkill[] {
  const maxSkills = Math.max(5, Math.min(30, opts?.maxSkills ?? 15));
  const normalized = normalize(description);
  if (!normalized) return [];

  const scored: Array<GeneratedJobSkill & { score: number; frequency: number }> = [];

  for (const skill of TAXONOMY_SKILLS) {
    const normalizedSkill = normalize(skill);
    if (!normalizedSkill || normalizedSkill.length < 2) continue;
    if (GENERIC_SKILL_DENYLIST.has(normalizedSkill)) continue;

    const frequency = countWordMatches(normalized, normalizedSkill);
    if (frequency === 0) continue;

    let score = frequency;
    let weight = 3;

    const firstIdx = normalized.search(new RegExp(escapeRegex(normalizedSkill)));
    const context = firstIdx >= 0
      ? normalized.slice(Math.max(0, firstIdx - 80), firstIdx + normalizedSkill.length + 80)
      : "";

    if (containsAny(context, MUST_HAVE_HINTS)) {
      weight = 5;
      score += 3;
    } else if (containsAny(context, NICE_TO_HAVE_HINTS)) {
      weight = 2;
    } else if (frequency >= 2) {
      weight = 4;
      score += 1;
    }

    scored.push({
      name: skill,
      weight,
      score,
      frequency,
    });
  }

  scored.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    if (b.score !== a.score) return b.score - a.score;
    if (b.frequency !== a.frequency) return b.frequency - a.frequency;
    return a.name.localeCompare(b.name);
  });

  return scored.slice(0, maxSkills).map((item) => ({
    name: item.name,
    weight: Math.max(1, Math.min(5, item.weight)),
  }));
}

export async function persistJobSkills(
  db: DbClient,
  orgId: string,
  jobId: string,
  generatedSkills: GeneratedJobSkill[]
) {
  for (const item of generatedSkills) {
    const name = item.name.trim();
    if (!name) continue;
    const weight = Math.max(1, Math.min(5, Math.round(item.weight)));

    const skill = await db.skill.upsert({
      where: { orgId_name: { orgId, name } },
      create: { orgId, name },
      update: {},
      select: { id: true },
    });

    await db.jobSkill.upsert({
      where: { jobId_skillId: { jobId, skillId: skill.id } },
      create: { jobId, skillId: skill.id, weight },
      update: { weight },
    });
  }
}

async function getJobSkillsSnapshot(db: DbClient, jobId: string) {
  const rows = await db.jobSkill.findMany({
    where: { jobId },
    include: { skill: true },
    orderBy: [{ weight: "desc" }, { createdAt: "asc" }],
  });

  return rows.map((row) => ({
    name: row.skill.name,
    weight: Math.max(1, Math.min(5, row.weight ?? 1)),
  }));
}

export async function autoGenerateAndPersistJobSkills(input: {
  orgId: string;
  jobId: string;
  description: string | null | undefined;
  onlyWhenEmpty?: boolean;
  maxSkills?: number;
  source?: "AUTO_CREATE" | "AUTO_UPDATE" | "MANUAL";
  triggeredBy?: string;
  createAudit?: boolean;
}) {
  const { orgId, jobId, description } = input;
  const text = String(description ?? "").trim();
  if (!text) return { generated: 0, skills: [] as GeneratedJobSkill[] };

  const beforeSnapshot = await getJobSkillsSnapshot(prisma, jobId);

  if (input.onlyWhenEmpty) {
    if (beforeSnapshot.length > 0) return { generated: 0, skills: [] as GeneratedJobSkill[] };
  }

  const skills = suggestJobSkillsFromDescription(text, { maxSkills: input.maxSkills ?? 15 });
  const shouldAudit = input.createAudit !== false;

  await prisma.$transaction(async (tx) => {
    if (skills.length > 0) {
      await persistJobSkills(tx, orgId, jobId, skills);
    }

    if (shouldAudit) {
      const afterSnapshot = await getJobSkillsSnapshot(tx, jobId);
      await tx.jobSkillGenerationAudit.create({
        data: {
          orgId,
          jobId,
          triggeredBy: input.triggeredBy ?? null,
          source: input.source ?? "MANUAL",
          onlyWhenEmpty: Boolean(input.onlyWhenEmpty),
          maxSkills: input.maxSkills ?? 15,
          generatedCount: skills.length,
          beforeSkills: beforeSnapshot as unknown as Prisma.InputJsonValue,
          afterSkills: afterSnapshot as unknown as Prisma.InputJsonValue,
          generatedSkills: skills as unknown as Prisma.InputJsonValue,
        },
      });
    }
  });

  return { generated: skills.length, skills };
}

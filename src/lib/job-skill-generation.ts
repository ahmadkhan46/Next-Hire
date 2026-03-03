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

function countOccurrences(haystack: string, needle: string) {
  if (!needle) return 0;
  let count = 0;
  let start = 0;
  while (true) {
    const idx = haystack.indexOf(needle, start);
    if (idx === -1) break;
    count += 1;
    start = idx + needle.length;
  }
  return count;
}

function containsAny(haystack: string, terms: string[]) {
  return terms.some((term) => haystack.includes(term));
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

    const frequency = countOccurrences(normalized, normalizedSkill);
    if (frequency === 0) continue;

    let score = frequency;
    let weight = 3;

    const firstIdx = normalized.indexOf(normalizedSkill);
    const context = normalized.slice(Math.max(0, firstIdx - 80), firstIdx + normalizedSkill.length + 80);

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

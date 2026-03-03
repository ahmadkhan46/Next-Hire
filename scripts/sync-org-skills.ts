import { PrismaClient } from "@prisma/client";
import { SKILLS_TAXONOMY } from "../src/lib/skills-taxonomy";

const prisma = new PrismaClient();

function taxonomyList() {
  const map = new Map<string, string>();
  for (const skills of Object.values(SKILLS_TAXONOMY)) {
    for (const raw of skills) {
      const name = String(raw).trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!map.has(key)) map.set(key, name);
    }
  }
  return Array.from(map.values());
}

async function main() {
  const taxonomy = taxonomyList();
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true },
  });

  if (orgs.length === 0) {
    console.log("No organizations found.");
    return;
  }

  for (const org of orgs) {
    const existing = await prisma.skill.findMany({
      where: { orgId: org.id },
      select: { name: true },
    });

    const existingLower = new Set(existing.map((s) => s.name.trim().toLowerCase()));
    const missing = taxonomy.filter((name) => !existingLower.has(name.toLowerCase()));

    if (missing.length > 0) {
      await prisma.skill.createMany({
        data: missing.map((name) => ({ orgId: org.id, name })),
        skipDuplicates: true,
      });
    }

    const total = await prisma.skill.count({ where: { orgId: org.id } });
    console.log(`${org.name} (${org.id}) -> added=${missing.length}, total=${total}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

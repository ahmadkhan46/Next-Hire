import { PrismaClient } from "@prisma/client";
import { clerkClient } from "@clerk/nextjs/server";

const prisma = new PrismaClient();

function nameFromEmail(email: string | null) {
  if (!email) return null;
  const local = email.split("@")[0]?.trim();
  if (!local) return null;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

async function main() {
  const rows = await prisma.jobPageAuditEvent.findMany({
    where: { actorId: { not: null } },
    distinct: ["actorId"],
    select: { actorId: true },
  });

  const actorIds = rows
    .map((row) => row.actorId)
    .filter((value): value is string => Boolean(value));

  console.log(`Found ${actorIds.length} distinct actor IDs in job audit events.`);
  if (actorIds.length === 0) return;

  const client = await clerkClient();

  let updated = 0;
  let skipped = 0;

  for (const actorId of actorIds) {
    try {
      const clerkUser = await client.users.getUser(actorId);
      const email =
        clerkUser.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId)
          ?.emailAddress ?? clerkUser.emailAddresses?.[0]?.emailAddress ?? null;
      const fullName = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim();
      const name = fullName || clerkUser.username || nameFromEmail(email) || actorId;

      await prisma.user.upsert({
        where: { id: actorId },
        update: {
          ...(name ? { name } : {}),
          ...(email ? { email: email.toLowerCase() } : {}),
        },
        create: {
          id: actorId,
          email: (email ?? `${actorId}@placeholder.local`).toLowerCase(),
          name,
        },
      });
      updated += 1;
    } catch {
      skipped += 1;
    }
  }

  console.log(`Backfill done. Updated: ${updated}, skipped: ${skipped}.`);
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

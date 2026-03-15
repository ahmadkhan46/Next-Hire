import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CliOptions = {
  orgId: string | null;
  all: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  let orgId: string | null = null;
  let all = false;

  for (const arg of argv) {
    if (arg === "--all") {
      all = true;
      continue;
    }

    if (!arg.startsWith("--") && !orgId) {
      orgId = arg;
    }
  }

  return { orgId, all };
}

function printUsage() {
  console.error("Usage:");
  console.error("  npx tsx scripts/clear-upload-history.ts <orgId>");
  console.error("  npx tsx scripts/clear-upload-history.ts --all");
}

async function clearForOrg(orgId: string) {
  const batches = await prisma.resumeUploadBatch.findMany({
    where: { orgId },
    select: { id: true },
  });

  const batchIds = batches.map((batch) => batch.id);

  if (batchIds.length === 0) {
    console.log(JSON.stringify({ orgId, deletedItems: 0, deletedBatches: 0 }, null, 2));
    return;
  }

  const deletedItems = await prisma.resumeUploadItem.deleteMany({
    where: { batchId: { in: batchIds } },
  });

  const deletedBatches = await prisma.resumeUploadBatch.deleteMany({
    where: { orgId },
  });

  console.log(
    JSON.stringify(
      {
        orgId,
        deletedItems: deletedItems.count,
        deletedBatches: deletedBatches.count,
      },
      null,
      2
    )
  );
}

async function clearAll() {
  const deletedItems = await prisma.resumeUploadItem.deleteMany({});
  const deletedBatches = await prisma.resumeUploadBatch.deleteMany({});

  console.log(
    JSON.stringify(
      {
        scope: "all",
        deletedItems: deletedItems.count,
        deletedBatches: deletedBatches.count,
      },
      null,
      2
    )
  );
}

async function main() {
  const { orgId, all } = parseArgs(process.argv.slice(2));

  if (all) {
    await clearAll();
    return;
  }

  if (!orgId) {
    printUsage();
    process.exit(1);
  }

  await clearForOrg(orgId);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

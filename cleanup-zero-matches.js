const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupZeroMatches() {
  console.log('Cleaning up all 0% matches...');

  // Delete all matches with 0 score
  const deleted = await prisma.matchResult.deleteMany({
    where: {
      score: 0
    }
  });

  console.log(`Deleted ${deleted.count} matches with 0% score`);
  console.log('Cleanup complete!');
}

cleanupZeroMatches()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

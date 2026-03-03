const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  console.log("Prisma client ok");
  await prisma.$disconnect();
}

main().catch(console.error);
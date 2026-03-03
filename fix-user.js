const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixUser() {
  const clerkId = 'user_39IG2D1Q6ApM1jvgKUaZCZgaVgu';
  const email = 'ahmadkhan58012@gmail.com';
  const orgId = 'cmlbmr0520001ecb82yamw366';

  // Find existing user by email
  let user = await prisma.user.findUnique({ where: { email } });
  
  if (user && user.id !== clerkId) {
    console.log('Found user with different ID:', user.id);
    // Delete old user and memberships
    await prisma.membership.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    console.log('Deleted old user');
  }

  // Create user with correct Clerk ID
  user = await prisma.user.upsert({
    where: { id: clerkId },
    create: { id: clerkId, email, name: 'Ahmad Khan' },
    update: {},
  });
  console.log('User created:', user);

  // Create membership
  const membership = await prisma.membership.upsert({
    where: { userId_orgId: { userId: clerkId, orgId } },
    create: { userId: clerkId, orgId, role: 'OWNER' },
    update: {},
  });
  console.log('Membership created:', membership);

  await prisma.$disconnect();
}

fixUser().catch(console.error);

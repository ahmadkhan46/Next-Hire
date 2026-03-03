import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

// SECURITY: Only allow in development
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { org: true },
  });

  const allUsers = await prisma.user.findMany({
    select: { id: true, email: true },
    take: 10,
  });

  return NextResponse.json({
    clerkUserId: userId,
    dbUser,
    memberships,
    allUsers,
  });
}

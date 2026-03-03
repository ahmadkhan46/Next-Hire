import { prisma } from './prisma';
import { clerkClient } from '@clerk/nextjs/server';

// Ensure user exists in database and has org membership
export async function ensureUserAndMembership(
  clerkUserId: string,
  email?: string
): Promise<{ userId: string; orgId: string }> {
  // Get user email from Clerk if not provided
  if (!email) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(clerkUserId);
      email = clerkUser.emailAddresses?.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      )?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress;
    } catch (error) {
      console.error('Failed to get Clerk user:', error);
    }
  }

  if (!email) {
    throw new Error('No email found for user');
  }

  // Find or create user in database
  let dbUser = await prisma.user.findFirst({
    where: {
      OR: [
        { id: clerkUserId },
        { email: email.toLowerCase() },
      ],
    },
  });

  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        id: clerkUserId,
        email: email.toLowerCase(),
        name: email.split('@')[0],
      },
    });
  }

  // Find or create membership
  let membership = await prisma.membership.findFirst({
    where: { userId: dbUser.id },
  });

  if (!membership) {
    // Find or create default org
    let org = await prisma.organization.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: 'Default Organization',
        },
      });
    }

    // Create membership
    membership = await prisma.membership.create({
      data: {
        userId: dbUser.id,
        orgId: org.id,
        role: 'OWNER', // First user is owner
      },
    });
  }

  return {
    userId: dbUser.id,
    orgId: membership.orgId,
  };
}


import { NextResponse } from 'next/server';
import { createRoute } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

export const POST = createRoute(
  {
    requireAuth: true,
    requireOrg: true,
  },
  async (req, { orgId, userId }) => {
    await prisma.notification.updateMany({
      where: {
        orgId: orgId!,
        OR: [
          { userId: userId! },
          { userId: null },
        ],
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  }
);

import { NextResponse } from 'next/server';
import { createRoute } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

export const GET = createRoute(
  {
    requireAuth: true,
    requireOrg: true,
  },
  async (req, { orgId, userId }) => {
    const notifications = await prisma.notification.findMany({
      where: {
        orgId: orgId!,
        OR: [
          { userId: userId! },
          { userId: null }, // Org-wide notifications
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        orgId: orgId!,
        OR: [
          { userId: userId! },
          { userId: null },
        ],
        read: false,
      },
    });

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  }
);

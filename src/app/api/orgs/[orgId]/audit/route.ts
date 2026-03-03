import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { Prisma } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { orgId } = await params;
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const candidateId = searchParams.get('candidateId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const where: any = { orgId };

    if (jobId) where.jobId = jobId;
    if (candidateId) where.candidateId = candidateId;
    if (startDate) where.createdAt = { gte: new Date(startDate) };
    if (endDate) {
      where.createdAt = where.createdAt || {};
      where.createdAt.lte = new Date(endDate);
    }

    const [auditLogs, totalCount] = await Promise.all([
      prisma.matchDecisionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          fromStatus: true,
          toStatus: true,
          note: true,
          decidedBy: true,
          job: {
            select: {
              id: true,
              title: true,
              location: true
            }
          },
          candidate: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        },
      }),
      prisma.matchDecisionLog.count({ where })
    ]);

    // Generate audit summary
    const summary = await generateAuditSummary(orgId, jobId, startDate, endDate);

    return NextResponse.json({
      auditLogs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1,
      },
      summary,
      filters: {
        orgId,
        jobId,
        candidateId,
        startDate,
        endDate,
      },
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Audit trail error:', error);
    return NextResponse.json({ error: 'Audit trail failed' }, { status: 500 });
  }
}

async function generateAuditSummary(
  orgId: string,
  jobId?: string | null,
  startDate?: string | null,
  endDate?: string | null
) {
  const where: any = { orgId };
  if (jobId) where.jobId = jobId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [
    totalDecisions,
    decisionsByStatus,
    decisionsByUser,
    automatedDecisions,
    averageDecisionTime
  ] = await Promise.all([
    prisma.matchDecisionLog.count({ where }),

    prisma.matchDecisionLog.groupBy({
      by: ['toStatus'],
      where,
      _count: { toStatus: true },
    }),

    prisma.matchDecisionLog.groupBy({
      by: ['decidedBy'],
      where,
      _count: { decidedBy: true },
    }),

    prisma.matchDecisionLog.count({
      where: {
        ...where,
        note: { contains: 'Automated:' }
      }
    }),

    // Calculate average time between candidate creation and first decision
    prisma.$queryRaw<
      Array<{ avg_hours: number | string | null }>
    >(
      Prisma.sql`
        SELECT AVG(EXTRACT(EPOCH FROM (mdl."createdAt" - c."createdAt")) / 3600) as avg_hours
        FROM "MatchDecisionLog" mdl
        JOIN "Candidate" c ON mdl."candidateId" = c.id
        WHERE mdl."orgId" = ${orgId}
        ${jobId ? Prisma.sql`AND mdl."jobId" = ${jobId}` : Prisma.empty}
        AND mdl."fromStatus" = 'NONE'
      `
    )
  ]);

  const avgRaw = averageDecisionTime?.[0]?.avg_hours;
  const averageDecisionTimeHours =
    avgRaw === null || avgRaw === undefined
      ? null
      : Math.round(Number(avgRaw) * 10) / 10;

  return {
    totalDecisions,
    automatedDecisions,
    manualDecisions: totalDecisions - automatedDecisions,
    automationRate: totalDecisions > 0 ? Math.round((automatedDecisions / totalDecisions) * 100) : 0,
    decisionsByStatus: decisionsByStatus.reduce((acc, item) => {
      acc[item.toStatus.toLowerCase()] = item._count.toStatus;
      return acc;
    }, {} as Record<string, number>),
    decisionsByUser: decisionsByUser.map(item => ({
      user: item.decidedBy || 'System',
      count: item._count.decidedBy
    })),
    averageDecisionTimeHours,
  };
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { auth } from '@clerk/nextjs/server';

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

    // Base filters
    const baseFilter = { orgId };
    const jobFilter = jobId ? { ...baseFilter, jobId } : baseFilter;

    // Pipeline metrics
    const [
      totalCandidates,
      totalJobs,
      statusBreakdown,
      recentActivity,
      topSkillsGaps
    ] = await Promise.all([
      // Total candidates
      prisma.candidate.count({ where: baseFilter }),

      // Active jobs
      prisma.job.count({ where: { ...baseFilter, status: 'OPEN' } }),

      // Status breakdown
      prisma.matchResult.groupBy({
        by: ['status'],
        where: jobFilter,
        _count: { status: true },
      }),

      // Recent decisions (last 7 days)
      prisma.matchDecisionLog.count({
        where: {
          ...jobFilter,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      }),

      // Top missing skills
      prisma.$queryRaw(
        Prisma.sql`
        SELECT skill_name, COUNT(*) as gap_count
        FROM (
          SELECT DISTINCT mr.id, jsonb_array_elements_text(mr.missing) as skill_name
          FROM "MatchResult" mr
          WHERE mr."orgId" = ${orgId}
          ${jobId ? Prisma.sql`AND mr."jobId" = ${jobId}` : Prisma.empty}
        ) skills
        GROUP BY skill_name
        ORDER BY gap_count DESC
        LIMIT 10
      `
      )
    ]);

    // Calculate conversion rates
    const statusCounts = statusBreakdown.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {} as Record<string, number>);

    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    const shortlistRate = total > 0 ? ((statusCounts.SHORTLISTED || 0) / total * 100) : 0;

    return NextResponse.json({
      overview: {
        totalCandidates,
        totalJobs,
        recentActivity,
        shortlistRate: Math.round(shortlistRate * 10) / 10,
      },
      pipeline: {
        none: statusCounts.NONE || 0,
        shortlisted: statusCounts.SHORTLISTED || 0,
        rejected: statusCounts.REJECTED || 0,
      },
      skillsGaps: topSkillsGaps,
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Analytics failed' }, { status: 500 });
  }
}

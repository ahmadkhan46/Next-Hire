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
    const type = searchParams.get('type') || 'decisions';
    const jobId = searchParams.get('jobId');
    const format = searchParams.get('format') || 'json';

    const baseFilter = { orgId };
    const jobFilter = jobId ? { ...baseFilter, jobId } : baseFilter;

    let data: any = {};

    switch (type) {
      case 'decisions':
        data = await exportDecisions(jobFilter);
        break;
      case 'candidates':
        data = await exportCandidates(baseFilter);
        break;
      case 'analytics':
        data = await exportAnalytics(baseFilter, jobId);
        break;
      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
    }

    if (format === 'csv') {
      const csv = convertToCSV(data, type);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${type}-${orgId}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({
      exportType: type,
      orgId,
      jobId,
      exportedAt: new Date().toISOString(),
      recordCount: Array.isArray(data) ? data.length : Object.keys(data).length,
      data,
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

async function exportDecisions(filter: any) {
  return await prisma.matchDecisionLog.findMany({
    where: filter,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      fromStatus: true,
      toStatus: true,
      note: true,
      decidedBy: true,
      job: {
        select: { title: true, id: true }
      },
      candidate: {
        select: { fullName: true, email: true, id: true }
      }
    },
  });
}

async function exportCandidates(filter: any) {
  return await prisma.candidate.findMany({
    where: filter,
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      createdAt: true,
      skills: {
        select: {
          skill: { select: { name: true } },
          level: true,
          source: true
        }
      },
      matches: {
        select: {
          jobId: true,
          score: true,
          status: true,
          statusUpdatedAt: true,
          job: { select: { title: true } }
        }
      }
    },
  });
}

async function exportAnalytics(filter: any, jobId?: string | null) {
  const [
    totalCandidates,
    totalJobs,
    statusBreakdown,
    decisionVelocity,
    skillsAnalysis
  ] = await Promise.all([
    prisma.candidate.count({ where: filter }),
    prisma.job.count({ where: filter }),
    prisma.matchResult.groupBy({
      by: ['status'],
      where: jobId ? { ...filter, jobId } : filter,
      _count: { status: true },
    }),
    prisma.matchDecisionLog.groupBy({
      by: ['toStatus'],
      where: {
        ...filter,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      _count: { toStatus: true },
    }),
    prisma.$queryRaw(
      Prisma.sql`
        SELECT skill_name, COUNT(*) as frequency
        FROM (
          SELECT DISTINCT mr.id, jsonb_array_elements_text(mr.missing) as skill_name
          FROM "MatchResult" mr
          WHERE mr."orgId" = ${filter.orgId}
          ${jobId ? Prisma.sql`AND mr."jobId" = ${jobId}` : Prisma.empty}
        ) skills
        GROUP BY skill_name
        ORDER BY frequency DESC
        LIMIT 20
      `
    )
  ]);

  return {
    overview: {
      totalCandidates,
      totalJobs,
      exportDate: new Date().toISOString(),
    },
    pipeline: statusBreakdown.reduce((acc, item) => {
      acc[item.status.toLowerCase()] = item._count.status;
      return acc;
    }, {} as Record<string, number>),
    recentDecisions: decisionVelocity,
    topSkillsGaps: skillsAnalysis,
  };
}

function convertToCSV(data: any, type: string): string {
  if (!Array.isArray(data)) {
    // For analytics, flatten the structure
    const rows = [];
    if (type === 'analytics') {
      rows.push(['Metric', 'Value']);
      rows.push(['Total Candidates', data.overview?.totalCandidates || 0]);
      rows.push(['Total Jobs', data.overview?.totalJobs || 0]);
      rows.push(['Shortlisted', data.pipeline?.shortlisted || 0]);
      rows.push(['Rejected', data.pipeline?.rejected || 0]);
      rows.push(['Unreviewed', data.pipeline?.none || 0]);
    }
    return rows.map(row => row.join(',')).join('\n');
  }

  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

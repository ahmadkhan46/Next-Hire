import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AnalyticsData = {
  overview: {
    totalCandidates: number;
    totalJobs: number;
    recentActivity: number;
    shortlistRate: number;
  };
  pipeline: {
    none: number;
    shortlisted: number;
    rejected: number;
  };
  skillsGaps: Array<{
    skill_name: string;
    gap_count: number;
  }>;
};

type SkillGapRow = {
  skill_name: string;
  gap_count: bigint | number | string;
};

export async function getOrgAnalytics(orgId: string, jobId?: string | null): Promise<AnalyticsData> {
  const baseFilter = { orgId };
  const jobFilter = jobId ? { ...baseFilter, jobId } : baseFilter;

  const [totalCandidates, totalJobs, statusBreakdown, recentActivity, topSkillsGaps] =
    await Promise.all([
      prisma.candidate.count({ where: baseFilter }),
      prisma.job.count({ where: { ...baseFilter, status: "OPEN" } }),
      prisma.matchResult.groupBy({
        by: ["status"],
        where: jobFilter,
        _count: { status: true },
      }),
      prisma.matchDecisionLog.count({
        where: {
          ...jobFilter,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.$queryRaw<SkillGapRow[]>(
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
      ),
    ]);

  const statusCounts = statusBreakdown.reduce((acc, item) => {
    acc[item.status] = item._count.status;
    return acc;
  }, {} as Record<string, number>);

  const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
  const shortlistRate = total > 0 ? (((statusCounts.SHORTLISTED || 0) / total) * 100) : 0;

  return {
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
    skillsGaps: topSkillsGaps.map((row) => ({
      skill_name: row.skill_name,
      gap_count: Number(row.gap_count) || 0,
    })),
  };
}

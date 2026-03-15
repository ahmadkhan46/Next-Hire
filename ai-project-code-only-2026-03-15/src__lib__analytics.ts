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

  const [totalCandidates, totalJobs, recentActivity, topSkillsGaps, orgWideStatuses, jobStatuses] =
    await Promise.all([
      prisma.candidate.count({ where: baseFilter }),
      prisma.job.count({ where: { ...baseFilter, status: "OPEN" } }),
      prisma.matchDecisionLog.count({
        where: {
          ...jobFilter,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.$queryRaw<SkillGapRow[]>(
        Prisma.sql`
          SELECT skill_name, COUNT(DISTINCT "candidateId") as gap_count
          FROM (
            SELECT DISTINCT mr."candidateId", jsonb_array_elements_text(mr.missing) as skill_name
            FROM "MatchResult" mr
            WHERE mr."orgId" = ${orgId}
            ${jobId ? Prisma.sql`AND mr."jobId" = ${jobId}` : Prisma.empty}
          ) skills
          GROUP BY skill_name
          ORDER BY gap_count DESC
          LIMIT 10
        `
      ),
      jobId
        ? Promise.resolve([])
        : prisma.matchResult.findMany({
            where: baseFilter,
            select: { candidateId: true, status: true },
          }),
      jobId
        ? prisma.matchResult.groupBy({
            by: ["status"],
            where: jobFilter,
            _count: { status: true },
          })
        : Promise.resolve([]),
    ]);

  let statusCounts: Record<string, number>;

  if (jobId) {
    statusCounts = jobStatuses.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {} as Record<string, number>);
  } else {
    const candidateStatus = new Map<string, "NONE" | "SHORTLISTED" | "REJECTED">();

    for (const row of orgWideStatuses) {
      const current = candidateStatus.get(row.candidateId);
      const next = row.status;

      if (!current) {
        candidateStatus.set(row.candidateId, next);
        continue;
      }

      // Candidate-level rollup priority:
      // SHORTLISTED wins, NONE beats REJECTED when there is still an unreviewed path.
      if (current === "SHORTLISTED" || next === "SHORTLISTED") {
        candidateStatus.set(row.candidateId, "SHORTLISTED");
      } else if (current === "NONE" || next === "NONE") {
        candidateStatus.set(row.candidateId, "NONE");
      } else {
        candidateStatus.set(row.candidateId, "REJECTED");
      }
    }

    statusCounts = { NONE: 0, SHORTLISTED: 0, REJECTED: 0 };
    for (const status of candidateStatus.values()) {
      statusCounts[status] += 1;
    }

    const classified = statusCounts.SHORTLISTED + statusCounts.REJECTED + statusCounts.NONE;
    if (classified < totalCandidates) {
      statusCounts.NONE += totalCandidates - classified;
    }
  }

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

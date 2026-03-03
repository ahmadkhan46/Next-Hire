import { prisma } from './prisma';

export interface FunnelMetrics {
  total: number;
  shortlisted: number;
  rejected: number;
  conversionRate: number;
}

export interface TimeToHireMetrics {
  averageDays: number;
  medianDays: number;
  fastest: number;
  slowest: number;
}

export interface SourceMetrics {
  source: string;
  count: number;
  shortlistedRate: number;
}

// Get recruitment funnel metrics
export async function getRecruitmentFunnel(
  orgId: string,
  jobId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<FunnelMetrics> {
  const where: any = { orgId };
  if (jobId) where.jobId = jobId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [total, shortlisted, rejected] = await Promise.all([
    prisma.matchResult.count({ where }),
    prisma.matchResult.count({ where: { ...where, status: 'SHORTLISTED' } }),
    prisma.matchResult.count({ where: { ...where, status: 'REJECTED' } }),
  ]);

  return {
    total,
    shortlisted,
    rejected,
    conversionRate: total > 0 ? (shortlisted / total) * 100 : 0,
  };
}

// Get time-to-hire metrics
export async function getTimeToHireMetrics(
  orgId: string,
  days: number = 90
): Promise<TimeToHireMetrics> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const matches = await prisma.matchResult.findMany({
    where: {
      orgId,
      status: 'SHORTLISTED',
      statusUpdatedAt: {
        gte: startDate,
      },
    },
    select: {
      createdAt: true,
      statusUpdatedAt: true,
    },
  });

  if (matches.length === 0) {
    return {
      averageDays: 0,
      medianDays: 0,
      fastest: 0,
      slowest: 0,
    };
  }

  const durations = matches
    .filter(m => m.statusUpdatedAt)
    .map(m => {
      const diff = m.statusUpdatedAt!.getTime() - m.createdAt.getTime();
      return diff / (1000 * 60 * 60 * 24); // Convert to days
    })
    .sort((a, b) => a - b);

  const sum = durations.reduce((a, b) => a + b, 0);
  const average = sum / durations.length;
  const median = durations[Math.floor(durations.length / 2)];

  return {
    averageDays: Math.round(average * 10) / 10,
    medianDays: Math.round(median * 10) / 10,
    fastest: Math.round(durations[0] * 10) / 10,
    slowest: Math.round(durations[durations.length - 1] * 10) / 10,
  };
}

// Get candidate source metrics
export async function getSourceMetrics(
  orgId: string,
  days: number = 30
): Promise<SourceMetrics[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const candidates = await prisma.candidate.findMany({
    where: {
      orgId,
      createdAt: {
        gte: startDate,
      },
    },
    select: {
      id: true,
      notes: true,
      matches: {
        select: {
          status: true,
        },
      },
    },
  });

  // Group by source (extracted from notes or default to "Direct")
  const sourceMap = new Map<string, { total: number; shortlisted: number }>();

  for (const candidate of candidates) {
    const source = extractSource(candidate.notes) || 'Direct';
    const stats = sourceMap.get(source) || { total: 0, shortlisted: 0 };

    stats.total++;
    if (candidate.matches.some(m => m.status === 'SHORTLISTED')) {
      stats.shortlisted++;
    }

    sourceMap.set(source, stats);
  }

  return Array.from(sourceMap.entries())
    .map(([source, stats]) => ({
      source,
      count: stats.total,
      shortlistedRate: (stats.shortlisted / stats.total) * 100,
    }))
    .sort((a, b) => b.count - a.count);
}

// Extract source from notes
function extractSource(notes: string | null): string | null {
  if (!notes) return null;

  const sources = ['LinkedIn', 'Indeed', 'Referral', 'Website', 'Agency'];
  const notesLower = notes.toLowerCase();

  for (const source of sources) {
    if (notesLower.includes(source.toLowerCase())) {
      return source;
    }
  }

  return null;
}

// Get diversity metrics
export async function getDiversityMetrics(orgId: string) {
  void orgId;
  // This would require additional fields in the schema
  // For now, return placeholder
  return {
    message: 'Diversity tracking requires additional candidate fields',
    recommendation: 'Add optional demographic fields with proper consent',
  };
}

// Get top skills in demand
export async function getTopSkills(orgId: string, limit: number = 10) {
  const skills = await prisma.$queryRaw<Array<{
    name: string;
    job_count: number;
    candidate_count: number;
  }>>`
    SELECT 
      s.name,
      COUNT(DISTINCT js.job_id)::int as job_count,
      COUNT(DISTINCT cs.candidate_id)::int as candidate_count
    FROM "Skill" s
    LEFT JOIN "JobSkill" js ON js.skill_id = s.id
    LEFT JOIN "CandidateSkill" cs ON cs.skill_id = s.id
    WHERE s.org_id = ${orgId}
    GROUP BY s.id, s.name
    ORDER BY job_count DESC, candidate_count DESC
    LIMIT ${limit}
  `;

  return skills;
}

// Get hiring velocity (candidates per week)
export async function getHiringVelocity(orgId: string, weeks: number = 12) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - weeks * 7);

  const candidates = await prisma.candidate.groupBy({
    by: ['createdAt'],
    where: {
      orgId,
      createdAt: {
        gte: startDate,
      },
    },
    _count: true,
  });

  // Group by week
  const weeklyData = new Map<string, number>();

  for (const candidate of candidates) {
    const weekStart = new Date(candidate.createdAt);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];

    weeklyData.set(weekKey, (weeklyData.get(weekKey) || 0) + candidate._count);
  }

  return Array.from(weeklyData.entries())
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

import { prisma } from './prisma';
import { MatchStatus } from '@prisma/client';
import { logger } from './logger';

const MATCH_CANDIDATES_LIMIT = Math.max(
  1,
  Number(process.env.MATCH_CANDIDATES_LIMIT ?? 500) || 500
);

type MatchComputation = {
  candidateId: string;
  fullName: string;
  email: string | null;
  score: number;
  matchedWeight: number;
  totalWeight: number;
  matched: string[];
  missing: string[];
  missingCritical: string[];
  experienceScore: number | null;
  status: MatchStatus;
  statusUpdatedAt: Date | null;
  statusUpdatedBy: string | null;
};

async function getJobRequirements(jobId: string) {
  const [jobSkills, job] = await Promise.all([
    prisma.jobSkill.findMany({
      where: { jobId },
      include: { skill: true },
    }),
    prisma.job.findUnique({
      where: { id: jobId },
      select: { requiredYearsOfExperience: true },
    }),
  ]);

  return {
    skills: jobSkills.map((js) => ({
      name: js.skill.name,
      weight: js.weight ?? 1,
    })),
    requiredYearsOfExperience: job?.requiredYearsOfExperience ?? null,
  };
}

/**
 * Scoring formula:
 *
 * When job has NO experience requirement:
 *   score = skillScore * 0.80 + projectScore * 0.20
 *
 * When job HAS experience requirement:
 *   – Hard filter: candidate years KNOWN and < required → score = 0 (disqualified)
 *   – Unknown years (null) → neutral, treated as meeting requirement
 *   – Qualified → score = expBonus * 0.40 + skillScore * 0.40 + projectScore * 0.20
 *     where expBonus rewards years beyond the minimum (up to +5 above req = full bonus)
 *
 * Projects: min(projectCount / 5, 1.0)  — 5+ projects = full project score
 */
function computeCandidateMatch(
  candidate: {
    id: string;
    fullName: string;
    email: string | null;
    yearsOfExperience: number | null;
    projectCount: number;
    skills: Array<{ skill: { name: string } }>;
  },
  required: Array<{ name: string; weight: number }>,
  requiredYearsOfExperience: number | null,
  preserved?: {
    status: MatchStatus;
    statusUpdatedAt: Date | null;
    statusUpdatedBy: string | null;
  }
): MatchComputation {
  const candidateSkills = candidate.skills.map((cs) => cs.skill.name);
  const candidateSet = new Set(candidateSkills);
  const totalWeight = required.reduce((sum, r) => sum + r.weight, 0);

  const matchedReq = required.filter((r) => candidateSet.has(r.name));
  const missingReq = required.filter((r) => !candidateSet.has(r.name));
  const matchedWeight = matchedReq.reduce((sum, r) => sum + r.weight, 0);
  const skillScore = totalWeight === 0 ? 0 : matchedWeight / totalWeight;

  const projectScore = Math.min(candidate.projectCount / 5, 1.0);

  let experienceScore: number | null = null;
  let score: number;

  if (requiredYearsOfExperience === null) {
    // No requirement — skills + projects only
    score = skillScore * 0.8 + projectScore * 0.2;
  } else {
    const candidateYears = candidate.yearsOfExperience;

    // Hard disqualification: known years below minimum
    if (candidateYears !== null && candidateYears < requiredYearsOfExperience) {
      experienceScore = 0;
      score = 0;
    } else {
      // Qualified (or unknown years — neutral)
      if (candidateYears === null) {
        experienceScore = 0.5; // unknown — neutral
      } else {
        // Reward years beyond the minimum; full bonus at req + 5 years
        experienceScore = Math.min(
          candidateYears / (requiredYearsOfExperience + 5),
          1.0
        );
      }
      score = experienceScore * 0.4 + skillScore * 0.4 + projectScore * 0.2;
    }
  }

  return {
    candidateId: candidate.id,
    fullName: candidate.fullName,
    email: candidate.email,
    score,
    matchedWeight,
    totalWeight,
    matched: matchedReq.map((r) => r.name),
    missing: missingReq.map((r) => r.name),
    missingCritical: missingReq.filter((r) => r.weight >= 4).map((r) => r.name),
    experienceScore,
    status: preserved?.status ?? MatchStatus.NONE,
    statusUpdatedAt: preserved?.statusUpdatedAt ?? null,
    statusUpdatedBy: preserved?.statusUpdatedBy ?? null,
  };
}

export async function recalculateJobMatches(jobId: string, orgId: string) {
  const { skills: required, requiredYearsOfExperience } = await getJobRequirements(jobId);

  if (required.length === 0) {
    await prisma.matchResult.deleteMany({ where: { jobId, orgId } });
    return {
      required,
      matches: [] as MatchComputation[],
      candidatesConsidered: 0,
    };
  }

  const [candidates, existing] = await Promise.all([
    prisma.candidate.findMany({
      where: { orgId },
      select: {
        id: true,
        fullName: true,
        email: true,
        yearsOfExperience: true,
        skills: { include: { skill: true } },
        _count: { select: { projects: true } },
      },
      take: MATCH_CANDIDATES_LIMIT,
    }),
    prisma.matchResult.findMany({
      where: { jobId },
      select: {
        candidateId: true,
        status: true,
        statusUpdatedAt: true,
        statusUpdatedBy: true,
      },
    }),
  ]);

  const preservedByCandidate = new Map(
    existing.map((row) => [
      row.candidateId,
      {
        status: row.status,
        statusUpdatedAt: row.statusUpdatedAt,
        statusUpdatedBy: row.statusUpdatedBy,
      },
    ])
  );

  const matches = candidates.map((candidate) =>
    computeCandidateMatch(
      { ...candidate, projectCount: candidate._count.projects },
      required,
      requiredYearsOfExperience,
      preservedByCandidate.get(candidate.id)
    )
  );

  await prisma.$transaction(async (tx) => {
    const candidateIds = matches.map((match) => match.candidateId);

    await tx.matchResult.deleteMany({
      where: { jobId, candidateId: { notIn: candidateIds } },
    });

    for (const match of matches) {
      await tx.matchResult.upsert({
        where: { jobId_candidateId: { jobId, candidateId: match.candidateId } },
        create: {
          jobId,
          candidateId: match.candidateId,
          orgId,
          score: match.score,
          matched: match.matched,
          missing: match.missing,
          matchedWeight: match.matchedWeight,
          totalWeight: match.totalWeight,
          experienceScore: match.experienceScore,
          status: match.status,
          statusUpdatedAt: match.statusUpdatedAt ?? undefined,
          statusUpdatedBy: match.statusUpdatedBy ?? undefined,
        },
        update: {
          score: match.score,
          matched: match.matched,
          missing: match.missing,
          matchedWeight: match.matchedWeight,
          totalWeight: match.totalWeight,
          experienceScore: match.experienceScore,
          status: match.status,
          statusUpdatedAt: match.statusUpdatedAt ?? undefined,
          statusUpdatedBy: match.statusUpdatedBy ?? undefined,
        },
      });
    }
  });

  return {
    required,
    matches,
    candidatesConsidered: candidates.length,
  };
}

// Automatically match candidate to all jobs
export async function autoMatchCandidateToJobs(candidateId: string, orgId: string) {
  logger.info('Auto-matching candidate to jobs', { candidateId, orgId });

  const jobs = await prisma.job.findMany({
    where: { orgId, status: 'OPEN' },
    select: { id: true },
  });

  for (const job of jobs) {
    await calculateAndSaveMatch(job.id, candidateId, orgId);
  }

  logger.info('Auto-match complete', { candidateId, jobCount: jobs.length });
}

// Automatically match a candidate to a specific job
export async function autoMatchCandidateToJob(candidateId: string, jobId: string, orgId: string) {
  logger.info('Auto-matching candidate to selected job', { candidateId, jobId, orgId });
  await calculateAndSaveMatch(jobId, candidateId, orgId);
}

// Automatically match job to all candidates
export async function autoMatchJobToCandidates(jobId: string, orgId: string) {
  logger.info('Auto-matching job to candidates', { jobId, orgId });
  const result = await recalculateJobMatches(jobId, orgId);
  logger.info('Auto-match complete', { jobId, candidateCount: result.candidatesConsidered });
}

// Calculate and save match result
async function calculateAndSaveMatch(jobId: string, candidateId: string, orgId: string) {
  try {
    const { skills: required, requiredYearsOfExperience } = await getJobRequirements(jobId);
    if (required.length === 0) {
      await prisma.matchResult.deleteMany({ where: { jobId, candidateId, orgId } });
      return;
    }

    const [candidate, existing] = await Promise.all([
      prisma.candidate.findUnique({
        where: { id: candidateId },
        select: {
          id: true,
          fullName: true,
          email: true,
          yearsOfExperience: true,
          skills: { include: { skill: true } },
          _count: { select: { projects: true } },
        },
      }),
      prisma.matchResult.findUnique({
        where: { jobId_candidateId: { jobId, candidateId } },
        select: { status: true, statusUpdatedAt: true, statusUpdatedBy: true },
      }),
    ]);

    if (!candidate) return;

    const match = computeCandidateMatch(
      { ...candidate, projectCount: candidate._count.projects },
      required,
      requiredYearsOfExperience,
      existing ?? undefined
    );

    await prisma.matchResult.upsert({
      where: { jobId_candidateId: { jobId, candidateId } },
      create: {
        jobId,
        candidateId,
        orgId,
        score: match.score,
        matched: match.matched,
        missing: match.missing,
        matchedWeight: match.matchedWeight,
        totalWeight: match.totalWeight,
        experienceScore: match.experienceScore,
        status: match.status,
        statusUpdatedAt: match.statusUpdatedAt ?? undefined,
        statusUpdatedBy: match.statusUpdatedBy ?? undefined,
      },
      update: {
        score: match.score,
        matched: match.matched,
        missing: match.missing,
        matchedWeight: match.matchedWeight,
        totalWeight: match.totalWeight,
        experienceScore: match.experienceScore,
        status: match.status,
        statusUpdatedAt: match.statusUpdatedAt ?? undefined,
        statusUpdatedBy: match.statusUpdatedBy ?? undefined,
      },
    });

    logger.info('Match calculated', {
      jobId,
      candidateId,
      score: match.score.toFixed(2),
      matched: match.matched.length,
      missing: match.missing.length,
    });
  } catch (error) {
    logger.error('Match calculation failed', { jobId, candidateId, error });
  }
}

// Recalculate all matches for an organization
export async function recalculateAllMatches(orgId: string) {
  logger.info('Recalculating all matches', { orgId });

  const jobs = await prisma.job.findMany({
    where: { orgId, status: 'OPEN' },
    select: { id: true },
  });

  for (const job of jobs) {
    await recalculateJobMatches(job.id, orgId);
  }

  logger.info('Recalculation complete', { orgId, jobCount: jobs.length });
}

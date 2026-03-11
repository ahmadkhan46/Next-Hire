import { prisma } from './prisma';
import { MatchStatus } from '@prisma/client';
import { logger } from './logger';

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
  status: MatchStatus;
  statusUpdatedAt: Date | null;
  statusUpdatedBy: string | null;
};

async function getJobRequirements(jobId: string) {
  const jobSkills = await prisma.jobSkill.findMany({
    where: { jobId },
    include: { skill: true },
  });

  return jobSkills.map((js) => ({
    name: js.skill.name,
    weight: js.weight ?? 1,
  }));
}

function computeCandidateMatch(
  candidate: {
    id: string;
    fullName: string;
    email: string | null;
    skills: Array<{ skill: { name: string } }>;
  },
  required: Array<{ name: string; weight: number }>,
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
  const score = totalWeight === 0 ? 0 : matchedWeight / totalWeight;

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
    status: preserved?.status ?? MatchStatus.NONE,
    statusUpdatedAt: preserved?.statusUpdatedAt ?? null,
    statusUpdatedBy: preserved?.statusUpdatedBy ?? null,
  };
}

export async function recalculateJobMatches(jobId: string, orgId: string) {
  const required = await getJobRequirements(jobId);

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
        skills: { include: { skill: true } },
      },
      take: 500,
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
    computeCandidateMatch(candidate, required, preservedByCandidate.get(candidate.id))
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
    const required = await getJobRequirements(jobId);
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
          skills: { include: { skill: true } },
        },
      }),
      prisma.matchResult.findUnique({
        where: { jobId_candidateId: { jobId, candidateId } },
        select: { status: true, statusUpdatedAt: true, statusUpdatedBy: true },
      }),
    ]);

    if (!candidate) return;

    const match = computeCandidateMatch(candidate, required, existing ?? undefined);

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

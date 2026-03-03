import { prisma } from './prisma';
import { MatchStatus } from '@prisma/client';
import { logger } from './logger';

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

  const candidates = await prisma.candidate.findMany({
    where: { orgId },
    select: { id: true },
    take: 500, // Limit for performance
  });

  for (const candidate of candidates) {
    await calculateAndSaveMatch(jobId, candidate.id, orgId);
  }

  logger.info('Auto-match complete', { jobId, candidateCount: candidates.length });
}

// Calculate and save match result
async function calculateAndSaveMatch(jobId: string, candidateId: string, orgId: string) {
  try {
    // Get job skills
    const jobSkills = await prisma.jobSkill.findMany({
      where: { jobId },
      include: { skill: true },
    });

    const required = jobSkills.map((js) => ({
      name: js.skill.name,
      weight: js.weight ?? 1,
    }));

    if (required.length === 0) return;

    const totalWeight = required.reduce((sum, r) => sum + r.weight, 0);

    // Get candidate skills
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        fullName: true,
        skills: { include: { skill: true } },
      },
    });

    if (!candidate) return;

    const candidateSkills = candidate.skills.map((cs) => cs.skill.name);
    
    // Skip candidates with no skills
    if (candidateSkills.length === 0) return;
    
    const candidateSet = new Set(candidateSkills);

    // Calculate match
    const matchedReq = required.filter((r) => candidateSet.has(r.name));
    const missingReq = required.filter((r) => !candidateSet.has(r.name));

    const matchedWeight = matchedReq.reduce((sum, r) => sum + r.weight, 0);
    const score = totalWeight === 0 ? 0 : matchedWeight / totalWeight;

    // Skip if no skills match (0% score)
    if (score === 0) return;

    // Check if match already exists
    const existing = await prisma.matchResult.findUnique({
      where: { jobId_candidateId: { jobId, candidateId } },
      select: { status: true, statusUpdatedAt: true, statusUpdatedBy: true },
    });

    // Save or update match
    await prisma.matchResult.upsert({
      where: { jobId_candidateId: { jobId, candidateId } },
      create: {
        jobId,
        candidateId,
        orgId,
        score,
        matched: matchedReq.map((r) => r.name),
        missing: missingReq.map((r) => r.name),
        matchedWeight,
        totalWeight,
        status: existing?.status ?? MatchStatus.NONE,
      },
      update: {
        score,
        matched: matchedReq.map((r) => r.name),
        missing: missingReq.map((r) => r.name),
        matchedWeight,
        totalWeight,
        // Preserve status if already set
        status: existing?.status ?? MatchStatus.NONE,
        statusUpdatedAt: existing?.statusUpdatedAt,
        statusUpdatedBy: existing?.statusUpdatedBy,
      },
    });

    logger.info('Match calculated', {
      jobId,
      candidateId,
      score: score.toFixed(2),
      matched: matchedReq.length,
      missing: missingReq.length,
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
    await autoMatchJobToCandidates(job.id, orgId);
  }

  logger.info('Recalculation complete', { orgId, jobCount: jobs.length });
}

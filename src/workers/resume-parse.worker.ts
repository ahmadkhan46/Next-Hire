import { Worker, Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { extractCandidateProfile, ResumeParseError } from '@/lib/resume-llm';
import { buildCandidateUpdate } from '@/lib/resume-apply';
import {
  ResumeParseJobData,
  ResumeParseRetryJobData,
  ResumeParseSingleJobData,
} from '@/lib/queue';
import { logger } from '@/lib/logger';
import { autoMatchCandidateToJob, autoMatchCandidateToJobs } from '@/lib/auto-matching';
import Redis from 'ioredis';

const connection = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
  : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    });

function shouldMarkNeedsReview(error: unknown): boolean {
  return (
    error instanceof ResumeParseError ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name?: string }).name === 'ZodError')
  );
}

async function recomputeBatchMetrics(batchId: string) {
  const items = await prisma.resumeUploadItem.findMany({
    where: { batchId },
    select: { status: true },
  });

  const createdCount = items.filter((item) => item.status === 'CREATED').length;
  const updatedCount = items.filter(
    (item) => item.status === 'UPDATED' || item.status === 'SKIPPED'
  ).length;
  const failedCount = items.filter((item) => item.status === 'FAILED').length;
  const processingCount = items.filter(
    (item) => item.status === 'PENDING' || item.status === 'PROCESSING'
  ).length;
  const processed = createdCount + updatedCount + failedCount;

  const batchStatus =
    processingCount > 0
      ? 'PROCESSING'
      : failedCount === 0
        ? 'COMPLETED'
        : processed === failedCount
          ? 'FAILED'
          : 'PARTIAL_FAILED';

  await prisma.resumeUploadBatch.update({
    where: { id: batchId },
    data: {
      processed,
      createdCount,
      updatedCount,
      failedCount,
      status: batchStatus,
      completedAt: processingCount > 0 ? null : new Date(),
    },
  });

  return { createdCount, updatedCount, failedCount, processed, batchStatus };
}

async function processSingleResumeParse(job: Job<ResumeParseSingleJobData>) {
  const { resumeId, candidateId, orgId, force } = job.data;
  logger.info('Processing resume parse job', { resumeId, candidateId, orgId });
  await job.updateProgress(10);

  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, candidateId },
    select: {
      id: true,
      rawText: true,
      parseStatus: true,
      candidate: { select: { id: true, orgId: true } },
    },
  });

  if (!resume || resume.candidate.orgId !== orgId) {
    throw new Error('Resume not found');
  }

  if (resume.parseStatus === 'SAVED' && !force) {
    return { status: 'SAVED', skipped: true };
  }

  if (!resume.rawText) {
    throw new Error('Resume has no rawText to parse');
  }

  await job.updateProgress(20);

  await prisma.resume.update({
    where: { id: resume.id },
    data: { parseStatus: 'EXTRACTING', parseError: null },
  });

  await job.updateProgress(30);

  try {
    const llm = await extractCandidateProfile(resume.rawText, orgId);
    const extract = llm.extract;

    await job.updateProgress(60);

    const { updateCandidate, experiences, projects, technologies, skills, educations } =
      buildCandidateUpdate(extract);

    await job.updateProgress(70);

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updateCandidate).length > 0) {
        await tx.candidate.update({
          where: { id: candidateId },
          data: updateCandidate,
        });
      }

      await tx.candidateExperience.deleteMany({ where: { candidateId } });
      await tx.candidateProject.deleteMany({ where: { candidateId } });
      await tx.candidateTechnology.deleteMany({ where: { candidateId } });
      await tx.candidateEducation.deleteMany({ where: { candidateId } });

      if (experiences.length) {
        await tx.candidateExperience.createMany({
          data: experiences.map((exp) => ({ ...exp, candidateId })),
        });
      }
      if (projects.length) {
        await tx.candidateProject.createMany({
          data: projects.map((project) => ({ ...project, candidateId })),
        });
      }
      if (technologies.length) {
        await tx.candidateTechnology.createMany({
          data: technologies.map((tech) => ({ ...tech, candidateId })),
        });
      }
      if (educations.length) {
        await tx.candidateEducation.createMany({
          data: educations.map((edu) => ({ ...edu, candidateId })),
        });
      }

      for (const name of skills) {
        const skill = await tx.skill.upsert({
          where: { orgId_name: { orgId, name } },
          update: {},
          create: { orgId, name },
        });

        await tx.candidateSkill.upsert({
          where: { candidateId_skillId: { candidateId, skillId: skill.id } },
          update: { source: 'resume' },
          create: { candidateId, skillId: skill.id, source: 'resume' },
        });
      }
    });

    await job.updateProgress(90);

    await prisma.resume.update({
      where: { id: resume.id },
      data: {
        parseStatus: 'SAVED',
        parseError: null,
        parsedAt: new Date(),
        parseModel: llm.model,
        promptVersion: llm.promptVersion,
        parsedJson: {
          ...extract,
          model: llm.model,
          promptVersion: llm.promptVersion,
          extractedAt: new Date().toISOString(),
          warnings: llm.warnings,
          usage: llm.usage ?? null,
        },
      },
    });

    await job.updateProgress(100);
    logger.info('Resume parse completed', { resumeId, candidateId });
    return { status: 'SAVED', resumeId, candidateId };
  } catch (error: any) {
    const message = error?.message ?? 'Parse failed';
    const status = shouldMarkNeedsReview(error) ? 'NEEDS_REVIEW' : 'FAILED';

    await prisma.resume.update({
      where: { id: resume.id },
      data: {
        parseStatus: status,
        parseError: message,
        parsedAt: new Date(),
        parsedJson: {
          error: message,
          failedAt: new Date().toISOString(),
          errorType: error?.name ?? 'UNKNOWN',
        },
      },
    });

    logger.error('Resume parse failed', { resumeId, candidateId, error: message });
    throw error;
  }
}

async function processRetryFailed(job: Job<ResumeParseRetryJobData>) {
  const { orgId, batchId, correlationId: requestCorrelationId } = job.data;
  const correlationId = requestCorrelationId?.trim() || `resume-retry-${String(job.id)}`;

  if (!batchId) {
    throw new Error(`[${correlationId}] Missing batchId for retry job`);
  }

  logger.info('Processing resume retry job', { jobId: job.id, orgId, batchId, correlationId });

  const batch = await prisma.resumeUploadBatch.findFirst({
    where: { id: batchId, orgId },
    select: { id: true, orgId: true, targetJobId: true },
  });

  if (!batch) {
    throw new Error('Upload batch not found');
  }

  await prisma.resumeUploadBatch.update({
    where: { id: batchId },
    data: {
      status: 'PROCESSING',
      startedAt: new Date(),
      completedAt: null,
    },
  });

  const failedItems = await prisma.resumeUploadItem.findMany({
    where: { batchId, status: 'FAILED' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      fileName: true,
      resumeId: true,
      candidateId: true,
    },
  });

  if (!failedItems.length) {
    const metrics = await recomputeBatchMetrics(batchId);
    return {
      retried: 0,
      fixed: 0,
      failed: 0,
      batchStatus: metrics.batchStatus,
      correlationId,
    };
  }

  let fixed = 0;
  let stillFailed = 0;

  for (let i = 0; i < failedItems.length; i++) {
    const item = failedItems[i];
    await job.updateProgress(Math.round((i / failedItems.length) * 100));

    await prisma.resumeUploadItem.update({
      where: { id: item.id },
      data: {
        status: 'PROCESSING',
        note: 'Retrying failed parse',
        error: null,
      },
    });

    if (!item.resumeId) {
      stillFailed += 1;
      await prisma.resumeUploadItem.update({
        where: { id: item.id },
        data: {
          status: 'FAILED',
          note: 'Cannot retry: no resume record attached',
          error: 'Missing resumeId',
        },
      });
      continue;
    }

    const resume = await prisma.resume.findFirst({
      where: { id: item.resumeId },
      select: {
        id: true,
        rawText: true,
        candidateId: true,
      },
    });

    if (!resume || !resume.rawText) {
      stillFailed += 1;
      await prisma.resumeUploadItem.update({
        where: { id: item.id },
        data: {
          status: 'FAILED',
          note: 'Cannot retry: resume text is missing',
          error: 'Resume missing or has no rawText',
        },
      });
      continue;
    }

    try {
      await prisma.resume.update({
        where: { id: resume.id },
        data: {
          parseStatus: 'EXTRACTING',
          parseError: null,
        },
      });

      const llm = await extractCandidateProfile(resume.rawText, orgId);
      const extract = llm.extract;
      const { updateCandidate, experiences, projects, technologies, skills, educations } =
        buildCandidateUpdate(extract);

      await prisma.$transaction(async (tx) => {
        if (Object.keys(updateCandidate).length > 0) {
          await tx.candidate.update({
            where: { id: resume.candidateId },
            data: updateCandidate,
          });
        }

        await tx.candidateExperience.deleteMany({ where: { candidateId: resume.candidateId } });
        await tx.candidateProject.deleteMany({ where: { candidateId: resume.candidateId } });
        await tx.candidateTechnology.deleteMany({ where: { candidateId: resume.candidateId } });
        await tx.candidateEducation.deleteMany({ where: { candidateId: resume.candidateId } });

        if (experiences.length) {
          await tx.candidateExperience.createMany({
            data: experiences.map((exp) => ({ ...exp, candidateId: resume.candidateId })),
          });
        }
        if (projects.length) {
          await tx.candidateProject.createMany({
            data: projects.map((project) => ({ ...project, candidateId: resume.candidateId })),
          });
        }
        if (technologies.length) {
          await tx.candidateTechnology.createMany({
            data: technologies.map((tech) => ({ ...tech, candidateId: resume.candidateId })),
          });
        }
        if (educations.length) {
          await tx.candidateEducation.createMany({
            data: educations.map((edu) => ({ ...edu, candidateId: resume.candidateId })),
          });
        }

        for (const name of skills) {
          const skill = await tx.skill.upsert({
            where: { orgId_name: { orgId, name } },
            update: {},
            create: { orgId, name },
          });

          await tx.candidateSkill.upsert({
            where: {
              candidateId_skillId: {
                candidateId: resume.candidateId,
                skillId: skill.id,
              },
            },
            update: { source: 'resume' },
            create: {
              candidateId: resume.candidateId,
              skillId: skill.id,
              source: 'resume',
            },
          });
        }
      });

      await prisma.resume.update({
        where: { id: resume.id },
        data: {
          parseStatus: 'SAVED',
          parseError: null,
          parsedAt: new Date(),
          parseModel: llm.model,
          promptVersion: llm.promptVersion,
          parsedJson: {
            ...extract,
            model: llm.model,
            promptVersion: llm.promptVersion,
            extractedAt: new Date().toISOString(),
            warnings: llm.warnings,
            usage: llm.usage ?? null,
          },
        },
      });

      if (batch.targetJobId) {
        await autoMatchCandidateToJob(resume.candidateId, batch.targetJobId, orgId);
      } else {
        await autoMatchCandidateToJobs(resume.candidateId, orgId);
      }

      await prisma.resumeUploadItem.update({
        where: { id: item.id },
        data: {
          status: 'UPDATED',
          candidateId: resume.candidateId,
          note: 'Retry succeeded',
          error: null,
        },
      });
      fixed += 1;
    } catch (error: any) {
      stillFailed += 1;
      const message = error?.message ?? 'Retry parse failed';
      const parseStatus = shouldMarkNeedsReview(error) ? 'NEEDS_REVIEW' : 'FAILED';

      await prisma.resume.update({
        where: { id: resume.id },
        data: {
          parseStatus,
          parseError: message,
          parsedAt: new Date(),
          parsedJson: {
            error: message,
            failedAt: new Date().toISOString(),
            errorType: error?.name ?? 'UNKNOWN',
          },
        },
      });

      await prisma.resumeUploadItem.update({
        where: { id: item.id },
        data: {
          status: 'FAILED',
          note: 'Retry failed',
          error: message,
        },
      });
    }
  }

  await job.updateProgress(100);
  const metrics = await recomputeBatchMetrics(batchId);
  return {
    retried: failedItems.length,
    fixed,
    failed: stillFailed,
    batchStatus: metrics.batchStatus,
    correlationId,
  };
}

export const resumeParseWorker = new Worker<ResumeParseJobData>(
  'resume-parse',
  async (job: Job<ResumeParseJobData>) => {
    if (job.name === 'retry-failed') {
      return processRetryFailed(job as Job<ResumeParseRetryJobData>);
    }

    const data = job.data as Partial<ResumeParseSingleJobData>;
    if (!data.resumeId || !data.candidateId) {
      throw new Error('Invalid resume parse job payload');
    }
    return processSingleResumeParse(job as Job<ResumeParseSingleJobData>);
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 60000,
    },
  }
);

resumeParseWorker.on('completed', (job) => {
  logger.info('Resume parse job completed', { jobId: job.id });
});

resumeParseWorker.on('failed', (job, err) => {
  logger.error('Resume parse job failed', { jobId: job?.id, error: err.message });
});

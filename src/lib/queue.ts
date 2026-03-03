import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

// Redis connection
const connection = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    })
  : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    });

// Job types
export type JobType = 'resume-parse' | 'bulk-import' | 'match-calculation' | 'email-send';

export interface ResumeParseSingleJobData {
  resumeId: string;
  candidateId: string;
  orgId: string;
  force?: boolean;
}

export interface ResumeParseRetryJobData {
  orgId: string;
  batchId: string;
  userId: string;
  correlationId?: string;
  failedItems?: Array<{
    fileName: string;
    resumeId: string | null;
  }>;
}

export type ResumeParseJobData = ResumeParseSingleJobData | ResumeParseRetryJobData;

export interface BulkImportJobData {
  orgId: string;
  userId: string;
  batchId?: string;
  targetJobId?: string | null;
  correlationId?: string;
  candidates: Array<{
    fullName: string;
    externalId?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    location?: string;
    currentTitle?: string;
    yearsOfExperience?: number;
    linkedinUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
    status?: string;
    source?: string;
    notes?: string;
    skills?: string[];
    resumeText?: string;
  }>;
}

export interface MatchCalculationJobData {
  jobId: string;
  orgId: string;
}

export interface EmailSendJobData {
  to: string;
  subject: string;
  body: string;
  orgId: string;
}

// Queue instances
export const queues = {
  resumeParse: new Queue<ResumeParseJobData>('resume-parse', { connection }),
  bulkImport: new Queue<BulkImportJobData>('bulk-import', { connection }),
  matchCalculation: new Queue<MatchCalculationJobData>('match-calculation', { connection }),
  emailSend: new Queue<EmailSendJobData>('email-send', { connection }),
};

// Queue events for monitoring
export const queueEvents = {
  resumeParse: new QueueEvents('resume-parse', { connection }),
  bulkImport: new QueueEvents('bulk-import', { connection }),
  matchCalculation: new QueueEvents('match-calculation', { connection }),
  emailSend: new QueueEvents('email-send', { connection }),
};

// Helper to add job with retry logic
export async function addJob<T>(
  queue: Queue<T>,
  name: string,
  data: T,
  options?: {
    priority?: number;
    delay?: number;
    attempts?: number;
  }
) {
  return (queue as Queue<any, any, string>).add(name, data as any, {
    attempts: options?.attempts || 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2s, then 4s, 8s
    },
    priority: options?.priority,
    delay: options?.delay,
    removeOnComplete: {
      age: 86400, // Keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 604800, // Keep failed jobs for 7 days
    },
  });
}

// Get job status
export async function getJobStatus(queue: Queue, jobId: string) {
  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const progress = job.progress;
  const returnvalue = job.returnvalue;
  const failedReason = job.failedReason;

  return {
    id: job.id,
    name: job.name,
    data: job.data,
    state,
    progress,
    returnvalue,
    failedReason,
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  };
}

// Get queue stats
export async function getQueueStats(queue: Queue) {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

// Clean old jobs
export async function cleanQueue(queue: Queue) {
  await queue.clean(86400000, 1000, 'completed'); // 24 hours
  await queue.clean(604800000, 1000, 'failed'); // 7 days
}

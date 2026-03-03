import { memoryQueues } from '@/lib/memory-queue';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { extractCandidateProfile, ResumeParseError } from '@/lib/resume-llm';
import { autoMatchCandidateToJob, autoMatchCandidateToJobs } from '@/lib/auto-matching';
import { logger } from '@/lib/logger';
import { buildCandidateUpdate } from '@/lib/resume-apply';
import { generateFingerprint } from '@/lib/fingerprint';

function normalizeEmail(email?: string | null) {
  return email ? email.toLowerCase().trim() : null;
}

function isValidEmail(email?: string | null) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhone(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  return digits || null;
}

function normalizeFullName(fullName?: string | null) {
  const normalized = String(fullName ?? '').trim().replace(/\s+/g, ' ');
  return normalized || 'Unknown';
}

function normalizeSkills(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const dedup = new Set<string>();
  for (const skill of input) {
    const value = String(skill ?? '').trim().replace(/\s+/g, ' ');
    if (!value) continue;
    dedup.add(value);
  }
  return Array.from(dedup);
}

function classifyImportError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('Email is required') || message.includes('Invalid or missing email')) {
    return { code: 'INVALID_EMAIL', message: 'Invalid or missing email address' };
  }

  if (error instanceof ResumeParseError) {
    return { code: 'RESUME_PARSE_FAILED', message };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return { code: 'UNIQUE_CONSTRAINT', message: 'Duplicate candidate conflict (unique field)' };
    }
    return { code: 'DB_KNOWN_ERROR', message };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return { code: 'DB_VALIDATION_ERROR', message };
  }

  return { code: 'IMPORT_FAILED', message };
}

const MAX_ROW_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 500;
const RETRYABLE_PRISMA_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2034']);

function isTransientImportError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE_PRISMA_CODES.has(error.code);
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('too many requests') ||
    message.includes('rate limit') ||
    message.includes('temporarily unavailable') ||
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('connection reset') ||
    message.includes('could not serialize access') ||
    message.includes('deadlock detected')
  );
}

function retryDelayMs(attempt: number): number {
  return BASE_RETRY_DELAY_MS * Math.pow(2, Math.max(0, attempt - 1));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findExistingCandidate(
  orgId: string,
  fullName?: string | null,
  email?: string | null,
  phone?: string | null,
  externalId?: string | null,
  dateOfBirth?: Date | null
) {
  // Priority 1: externalId (user's system)
  if (externalId) {
    const existing = await prisma.candidate.findUnique({
      where: { orgId_externalId: { orgId, externalId } },
      select: { id: true },
    });
    if (existing) return { candidate: existing, matchType: 'externalId' };
  }

  // Priority 2: email (strong identifier)
  const emailNorm = normalizeEmail(email);
  if (emailNorm) {
    const existing = await prisma.candidate.findFirst({
      where: { orgId, email: { equals: emailNorm, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) return { candidate: existing, matchType: 'email' };
  }

  // Priority 3: fingerprint (firstName + lastName + (email OR phone) + DOB)
  const phoneNorm = normalizePhone(phone);
  if (phoneNorm) {
    const existing = await prisma.candidate.findFirst({
      where: { orgId, phone: phoneNorm },
      select: { id: true },
    });
    if (existing) return { candidate: existing, matchType: 'phone' };
  }

  // Priority 4: fingerprint (firstName + lastName + (email OR phone) + DOB)
  if (fullName) {
    const fingerprint = generateFingerprint({ fullName, email, phone, dateOfBirth });
    if (fingerprint) {
      const existing = await prisma.candidate.findUnique({
        where: { orgId_fingerprint: { orgId, fingerprint } },
        select: { id: true },
      });
      if (existing) return { candidate: existing, matchType: 'fingerprint' };
    }
  }

  return null;
}

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

// Process bulk import jobs
memoryQueues.bulkImport.on('active', async (job) => {
  const { orgId, candidates, batchId } = job.data as {
    orgId: string;
    candidates: Array<Record<string, any>>;
    batchId?: string;
    targetJobId?: string | null;
    correlationId?: string;
  };
  const targetJobId =
    typeof (job.data as { targetJobId?: unknown }).targetJobId === 'string' &&
    (job.data as { targetJobId?: string }).targetJobId
      ? (job.data as { targetJobId?: string }).targetJobId!
      : null;

  const importRunId = `bulk-${job.id}-${Date.now()}`;
  const correlationId =
    typeof (job.data as { correlationId?: unknown }).correlationId === 'string' &&
    (job.data as { correlationId?: string }).correlationId
      ? (job.data as { correlationId?: string }).correlationId!
      : importRunId;
  logger.info('Processing bulk import job', {
    jobId: job.id,
    orgId,
    count: candidates.length,
    importRunId,
    correlationId,
  });

  const results = [];
  const total = candidates.length;

  try {
    if (batchId) {
      await prisma.resumeUploadBatch.update({
        where: { id: batchId },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
        },
      });
    }

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const rowIndex = i + 1;
      const rowName = normalizeFullName(
        typeof candidate.fullName === 'string' && candidate.fullName.trim()
          ? candidate.fullName
          : `row-${rowIndex}`
      );
      let itemId: string | null = null;

      if (batchId) {
        const item = await prisma.resumeUploadItem.create({
          data: {
            batchId,
            fileName: `${rowIndex.toString().padStart(5, '0')}-${rowName}.csv-row`,
            status: 'PROCESSING',
            note: `Row ${rowIndex} is being processed`,
          },
          select: { id: true },
        });
        itemId = item.id;
      }

      let rowAttempts = 0;
      while (rowAttempts < MAX_ROW_ATTEMPTS) {
        rowAttempts += 1;
        try {
        let extractedData = null;
        let llmMetadata = null;

        if (candidate.resumeText) {
          const llmResult = await extractCandidateProfile(candidate.resumeText, orgId);
          extractedData = llmResult.extract;

          llmMetadata = {
            model: llmResult.model,
            promptVersion: llmResult.promptVersion,
            warnings: llmResult.warnings,
            usage: llmResult.usage,
            extractedAt: new Date().toISOString(),
          };
        }

        const fullName = normalizeFullName(candidate.fullName || extractedData?.personal.fullName);
        const email = normalizeEmail(candidate.email || extractedData?.personal.email || null);
        const phone = normalizePhone(candidate.phone || extractedData?.personal.phone || null);
        const dateOfBirth = candidate.dateOfBirth ? new Date(candidate.dateOfBirth) : null;
        const externalId =
          candidate.externalId && candidate.externalId.trim()
            ? candidate.externalId.trim()
            : null;
        const location = candidate.location || extractedData?.personal.location || null;
        const currentTitle = candidate.currentTitle || extractedData?.personal.currentTitle || null;
        const yearsOfExperience = candidate.yearsOfExperience ?? extractedData?.personal.yearsOfExperience ?? null;
        const linkedinUrl = candidate.linkedinUrl || null;
        const githubUrl = candidate.githubUrl || null;
        const portfolioUrl = candidate.portfolioUrl || null;
        const status = candidate.status || 'ACTIVE';
        const source = candidate.source || 'IMPORT';
        const notes = candidate.notes || extractedData?.personal.notes || null;

        if (!isValidEmail(email)) {
          throw new Error(`Email is required for bulk import rows (row ${rowIndex})`);
        }

        const existing = await findExistingCandidate(
          orgId,
          fullName,
          email,
          phone,
          externalId,
          dateOfBirth
        );

        let targetCandidateId = existing?.candidate.id ?? null;
        const matchType = existing?.matchType || 'created';

        const fingerprint = generateFingerprint({ fullName, email, phone, dateOfBirth });

        const candidatePayload = {
          fullName,
          email: email ?? undefined,
          phone: phone ?? undefined,
          dateOfBirth: dateOfBirth ?? undefined,
          fingerprint: fingerprint ?? undefined,
          location: location ?? undefined,
          currentTitle: currentTitle ?? undefined,
          yearsOfExperience: yearsOfExperience ?? undefined,
          linkedinUrl: linkedinUrl ?? undefined,
          githubUrl: githubUrl ?? undefined,
          portfolioUrl: portfolioUrl ?? undefined,
          status,
          source,
          notes: notes ?? undefined,
          educationSchool: extractedData?.personal.education?.school,
          educationDegree: extractedData?.personal.education?.degree,
          educationYear: extractedData?.personal.education?.year,
          externalId: externalId ?? undefined,
          orgId,
        };

        try {
          if (!targetCandidateId) {
            const created = await prisma.candidate.create({ data: candidatePayload });
            targetCandidateId = created.id;
          } else {
            await prisma.candidate.update({
              where: { id: targetCandidateId },
              data: candidatePayload,
            });
          }
        } catch (error) {
          // Handle race conditions for unique constraints by re-resolving candidate.
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const resolved = await findExistingCandidate(
              orgId,
              fullName,
              email,
              phone,
              externalId,
              dateOfBirth
            );
            if (!resolved?.candidate.id) throw error;
            targetCandidateId = resolved.candidate.id;
            await prisma.candidate.update({
              where: { id: targetCandidateId },
              data: candidatePayload,
            });
          } else {
            throw error;
          }
        }

        const newCandidate = { id: targetCandidateId, fullName };

        if (candidate.resumeText) {
          await prisma.resume.create({
            data: {
              candidateId: newCandidate.id,
              rawText: candidate.resumeText,
              fileName: `${newCandidate.fullName.replace(/\s+/g, '_')}_resume.txt`,
              mimeType: 'text/plain',
              sizeBytes: candidate.resumeText.length,
              parseStatus: extractedData ? 'SAVED' : 'QUEUED',
              parsedAt: extractedData ? new Date() : undefined,
              parseModel: llmMetadata?.model ?? undefined,
              promptVersion: llmMetadata?.promptVersion ?? undefined,
              parsedJson: extractedData
                ? {
                    extract: extractedData,
                    metadata: llmMetadata,
                  }
                : undefined,
            },
          });
        }

        if (extractedData) {
          const { updateCandidate, experiences, projects, technologies, skills, educations } =
            buildCandidateUpdate(extractedData);

          await prisma.$transaction(async (tx) => {
            if (Object.keys(updateCandidate).length) {
              await tx.candidate.update({
                where: { id: newCandidate.id },
                data: updateCandidate,
              });
            }

            await tx.candidateExperience.deleteMany({ where: { candidateId: newCandidate.id } });
            await tx.candidateProject.deleteMany({ where: { candidateId: newCandidate.id } });
            await tx.candidateTechnology.deleteMany({ where: { candidateId: newCandidate.id } });
            await tx.candidateEducation.deleteMany({ where: { candidateId: newCandidate.id } });

            if (experiences.length) {
              await tx.candidateExperience.createMany({
                data: experiences.map((exp) => ({ ...exp, candidateId: newCandidate.id })),
              });
            }
            if (projects.length) {
              await tx.candidateProject.createMany({
                data: projects.map((project) => ({ ...project, candidateId: newCandidate.id })),
              });
            }
            if (technologies.length) {
              await tx.candidateTechnology.createMany({
                data: technologies.map((tech) => ({ ...tech, candidateId: newCandidate.id })),
              });
            }
            if (educations.length) {
              await tx.candidateEducation.createMany({
                data: educations.map((edu) => ({ ...edu, candidateId: newCandidate.id })),
              });
            }

            for (const name of skills) {
              const skill = await tx.skill.upsert({
                where: { orgId_name: { orgId, name } },
                create: { name, orgId },
                update: {},
              });
              await tx.candidateSkill.upsert({
                where: { candidateId_skillId: { candidateId: newCandidate.id, skillId: skill.id } },
                create: {
                  candidateId: newCandidate.id,
                  skillId: skill.id,
                  source: extractedData ? 'llm' : 'import',
                },
                update: {},
              });
            }
          });
        }

        if (!extractedData) {
          const uniqueSkills = normalizeSkills(candidate.skills);

          if (uniqueSkills.length) {
            for (const skillName of uniqueSkills) {
              const skill = await prisma.skill.upsert({
                where: { orgId_name: { orgId, name: skillName } },
                create: { name: skillName, orgId },
                update: {},
              });

              await prisma.candidateSkill.upsert({
                where: { candidateId_skillId: { candidateId: newCandidate.id, skillId: skill.id } },
                create: {
                  candidateId: newCandidate.id,
                  skillId: skill.id,
                  source: 'import',
                },
                update: {},
              });
            }
          }
        }

        results.push({
          success: true,
          rowIndex,
          candidateId: newCandidate.id,
          name: newCandidate.fullName,
          matchType,
          attempts: rowAttempts,
          retryCount: rowAttempts - 1,
        });

        if (batchId && itemId) {
          const retrySuffix = rowAttempts > 1 ? ` after ${rowAttempts - 1} retr${rowAttempts - 1 === 1 ? 'y' : 'ies'}` : '';
          await prisma.resumeUploadItem.update({
            where: { id: itemId },
            data: {
              candidateId: newCandidate.id,
              status: matchType === 'created' ? 'CREATED' : 'UPDATED',
              note:
                matchType === 'created'
                  ? `Candidate created from CSV${retrySuffix}`
                  : `Existing candidate updated (${matchType})${retrySuffix}`,
            },
          });
        }

        // Auto-match to selected job (if provided) or all open jobs.
        try {
          if (targetJobId) {
            await autoMatchCandidateToJob(newCandidate.id, targetJobId, orgId);
          } else {
            await autoMatchCandidateToJobs(newCandidate.id, orgId);
          }
        } catch (error) {
          logger.error('Auto-matching failed', {
            candidateId: newCandidate.id,
            correlationId,
            importRunId,
            rowIndex,
            error,
          });
        }
          break;
        } catch (error: any) {
          const transient = isTransientImportError(error);
          if (transient && rowAttempts < MAX_ROW_ATTEMPTS) {
            const delayMs = retryDelayMs(rowAttempts);
            logger.warn('Retrying candidate import row', {
              importRunId,
              correlationId,
              rowIndex,
              attempt: rowAttempts + 1,
              maxAttempts: MAX_ROW_ATTEMPTS,
              delayMs,
              candidate: candidate.fullName,
              error: error instanceof Error ? error.message : String(error),
            });
            if (batchId && itemId) {
              await prisma.resumeUploadItem.update({
                where: { id: itemId },
                data: {
                  status: 'PROCESSING',
                  note: `Row ${rowIndex} retrying (${rowAttempts + 1}/${MAX_ROW_ATTEMPTS})`,
                },
              });
            }
            await sleep(delayMs);
            continue;
          }

          const classified = classifyImportError(error);
          logger.error('Candidate import error', {
            importRunId,
            correlationId,
            rowIndex,
            attempts: rowAttempts,
            transient,
            candidate: candidate.fullName,
            errorCode: classified.code,
            error: classified.message,
          });
          results.push({
            success: false,
            rowIndex,
            name: candidate.fullName,
            errorCode: classified.code,
            error: classified.message,
            attempts: rowAttempts,
            retryCount: rowAttempts - 1,
            transient,
          });
          if (batchId && itemId) {
            await prisma.resumeUploadItem.update({
              where: { id: itemId },
              data: {
                status: 'FAILED',
                note: `Row ${rowIndex} failed (${classified.code})`,
                error: classified.message,
              },
            });
          }
          break;
        }
      }

      if (batchId) {
        const processed = i + 1;
        const createdCount = results.filter((r: any) => r.success && r.matchType === 'created').length;
        const updatedCount = results.filter((r: any) => r.success && r.matchType !== 'created').length;
        const failedCount = results.filter((r: any) => !r.success).length;
        await prisma.resumeUploadBatch.update({
          where: { id: batchId },
          data: {
            processed,
            createdCount,
            updatedCount,
            failedCount,
          },
        });
      }

      await memoryQueues.bulkImport.updateProgress(job.id, Math.round(((i + 1) / total) * 100));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const createdCount = results.filter((r: any) => r.success && r.matchType === 'created').length;
    const updatedCount = results.filter((r: any) => r.success && r.matchType !== 'created').length;

    const failedRows = results
      .filter((row: any) => !row.success)
      .map((row: any) => ({
        rowIndex: row.rowIndex,
        name: row.name ?? null,
        errorCode: row.errorCode ?? 'IMPORT_FAILED',
        error: row.error ?? 'Unknown import error',
        attempts: row.attempts ?? 1,
        retryCount: row.retryCount ?? 0,
        transient: row.transient ?? false,
      }));

    await memoryQueues.bulkImport.complete(job.id, {
      imported: successful,
      failed,
      correlationId,
      importRunId,
      results,
      failedRows,
    });

    if (batchId) {
      const finalStatus =
        failed === 0 ? 'COMPLETED' : successful === 0 ? 'FAILED' : 'PARTIAL_FAILED';
      await prisma.resumeUploadBatch.update({
        where: { id: batchId },
        data: {
          processed: candidates.length,
          createdCount,
          updatedCount,
          failedCount: failed,
          status: finalStatus,
          completedAt: new Date(),
        },
      });
    }

    logger.info('Bulk import completed', {
      jobId: job.id,
      orgId,
      successful,
      failed,
      importRunId,
      correlationId,
    });
  } catch (error: any) {
    logger.error('Bulk import job failed', {
      jobId: job.id,
      importRunId,
      correlationId,
      error: error.message,
    });
    const batchId = (job.data as any)?.batchId as string | undefined;
    const candidates = (job.data as any)?.candidates as Array<any> | undefined;
    if (batchId) {
      await prisma.resumeUploadBatch.update({
        where: { id: batchId },
        data: {
          processed: candidates?.length ?? 0,
          status: 'FAILED',
          failedCount: candidates?.length ?? 0,
          completedAt: new Date(),
        },
      });
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    await memoryQueues.bulkImport.fail(
      job.id,
      new Error(`[${correlationId}] ${errorMessage}`)
    );
  }
});

// Process retry jobs for failed resume parses
memoryQueues.resumeParse.on('active', async (job) => {
  const { orgId, batchId } = job.data as {
    orgId: string;
    batchId?: string;
    correlationId?: string;
  };
  const correlationId =
    typeof (job.data as { correlationId?: unknown }).correlationId === 'string' &&
    (job.data as { correlationId?: string }).correlationId
      ? (job.data as { correlationId?: string }).correlationId!
      : `resume-retry-${job.id}`;

  if (!batchId) {
    await memoryQueues.resumeParse.fail(
      job.id,
      new Error(`[${correlationId}] Missing batchId for retry job`)
    );
    return;
  }

  logger.info('Processing resume retry job', { jobId: job.id, orgId, batchId, correlationId });

  try {
    const batch = await prisma.resumeUploadBatch.findFirst({
      where: { id: batchId, orgId },
      select: {
        id: true,
        orgId: true,
        targetJobId: true,
      },
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
      await recomputeBatchMetrics(batchId);
      await memoryQueues.resumeParse.complete(job.id, {
        retried: 0,
        fixed: 0,
        failed: 0,
        correlationId,
      });
      return;
    }

    let fixed = 0;
    let stillFailed = 0;

    for (let i = 0; i < failedItems.length; i++) {
      const item = failedItems[i];
      await memoryQueues.resumeParse.updateProgress(
        job.id,
        Math.round((i / failedItems.length) * 100)
      );

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
              where: { candidateId_skillId: { candidateId: resume.candidateId, skillId: skill.id } },
              update: { source: 'resume' },
              create: { candidateId: resume.candidateId, skillId: skill.id, source: 'resume' },
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

    await memoryQueues.resumeParse.updateProgress(job.id, 100);
    const metrics = await recomputeBatchMetrics(batchId);
    await memoryQueues.resumeParse.complete(job.id, {
      retried: failedItems.length,
      fixed,
      failed: stillFailed,
      batchStatus: metrics.batchStatus,
      correlationId,
    });
  } catch (error: any) {
    logger.error('Resume retry job failed', {
      jobId: job.id,
      batchId,
      correlationId,
      error: error?.message,
    });
    await prisma.resumeUploadBatch
      .update({
        where: { id: batchId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      })
      .catch(() => undefined);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await memoryQueues.resumeParse.fail(job.id, new Error(`[${correlationId}] ${errorMessage}`));
  }
});

console.log('Memory workers started (no Redis required)');

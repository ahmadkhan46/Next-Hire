import { Worker, Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { extractCandidateProfile, ResumeParseError } from '@/lib/resume-llm';
import { BulkImportJobData } from '@/lib/queue';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import { autoMatchCandidateToJob, autoMatchCandidateToJobs } from '@/lib/auto-matching';
import { buildCandidateUpdate } from '@/lib/resume-apply';
import { generateFingerprint } from '@/lib/fingerprint';
import Redis from 'ioredis';

const connection = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
  : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    });

function normalizeEmail(email?: string | null) {
  return email ? email.toLowerCase().trim() : null;
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

function isValidEmail(email?: string | null) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
  if (externalId) {
    const existing = await prisma.candidate.findUnique({
      where: { orgId_externalId: { orgId, externalId } },
      select: { id: true },
    });
    if (existing) return { candidate: existing, matchType: 'externalId' as const };
  }

  const emailNorm = normalizeEmail(email);
  if (emailNorm) {
    const existing = await prisma.candidate.findFirst({
      where: { orgId, email: { equals: emailNorm, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) return { candidate: existing, matchType: 'email' as const };
  }

  const phoneNorm = normalizePhone(phone);
  if (phoneNorm) {
    const existing = await prisma.candidate.findFirst({
      where: { orgId, phone: phoneNorm },
      select: { id: true },
    });
    if (existing) return { candidate: existing, matchType: 'phone' as const };
  }

  if (fullName) {
    const fingerprint = generateFingerprint({ fullName, email, phone, dateOfBirth });
    if (fingerprint) {
      const existing = await prisma.candidate.findUnique({
        where: { orgId_fingerprint: { orgId, fingerprint } },
        select: { id: true },
      });
      if (existing) return { candidate: existing, matchType: 'fingerprint' as const };
    }
  }

  return null;
}

export const bulkImportWorker = new Worker<BulkImportJobData>(
  'bulk-import',
  async (job: Job<BulkImportJobData>) => {
    const { orgId, candidates, batchId, targetJobId } = job.data;
    const importRunId = `bulk-${String(job.id)}-${Date.now()}`;
    const correlationId = job.data.correlationId?.trim() || importRunId;
    logger.info('Processing bulk import job', {
      jobId: job.id,
      orgId,
      count: candidates.length,
      importRunId,
      correlationId,
    });

    const results: Array<Record<string, unknown>> = [];
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
        const candidate = candidates[i] as Record<string, any>;
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
              candidate.externalId && String(candidate.externalId).trim()
                ? String(candidate.externalId).trim()
                : null;
            const location = candidate.location || extractedData?.personal.location || null;
            const currentTitle = candidate.currentTitle || extractedData?.personal.currentTitle || null;
            const yearsOfExperience =
              candidate.yearsOfExperience ?? extractedData?.personal.yearsOfExperience ?? null;
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

            const newCandidate = { id: targetCandidateId as string, fullName };

            if (candidate.resumeText) {
              await prisma.resume.create({
                data: {
                  candidateId: newCandidate.id,
                  rawText: candidate.resumeText,
                  fileName: `${newCandidate.fullName.replace(/\s+/g, '_')}_resume.txt`,
                  mimeType: 'text/plain',
                  sizeBytes: String(candidate.resumeText).length,
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
                    where: {
                      candidateId_skillId: { candidateId: newCandidate.id, skillId: skill.id },
                    },
                    create: {
                      candidateId: newCandidate.id,
                      skillId: skill.id,
                      source: 'llm',
                    },
                    update: {},
                  });
                }
              });
            } else {
              const uniqueSkills = normalizeSkills(candidate.skills);
              if (uniqueSkills.length) {
                for (const skillName of uniqueSkills) {
                  const skill = await prisma.skill.upsert({
                    where: { orgId_name: { orgId, name: skillName } },
                    create: { name: skillName, orgId },
                    update: {},
                  });

                  await prisma.candidateSkill.upsert({
                    where: {
                      candidateId_skillId: { candidateId: newCandidate.id, skillId: skill.id },
                    },
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
              const retrySuffix =
                rowAttempts > 1
                  ? ` after ${rowAttempts - 1} retr${rowAttempts - 1 === 1 ? 'y' : 'ies'}`
                  : '';
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
          } catch (error: unknown) {
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
          const createdCount = results.filter(
            (r) => r.success === true && r.matchType === 'created'
          ).length;
          const updatedCount = results.filter(
            (r) => r.success === true && r.matchType !== 'created'
          ).length;
          const failedCount = results.filter((r) => r.success !== true).length;
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

        await job.updateProgress(Math.round(((i + 1) / total) * 100));
      }

      const successful = results.filter((r) => r.success === true).length;
      const failed = results.filter((r) => r.success !== true).length;
      const createdCount = results.filter(
        (r) => r.success === true && r.matchType === 'created'
      ).length;
      const updatedCount = results.filter(
        (r) => r.success === true && r.matchType !== 'created'
      ).length;

      const failedRows = results
        .filter((row) => row.success !== true)
        .map((row) => ({
          rowIndex: (row.rowIndex as number) ?? 0,
          name: (row.name as string | null) ?? null,
          errorCode: (row.errorCode as string) ?? 'IMPORT_FAILED',
          error: (row.error as string) ?? 'Unknown import error',
          attempts: (row.attempts as number) ?? 1,
          retryCount: (row.retryCount as number) ?? 0,
          transient: (row.transient as boolean) ?? false,
        }));

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

      return {
        imported: successful,
        failed,
        correlationId,
        importRunId,
        results,
        failedRows,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Bulk import job failed', {
        jobId: job.id,
        importRunId,
        correlationId,
        error: errorMessage,
      });

      if (batchId) {
        await prisma.resumeUploadBatch
          .update({
            where: { id: batchId },
            data: {
              processed: candidates.length,
              status: 'FAILED',
              failedCount: candidates.length,
              completedAt: new Date(),
            },
          })
          .catch(() => undefined);
      }

      throw new Error(`[${correlationId}] ${errorMessage}`);
    }
  },
  {
    connection,
    concurrency: 2,
  }
);

bulkImportWorker.on('completed', (job) => {
  logger.info('Bulk import job completed', { jobId: job.id });
});

bulkImportWorker.on('failed', (job, err) => {
  logger.error('Bulk import job failed', { jobId: job?.id, error: err.message });
});

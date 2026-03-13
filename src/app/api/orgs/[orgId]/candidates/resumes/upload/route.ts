export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTextFromFile } from "@/lib/resume-text-extract";
import { extractCandidateProfile } from "@/lib/resume-llm";
import { buildCandidateUpdate } from "@/lib/resume-apply";
import { createRoute } from "@/lib/api-middleware";
import { autoMatchCandidateToJob, autoMatchCandidateToJobs } from "@/lib/auto-matching";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FILE_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 500;
const RETRYABLE_PRISMA_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024", "P2034"]);
const DEFAULT_UPLOAD_BATCH_SIZE = process.env.NODE_ENV === "production" ? 1 : 5;
const UPLOAD_BATCH_SIZE = Math.max(
  1,
  Math.min(5, Number(process.env.RESUME_UPLOAD_BATCH_SIZE ?? DEFAULT_UPLOAD_BATCH_SIZE) || DEFAULT_UPLOAD_BATCH_SIZE)
);

function candidateNameFromFile(fileName: string) {
  const base = fileName.replace(/\.[^/.]+$/, "");
  const cleaned = base.replace(/[_\-]+/g, " ").trim();
  return cleaned || "Imported Candidate";
}

function normalizeEmail(email?: string | null) {
  return email ? email.toLowerCase().trim() : null;
}

function normalizePhone(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits || null;
}

function retryDelayMs(attempt: number) {
  return BASE_RETRY_DELAY_MS * Math.pow(2, Math.max(0, attempt - 1));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientUploadError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE_PRISMA_CODES.has(error.code);
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("too many requests") ||
    message.includes("rate limit") ||
    message.includes("temporarily unavailable") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("connection reset") ||
    message.includes("could not serialize access") ||
    message.includes("deadlock detected")
  );
}

function classifyUploadError(error: unknown, hasExtractedText: boolean) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("no valid email")) {
    return { code: "INVALID_EMAIL", message: "No valid email found in resume" };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return { code: "UNIQUE_CONSTRAINT", message: "Duplicate candidate conflict (unique field)" };
    }
    return { code: "DB_KNOWN_ERROR", message };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return { code: "DB_VALIDATION_ERROR", message };
  }

  if (hasExtractedText) {
    return { code: "RESUME_PARSE_FAILED", message };
  }
  return { code: "TEXT_EXTRACTION_FAILED", message };
}

async function findExistingCandidate(
  orgId: string,
  fullName?: string | null,
  email?: string | null,
  phone?: string | null
) {
  if (!fullName) return null;
  const emailNorm = normalizeEmail(email);
  const phoneNorm = normalizePhone(phone);
  if (!emailNorm && !phoneNorm) return null;

  return prisma.candidate.findFirst({
    where: {
      orgId,
      fullName: { equals: fullName, mode: "insensitive" },
      OR: [
        emailNorm ? { email: { equals: emailNorm, mode: "insensitive" } } : undefined,
        phoneNorm ? { phone: phoneNorm } : undefined,
      ].filter(Boolean) as any,
    },
    select: { id: true },
  });
}

export const POST = createRoute(
  {
    requireAuth: true,
    requireOrg: true,
    permission: "candidates:write",
    rateLimit: {
      type: "llm",
      identifier: (_req, userId, orgId) => orgId || userId || "unknown",
    },
  },
  async (req: NextRequest, { orgId, userId }) => {
    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }
    const correlationId = req.headers.get("x-correlation-id")?.trim() || crypto.randomUUID();

    const formData = await req.formData();
    const files = formData.getAll("files").filter((f) => f instanceof File) as File[];
    const sourceTypeRaw = String(formData.get("sourceType") ?? "PDF_DOCX");
    const duplicateModeRaw = String(formData.get("duplicateMode") ?? "update");
    const duplicateMode = duplicateModeRaw === "skip" ? "skip" : "update";
    const sourceType =
      sourceTypeRaw === "ZIP" || sourceTypeRaw === "CSV" || sourceTypeRaw === "PDF_DOCX"
        ? sourceTypeRaw
        : "PDF_DOCX";
    const sourceNameRaw = formData.get("sourceName");
    const sourceName = typeof sourceNameRaw === "string" ? sourceNameRaw : null;
    const targetJobIdRaw = formData.get("targetJobId");
    const targetJobId =
      typeof targetJobIdRaw === "string" && targetJobIdRaw.trim()
        ? targetJobIdRaw.trim()
        : null;

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (targetJobId) {
      const job = await prisma.job.findFirst({
        where: { id: targetJobId, orgId },
        select: { id: true },
      });
      if (!job) {
        return NextResponse.json(
          { error: "Selected job was not found for this organization." },
          { status: 400 }
        );
      }
    }

    const batch = await prisma.resumeUploadBatch.create({
      data: {
        orgId,
        targetJobId,
        sourceType: sourceType as "CSV" | "ZIP" | "PDF_DOCX",
        sourceName,
        uploadedBy: userId,
        status: "PROCESSING",
        totalFiles: files.length,
        startedAt: new Date(),
      },
      select: { id: true },
    });
    logger.info("Bulk resume upload started", {
      orgId,
      userId,
      batchId: batch.id,
      targetJobId,
      sourceType,
      sourceName,
      totalFiles: files.length,
      correlationId,
    });

    const queuedItems = await Promise.all(
      files.map((file) =>
        prisma.resumeUploadItem.create({
          data: {
            batchId: batch.id,
            fileName: file.name,
            status: "PENDING",
            note: "Queued for parsing",
          },
          select: { id: true },
        })
      )
    );

    const results: Array<{
      fileName: string;
      itemId?: string;
      candidateId?: string;
      resumeId?: string;
      ok: boolean;
      status: "CREATED" | "UPDATED" | "SKIPPED" | "FAILED";
      note?: string;
      error?: string;
      errorCode?: string;
      attempts?: number;
      retryCount?: number;
      transient?: boolean;
    }> = [];

    const fileEntries = files.map((file, index) => ({
      file,
      itemId: queuedItems[index]?.id,
    }));

    const batchSize = UPLOAD_BATCH_SIZE;
    for (let i = 0; i < fileEntries.length; i += batchSize) {
      const fileBatch = fileEntries.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        fileBatch.map(async ({ file, itemId }) => {
          if (itemId) {
            await prisma.resumeUploadItem.update({
              where: { id: itemId },
              data: { status: "PROCESSING", note: "Parsing in progress", error: null },
            });
          }

          if (file.size > MAX_BYTES) {
            if (itemId) {
              await prisma.resumeUploadItem.update({
                where: { id: itemId },
                data: {
                  status: "FAILED",
                  note: "Validation failed",
                  error: "File exceeds 5MB limit",
                },
              });
            }
            return {
              fileName: file.name,
              itemId,
              ok: false,
              status: "FAILED" as const,
              error: "File exceeds 5MB limit",
              errorCode: "FILE_TOO_LARGE",
              attempts: 1,
              retryCount: 0,
              transient: false,
            };
          }
          if (!ALLOWED_MIME.has(file.type)) {
            if (itemId) {
              await prisma.resumeUploadItem.update({
                where: { id: itemId },
                data: {
                  status: "FAILED",
                  note: "Validation failed",
                  error: "Only PDF or DOCX supported",
                },
              });
            }
            return {
              fileName: file.name,
              itemId,
              ok: false,
              status: "FAILED" as const,
              error: "Only PDF or DOCX supported",
              errorCode: "INVALID_MIME",
              attempts: 1,
              retryCount: 0,
              transient: false,
            };
          }

          let attempt = 0;
          while (attempt < MAX_FILE_ATTEMPTS) {
            attempt += 1;
            let rawText: string | null = null;
            try {
              const buffer = Buffer.from(await file.arrayBuffer());
              rawText = await extractTextFromFile(file.name, file.type, buffer);
              const llm = await extractCandidateProfile(rawText, orgId);
              const extract = llm.extract;
              const { updateCandidate, experiences, projects, technologies, skills, educations } =
                buildCandidateUpdate(extract);

              const matchName =
                typeof updateCandidate.fullName === "string"
                  ? (updateCandidate.fullName as string)
                  : candidateNameFromFile(file.name);
              const matchEmail =
                typeof updateCandidate.email === "string"
                  ? (updateCandidate.email as string)
                  : null;
              const matchPhone =
                typeof updateCandidate.phone === "string"
                  ? (updateCandidate.phone as string)
                  : null;

              const normalizedEmail = normalizeEmail(matchEmail);
              if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
                if (itemId) {
                  await prisma.resumeUploadItem.update({
                    where: { id: itemId },
                    data: {
                      status: "FAILED",
                      note: "Email is required to create or update candidate",
                      error: "No valid email found in resume",
                    },
                  });
                }
                return {
                  fileName: file.name,
                  itemId,
                  ok: false,
                  status: "FAILED" as const,
                  error: "No valid email found in resume",
                  note: "Email is required to create or update candidate",
                  errorCode: "INVALID_EMAIL",
                  attempts: attempt,
                  retryCount: attempt - 1,
                  transient: false,
                };
              }

              const existing = await findExistingCandidate(
                orgId,
                matchName,
                normalizedEmail,
                matchPhone
              );

              if (existing && duplicateMode === "skip") {
                if (itemId) {
                  await prisma.resumeUploadItem.update({
                    where: { id: itemId },
                    data: {
                      candidateId: existing.id,
                      status: "SKIPPED",
                      note: "Candidate already exists, skipped",
                      error: null,
                    },
                  });
                }
                return {
                  fileName: file.name,
                  itemId,
                  ok: true,
                  status: "SKIPPED" as const,
                  candidateId: existing.id,
                  note: "Candidate already exists, skipped",
                  attempts: attempt,
                  retryCount: attempt - 1,
                  transient: false,
                };
              }

              const candidate = existing
                ? await prisma.candidate.update({
                    where: { id: existing.id },
                    data: updateCandidate,
                  })
                : await prisma.candidate.create({
                    data: {
                      orgId,
                      fullName: matchName,
                      email: normalizedEmail,
                      phone: normalizePhone(matchPhone) ?? undefined,
                      ...updateCandidate,
                    },
                  });

              const resume = await prisma.resume.create({
                data: {
                  candidateId: candidate.id,
                  fileName: file.name,
                  mimeType: file.type,
                  sizeBytes: file.size,
                  rawText,
                  parseStatus: "EXTRACTING",
                },
              });

              await prisma.$transaction(async (tx) => {
                if (Object.keys(updateCandidate).length > 0) {
                  await tx.candidate.update({
                    where: { id: candidate.id },
                    data: updateCandidate,
                  });
                }

                await tx.candidateExperience.deleteMany({ where: { candidateId: candidate.id } });
                await tx.candidateProject.deleteMany({ where: { candidateId: candidate.id } });
                await tx.candidateTechnology.deleteMany({ where: { candidateId: candidate.id } });
                await tx.candidateEducation.deleteMany({ where: { candidateId: candidate.id } });

                if (experiences.length) {
                  await tx.candidateExperience.createMany({
                    data: experiences.map((exp) => ({ ...exp, candidateId: candidate.id })),
                  });
                }
                if (projects.length) {
                  await tx.candidateProject.createMany({
                    data: projects.map((project) => ({ ...project, candidateId: candidate.id })),
                  });
                }
                if (technologies.length) {
                  await tx.candidateTechnology.createMany({
                    data: technologies.map((tech) => ({ ...tech, candidateId: candidate.id })),
                  });
                }
                if (educations.length) {
                  await tx.candidateEducation.createMany({
                    data: educations.map((edu) => ({ ...edu, candidateId: candidate.id })),
                  });
                }

                for (const name of skills) {
                  const skill = await tx.skill.upsert({
                    where: { orgId_name: { orgId, name } },
                    update: {},
                    create: { orgId, name },
                  });
                  await tx.candidateSkill.upsert({
                    where: { candidateId_skillId: { candidateId: candidate.id, skillId: skill.id } },
                    update: { source: "resume" },
                    create: { candidateId: candidate.id, skillId: skill.id, source: "resume" },
                  });
                }
              });

              await prisma.resume.update({
                where: { id: resume.id },
                data: {
                  parseStatus: "SAVED",
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

              if (targetJobId) {
                await autoMatchCandidateToJob(candidate.id, targetJobId, orgId);
              } else {
                await autoMatchCandidateToJobs(candidate.id, orgId);
              }

              if (itemId) {
                const retrySuffix = attempt > 1 ? ` after ${attempt - 1} retr${attempt - 1 === 1 ? "y" : "ies"}` : "";
                await prisma.resumeUploadItem.update({
                  where: { id: itemId },
                  data: {
                    candidateId: candidate.id,
                    resumeId: resume.id,
                    status: existing ? "UPDATED" : "CREATED",
                    note: existing
                      ? `Candidate already exists, profile updated from resume${retrySuffix}`
                      : `Candidate created${retrySuffix}`,
                    error: null,
                  },
                });
              }

              return {
                fileName: file.name,
                itemId,
                ok: true,
                status: (existing ? "UPDATED" : "CREATED") as "UPDATED" | "CREATED",
                candidateId: candidate.id,
                resumeId: resume.id,
                note: existing
                  ? "Candidate already exists, profile updated from resume"
                  : "Candidate created",
                attempts: attempt,
                retryCount: attempt - 1,
                transient: false,
              };
            } catch (err: any) {
              const transient = isTransientUploadError(err);
              if (transient && attempt < MAX_FILE_ATTEMPTS) {
                const delayMs = retryDelayMs(attempt);
                logger.warn("Retrying resume upload file", {
                  orgId,
                  batchId: batch.id,
                  fileName: file.name,
                  attempt: attempt + 1,
                  maxAttempts: MAX_FILE_ATTEMPTS,
                  delayMs,
                  correlationId,
                  error: err instanceof Error ? err.message : String(err),
                });
                if (itemId) {
                  await prisma.resumeUploadItem.update({
                    where: { id: itemId },
                    data: {
                      status: "PROCESSING",
                      note: `Retrying (${attempt + 1}/${MAX_FILE_ATTEMPTS})`,
                      error: null,
                    },
                  });
                }
                await sleep(delayMs);
                continue;
              }

              const classified = classifyUploadError(err, !!rawText);
              logger.error("Resume upload file failed", {
                orgId,
                batchId: batch.id,
                fileName: file.name,
                attempts: attempt,
                transient,
                errorCode: classified.code,
                error: classified.message,
                correlationId,
              });

              if (itemId) {
                await prisma.resumeUploadItem.update({
                  where: { id: itemId },
                  data: {
                    status: "FAILED",
                    note: rawText
                      ? "Resume could not be parsed into a candidate profile"
                      : "Resume text extraction failed",
                    error: classified.message,
                  },
                });
              }
              return {
                fileName: file.name,
                itemId,
                ok: false,
                status: "FAILED" as const,
                error: classified.message,
                note: rawText
                  ? "Resume could not be parsed into a candidate profile"
                  : "Resume text extraction failed",
                errorCode: classified.code,
                attempts: attempt,
                retryCount: attempt - 1,
                transient,
              };
            }
          }

          return {
            fileName: file.name,
            itemId,
            ok: false,
            status: "FAILED" as const,
            error: "Upload failed after retries",
            note: "Upload failed after retries",
            errorCode: "UPLOAD_FAILED",
            attempts: MAX_FILE_ATTEMPTS,
            retryCount: MAX_FILE_ATTEMPTS - 1,
            transient: true,
          };
        })
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          results.push({
            fileName: "unknown",
            ok: false,
            status: "FAILED" as const,
            error: result.reason?.message ?? "Upload failed",
            errorCode: "UPLOAD_FAILED",
            attempts: 1,
            retryCount: 0,
            transient: false,
          });
        }
      }
    }

    const createdCount = results.filter((r) => r.status === "CREATED").length;
    const updatedCount = results.filter(
      (r) => r.status === "UPDATED" || r.status === "SKIPPED"
    ).length;
    const failedCountFromResults = results.filter((r) => r.status === "FAILED").length;
    const stuckItems = await prisma.resumeUploadItem.updateMany({
      where: {
        batchId: batch.id,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      data: {
        status: "FAILED",
        note: "Upload interrupted",
        error: "Unexpected failure before completion",
      },
    });
    const failedCount = failedCountFromResults + stuckItems.count;
    const finalStatus =
      failedCount === 0 ? "COMPLETED" : createdCount + updatedCount === 0 ? "FAILED" : "PARTIAL_FAILED";

    await prisma.resumeUploadBatch.update({
      where: { id: batch.id },
      data: {
        processed: results.length,
        createdCount,
        updatedCount,
        failedCount,
        status: finalStatus,
        completedAt: new Date(),
      },
    });
    const failedFiles = results
      .filter((r) => r.status === "FAILED")
      .map((r) => ({
        fileName: r.fileName,
        errorCode: r.errorCode ?? "UPLOAD_FAILED",
        error: r.error ?? "Upload failed",
        attempts: r.attempts ?? 1,
        retryCount: r.retryCount ?? 0,
        transient: r.transient ?? false,
      }));
    logger.info("Bulk resume upload completed", {
      orgId,
      batchId: batch.id,
      targetJobId,
      createdCount,
      updatedCount,
      failedCount,
      correlationId,
    });

    const response = NextResponse.json({
      ok: results.some((r) => r.ok),
      batchId: batch.id,
      targetJobId,
      correlationId,
      results,
      failedFiles,
    });
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }
);

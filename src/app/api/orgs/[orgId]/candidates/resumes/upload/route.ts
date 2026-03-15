export const runtime = "nodejs";
export const maxDuration = 120;

import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTextFromFile } from "@/lib/resume-text-extract";
import {
  extractCandidateProfile,
  extractCandidateProfilesBatch,
  BATCH_LLM_SIZE,
} from "@/lib/resume-llm";
import { buildCandidateUpdate } from "@/lib/resume-apply";
import { createRoute } from "@/lib/api-middleware";
import { autoMatchCandidateToJob, autoMatchCandidateToJobs } from "@/lib/auto-matching";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

const MAX_BYTES = 5 * 1024 * 1024;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
// In production process up to 10 files in parallel; honour env override
const UPLOAD_BATCH_SIZE = Math.max(
  1,
  Math.min(10, Number(process.env.RESUME_UPLOAD_BATCH_SIZE ?? 10) || 10),
);

// ── helpers ──────────────────────────────────────────────────────────────────

function isAllowedFile(file: File): boolean {
  if (ALLOWED_MIME.has(file.type)) return true;
  const lower = file.name.toLowerCase();
  return lower.endsWith(".pdf") || lower.endsWith(".docx");
}

function candidateNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^/.]+$/, "");
  return base.replace(/[_\-]+/g, " ").trim() || "Imported Candidate";
}

function normalizeEmail(email?: string | null): string | null {
  return email ? email.toLowerCase().trim() : null;
}

function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits || null;
}

/**
 * Regex-based contact extraction from the top of a resume.
 * Used BEFORE any LLM call to enable instant dedup lookups.
 */
function fastExtractContactInfo(rawText: string): {
  email: string | null;
  phone: string | null;
  name: string | null;
} {
  const text = rawText.slice(0, 4000);

  // Email — most reliable field in a resume
  const emailMatch = text.match(/\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/);
  const email = emailMatch?.[1]?.toLowerCase() ?? null;

  // Phone — handles +1 (555) 123-4567, 555.123.4567, etc.
  const phoneMatch = text.match(
    /(\+?1?\s*[-.]?\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})(?!\d)/,
  );
  const phone = phoneMatch?.[1] ? phoneMatch[1].replace(/[^\d+]/g, "") : null;

  // Name — first line that looks like a person's name (2–5 words, mostly alpha)
  const lines = text.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);
  let name: string | null = null;
  for (const line of lines.slice(0, 10)) {
    if (line.includes("@") || /https?:\/\//.test(line)) continue;
    if (line.length < 4 || line.length > 60) continue;
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 5) continue;
    if (!/^[A-Za-z\s\-'.]+$/.test(line)) continue;
    if (!words.some((w) => /^[A-Z]/.test(w))) continue;
    name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    break;
  }

  return { email, phone, name };
}

/**
 * Single DB round-trip to find existing candidates for every file at once.
 * Matches on: fullName (case-insensitive) AND (email OR phone).
 */
async function batchFindExistingCandidates(
  orgId: string,
  contacts: Array<{ name: string; email: string | null; phone: string | null }>,
): Promise<Array<{ id: string; fullName: string; email: string | null; phone: string | null }>> {
  const conditions: Prisma.CandidateWhereInput[] = contacts.flatMap(({ name, email, phone }) => {
    const emailNorm = normalizeEmail(email);
    const phoneNorm = normalizePhone(phone);
    if (!emailNorm && !phoneNorm) return [];
    return [
      {
        orgId,
        fullName: { equals: name, mode: "insensitive" as const },
        OR: [
          ...(emailNorm
            ? [{ email: { equals: emailNorm, mode: "insensitive" as const } }]
            : []),
          ...(phoneNorm ? [{ phone: phoneNorm }] : []),
        ].filter(Boolean) as Prisma.CandidateWhereInput[],
      },
    ];
  });

  if (!conditions.length) return [];
  return prisma.candidate.findMany({
    where: { OR: conditions },
    select: { id: true, fullName: true, email: true, phone: true },
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── types ────────────────────────────────────────────────────────────────────

type LlmQueueItem = {
  itemId: string;
  resumeId: string;
  candidateId: string | null; // null = candidate not created yet (no email from regex)
  rawText: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  isNew: boolean; // true = candidate needs to be created
  regexName: string;
  targetJobId: string | null;
};

// ── route ────────────────────────────────────────────────────────────────────

export const POST = createRoute(
  {
    requireAuth: true,
    requireOrg: true,
    permission: "candidates:write",
    rateLimit: { type: "llm", identifier: (_req, userId, orgId) => orgId || userId || "unknown" },
  },
  async (req: NextRequest, { orgId, userId }) => {
    if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

    const correlationId =
      req.headers.get("x-correlation-id")?.trim() || crypto.randomUUID();

    const formData = await req.formData();
    const files = formData.getAll("files").filter((f) => f instanceof File) as File[];

    // Pre-extracted texts sent by the browser (approach 4: client-side PDF extraction).
    // Map of { [fileName]: extractedText }
    let preExtracted: Record<string, string> = {};
    const extractedTextsRaw = formData.get("extractedTexts");
    if (typeof extractedTextsRaw === "string") {
      try {
        preExtracted = JSON.parse(extractedTextsRaw);
      } catch {
        /* ignore malformed JSON */
      }
    }

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

    if (!files.length) return NextResponse.json({ error: "No files provided" }, { status: 400 });

    if (targetJobId) {
      const job = await prisma.job.findFirst({
        where: { id: targetJobId, orgId },
        select: { id: true },
      });
      if (!job) {
        return NextResponse.json(
          { error: "Selected job was not found for this organization." },
          { status: 400 },
        );
      }
    }

    // ── create batch + item records ─────────────────────────────────────────
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

    const queuedItems = await Promise.all(
      files.map((f) =>
        prisma.resumeUploadItem.create({
          data: { batchId: batch.id, fileName: f.name, status: "PENDING", note: "Queued" },
          select: { id: true },
        }),
      ),
    );

    logger.info("Bulk resume upload started", {
      orgId, userId, batchId: batch.id, targetJobId, sourceType, totalFiles: files.length, correlationId,
    });

    // ── Phase 1: text extraction (parallel) ─────────────────────────────────
    // Use client pre-extracted text where available; otherwise extract server-side.
    const extracted = await Promise.all(
      files.map(async (file, idx) => {
        const itemId = queuedItems[idx]?.id ?? null;

        // Validate
        if (file.size > MAX_BYTES) {
          return { file, itemId, rawText: null, error: "File exceeds 5MB limit", errorCode: "FILE_TOO_LARGE" };
        }
        if (!isAllowedFile(file)) {
          return { file, itemId, rawText: null, error: "Only PDF or DOCX supported", errorCode: "INVALID_MIME" };
        }

        // Prefer client-extracted text (approach 4)
        if (preExtracted[file.name]) {
          return { file, itemId, rawText: preExtracted[file.name], error: null, errorCode: null };
        }

        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          const rawText = await extractTextFromFile(file.name, file.type, buffer);
          return { file, itemId, rawText, error: null, errorCode: null };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { file, itemId, rawText: null, error: message, errorCode: "TEXT_EXTRACTION_FAILED" };
        }
      }),
    );

    // ── Phase 2: regex contact extraction ───────────────────────────────────
    const contacts = extracted.map(({ file, rawText }) => {
      if (!rawText) return { name: candidateNameFromFile(file.name), email: null, phone: null };
      const info = fastExtractContactInfo(rawText);
      return { name: info.name || candidateNameFromFile(file.name), email: info.email, phone: info.phone };
    });

    // ── Phase 3: batch dedup DB query (ONE round-trip for all files) ─────────
    const existingCandidates = await batchFindExistingCandidates(orgId, contacts);

    const findExisting = (name: string, email: string | null, phone: string | null) =>
      existingCandidates.find(
        (c) =>
          c.fullName.toLowerCase() === name.toLowerCase() &&
          ((email && c.email?.toLowerCase() === email.toLowerCase()) ||
            (phone && c.phone === phone)),
      ) ?? null;

    // ── Phase 4: instant processing for duplicates + queueing for new ───────
    type UploadResult = {
      fileName: string;
      itemId?: string;
      candidateId?: string;
      resumeId?: string;
      ok: boolean;
      status: "CREATED" | "UPDATED" | "SKIPPED" | "FAILED" | "PROCESSING";
      note?: string;
      error?: string;
      errorCode?: string;
    };

    const results: UploadResult[] = [];
    const llmQueue: LlmQueueItem[] = [];

    // Process files in parallel batches
    for (let batchStart = 0; batchStart < extracted.length; batchStart += UPLOAD_BATCH_SIZE) {
      const slice = extracted.slice(batchStart, batchStart + UPLOAD_BATCH_SIZE);
      const sliceResults = await Promise.all(
        slice.map(async ({ file, itemId, rawText, error, errorCode }, localIdx) => {
          const globalIdx = batchStart + localIdx;
          const contact = contacts[globalIdx];
          const { name: regexName, email: regexEmail, phone: regexPhone } = contact;
          const normalizedEmail = normalizeEmail(regexEmail);
          const normalizedPhone = normalizePhone(regexPhone);

          // Text extraction failed
          if (!rawText || error) {
            if (itemId) {
              await prisma.resumeUploadItem.update({
                where: { id: itemId },
                data: { status: "FAILED", note: "Text extraction failed", error: error ?? "Unknown" },
              });
            }
            return {
              fileName: file.name, itemId, ok: false,
              status: "FAILED" as const, error: error ?? "Text extraction failed", errorCode: errorCode ?? "TEXT_EXTRACTION_FAILED",
            };
          }

          const existing = findExisting(regexName, normalizedEmail, normalizedPhone);

          // ── Skip duplicate ───────────────────────────────────────────────
          if (existing && duplicateMode === "skip") {
            if (itemId) {
              await prisma.resumeUploadItem.update({
                where: { id: itemId },
                data: { status: "SKIPPED", candidateId: existing.id, note: "Candidate already exists, skipped" },
              });
            }
            return { fileName: file.name, itemId, ok: true, status: "SKIPPED" as const, candidateId: existing.id, note: "Candidate already exists, skipped" };
          }

          // ── Update existing candidate (INSTANT — no LLM) ────────────────
          if (existing) {
            const resume = await prisma.resume.create({
              data: {
                candidateId: existing.id,
                fileName: file.name,
                mimeType: file.type || "application/octet-stream",
                sizeBytes: file.size,
                rawText,
                parseStatus: "QUEUED",
              },
            });
            if (itemId) {
              await prisma.resumeUploadItem.update({
                where: { id: itemId },
                data: {
                  status: "UPDATED",
                  candidateId: existing.id,
                  resumeId: resume.id,
                  note: "Candidate already exists, profile updated from resume",
                },
              });
            }
            // Queue for LLM enrichment (runs after response)
            llmQueue.push({
              itemId: itemId as string,
              resumeId: resume.id,
              candidateId: existing.id,
              rawText,
              fileName: file.name,
              mimeType: file.type || "application/octet-stream",
              fileSize: file.size,
              isNew: false,
              regexName,
              targetJobId,
            });
            return {
              fileName: file.name, itemId, ok: true, status: "UPDATED" as const,
              candidateId: existing.id, resumeId: resume.id,
              note: "Candidate already exists, profile updated from resume",
            };
          }

          // ── New candidate ────────────────────────────────────────────────
          // If regex found a valid email, create a stub immediately.
          // Otherwise, queue for full LLM (LLM will provide the email).
          if (normalizedEmail && EMAIL_REGEX.test(normalizedEmail)) {
            const stub = await prisma.candidate.create({
              data: { orgId, fullName: regexName, email: normalizedEmail, phone: normalizedPhone ?? undefined, source: "IMPORT", status: "ACTIVE" },
            });
            const resume = await prisma.resume.create({
              data: {
                candidateId: stub.id,
                fileName: file.name,
                mimeType: file.type || "application/octet-stream",
                sizeBytes: file.size,
                rawText,
                parseStatus: "QUEUED",
              },
            });
            if (itemId) {
              await prisma.resumeUploadItem.update({
                where: { id: itemId },
                data: { status: "PROCESSING", candidateId: stub.id, resumeId: resume.id, note: "Queued for AI enrichment" },
              });
            }
            llmQueue.push({
              itemId: itemId as string, resumeId: resume.id, candidateId: stub.id,
              rawText, fileName: file.name, mimeType: file.type || "application/octet-stream",
              fileSize: file.size, isNew: true, regexName, targetJobId,
            });
            return {
              fileName: file.name, itemId, ok: true, status: "PROCESSING" as const,
              candidateId: stub.id, resumeId: resume.id, note: "Queued for AI enrichment",
            };
          }

          // No email from regex — must LLM first to get email before creating candidate
          if (itemId) {
            await prisma.resumeUploadItem.update({
              where: { id: itemId },
              data: { status: "PROCESSING", note: "Queued for AI parsing" },
            });
          }
          llmQueue.push({
            itemId: itemId as string, resumeId: "", candidateId: null,
            rawText, fileName: file.name, mimeType: file.type || "application/octet-stream",
            fileSize: file.size, isNew: true, regexName, targetJobId,
          });
          return { fileName: file.name, itemId, ok: true, status: "PROCESSING" as const, note: "Queued for AI parsing" };
        }),
      );
      results.push(...sliceResults);
    }

    // Finalize counts for instantly-resolved items
    const instantCreated = results.filter((r) => r.status === "CREATED").length;
    const instantUpdated = results.filter((r) => r.status === "UPDATED" || r.status === "SKIPPED").length;
    const instantFailed = results.filter((r) => r.status === "FAILED").length;
    const processing = results.filter((r) => r.status === "PROCESSING").length;

    await prisma.resumeUploadBatch.update({
      where: { id: batch.id },
      data: {
        processed: results.length - processing,
        createdCount: instantCreated,
        updatedCount: instantUpdated,
        failedCount: instantFailed,
        status: processing > 0 ? "PROCESSING" : (instantFailed === results.length ? "FAILED" : "COMPLETED"),
      },
    });

    // ── Phase 5: LLM enrichment runs AFTER response is sent ─────────────────
    // Uses Next.js after() so the client gets the 200 immediately.
    if (llmQueue.length > 0) {
      after(async () => {
        let totalCreated = instantCreated;
        let totalUpdated = instantUpdated;
        let totalFailed = instantFailed;

        // Items needing full candidate creation (no regex email) vs enrichment-only
        const needsCreate = llmQueue.filter((q) => q.candidateId === null);
        const needsEnrich = llmQueue.filter((q) => q.candidateId !== null);

        // Helper: apply LLM extract to DB
        const applyExtract = async (
          q: LlmQueueItem,
          extract: NonNullable<Awaited<ReturnType<typeof extractCandidateProfilesBatch>>[number]["extract"]>,
          candidateId: string,
          resumeId: string,
        ) => {
          const { updateCandidate, experiences, projects, technologies, skills, educations } =
            buildCandidateUpdate(extract);

          await prisma.$transaction(async (tx) => {
            if (Object.keys(updateCandidate).length) {
              await tx.candidate.update({ where: { id: candidateId }, data: updateCandidate });
            }
            await tx.candidateExperience.deleteMany({ where: { candidateId } });
            await tx.candidateProject.deleteMany({ where: { candidateId } });
            await tx.candidateTechnology.deleteMany({ where: { candidateId } });
            await tx.candidateEducation.deleteMany({ where: { candidateId } });
            if (experiences.length)
              await tx.candidateExperience.createMany({ data: experiences.map((e) => ({ ...e, candidateId })) });
            if (projects.length)
              await tx.candidateProject.createMany({ data: projects.map((p) => ({ ...p, candidateId })) });
            if (technologies.length)
              await tx.candidateTechnology.createMany({ data: technologies.map((t) => ({ ...t, candidateId })) });
            if (educations.length)
              await tx.candidateEducation.createMany({ data: educations.map((e) => ({ ...e, candidateId })) });
            for (const name of skills) {
              const skill = await tx.skill.upsert({
                where: { orgId_name: { orgId, name } },
                create: { name, orgId },
                update: {},
              });
              await tx.candidateSkill.upsert({
                where: { candidateId_skillId: { candidateId, skillId: skill.id } },
                create: { candidateId, skillId: skill.id, source: "resume" },
                update: { source: "resume" },
              });
            }
          });

          await prisma.resume.update({
            where: { id: resumeId },
            data: {
              parseStatus: "SAVED",
              parseError: null,
              parsedAt: new Date(),
              parsedJson: { ...extract, extractedAt: new Date().toISOString() },
            },
          });

          // Auto-match fire-and-forget
          const matchFn = q.targetJobId
            ? () => autoMatchCandidateToJob(candidateId, q.targetJobId!, orgId)
            : () => autoMatchCandidateToJobs(candidateId, orgId);
          matchFn().catch((err) =>
            logger.error("Auto-match failed after upload", { candidateId, error: err instanceof Error ? err.message : String(err) }),
          );
        };

        // ── Process needsCreate items in batches of BATCH_LLM_SIZE ──────────
        for (const batchChunk of chunk(needsCreate, BATCH_LLM_SIZE)) {
          const batchItems = batchChunk.map((q) => ({ rawText: q.rawText, fileName: q.fileName }));
          const batchResults = await extractCandidateProfilesBatch(batchItems, orgId);

          for (let i = 0; i < batchChunk.length; i++) {
            const q = batchChunk[i];
            const r = batchResults[i];

            if (!r.extract) {
              // Try individual fallback
              let fallbackExtract = null;
              try {
                const individual = await extractCandidateProfile(q.rawText, orgId);
                fallbackExtract = individual.extract;
              } catch {}

              if (!fallbackExtract) {
                await prisma.resumeUploadItem.update({
                  where: { id: q.itemId },
                  data: { status: "FAILED", note: "AI parsing failed", error: r.error ?? "Unknown" },
                });
                totalFailed++;
                continue;
              }
              r.extract = fallbackExtract;
            }

            const emailFromLLM = normalizeEmail(r.extract.personal.email);
            if (!emailFromLLM || !EMAIL_REGEX.test(emailFromLLM)) {
              await prisma.resumeUploadItem.update({
                where: { id: q.itemId },
                data: { status: "FAILED", note: "No valid email found in resume", error: "INVALID_EMAIL" },
              });
              totalFailed++;
              continue;
            }

            try {
              const { updateCandidate } = buildCandidateUpdate(r.extract);
              const candidate = await prisma.candidate.create({
                data: {
                  orgId,
                  fullName: r.extract.personal.fullName || q.regexName,
                  email: emailFromLLM,
                  phone: normalizePhone(r.extract.personal.phone) ?? undefined,
                  source: "IMPORT",
                  status: "ACTIVE",
                  ...updateCandidate,
                },
              });
              const resume = await prisma.resume.create({
                data: {
                  candidateId: candidate.id,
                  fileName: q.fileName,
                  mimeType: q.mimeType,
                  sizeBytes: q.fileSize,
                  rawText: q.rawText,
                  parseStatus: "EXTRACTING",
                },
              });
              await applyExtract(q, r.extract, candidate.id, resume.id);
              await prisma.resumeUploadItem.update({
                where: { id: q.itemId },
                data: { status: "CREATED", candidateId: candidate.id, resumeId: resume.id, note: "Candidate created", error: null },
              });
              totalCreated++;
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              await prisma.resumeUploadItem.update({
                where: { id: q.itemId },
                data: { status: "FAILED", error: message, note: "Failed to create candidate" },
              });
              totalFailed++;
            }
          }
        }

        // ── Enrich existing stubs in batches of BATCH_LLM_SIZE ───────────
        for (const batchChunk of chunk(needsEnrich, BATCH_LLM_SIZE)) {
          const batchItems = batchChunk.map((q) => ({ rawText: q.rawText, fileName: q.fileName }));
          const batchResults = await extractCandidateProfilesBatch(batchItems, orgId);

          for (let i = 0; i < batchChunk.length; i++) {
            const q = batchChunk[i];
            const r = batchResults[i];
            let extract = r.extract;

            if (!extract) {
              try {
                const individual = await extractCandidateProfile(q.rawText, orgId);
                extract = individual.extract;
              } catch {}
            }

            if (!extract) {
              // Enrichment failed but the candidate/resume record already exists — mark resume NEEDS_REVIEW
              await prisma.resume.update({
                where: { id: q.resumeId },
                data: { parseStatus: "NEEDS_REVIEW", parseError: r.error ?? "LLM enrichment failed" },
              });
              await prisma.resumeUploadItem.update({
                where: { id: q.itemId },
                data: { status: q.isNew ? "CREATED" : "UPDATED", note: "AI enrichment failed — manual review needed" },
              });
              if (q.isNew) totalCreated++; else totalUpdated++;
              continue;
            }

            try {
              await applyExtract(q, extract, q.candidateId!, q.resumeId);
              await prisma.resumeUploadItem.update({
                where: { id: q.itemId },
                data: { status: q.isNew ? "CREATED" : "UPDATED", note: q.isNew ? "Candidate created" : "Profile enriched from resume", error: null },
              });
              if (q.isNew) totalCreated++; else totalUpdated++;
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              await prisma.resume.update({
                where: { id: q.resumeId },
                data: { parseStatus: "NEEDS_REVIEW", parseError: message },
              });
              await prisma.resumeUploadItem.update({
                where: { id: q.itemId },
                data: { status: q.isNew ? "CREATED" : "UPDATED", note: "Partially processed — AI enrichment failed" },
              });
              if (q.isNew) totalCreated++; else totalUpdated++;
            }
          }
        }

        // Final batch update
        const finalFailed = totalFailed;
        const finalSuccess = totalCreated + totalUpdated;
        await prisma.resumeUploadBatch.update({
          where: { id: batch.id },
          data: {
            processed: results.length,
            createdCount: totalCreated,
            updatedCount: totalUpdated,
            failedCount: finalFailed,
            status: finalFailed === 0 ? "COMPLETED" : finalSuccess === 0 ? "FAILED" : "PARTIAL_FAILED",
            completedAt: new Date(),
          },
        });

        logger.info("Bulk upload LLM enrichment complete", {
          batchId: batch.id, orgId, created: totalCreated, updated: totalUpdated, failed: finalFailed,
        });
      });
    } else {
      // Nothing queued — mark batch complete now
      await prisma.resumeUploadBatch.update({
        where: { id: batch.id },
        data: {
          processed: results.length,
          status: instantFailed === results.length ? "FAILED" : "COMPLETED",
          completedAt: new Date(),
        },
      });
    }

    const response = NextResponse.json({
      ok: results.some((r) => r.ok),
      batchId: batch.id,
      targetJobId,
      correlationId,
      results,
      failedFiles: results
        .filter((r) => r.status === "FAILED")
        .map((r) => ({ fileName: r.fileName, errorCode: r.errorCode ?? "UPLOAD_FAILED", error: r.error ?? "Upload failed" })),
    });
    response.headers.set("x-correlation-id", correlationId);
    return response;
  },
);

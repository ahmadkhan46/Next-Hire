export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTextFromFile } from "@/lib/resume-text-extract";
import {
  extractCandidateProfile,
  extractCandidateProfilesBatch,
  BATCH_LLM_SIZE,
} from "@/lib/resume-llm";
import type { CandidateProfileExtract } from "@/lib/resume-extract-schema";
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
// ── helpers ──────────────────────────────────────────────────────────────────

function isAllowedFile(file: File): boolean {
  if (ALLOWED_MIME.has(file.type)) return true;
  const lower = file.name.toLowerCase();
  return lower.endsWith(".pdf") || lower.endsWith(".docx");
}


function normalizeEmail(email?: string | null): string | null {
  return email ? email.toLowerCase().trim() : null;
}

function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits || null;
}

function fastExtractContactInfo(rawText: string): {
  email: string | null;
  phone: string | null;
  name: string | null;
} {
  const text = rawText.slice(0, 4000);
  const emailMatch = text.match(/\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/);
  const email = emailMatch?.[1]?.toLowerCase() ?? null;
  const phoneMatch = text.match(
    /(\+?1?\s*[-.]?\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})(?!\d)/,
  );
  const phone = phoneMatch?.[1] ? phoneMatch[1].replace(/[^\d+]/g, "") : null;
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

async function batchFindExistingCandidates(
  orgId: string,
  contacts: Array<{ email: string | null; phone: string | null }>,
): Promise<Array<{ id: string; fullName: string; email: string | null; phone: string | null }>> {
  const conditions: Prisma.CandidateWhereInput[] = contacts.flatMap(({ email, phone }) => {
    const emailNorm = normalizeEmail(email);
    const phoneNorm = normalizePhone(phone);
    if (!emailNorm && !phoneNorm) return [];
    return [
      {
        orgId,
        OR: [
          ...(emailNorm ? [{ email: { equals: emailNorm, mode: "insensitive" as const } }] : []),
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

type UploadResult = {
  fileName: string;
  itemId?: string;
  candidateId?: string;
  resumeId?: string;
  ok: boolean;
  status: "CREATED" | "UPDATED" | "SKIPPED" | "FAILED";
  note?: string;
  error?: string;
  errorCode?: string;
};

type LlmQueueItem = {
  itemId: string;
  resumeId: string;
  candidateId: string | null;
  rawText: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  isNew: boolean;
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

    let preExtracted: Record<string, string> = {};
    const extractedTextsRaw = formData.get("extractedTexts");
    if (typeof extractedTextsRaw === "string") {
      try { preExtracted = JSON.parse(extractedTextsRaw); } catch { /* ignore */ }
    }

    const sourceTypeRaw = String(formData.get("sourceType") ?? "PDF_DOCX");
    const duplicateModeRaw = String(formData.get("duplicateMode") ?? "skip");
    const duplicateMode = duplicateModeRaw === "update" ? "update" : "skip";
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
      const job = await prisma.job.findFirst({ where: { id: targetJobId, orgId }, select: { id: true } });
      if (!job) return NextResponse.json({ error: "Selected job was not found." }, { status: 400 });
    }

    // ── Create batch + item records ─────────────────────────────────────────
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
    const extracted = await Promise.all(
      files.map(async (file, idx) => {
        const itemId = queuedItems[idx]?.id ?? null;
        if (file.size > MAX_BYTES) {
          return { file, itemId, rawText: null, error: "File exceeds 5MB limit", errorCode: "FILE_TOO_LARGE" };
        }
        if (!isAllowedFile(file)) {
          return { file, itemId, rawText: null, error: "Only PDF or DOCX supported", errorCode: "INVALID_MIME" };
        }
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

    // ── Phase 2: regex contact extraction (email + phone only — no filename) ──
    const contacts = extracted.map(({ rawText }) => {
      if (!rawText) return { email: null, phone: null };
      const info = fastExtractContactInfo(rawText);
      return { email: info.email, phone: info.phone };
    });

    // ── Phase 3: batch dedup DB query ────────────────────────────────────────
    const existingCandidates = await batchFindExistingCandidates(orgId, contacts);
    const findExisting = (email: string | null, phone: string | null) =>
      existingCandidates.find(
        (c) =>
          (email && c.email?.toLowerCase() === email.toLowerCase()) ||
          (phone && c.phone === phone),
      ) ?? null;

    // ── Phase 4: categorize files ────────────────────────────────────────────
    const instantResults: UploadResult[] = [];
    const createQueue: LlmQueueItem[] = []; // new candidates — need LLM to extract profile
    const updateQueue: LlmQueueItem[] = []; // existing — need LLM to enrich

    for (let idx = 0; idx < extracted.length; idx++) {
      const { file, itemId, rawText, error, errorCode } = extracted[idx];
      const { email: regexEmail, phone: regexPhone } = contacts[idx];
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
        instantResults.push({
          fileName: file.name, itemId: itemId ?? undefined, ok: false,
          status: "FAILED", error: error ?? "Text extraction failed", errorCode: errorCode ?? "TEXT_EXTRACTION_FAILED",
        });
        continue;
      }

      const existing = findExisting(normalizedEmail, normalizedPhone);

      // Duplicate — skip
      if (existing && duplicateMode === "skip") {
        if (itemId) {
          await prisma.resumeUploadItem.update({
            where: { id: itemId },
            data: { status: "SKIPPED", candidateId: existing.id, note: "Candidate already exists, skipped" },
          });
        }
        instantResults.push({
          fileName: file.name, itemId: itemId ?? undefined, ok: true,
          status: "SKIPPED", candidateId: existing.id, note: "Candidate already exists, skipped",
        });
        continue;
      }

      // Duplicate — update (enrich with LLM)
      if (existing) {
        // Replace old resumes so the candidate always has one current resume
        await prisma.resume.deleteMany({ where: { candidateId: existing.id } });
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
            data: { status: "PENDING", candidateId: existing.id, resumeId: resume.id, note: "AI enrichment in progress" },
          });
        }
        updateQueue.push({
          itemId: itemId!, resumeId: resume.id, candidateId: existing.id,
          rawText, fileName: file.name, mimeType: file.type || "application/octet-stream",
          fileSize: file.size, isNew: false, targetJobId,
        });
        continue;
      }

      // New candidate — need LLM
      if (itemId) {
        await prisma.resumeUploadItem.update({
          where: { id: itemId },
          data: { status: "PENDING", note: "AI parsing in progress" },
        });
      }
      createQueue.push({
        itemId: itemId!, resumeId: "", candidateId: null,
        rawText, fileName: file.name, mimeType: file.type || "application/octet-stream",
        fileSize: file.size, isNew: true, targetJobId,
      });
    }

    // ── Phase 5: apply LLM extract to DB ─────────────────────────────────────
    // Helper: apply an LLM extract to an existing candidate + resume
    const applyExtract = async (
      candidateId: string,
      resumeId: string,
      extract: CandidateProfileExtract,
      targetJob: string | null,
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

      // Auto-match — fire and forget, never blocks the response
      (targetJob
        ? autoMatchCandidateToJob(candidateId, targetJob, orgId)
        : autoMatchCandidateToJobs(candidateId, orgId)
      ).catch((err) =>
        logger.error("Auto-match failed", { candidateId, error: err instanceof Error ? err.message : String(err) }),
      );
    };

    const llmResults: UploadResult[] = [];

    // ── Process createQueue (new candidates) ────────────────────────────────
    for (const batchChunk of chunk(createQueue, BATCH_LLM_SIZE)) {
      const batchItems = batchChunk.map((q) => ({ rawText: q.rawText, fileName: q.fileName }));
      const batchResults = await extractCandidateProfilesBatch(batchItems, orgId);

      for (let i = 0; i < batchChunk.length; i++) {
        const q = batchChunk[i];
        let extract = batchResults[i]?.extract ?? null;

        // Batch item failed — try individual fallback
        if (!extract) {
          try {
            extract = (await extractCandidateProfile(q.rawText, orgId)).extract;
          } catch { /* extract stays null */ }
        }

        if (!extract) {
          const errMsg = batchResults[i]?.error ?? "AI parsing failed";
          await prisma.resumeUploadItem.update({
            where: { id: q.itemId },
            data: { status: "FAILED", error: errMsg, note: "AI parsing failed" },
          });
          llmResults.push({ fileName: q.fileName, itemId: q.itemId, ok: false, status: "FAILED", error: errMsg, errorCode: "LLM_FAILED" });
          continue;
        }

        const emailFromLLM = normalizeEmail(extract.personal?.email);
        if (!emailFromLLM || !EMAIL_REGEX.test(emailFromLLM)) {
          await prisma.resumeUploadItem.update({
            where: { id: q.itemId },
            data: { status: "FAILED", error: "No valid email found in resume", note: "Cannot create candidate without email" },
          });
          llmResults.push({ fileName: q.fileName, itemId: q.itemId, ok: false, status: "FAILED", error: "No valid email found in resume", errorCode: "INVALID_EMAIL" });
          continue;
        }

        try {
          const { updateCandidate, experiences, projects, technologies, skills, educations } =
            buildCandidateUpdate(extract);

          // Strip fields we set explicitly so there's no conflict
          const { fullName: _fn, email: _em, phone: _ph, ...safeUpdate } = updateCandidate as Record<string, unknown>;

          const candidate = await prisma.candidate.create({
            data: {
              orgId,
              fullName: extract.personal?.fullName || "Unknown Candidate",
              email: emailFromLLM,
              phone: normalizePhone(extract.personal?.phone) ?? undefined,
              source: "IMPORT",
              status: "ACTIVE",
              ...safeUpdate,
            },
          });

          const resume = await prisma.resume.create({
            data: {
              candidateId: candidate.id,
              fileName: q.fileName,
              mimeType: q.mimeType,
              sizeBytes: q.fileSize,
              rawText: q.rawText,
              parseStatus: "SAVED",
              parsedAt: new Date(),
              parsedJson: { ...extract, extractedAt: new Date().toISOString() },
            },
          });

          // Create related records
          await prisma.$transaction(async (tx) => {
            if (experiences.length)
              await tx.candidateExperience.createMany({ data: experiences.map((e) => ({ ...e, candidateId: candidate.id })) });
            if (projects.length)
              await tx.candidateProject.createMany({ data: projects.map((p) => ({ ...p, candidateId: candidate.id })) });
            if (technologies.length)
              await tx.candidateTechnology.createMany({ data: technologies.map((t) => ({ ...t, candidateId: candidate.id })) });
            if (educations.length)
              await tx.candidateEducation.createMany({ data: educations.map((e) => ({ ...e, candidateId: candidate.id })) });
            for (const name of skills) {
              const skill = await tx.skill.upsert({
                where: { orgId_name: { orgId, name } },
                create: { name, orgId },
                update: {},
              });
              await tx.candidateSkill.upsert({
                where: { candidateId_skillId: { candidateId: candidate.id, skillId: skill.id } },
                create: { candidateId: candidate.id, skillId: skill.id, source: "resume" },
                update: { source: "resume" },
              });
            }
          });

          await prisma.resumeUploadItem.update({
            where: { id: q.itemId },
            data: { status: "CREATED", candidateId: candidate.id, resumeId: resume.id, note: "Candidate created", error: null },
          });
          llmResults.push({
            fileName: q.fileName, itemId: q.itemId, ok: true,
            status: "CREATED", candidateId: candidate.id, resumeId: resume.id, note: "Candidate created",
          });

          // Auto-match — fire and forget
          (q.targetJobId
            ? autoMatchCandidateToJob(candidate.id, q.targetJobId, orgId)
            : autoMatchCandidateToJobs(candidate.id, orgId)
          ).catch((err) =>
            logger.error("Auto-match failed", { candidateId: candidate.id, error: err instanceof Error ? err.message : String(err) }),
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await prisma.resumeUploadItem.update({
            where: { id: q.itemId },
            data: { status: "FAILED", error: message, note: "Failed to create candidate" },
          });
          llmResults.push({ fileName: q.fileName, itemId: q.itemId, ok: false, status: "FAILED", error: message, errorCode: "CREATE_FAILED" });
        }
      }
    }

    // ── Process updateQueue (existing candidates — enrich) ──────────────────
    for (const batchChunk of chunk(updateQueue, BATCH_LLM_SIZE)) {
      const batchItems = batchChunk.map((q) => ({ rawText: q.rawText, fileName: q.fileName }));
      const batchResults = await extractCandidateProfilesBatch(batchItems, orgId);

      for (let i = 0; i < batchChunk.length; i++) {
        const q = batchChunk[i];
        let extract = batchResults[i]?.extract ?? null;

        if (!extract) {
          try {
            extract = (await extractCandidateProfile(q.rawText, orgId)).extract;
          } catch { /* stays null */ }
        }

        if (!extract) {
          // Candidate + resume already exist — mark resume as needing review
          await prisma.resume.update({
            where: { id: q.resumeId },
            data: { parseStatus: "NEEDS_REVIEW", parseError: batchResults[i]?.error ?? "AI enrichment failed" },
          });
          await prisma.resumeUploadItem.update({
            where: { id: q.itemId },
            data: { status: "UPDATED", note: "Candidate updated — AI enrichment failed, manual review needed" },
          });
          llmResults.push({
            fileName: q.fileName, itemId: q.itemId, ok: true,
            status: "UPDATED", candidateId: q.candidateId!, resumeId: q.resumeId,
            note: "Candidate updated — AI enrichment failed, manual review needed",
          });
          continue;
        }

        try {
          await applyExtract(q.candidateId!, q.resumeId, extract, q.targetJobId);
          await prisma.resumeUploadItem.update({
            where: { id: q.itemId },
            data: { status: "UPDATED", note: "Profile enriched from resume", error: null },
          });
          llmResults.push({
            fileName: q.fileName, itemId: q.itemId, ok: true,
            status: "UPDATED", candidateId: q.candidateId!, resumeId: q.resumeId,
            note: "Profile enriched from resume",
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await prisma.resume.update({
            where: { id: q.resumeId },
            data: { parseStatus: "NEEDS_REVIEW", parseError: message },
          });
          await prisma.resumeUploadItem.update({
            where: { id: q.itemId },
            data: { status: "UPDATED", note: "Candidate updated — AI enrichment partially failed" },
          });
          llmResults.push({
            fileName: q.fileName, itemId: q.itemId, ok: true,
            status: "UPDATED", candidateId: q.candidateId!, resumeId: q.resumeId,
            note: "Candidate updated — AI enrichment partially failed",
          });
        }
      }
    }

    // ── Final results + batch status ─────────────────────────────────────────
    const allResults = [...instantResults, ...llmResults];
    const created = allResults.filter((r) => r.status === "CREATED").length;
    const updated = allResults.filter((r) => r.status === "UPDATED").length;
    const skipped = allResults.filter((r) => r.status === "SKIPPED").length;
    const failed = allResults.filter((r) => r.status === "FAILED").length;

    await prisma.resumeUploadBatch.update({
      where: { id: batch.id },
      data: {
        processed: allResults.length,
        createdCount: created,
        updatedCount: updated + skipped,
        failedCount: failed,
        status:
          failed === 0
            ? "COMPLETED"
            : created + updated + skipped === 0
              ? "FAILED"
              : "PARTIAL_FAILED",
        completedAt: new Date(),
      },
    });

    logger.info("Bulk upload complete", {
      batchId: batch.id, orgId, created, updated, skipped, failed,
    });

    const response = NextResponse.json({
      ok: allResults.some((r) => r.ok),
      batchId: batch.id,
      targetJobId,
      correlationId,
      results: allResults,
      failedFiles: allResults
        .filter((r) => r.status === "FAILED")
        .map((r) => ({ fileName: r.fileName, errorCode: r.errorCode ?? "UPLOAD_FAILED", error: r.error ?? "Upload failed" })),
    });
    response.headers.set("x-correlation-id", correlationId);
    return response;
  },
);

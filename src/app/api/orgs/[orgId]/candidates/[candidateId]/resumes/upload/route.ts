export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTextFromFile } from "@/lib/resume-text-extract";
import { createRoute } from "@/lib/api-middleware";
import { logCandidateActivity } from "@/lib/candidate-activity";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const POST = createRoute(
  {
    requireAuth: true,
    requireOrg: true,
    permission: "candidates:write",
    rateLimit: { type: "api" },
  },
  async (req: NextRequest, { params, userId }) => {
    const { orgId, candidateId } = params as { orgId: string; candidateId: string };

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, orgId },
      select: { id: true },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File exceeds 5MB limit" },
        { status: 400 }
      );
    }

    const fileName = file.name || "resume";
    const mimeType = file.type || "application/octet-stream";

    if (!ALLOWED_MIME.has(mimeType)) {
      return NextResponse.json(
        { error: "Only PDF and DOCX are supported" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawText = await extractTextFromFile(fileName, mimeType, buffer);

    const resume = await prisma.resume.create({
      data: {
        candidateId,
        fileName,
        mimeType,
        sizeBytes: file.size,
        rawText,
        parseStatus: "QUEUED",
      },
    });

    await logCandidateActivity({
      orgId,
      candidateId,
      type: "RESUME_UPLOADED",
      title: "Resume uploaded",
      description: `${fileName} was uploaded for parsing.`,
      actorId: userId,
      metadata: { resumeId: resume.id, fileName, sizeBytes: file.size },
    });

    return NextResponse.json({ ok: true, resume });
  }
);

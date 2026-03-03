import { NextResponse } from "next/server";
import { z } from "zod";
import { createProtectedRoute } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { logCandidateActivity } from "@/lib/candidate-activity";

const updateNoteSchema = z.object({
  content: z.string().min(1).max(5000),
  isImportant: z.boolean().optional(),
});

function extractMentions(content: string) {
  const matches = content.match(/@[a-zA-Z0-9._-]+/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase())));
}

export const PATCH = createProtectedRoute(
  "candidates:write",
  async (req, { params, body, userId }) => {
    const { orgId, candidateId, noteId } = await params;
    const payload = body ?? (await req.json());
    const data = updateNoteSchema.parse(payload);

    const existing = await prisma.candidateNote.findFirst({
      where: { id: noteId, orgId, candidateId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const note = await prisma.candidateNote.update({
      where: { id: noteId },
      data: {
        content: data.content.trim(),
        isImportant: !!data.isImportant,
        authorId: userId ?? null,
      },
      select: {
        id: true,
        content: true,
        isImportant: true,
        createdAt: true,
        updatedAt: true,
        authorId: true,
      },
    });
    const mentions = extractMentions(data.content);

    await logCandidateActivity({
      orgId,
      candidateId,
      type: "NOTE_UPDATED",
      title: "Note updated",
      description: data.content.trim().slice(0, 180),
      actorId: userId,
      metadata: { noteId, isImportant: !!data.isImportant, mentions },
    });

    return NextResponse.json({ ok: true, note });
  }
);

export const DELETE = createProtectedRoute(
  "candidates:write",
  async (_req, { params, userId }) => {
    const { orgId, candidateId, noteId } = await params;

    const existing = await prisma.candidateNote.findFirst({
      where: { id: noteId, orgId, candidateId },
      select: { id: true, content: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    await prisma.candidateNote.delete({ where: { id: noteId } });

    await logCandidateActivity({
      orgId,
      candidateId,
      type: "NOTE_REMOVED",
      title: "Note removed",
      description: existing.content.slice(0, 180),
      actorId: userId,
      metadata: { noteId },
    });

    return NextResponse.json({ ok: true });
  }
);

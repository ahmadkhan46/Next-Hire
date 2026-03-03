import { NextResponse } from "next/server";
import { z } from "zod";
import { createProtectedRoute } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { logCandidateActivity } from "@/lib/candidate-activity";

const createNoteSchema = z.object({
  content: z.string().min(1).max(5000),
  isImportant: z.boolean().optional(),
});

function extractMentions(content: string) {
  const matches = content.match(/@[a-zA-Z0-9._-]+/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase())));
}

export const GET = createProtectedRoute(
  "candidates:read",
  async (req, { params }) => {
    const { orgId, candidateId } = await params;
    const cursor = req.nextUrl.searchParams.get("cursor");
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "10");
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 50)
      : 10;

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, orgId },
      select: { id: true },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const notes = await prisma.candidateNote.findMany({
      where: { orgId, candidateId },
      orderBy: [{ isImportant: "desc" }, { createdAt: "desc" }],
      ...(cursor
        ? { cursor: { id: cursor }, skip: 1 }
        : {}),
      take: limit,
      select: {
        id: true,
        content: true,
        isImportant: true,
        createdAt: true,
        updatedAt: true,
        authorId: true,
      },
    });

    const nextCursor = notes.length === limit ? notes[notes.length - 1]?.id ?? null : null;

    return NextResponse.json({ notes, nextCursor });
  }
);

export const POST = createProtectedRoute(
  "candidates:write",
  async (req, { params, body, userId }) => {
    const { orgId, candidateId } = await params;
    const payload = body ?? (await req.json());
    const data = createNoteSchema.parse(payload);

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, orgId },
      select: { id: true },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const note = await prisma.candidateNote.create({
      data: {
        orgId,
        candidateId,
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
      type: "NOTE_ADDED",
      title: data.isImportant ? "Important note added" : "Note added",
      description: data.content.trim().slice(0, 180),
      actorId: userId,
      metadata: { noteId: note.id, isImportant: !!data.isImportant, mentions },
    });

    return NextResponse.json({ ok: true, note });
  }
);

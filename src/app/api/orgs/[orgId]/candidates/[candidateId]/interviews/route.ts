import { NextResponse } from "next/server";
import { z } from "zod";
import { createProtectedRoute } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { logCandidateActivity } from "@/lib/candidate-activity";

const createInterviewSchema = z.object({
  title: z.string().min(1).max(200),
  round: z.string().max(100).optional().nullable(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(240).optional(),
  timezone: z.string().max(80).optional(),
  meetingType: z.string().max(40).optional(),
  meetingLink: z.string().url().max(1000).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  interviewer: z.string().max(120).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const GET = createProtectedRoute(
  "candidates:read",
  async (req, { params }) => {
    const { orgId, candidateId } = await params;
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "10");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 10;

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, orgId },
      select: { id: true },
    });
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const interviews = await prisma.candidateInterview.findMany({
      where: { orgId, candidateId },
      orderBy: [{ scheduledAt: "desc" }],
      take: limit,
      select: {
        id: true,
        title: true,
        round: true,
        scheduledAt: true,
        durationMinutes: true,
        timezone: true,
        meetingType: true,
        meetingLink: true,
        location: true,
        interviewer: true,
        notes: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ interviews });
  }
);

export const POST = createProtectedRoute(
  "candidates:write",
  async (req, { params, body, userId }) => {
    const { orgId, candidateId } = await params;
    const payload = body ?? (await req.json());
    const data = createInterviewSchema.parse(payload);

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, orgId },
      select: { id: true },
    });
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const interview = await prisma.candidateInterview.create({
      data: {
        orgId,
        candidateId,
        title: data.title.trim(),
        round: data.round?.trim() || null,
        scheduledAt: new Date(data.scheduledAt),
        durationMinutes: data.durationMinutes ?? 45,
        timezone: data.timezone?.trim() || "UTC",
        meetingType: data.meetingType?.trim() || "Video",
        meetingLink: data.meetingLink?.trim() || null,
        location: data.location?.trim() || null,
        interviewer: data.interviewer?.trim() || null,
        notes: data.notes?.trim() || null,
        createdBy: userId ?? null,
      },
      select: {
        id: true,
        title: true,
        round: true,
        scheduledAt: true,
        durationMinutes: true,
        timezone: true,
        meetingType: true,
        meetingLink: true,
        location: true,
        interviewer: true,
        notes: true,
        status: true,
        createdAt: true,
      },
    });

    await logCandidateActivity({
      orgId,
      candidateId,
      type: "INTERVIEW_SCHEDULED",
      title: "Interview scheduled",
      description: `${interview.title} at ${new Date(interview.scheduledAt).toLocaleString()}`,
      actorId: userId,
      metadata: {
        interviewId: interview.id,
        round: interview.round,
        meetingType: interview.meetingType,
      },
    });

    return NextResponse.json({ ok: true, interview });
  }
);


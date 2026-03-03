import { NextResponse } from "next/server";
import { z } from "zod";
import { createProtectedRoute } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { logCandidateActivity } from "@/lib/candidate-activity";

const updateInterviewSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  round: z.string().max(100).optional().nullable(),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(15).max(240).optional(),
  timezone: z.string().max(80).optional(),
  meetingType: z.string().max(40).optional(),
  meetingLink: z.string().url().max(1000).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  interviewer: z.string().max(120).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
});

export const PATCH = createProtectedRoute(
  "candidates:write",
  async (req, { params, body, userId }) => {
    const { orgId, candidateId, interviewId } = await params;
    const payload = body ?? (await req.json());
    const data = updateInterviewSchema.parse(payload);

    const existing = await prisma.candidateInterview.findFirst({
      where: { id: interviewId, orgId, candidateId },
      select: { id: true, status: true, title: true, scheduledAt: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if ("title" in data && data.title !== undefined) updateData.title = data.title.trim();
    if ("round" in data) updateData.round = data.round?.trim() || null;
    if ("scheduledAt" in data && data.scheduledAt) updateData.scheduledAt = new Date(data.scheduledAt);
    if ("durationMinutes" in data && data.durationMinutes !== undefined)
      updateData.durationMinutes = data.durationMinutes;
    if ("timezone" in data && data.timezone !== undefined) updateData.timezone = data.timezone.trim();
    if ("meetingType" in data && data.meetingType !== undefined)
      updateData.meetingType = data.meetingType.trim();
    if ("meetingLink" in data) updateData.meetingLink = data.meetingLink?.trim() || null;
    if ("location" in data) updateData.location = data.location?.trim() || null;
    if ("interviewer" in data) updateData.interviewer = data.interviewer?.trim() || null;
    if ("notes" in data) updateData.notes = data.notes?.trim() || null;
    if ("status" in data && data.status !== undefined) updateData.status = data.status;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const interview = await prisma.candidateInterview.update({
      where: { id: interviewId },
      data: updateData,
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

    const statusChanged = data.status && data.status !== existing.status;
    const activityType = statusChanged
      ? data.status === "COMPLETED"
        ? "INTERVIEW_COMPLETED"
        : data.status === "CANCELLED"
        ? "INTERVIEW_CANCELLED"
        : "INTERVIEW_UPDATED"
      : "INTERVIEW_UPDATED";

    await logCandidateActivity({
      orgId,
      candidateId,
      type: activityType,
      title: statusChanged ? `Interview ${data.status?.toLowerCase()}` : "Interview updated",
      description: `${interview.title} at ${new Date(interview.scheduledAt).toLocaleString()}`,
      actorId: userId,
      metadata: {
        interviewId: interview.id,
        fromStatus: existing.status,
        toStatus: interview.status,
      },
    });

    return NextResponse.json({ ok: true, interview });
  }
);

export const DELETE = createProtectedRoute(
  "candidates:write",
  async (_req, { params, userId }) => {
    const { orgId, candidateId, interviewId } = await params;

    const existing = await prisma.candidateInterview.findFirst({
      where: { id: interviewId, orgId, candidateId },
      select: { id: true, title: true, status: true, scheduledAt: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    await prisma.candidateInterview.delete({
      where: { id: interviewId },
    });

    await logCandidateActivity({
      orgId,
      candidateId,
      type: "INTERVIEW_CANCELLED",
      title: "Interview cancelled",
      description: `${existing.title} at ${new Date(existing.scheduledAt).toLocaleString()}`,
      actorId: userId,
      metadata: { interviewId: existing.id, fromStatus: existing.status, toStatus: "CANCELLED" },
    });

    return NextResponse.json({ ok: true });
  }
);


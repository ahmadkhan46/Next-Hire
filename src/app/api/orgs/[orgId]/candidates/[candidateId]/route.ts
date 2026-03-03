export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRoute } from "@/lib/api-middleware";
import { logCandidateActivity } from "@/lib/candidate-activity";

export const PATCH = createRoute(
  {
    requireAuth: true,
    requireOrg: true,
    permission: "candidates:write",
    rateLimit: { type: "api" },
  },
  async (req: NextRequest, { params, orgId, userId }) => {
    const { candidateId } = params as { orgId: string; candidateId: string };
    const body = await req.json().catch(() => ({}));

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, orgId },
      select: { id: true, status: true },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const updateData: {
      fullName?: string;
      email?: string | null;
      phone?: string | null;
      location?: string | null;
      currentTitle?: string | null;
      yearsOfExperience?: number | null;
      notes?: string | null;
      educationSchool?: string | null;
      educationDegree?: string | null;
      educationYear?: number | null;
      status?: string;
    } = {};

    if ("fullName" in body) {
      const fullName = String(body.fullName || "").trim();
      if (!fullName) {
        return NextResponse.json({ error: "fullName cannot be empty" }, { status: 400 });
      }
      updateData.fullName = fullName;
    }

    if ("email" in body) {
      updateData.email = body.email ? String(body.email).toLowerCase().trim() : null;
    }

    if ("phone" in body) {
      updateData.phone = body.phone ? String(body.phone).trim() : null;
    }

    if ("location" in body) {
      updateData.location = body.location ? String(body.location).trim() : null;
    }

    if ("currentTitle" in body) {
      updateData.currentTitle = body.currentTitle ? String(body.currentTitle).trim() : null;
    }

    if ("yearsOfExperience" in body) {
      const yearsRaw = body.yearsOfExperience;
      const yearsOfExperience =
        yearsRaw === null || yearsRaw === undefined || yearsRaw === ""
          ? null
          : Number(yearsRaw);
      updateData.yearsOfExperience = Number.isFinite(yearsOfExperience) ? yearsOfExperience : null;
    }

    if ("notes" in body) {
      updateData.notes = body.notes ? String(body.notes).trim() : null;
    }

    if ("educationSchool" in body) {
      updateData.educationSchool = body.educationSchool
        ? String(body.educationSchool).trim()
        : null;
    }

    if ("educationDegree" in body) {
      updateData.educationDegree = body.educationDegree
        ? String(body.educationDegree).trim()
        : null;
    }

    if ("educationYear" in body) {
      const educationYearRaw = body.educationYear;
      const educationYear =
        educationYearRaw === null || educationYearRaw === undefined || educationYearRaw === ""
          ? null
          : Number(educationYearRaw);
      updateData.educationYear = Number.isFinite(educationYear) ? educationYear : null;
    }

    if ("status" in body) {
      const nextStatus = String(body.status || "").trim().toUpperCase();
      const allowedStatuses = new Set(["ACTIVE", "IN_PROCESS", "HIRED", "ARCHIVED", "REJECTED"]);
      if (!allowedStatuses.has(nextStatus)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updateData.status = nextStatus;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.candidate.update({
      where: { id: candidateId },
      data: updateData,
    });

    const changedFields = Object.keys(updateData);
    const statusChanged = updateData.status && updateData.status !== candidate.status;

    await logCandidateActivity({
      orgId: orgId!,
      candidateId,
      type: "PROFILE_UPDATED",
      title: statusChanged ? "Candidate status updated" : "Profile updated",
      description: statusChanged
        ? `Status changed from ${candidate.status} to ${updateData.status}.`
        : `Updated fields: ${changedFields.join(", ")}.`,
      actorId: userId,
      metadata: { changedFields, status: updateData.status ?? null },
    });

    return NextResponse.json({ ok: true, candidate: updated });
  }
);

export const DELETE = createRoute(
  {
    requireAuth: true,
    requireOrg: true,
    permission: "candidates:delete",
    rateLimit: { type: "api" },
  },
  async (req: NextRequest, { params, orgId }) => {
    const { candidateId } = params as { orgId: string; candidateId: string };

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, orgId },
      select: { id: true },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    await prisma.candidate.delete({
      where: { id: candidateId },
    });

    return NextResponse.json({ ok: true, message: "Candidate deleted" });
  }
);

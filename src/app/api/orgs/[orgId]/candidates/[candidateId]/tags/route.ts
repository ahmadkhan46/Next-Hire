import { NextResponse } from "next/server";
import { createProtectedRoute } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";

export const POST = createProtectedRoute(
  "candidates:write",
  async (req, { params }) => {
    const { orgId, candidateId } = await params;
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const color =
      typeof body.color === "string" && body.color.trim() ? body.color.trim() : "#64748b";

    if (!name) {
      return NextResponse.json({ error: "Tag name required" }, { status: 400 });
    }

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, orgId },
      select: { id: true },
    });
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const tag = await prisma.candidateTag.upsert({
      where: { orgId_name: { orgId, name } },
      create: { orgId, name, color },
      update: {},
    });

    await prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        tags: {
          connect: { id: tag.id },
        },
      },
    });

    return NextResponse.json({ ok: true, tag });
  }
);

export const GET = createProtectedRoute(
  "candidates:read",
  async (_req, { params }) => {
    const { orgId, candidateId } = await params;
    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, orgId },
      select: {
        tags: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    return NextResponse.json({ tags: candidate.tags });
  }
);

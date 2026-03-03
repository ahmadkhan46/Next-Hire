import { NextResponse } from "next/server";
import { createProtectedRoute } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";

export const DELETE = createProtectedRoute(
  "candidates:write",
  async (_req, { params }) => {
    const { orgId, candidateId, tagId } = await params;

    const [candidate, tag] = await Promise.all([
      prisma.candidate.findFirst({
        where: { id: candidateId, orgId },
        select: { id: true },
      }),
      prisma.candidateTag.findFirst({
        where: { id: tagId, orgId },
        select: { id: true },
      }),
    ]);

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }
    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    await prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        tags: {
          disconnect: { id: tag.id },
        },
      },
    });

    return NextResponse.json({ ok: true });
  }
);

import { NextResponse } from "next/server";
import { createProtectedRoute } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { resolveActorNames } from "@/lib/job-audit";

export const GET = createProtectedRoute(
  "candidates:read",
  async (_req, { params }) => {
    const { orgId } = await params;

    const batches = await prisma.resumeUploadBatch.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        sourceType: true,
        sourceName: true,
        uploadedBy: true,
        targetJobId: true,
        status: true,
        totalFiles: true,
        processed: true,
        createdCount: true,
        updatedCount: true,
        failedCount: true,
        createdAt: true,
        targetJob: {
          select: {
            title: true,
          },
        },
        items: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            fileName: true,
            candidateId: true,
            resumeId: true,
            status: true,
            note: true,
            error: true,
            createdAt: true,
          },
        },
      },
    });

    const uploaderIds = batches.map((b) => b.uploadedBy).filter(Boolean) as string[];
    const nameMap = await resolveActorNames(uploaderIds);

    const batchesWithNames = batches.map((b) => ({
      ...b,
      uploadedByName: b.uploadedBy ? (nameMap.get(b.uploadedBy) ?? b.uploadedBy) : null,
    }));

    return NextResponse.json({ batches: batchesWithNames });
  }
);

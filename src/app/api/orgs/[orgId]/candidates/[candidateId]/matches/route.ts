import { NextResponse } from "next/server";
import { JobStatus } from "@prisma/client";
import { createProtectedRoute } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";

function toPositiveInt(input: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export const GET = createProtectedRoute(
  "candidates:read",
  async (req, { params }) => {
    const { orgId, candidateId } = await params;
    const page = toPositiveInt(req.nextUrl.searchParams.get("page"), 1, 1, 100000);
    const limit = toPositiveInt(req.nextUrl.searchParams.get("limit"), 10, 1, 50);
    const sort = req.nextUrl.searchParams.get("sort") ?? "score_desc";
    const status = (req.nextUrl.searchParams.get("status") ?? "ALL").toUpperCase();
    const skip = (page - 1) * limit;

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, orgId },
      select: { id: true },
    });
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const jobStatusFilter =
      status === "OPEN" ? JobStatus.OPEN : status === "CLOSED" ? JobStatus.CLOSED : null;

    const where = {
      orgId,
      candidateId,
      ...(jobStatusFilter ? { job: { status: jobStatusFilter } } : {}),
    };

    const orderBy =
      sort === "updated_desc"
        ? [{ statusUpdatedAt: "desc" as const }, { createdAt: "desc" as const }]
        : [{ score: "desc" as const }, { statusUpdatedAt: "desc" as const }];

    const [total, rows] = await prisma.$transaction([
      prisma.matchResult.count({ where }),
      prisma.matchResult.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          score: true,
          status: true,
          statusUpdatedAt: true,
          job: {
            select: {
              id: true,
              title: true,
              location: true,
              status: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      matches: rows.map((row) => ({
        ...row,
        statusUpdatedAt: row.statusUpdatedAt ? row.statusUpdatedAt.toISOString() : null,
      })),
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + limit < total,
      },
    });
  }
);

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { ActivityLogClient } from "./activity-log-client";
import type { Prisma } from "@prisma/client";

export default async function UploadHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{
    q?: string;
    source?: string;
    status?: string;
    sort?: string;
    start?: string;
    end?: string;
    page?: string;
    limit?: string;
  }>;
}) {
  const { orgId } = await params;
  const qp = await searchParams;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  });
  if (!org) redirect("/orgs/demo");

  // Guard for stale Prisma client in dev (schema changed but client not regenerated yet).
  const hasUploadBatchModel = typeof (prisma as unknown as Record<string, unknown>).resumeUploadBatch !== "undefined";
  if (!hasUploadBatchModel) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Import Activity Log</h1>
        <Card className="rounded-2xl border bg-card/50 p-6">
          <p className="text-sm text-muted-foreground">
            Activity tracking is enabled in code, but your Prisma client is stale.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Run <code>npx prisma generate</code> (and apply migrations if pending), then refresh.
          </p>
        </Card>
      </div>
    );
  }

  const source =
    qp.source === "CSV" || qp.source === "ZIP" || qp.source === "PDF_DOCX"
      ? qp.source
      : "";
  const statusOptions = new Set([
    "failed",
    "success",
    "pending",
    "queued",
    "processing",
    "completed",
    "partial_failed",
  ]);
  const status = statusOptions.has(qp.status ?? "") ? (qp.status as string) : "";
  const sort =
    qp.sort === "oldest" || qp.sort === "most_failed" || qp.sort === "most_created"
      ? qp.sort
      : "newest";
  const q = (qp.q ?? "").trim();
  const start = qp.start ?? "";
  const end = qp.end ?? "";
  const page = Number.isFinite(Number(qp.page)) ? Math.max(1, Number(qp.page)) : 1;
  const limitRaw = Number.isFinite(Number(qp.limit)) ? Number(qp.limit) : 20;
  const limit = [10, 20, 50, 100].includes(limitRaw) ? limitRaw : 20;
  const skip = (page - 1) * limit;

  const where: Prisma.ResumeUploadBatchWhereInput = { orgId };

  if (source) {
    where.sourceType = source as "CSV" | "ZIP" | "PDF_DOCX";
  }
  if (status === "failed") {
    where.status = { in: ["FAILED", "PARTIAL_FAILED"] };
  } else if (status === "success" || status === "completed") {
    where.status = "COMPLETED";
  } else if (status === "pending") {
    where.status = { in: ["QUEUED", "PROCESSING"] };
  } else if (status === "queued") {
    where.status = "QUEUED";
  } else if (status === "processing") {
    where.status = "PROCESSING";
  } else if (status === "partial_failed") {
    where.status = "PARTIAL_FAILED";
  }

  if (start || end) {
    where.createdAt = {};
    if (start) where.createdAt.gte = new Date(`${start}T00:00:00.000Z`);
    if (end) where.createdAt.lte = new Date(`${end}T23:59:59.999Z`);
  }
  if (q) {
    where.OR = [
      { sourceName: { contains: q, mode: "insensitive" } },
      { uploadedBy: { contains: q, mode: "insensitive" } },
      { targetJobId: { contains: q, mode: "insensitive" } },
      { targetJob: { title: { contains: q, mode: "insensitive" } } },
      {
        items: {
          some: {
            OR: [
              { fileName: { contains: q, mode: "insensitive" } },
              { note: { contains: q, mode: "insensitive" } },
              { error: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }

  const orderBy: Prisma.ResumeUploadBatchOrderByWithRelationInput =
    sort === "oldest"
      ? { createdAt: "asc" }
      : sort === "most_failed"
        ? { failedCount: "desc" }
        : sort === "most_created"
          ? { createdCount: "desc" }
          : { createdAt: "desc" };

  const [totalBatches, aggregate, batches] = await Promise.all([
    prisma.resumeUploadBatch.count({ where }),
    prisma.resumeUploadBatch.aggregate({
      where,
      _sum: {
        totalFiles: true,
        createdCount: true,
        updatedCount: true,
        failedCount: true,
      },
    }),
    prisma.resumeUploadBatch.findMany({
      where,
      orderBy,
      take: limit,
      skip,
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
        startedAt: true,
        completedAt: true,
        targetJob: {
          select: {
            title: true,
          },
        },
        items: {
          orderBy: { createdAt: "desc" },
          take: 200,
          select: {
            id: true,
            fileName: true,
            candidateId: true,
            status: true,
            note: true,
            error: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalBatches / limit));
  const safePage = Math.min(page, totalPages);

  const totals = {
    total: aggregate._sum.totalFiles ?? 0,
    created: aggregate._sum.createdCount ?? 0,
    updated: aggregate._sum.updatedCount ?? 0,
    failed: aggregate._sum.failedCount ?? 0,
  };

  const pageBatches = safePage === page ? batches : [];

  const normalizedBatches =
    safePage === page
      ? pageBatches
      : await prisma.resumeUploadBatch.findMany({
          where,
          orderBy,
          take: limit,
          skip: (safePage - 1) * limit,
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
            startedAt: true,
            completedAt: true,
            targetJob: {
              select: {
                title: true,
              },
            },
            items: {
              orderBy: { createdAt: "desc" },
              take: 200,
              select: {
                id: true,
                fileName: true,
                candidateId: true,
                status: true,
                note: true,
                error: true,
                createdAt: true,
              },
            },
          },
        });

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            Upload Audit
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Import Activity Log</h1>
          <p className="mt-2 text-muted-foreground">
            System-tracked log of CSV, ZIP and PDF/DOCX imports with created, updated and failed records.
          </p>
        </div>

        <Link
          href={`/orgs/${orgId}/candidates`}
          className="inline-flex items-center gap-2 rounded-2xl border bg-card/60 px-4 py-2 text-sm transition hover:bg-accent/60"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Candidates
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="premium-subblock rounded-2xl border bg-card/50 p-4">
          <div className="text-xs text-muted-foreground">Batches</div>
          <div className="mt-1 text-2xl font-semibold">{totalBatches}</div>
        </Card>
        <Card className="premium-subblock rounded-2xl border bg-card/50 p-4">
          <div className="text-xs text-muted-foreground">Files Seen</div>
          <div className="mt-1 text-2xl font-semibold">{totals.total}</div>
        </Card>
        <Card className="premium-subblock rounded-2xl border bg-card/50 p-4">
          <div className="text-xs text-muted-foreground">Created / Updated</div>
          <div className="mt-1 text-2xl font-semibold">
            {totals.created} / {totals.updated}
          </div>
        </Card>
        <Card className="premium-subblock rounded-2xl border bg-card/50 p-4">
          <div className="text-xs text-muted-foreground">Failed</div>
          <div className="mt-1 text-2xl font-semibold text-red-600">{totals.failed}</div>
        </Card>
      </div>

      <ActivityLogClient
        orgId={orgId}
        initialFilters={{
          q,
          source,
          status,
          sort,
          start,
          end,
        }}
        pagination={{
          page: safePage,
          pageSize: limit,
          totalItems: totalBatches,
          totalPages,
        }}
        batches={normalizedBatches.map((batch) => {
          const { targetJob, ...rest } = batch;
          return {
            ...rest,
            targetJobTitle: targetJob?.title ?? null,
            createdAt: batch.createdAt.toISOString(),
            startedAt: batch.startedAt?.toISOString() ?? null,
            completedAt: batch.completedAt?.toISOString() ?? null,
            items: batch.items.map((item) => ({
              ...item,
              createdAt: item.createdAt.toISOString(),
            })),
          };
        })}
      />
    </div>
  );
}

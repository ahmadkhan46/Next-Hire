"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, FileSpreadsheet, FileArchive, FileText, Download, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type BatchItem = {
  id: string;
  fileName: string;
  candidateId: string | null;
  status: string;
  note: string | null;
  error: string | null;
  createdAt: string;
};

type Batch = {
  id: string;
  sourceType: string;
  sourceName: string | null;
  uploadedBy: string | null;
  targetJobId: string | null;
  targetJobTitle: string | null;
  status: string;
  totalFiles: number;
  processed: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  items: BatchItem[];
};

function formatUtc(date: string) {
  return (
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(date)) + " UTC"
  );
}

function sourceIcon(sourceType: string) {
  if (sourceType === "CSV") return <FileSpreadsheet className="h-4 w-4" />;
  if (sourceType === "ZIP") return <FileArchive className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function formatBatchStatus(status: string) {
  return status.toLowerCase().replace(/_/g, " ");
}

function getVisiblePages(currentPage: number, totalPages: number) {
  const pages: Array<number | "ellipsis"> = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }

  pages.push(1);

  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);

  if (left > 2) pages.push("ellipsis");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < totalPages - 1) pages.push("ellipsis");

  pages.push(totalPages);
  return pages;
}

export function ActivityLogClient({
  orgId,
  batches,
  initialFilters,
  pagination,
}: {
  orgId: string;
  batches: Batch[];
  initialFilters: {
    q: string;
    source: string;
    status: string;
    sort: string;
    start: string;
    end: string;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(initialFilters.q || "");
  const [statusFilter, setStatusFilter] = useState(initialFilters.status || "all");
  const [sourceFilter, setSourceFilter] = useState(initialFilters.source || "all");
  const [sortBy, setSortBy] = useState(initialFilters.sort || "newest");
  const [startDate, setStartDate] = useState(initialFilters.start || "");
  const [endDate, setEndDate] = useState(initialFilters.end || "");
  const [pageSize, setPageSize] = useState(String(pagination.pageSize));
  const [retrying, setRetrying] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const visiblePages = getVisiblePages(pagination.page, pagination.totalPages);

  const filteredBatches = batches;

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (sortBy !== "newest") params.set("sort", sortBy);
    if (startDate) params.set("start", startDate);
    if (endDate) params.set("end", endDate);
    params.set("page", "1");
    params.set("limit", pageSize);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const clearFilters = () => {
    setSearch("");
    setSourceFilter("all");
    setStatusFilter("all");
    setSortBy("newest");
    setStartDate("");
    setEndDate("");
    setPageSize("20");
    router.replace(pathname);
  };

  const goToPage = (nextPage: number) => {
    const safePage = Math.min(Math.max(1, nextPage), pagination.totalPages);
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (sortBy !== "newest") params.set("sort", sortBy);
    if (startDate) params.set("start", startDate);
    if (endDate) params.set("end", endDate);
    params.set("page", String(safePage));
    params.set("limit", pageSize);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const updatePageSize = (nextSize: string) => {
    setPageSize(nextSize);
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (sortBy !== "newest") params.set("sort", sortBy);
    if (startDate) params.set("start", startDate);
    if (endDate) params.set("end", endDate);
    params.set("page", "1");
    params.set("limit", nextSize);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const retryFailed = async (batchId: string) => {
    setRetrying(batchId);
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/uploads/${batchId}/retry`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Retry failed");

      toast.success(`Retrying ${data.count} failed file(s)`);
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      toast.error(error.message || "Failed to retry");
    } finally {
      setRetrying(null);
    }
  };

  const exportBatch = async (batchId: string, format: "csv" | "errors") => {
    setExporting(batchId);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/candidates/uploads/${batchId}/export?format=${format}`
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Export failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `batch-${batchId}-${format}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Export downloaded");
    } catch (error: any) {
      toast.error(error.message || "Export failed");
    } finally {
      setExporting(null);
    }
  };

  return (
    <Card className="premium-block rounded-3xl border bg-card/50 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Batch Log</h2>
        <Badge variant="secondary" className="rounded-full">
          Showing {batches.length} of {pagination.totalItems}
        </Badge>
      </div>
      <Separator className="mb-4" />

      <div className="mb-4 grid gap-3 md:grid-cols-12" suppressHydrationWarning>
        <div className="relative md:col-span-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search file, source, user, error..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-2xl"
          />
        </div>
        <div className="md:col-span-2" suppressHydrationWarning>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-full rounded-2xl">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="CSV">CSV</SelectItem>
              <SelectItem value="ZIP">ZIP</SelectItem>
              <SelectItem value="PDF_DOCX">PDF/DOCX</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2" suppressHydrationWarning>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full rounded-2xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outcomes</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="partial_failed">Partial failed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="success">Success only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2" suppressHydrationWarning>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full rounded-2xl">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Sort: newest</SelectItem>
              <SelectItem value="oldest">Sort: oldest</SelectItem>
              <SelectItem value="most_failed">Sort: most failed</SelectItem>
              <SelectItem value="most_created">Sort: most created</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-2xl md:col-span-1"
          aria-label="Start date"
        />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-2xl md:col-span-1"
          aria-label="End date"
        />
        <div className="md:col-span-2 flex gap-2">
          <Button variant="outline" className="w-full rounded-2xl" onClick={applyFilters}>
            Apply
          </Button>
          <Button variant="ghost" className="w-full rounded-2xl" onClick={clearFilters}>
            Reset
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <div>
          Page {pagination.page} of {pagination.totalPages}
        </div>
        <div className="flex items-center gap-2">
          <span>Per page</span>
          <Select value={pageSize} onValueChange={updatePageSize}>
            <SelectTrigger className="h-8 w-[88px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {search || statusFilter !== "all" || sourceFilter !== "all" || sortBy !== "newest" || startDate || endDate ? (
        <div className="text-sm text-muted-foreground mb-4">
          Showing {filteredBatches.length} of {batches.length} batches
        </div>
      ) : null}

      {filteredBatches.length === 0 ? (
        <div className="premium-subblock rounded-2xl border border-dashed bg-background/40 p-6 text-sm text-muted-foreground">
          {search || statusFilter !== "all" || sourceFilter !== "all" || sortBy !== "newest" || startDate || endDate
            ? "No batches match your filters"
            : "No upload batches yet"}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBatches.map((batch) => (
            <details
              key={batch.id}
              className="premium-subblock rounded-2xl border bg-background/40 p-4"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {sourceIcon(batch.sourceType)}
                    <span>{batch.sourceType}</span>
                    <span className="text-muted-foreground">
                      {batch.sourceName ? `- ${batch.sourceName}` : "- direct upload"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">{formatUtc(batch.createdAt)}</div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="rounded-full">
                    status: {formatBatchStatus(batch.status)}
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    total: {batch.totalFiles}
                  </Badge>
                  <Badge variant="outline" className="rounded-full text-emerald-700">
                    created: {batch.createdCount}
                  </Badge>
                  <Badge variant="outline" className="rounded-full text-blue-700">
                    updated: {batch.updatedCount}
                  </Badge>
                  <Badge variant="outline" className="rounded-full text-red-700">
                    failed: {batch.failedCount}
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    by: {batch.uploadedBy ?? "unknown"}
                  </Badge>
                  {batch.targetJobId ? (
                    <Badge variant="outline" className="rounded-full">
                      job: {batch.targetJobTitle ?? batch.targetJobId}
                    </Badge>
                  ) : null}
                  {batch.startedAt ? (
                    <Badge variant="outline" className="rounded-full">
                      started: {formatUtc(batch.startedAt)}
                    </Badge>
                  ) : null}
                  {batch.completedAt ? (
                    <Badge variant="outline" className="rounded-full">
                      ended: {formatUtc(batch.completedAt)}
                    </Badge>
                  ) : null}
                </div>
              </summary>

              <Separator className="my-3" />

              <div className="mb-3 flex flex-wrap gap-2">
                {batch.failedCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => retryFailed(batch.id)}
                    disabled={retrying === batch.id}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${retrying === batch.id ? "animate-spin" : ""}`} />
                    Retry {batch.failedCount} Failed
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => exportBatch(batch.id, "csv")}
                  disabled={exporting === batch.id}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Export CSV
                </Button>
                {batch.failedCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => exportBatch(batch.id, "errors")}
                    disabled={exporting === batch.id}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Export Errors Only
                  </Button>
                )}
              </div>

              {batch.items.length === 0 ? (
                <div className="text-xs text-muted-foreground">No item-level logs recorded.</div>
              ) : (
                <div className="space-y-2">
                  {batch.items.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[1.6fr_0.8fr_2fr_auto] items-start gap-2 rounded-xl border bg-background/60 px-3 py-2 text-xs"
                    >
                      <div className="truncate" title={item.fileName}>
                        {item.fileName}
                      </div>
                      <div
                        className={
                          item.status === "FAILED"
                            ? "font-semibold text-red-600"
                            : item.status === "PENDING" || item.status === "PROCESSING"
                              ? "font-semibold text-amber-600"
                            : item.status === "UPDATED"
                              ? "font-semibold text-blue-600"
                              : item.status === "SKIPPED"
                                ? "font-semibold text-slate-600"
                              : "font-semibold text-emerald-600"
                        }
                      >
                        {item.status}
                      </div>
                      <div className="truncate text-muted-foreground" title={item.note ?? item.error ?? ""}>
                        {item.note ?? item.error ?? "-"}
                      </div>
                      {item.candidateId ? (
                        <Link
                          href={`/orgs/${orgId}/candidates/${item.candidateId}`}
                          className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-1 text-xs hover:bg-accent/60"
                        >
                          View <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </details>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={() => goToPage(pagination.page - 1)}
          disabled={pagination.page <= 1}
        >
          Previous
        </Button>
        {visiblePages.map((entry, idx) =>
          entry === "ellipsis" ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-sm text-muted-foreground">
              ...
            </span>
          ) : (
            <Button
              key={entry}
              variant={entry === pagination.page ? "default" : "outline"}
              className="h-9 min-w-9 rounded-2xl px-3"
              onClick={() => goToPage(entry)}
            >
              {entry}
            </Button>
          )
        )}
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={() => goToPage(pagination.page + 1)}
          disabled={pagination.page >= pagination.totalPages}
        >
          Next
        </Button>
      </div>
    </Card>
  );
}

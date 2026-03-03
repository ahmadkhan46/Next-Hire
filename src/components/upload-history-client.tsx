"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FileSpreadsheet, FileArchive, FileText, Download, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type BatchItem = {
  id: string;
  fileName: string;
  candidateId: string | null;
  status: string;
  note: string | null;
  error: string | null;
};

type Batch = {
  id: string;
  sourceType: string;
  sourceName: string | null;
  uploadedBy: string | null;
  totalFiles: number;
  processed: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  createdAt: string;
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

export function UploadHistoryClient({ orgId, batches }: { orgId: string; batches: Batch[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [retrying, setRetrying] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  // Filter batches
  const filteredBatches = batches.filter((batch) => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSource = batch.sourceName?.toLowerCase().includes(searchLower);
      const matchesFile = batch.items.some((item) =>
        item.fileName.toLowerCase().includes(searchLower)
      );
      if (!matchesSource && !matchesFile) return false;
    }

    // Source filter
    if (sourceFilter !== "all" && batch.sourceType !== sourceFilter) {
      return false;
    }

    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "failed" && batch.failedCount === 0) return false;
      if (statusFilter === "created" && batch.createdCount === 0) return false;
      if (statusFilter === "updated" && batch.updatedCount === 0) return false;
    }

    return true;
  });

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
    <>
      {/* Search and Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by filename or source..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-2xl"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] rounded-2xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="updated">Updated</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[140px] rounded-2xl">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="CSV">CSV</SelectItem>
              <SelectItem value="ZIP">ZIP</SelectItem>
              <SelectItem value="PDF_DOCX">PDF/DOCX</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Count */}
      {search || statusFilter !== "all" || sourceFilter !== "all" ? (
        <div className="text-sm text-muted-foreground">
          Showing {filteredBatches.length} of {batches.length} batches
        </div>
      ) : null}

      {/* Batch List */}
      {filteredBatches.length === 0 ? (
        <div className="premium-subblock rounded-2xl border border-dashed bg-background/40 p-6 text-sm text-muted-foreground">
          {search || statusFilter !== "all" || sourceFilter !== "all"
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
                </div>
              </summary>

              <Separator className="my-3" />

              {/* Batch Actions */}
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

              {/* Items List */}
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
                            : item.status === "UPDATED"
                              ? "font-semibold text-blue-600"
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
    </>
  );
}

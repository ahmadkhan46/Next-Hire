"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import JSZip from "jszip";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

type UploadResult = {
  fileName: string;
  ok: boolean;
  status?: "CREATED" | "UPDATED" | "SKIPPED" | "FAILED";
  candidateId?: string;
  resumeId?: string;
  note?: string;
  error?: string;
  errorCode?: string;
  attempts?: number;
  retryCount?: number;
  transient?: boolean;
};

export function BulkResumeUpload({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [extracting, setExtracting] = React.useState(false);
  const [results, setResults] = React.useState<UploadResult[]>([]);
  const [duplicateMode, setDuplicateMode] = React.useState<"update" | "skip">("update");
  const [sourceType, setSourceType] = React.useState<"ZIP" | "PDF_DOCX">("PDF_DOCX");
  const [sourceName, setSourceName] = React.useState<string | null>(null);
  const [correlationId, setCorrelationId] = React.useState<string | null>(null);
  const [jobs, setJobs] = React.useState<Array<{ id: string; title: string; status: string }>>([]);
  const [targetJobId, setTargetJobId] = React.useState<string>("none");
  const [history, setHistory] = React.useState<
    Array<{
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
      items: Array<{
        id: string;
        fileName: string;
        status: string;
        note: string | null;
        error: string | null;
      }>;
    }>
  >([]);
  const totalFiles = files.length;
  const processedFiles = results.length;
  const makeCorrelationId = React.useCallback(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `resume-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }, []);
  const getBatchCounts = React.useCallback(
    (
      items: Array<{
        id: string;
        fileName: string;
        status: string;
        note: string | null;
        error: string | null;
      }>
    ) => {
      const counts = {
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
      };
      for (const item of items) {
        if (item.status === "CREATED") counts.created += 1;
        else if (item.status === "UPDATED") counts.updated += 1;
        else if (item.status === "SKIPPED") counts.skipped += 1;
        else if (item.status === "FAILED") counts.failed += 1;
      }
      return counts;
    },
    []
  );
  const resultSummary = React.useMemo(() => {
    const counts = { created: 0, updated: 0, skipped: 0, failed: 0 };
    const reasonCount = new Map<string, number>();

    for (const result of results) {
      if (result.status === "CREATED") counts.created += 1;
      else if (result.status === "UPDATED") counts.updated += 1;
      else if (result.status === "SKIPPED") counts.skipped += 1;
      else counts.failed += 1;

      const rawReason =
        result.status === "SKIPPED"
          ? result.note
          : !result.ok
            ? result.error ?? result.note
            : null;
      const reason = rawReason?.trim();
      if (reason) {
        reasonCount.set(reason, (reasonCount.get(reason) ?? 0) + 1);
      }
    }

    const topReasons = Array.from(reasonCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return { counts, topReasons };
  }, [results]);

  const loadHistory = React.useCallback(async () => {
    const res = await fetch(`/api/orgs/${orgId}/candidates/uploads/history`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Failed to load upload history");
    const mapped = Array.isArray(data?.batches)
      ? data.batches.map((batch: any) => ({
          ...batch,
          targetJobTitle: batch?.targetJob?.title ?? null,
        }))
      : [];
    setHistory(mapped);
  }, [orgId]);

  const loadJobs = React.useCallback(async () => {
    const response = await fetch(`/api/orgs/${orgId}/jobs`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error ?? "Failed to load jobs");
    const nextJobs = Array.isArray(data?.jobs) ? data.jobs : [];
    setJobs(nextJobs.filter((job: { status?: string }) => job.status === "OPEN"));
  }, [orgId]);

  React.useEffect(() => {
    if (!open) return;
    Promise.all([loadHistory(), loadJobs()]).catch((err: any) => {
      toast.error(err?.message ?? "Failed to load upload history");
    });
  }, [open, loadHistory, loadJobs]);

  const extractZipFiles = async (zipFile: File): Promise<File[]> => {
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(zipFile);
      const extractedFiles: File[] = [];

      for (const [filename, file] of Object.entries(contents.files)) {
        if (file.dir || filename.startsWith("__MACOSX") || filename.startsWith(".")) {
          continue;
        }

        const ext = filename.toLowerCase();
        if (!ext.endsWith(".pdf") && !ext.endsWith(".docx")) {
          continue;
        }

        try {
          const blob = await file.async("blob");
          const mimeType = ext.endsWith(".pdf")
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

          const extractedFile = new File([blob], filename.split("/").pop() || filename, {
            type: mimeType,
          });

          if (extractedFile.size > MAX_BYTES) {
            toast.warning(`${extractedFile.name}: Skipped (exceeds 5MB)`);
            continue;
          }

          extractedFiles.push(extractedFile);
        } catch (err) {
          console.warn(`Failed to extract ${filename}:`, err);
        }
      }

      return extractedFiles;
    } catch {
      throw new Error("Invalid ZIP file. Please upload a valid ZIP archive.");
    }
  };

  const onFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) {
      setFiles([]);
      setResults([]);
      return;
    }

    setExtracting(true);
    const valid: File[] = [];
    let zipSelected = false;
    let selectedZipName: string | null = null;

    try {
      for (const f of picked) {
        if (
          f.type === "application/zip" ||
          f.type === "application/x-zip-compressed" ||
          f.name.endsWith(".zip")
        ) {
          zipSelected = true;
          selectedZipName = f.name;
          try {
            toast.info(`Extracting ${f.name}...`);
            const extractedFiles = await extractZipFiles(f);

            if (extractedFiles.length === 0) {
              toast.warning(`${f.name}: No valid PDF/DOCX files found inside`);
            } else {
              valid.push(...extractedFiles);
              toast.success(`${f.name}: Extracted ${extractedFiles.length} file(s)`);
            }
          } catch (err: any) {
            toast.error(`${f.name}: ${err.message || "Failed to extract"}`);
          }
          continue;
        }

        if (f.size > MAX_BYTES) {
          toast.warning(`${f.name}: Skipped (exceeds 5MB)`);
          continue;
        }
        if (!ALLOWED.includes(f.type)) {
          toast.warning(`${f.name}: Skipped (only PDF or DOCX supported)`);
          continue;
        }
        valid.push(f);
      }

      if (valid.length === 0) {
        toast.error("No valid files to upload. Please select PDF, DOCX, or ZIP files.");
      }

      setFiles(valid);
      setResults([]);
      setSourceType(zipSelected ? "ZIP" : "PDF_DOCX");
      setSourceName(zipSelected ? selectedZipName : null);
    } finally {
      setExtracting(false);
    }
  };

  const uploadAll = async () => {
    if (!files.length) {
      toast.error("Select resumes first");
      return;
    }
    setBusy(true);
    setCorrelationId(null);
    let activeCorrelationId: string | null = null;
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      form.append("sourceType", sourceType);
      if (sourceName) form.append("sourceName", sourceName);
      form.append("duplicateMode", duplicateMode);
      if (targetJobId !== "none") {
        form.append("targetJobId", targetJobId);
      }
      const requestCorrelationId = makeCorrelationId();
      activeCorrelationId = requestCorrelationId;
      setCorrelationId(requestCorrelationId);
      const res = await fetch(`/api/orgs/${orgId}/candidates/resumes/upload`, {
        method: "POST",
        headers: {
          "x-correlation-id": requestCorrelationId,
        },
        body: form,
      });
      const rawText = await res.text();
      let data: Record<string, any> = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = { rawText };
        }
      }
      const responseCorrelationId =
        res.headers.get("x-correlation-id") || data?.correlationId || requestCorrelationId;
      activeCorrelationId = responseCorrelationId;
      setCorrelationId(responseCorrelationId);
      if (!res.ok) {
        const responseMessage =
          data?.error ||
          (typeof data?.rawText === "string" && data.rawText.trim()
            ? data.rawText.trim().slice(0, 200)
            : null);
        throw new Error(
          responseMessage ? `${responseMessage} (HTTP ${res.status})` : `Upload failed (HTTP ${res.status})`
        );
      }

      const nextResults: UploadResult[] = data?.results ?? [];
      const success = nextResults.filter((r) => r.ok).length;
      const failed = nextResults.filter((r) => !r.ok).length;
      setResults(nextResults);

      if (success > 0 && failed === 0) {
        toast.success(`Successfully processed ${success} resume(s)`);
      } else if (success > 0 && failed > 0) {
        toast.success(`Processed ${success} resume(s). ${failed} file(s) had issues.`);
      } else {
        toast.error("Failed to process resumes. See details below.");
      }

      setFiles([]);
      router.refresh();
      await loadHistory();
    } catch (err: any) {
      toast.error(
        `${err?.message ?? "Upload failed. Please try again."}${activeCorrelationId ? ` (Correlation ID: ${activeCorrelationId})` : ""}`
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-2xl">
          Resume Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100vh-6rem)] max-w-lg flex-col overflow-hidden rounded-3xl p-0">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle className="text-lg">Upload resumes</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto inner-scroll px-6 pb-6 pr-4">
          <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload PDF, DOCX files, or a ZIP archive containing resumes (max 5MB per file).
          </p>
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.zip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,application/x-zip-compressed"
            onChange={onFilesChange}
            disabled={extracting || busy}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800 disabled:opacity-50"
          />
          {extracting ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              Extracting ZIP file(s)...
            </div>
          ) : null}
          <div className="text-xs text-muted-foreground">
            {files.length ? `${files.length} file(s) ready to upload` : "No files selected"}
          </div>
          <div className="rounded-xl border bg-background/40 p-3 text-xs">
            <div className="mb-2 font-semibold">Duplicate handling</div>
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="duplicate-mode"
                  value="update"
                  checked={duplicateMode === "update"}
                  onChange={() => setDuplicateMode("update")}
                  disabled={busy || extracting}
                />
                <span>Update existing candidate</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="duplicate-mode"
                  value="skip"
                  checked={duplicateMode === "skip"}
                  onChange={() => setDuplicateMode("skip")}
                  disabled={busy || extracting}
                />
                <span>Skip existing candidate</span>
              </label>
            </div>
          </div>
          <div className="rounded-xl border bg-background/40 p-3 text-xs">
            <div className="mb-2 font-semibold">Auto-match target</div>
            <select
              value={targetJobId}
              onChange={(e) => setTargetJobId(e.target.value)}
              disabled={busy || extracting}
              className="h-9 w-full rounded-md border bg-background px-3 text-xs"
            >
              <option value="none">All open jobs (default)</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button
              className="rounded-2xl"
              onClick={uploadAll}
              disabled={busy || !files.length || extracting}
            >
              {busy ? "Uploading..." : "Upload & Parse"}
            </Button>
          </div>
          {busy ? (
            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-slate-500" />
              Processing {totalFiles} file(s). This may take a few minutes.
              {correlationId ? <span>Correlation ID: {correlationId}</span> : null}
            </div>
          ) : null}
          {results.length ? (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold">Upload Results</div>
              {correlationId ? (
                <div className="text-[11px] text-muted-foreground">Correlation ID: {correlationId}</div>
              ) : null}
              <div className="text-xs text-muted-foreground">Processed {processedFiles} file(s).</div>
              <div className="rounded-2xl border bg-background/40 p-3 text-xs">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border bg-emerald-50 p-2">
                    <div className="text-[11px] text-emerald-700">Created</div>
                    <div className="text-base font-semibold text-emerald-700">{resultSummary.counts.created}</div>
                  </div>
                  <div className="rounded-xl border bg-blue-50 p-2">
                    <div className="text-[11px] text-blue-700">Updated</div>
                    <div className="text-base font-semibold text-blue-700">{resultSummary.counts.updated}</div>
                  </div>
                  <div className="rounded-xl border bg-amber-50 p-2">
                    <div className="text-[11px] text-amber-700">Skipped</div>
                    <div className="text-base font-semibold text-amber-700">{resultSummary.counts.skipped}</div>
                  </div>
                  <div className="rounded-xl border bg-red-50 p-2">
                    <div className="text-[11px] text-red-700">Failed</div>
                    <div className="text-base font-semibold text-red-700">{resultSummary.counts.failed}</div>
                  </div>
                </div>
                {resultSummary.topReasons.length > 0 ? (
                  <div className="mt-3 space-y-1">
                    <div className="text-[11px] font-semibold text-muted-foreground">Top reasons</div>
                    {resultSummary.topReasons.map(([reason, count]) => (
                      <div key={reason} className="text-[11px] text-muted-foreground">
                        {count}x - {reason}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="max-h-48 overflow-y-auto rounded-2xl border bg-background/40 p-3 text-xs inner-scroll">
                <div className="hidden grid-cols-[1.5fr_0.8fr_2fr] gap-2 font-semibold text-muted-foreground sm:grid">
                  <span>File</span>
                  <span>Status</span>
                  <span>Details</span>
                </div>
                <div className="mt-2 space-y-2">
                  {results.map((r, idx) => (
                    <div
                      key={`${r.fileName}-${idx}`}
                      className="grid gap-1 rounded-xl border border-slate-200/70 bg-white/70 p-2 sm:grid-cols-[1.5fr_0.8fr_2fr] sm:gap-2 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
                    >
                      <span className="truncate font-medium sm:font-normal" title={r.fileName}>
                        {r.fileName}
                      </span>
                      <span
                        className={
                          r.status === "CREATED"
                            ? "text-emerald-600 font-semibold"
                            : r.status === "UPDATED"
                              ? "text-blue-600 font-semibold"
                              : r.status === "SKIPPED"
                                ? "text-amber-600 font-semibold"
                                : "text-red-600 font-semibold"
                        }
                      >
                        {r.status ?? (r.ok ? "SUCCESS" : "FAILED")}
                      </span>
                      <span
                        className="truncate text-muted-foreground"
                        title={
                          r.ok
                            ? r.note ?? r.candidateId
                            : `${r.errorCode ? `[${r.errorCode}] ` : ""}${r.error ?? "Processing issue"}${
                                r.retryCount && r.retryCount > 0 ? ` (retries: ${r.retryCount})` : ""
                              }`
                        }
                      >
                        {r.ok
                          ? r.note ?? "Processed"
                          : `${r.errorCode ? `[${r.errorCode}] ` : ""}${r.error ?? "Processing issue"}${
                              r.retryCount && r.retryCount > 0 ? ` (retries: ${r.retryCount})` : ""
                            }`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-2">
            <div className="text-xs font-semibold">Recent Upload History</div>
            {history.length === 0 ? (
              <div className="rounded-2xl border bg-background/40 p-3 text-xs text-muted-foreground">
                No upload history yet.
              </div>
            ) : (
              <div className="max-h-[11.5rem] space-y-2 overflow-y-auto inner-scroll rounded-2xl border bg-background/40 p-3 text-xs snap-y snap-mandatory">
                {history.map((batch) => (
                  <details key={batch.id} className="snap-start rounded-xl border bg-white/70 p-2">
                    <summary className="cursor-pointer list-none">
                      {(() => {
                        const counts = getBatchCounts(batch.items);
                        return (
                          <>
                            <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                              <div className="truncate font-medium">
                                {new Date(batch.createdAt).toLocaleString()} - {batch.sourceType}
                                {batch.sourceName ? ` - ${batch.sourceName}` : ""}
                                {batch.targetJobTitle ? ` - Job: ${batch.targetJobTitle}` : ""}
                              </div>
                              <div className="text-muted-foreground">
                                C:{counts.created} U:{counts.updated} S:{counts.skipped} F:{counts.failed}
                              </div>
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              status: {batch.status.toLowerCase().replace(/_/g, " ")}
                            </div>
                          </>
                        );
                      })()}
                    </summary>
                    <div className="mt-2 space-y-1 border-t pt-2">
                      {batch.items.map((item) => (
                        <div key={item.id} className="grid gap-1 rounded-xl border border-slate-200/70 bg-white/70 p-2 sm:grid-cols-[1.5fr_0.8fr_2fr] sm:gap-2 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0">
                          <span className="truncate font-medium sm:font-normal" title={item.fileName}>
                            {item.fileName}
                          </span>
                          <span
                            className={
                              item.status === "FAILED"
                                ? "text-amber-600"
                                : item.status === "PENDING" || item.status === "PROCESSING"
                                  ? "text-orange-600"
                                : item.status === "UPDATED"
                                  ? "text-blue-600"
                                  : item.status === "SKIPPED"
                                    ? "text-slate-600"
                                  : "text-emerald-600"
                            }
                          >
                            {item.status}
                          </span>
                          <span className="truncate text-muted-foreground" title={item.note ?? item.error ?? ""}>
                            {item.note ?? item.error ?? "-"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



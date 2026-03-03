"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { History } from "lucide-react";

type JobAuditEvent = {
  id: string;
  createdAt: string;
  action: string;
  summary: string | null;
  actorName: string | null;
  metadata: unknown;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatUtcTimestamp(input: string) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  const dd = pad2(d.getUTCDate());
  const mm = pad2(d.getUTCMonth() + 1);
  const yyyy = d.getUTCFullYear();
  const hh = pad2(d.getUTCHours());
  const min = pad2(d.getUTCMinutes());
  const ss = pad2(d.getUTCSeconds());
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}:${ss} UTC`;
}

function formatAuditAction(action: string) {
  if (action === "JOB_DETAILS_UPDATED") return "Job details updated";
  if (action === "JOB_SKILLS_UPDATED") return "Job skills updated";
  if (action === "JOB_SKILLS_GENERATED") return "Skills generated from description";
  if (action === "JOB_MATCHING_RERUN") return "Matchboard re-run";
  if (action === "JOB_DELETED") return "Job deleted";
  return action;
}

function metadataSummary(action: string, metadata: unknown) {
  const m = (metadata ?? {}) as Record<string, unknown>;

  if (action === "JOB_DETAILS_UPDATED") {
    const fields = Array.isArray(m.changedFields) ? m.changedFields : [];
    return fields.length > 0 ? `Changed: ${fields.join(", ")}` : "Updated fields";
  }

  if (action === "JOB_SKILLS_UPDATED") {
    const beforeCount = typeof m.beforeCount === "number" ? m.beforeCount : 0;
    const afterCount = typeof m.afterCount === "number" ? m.afterCount : 0;
    const added = Array.isArray(m.added) ? m.added.length : 0;
    const removed = Array.isArray(m.removed) ? m.removed.length : 0;
    const weightChanged = Array.isArray(m.weightChanged) ? m.weightChanged.length : 0;
    return `${beforeCount} -> ${afterCount} skills | +${added} / -${removed} / ${weightChanged} weight changes`;
  }

  if (action === "JOB_SKILLS_GENERATED") {
    const generatedCount = typeof m.generatedCount === "number" ? m.generatedCount : 0;
    const source = typeof m.source === "string" ? m.source : "MANUAL";
    return `Generated ${generatedCount} skills (${source})`;
  }

  if (action === "JOB_MATCHING_RERUN") {
    const candidates = typeof m.candidatesConsidered === "number" ? m.candidatesConsidered : 0;
    const matches = typeof m.matchesPersisted === "number" ? m.matchesPersisted : 0;
    return `Candidates: ${candidates} | matches persisted: ${matches}`;
  }

  return "No details";
}

export function JobAuditTimeline({
  jobId,
  initialEvents,
  initialHasMore,
  initialNextCursor,
}: {
  jobId: string;
  initialEvents: JobAuditEvent[];
  initialHasMore: boolean;
  initialNextCursor: string | null;
}) {
  const [events, setEvents] = useState<JobAuditEvent[]>(initialEvents);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const typeOptions = useMemo(() => {
    const unique = Array.from(new Set(events.map((e) => e.action))).sort((a, b) =>
      a.localeCompare(b)
    );
    return ["ALL", ...unique];
  }, [events]);

  const filteredEvents = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;

    return events.filter((event) => {
      const eventDate = new Date(event.createdAt);

      if (typeFilter !== "ALL" && event.action !== typeFilter) return false;
      if (from && eventDate < from) return false;
      if (to && eventDate > to) return false;
      return true;
    });
  }, [events, fromDate, toDate, typeFilter]);

  async function loadMore() {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set("take", "25");
      params.set("cursor", nextCursor);

      const res = await fetch(`/api/jobs/${jobId}/audit?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load more activity");

      const incoming = Array.isArray(json?.events) ? (json.events as JobAuditEvent[]) : [];
      setEvents((prev) => [...prev, ...incoming]);
      setHasMore(Boolean(json?.hasMore));
      setNextCursor(typeof json?.nextCursor === "string" ? json.nextCursor : null);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "ALL") params.set("action", typeFilter);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);

      const res = await fetch(`/api/jobs/${jobId}/audit/export?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "Export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `job-audit-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // no-op
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card className="premium-block rounded-3xl border border-slate-300 bg-gradient-to-br from-white via-white/90 to-slate-50 p-6 shadow-[0_26px_60px_-32px_rgba(15,23,42,0.4)]">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
          <History className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Audit trail</div>
          <div className="text-lg font-semibold">Activity timeline</div>
        </div>
      </div>

      <Separator className="my-4" />

      <div className="mb-4 grid gap-2 md:grid-cols-[1.1fr_1fr_1fr_auto]">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm"
        >
          {typeOptions.map((option) => (
            <option key={option} value={option}>
              {option === "ALL" ? "All types" : formatAuditAction(option)}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            setTypeFilter("ALL");
            setFromDate("");
            setToDate("");
          }}
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <div className="mb-4">
        <button
          type="button"
          onClick={() => {
            void exportCsv();
          }}
          disabled={exporting}
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm hover:bg-slate-50 disabled:opacity-60"
        >
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      <div className="mb-4 text-sm text-muted-foreground">
        Tracks details updates, skills changes, generation, and matching runs.
      </div>

      {filteredEvents.length === 0 ? (
        <div className="text-sm text-muted-foreground">No activity for current filter.</div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event) => (
            <div
              key={event.id}
              className="premium-subblock rounded-2xl border border-slate-300/80 bg-white/70 p-4 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{formatAuditAction(event.action)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {event.summary ?? metadataSummary(event.action, event.metadata)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {metadataSummary(event.action, event.metadata)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full capitalize">
                    {formatAuditAction(event.action)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatUtcTimestamp(event.createdAt)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    by {event.actorName ?? "system"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              void loadMore();
            }}
            disabled={loadingMore}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {loadingMore ? "Loading..." : "Show more activity"}
          </button>
        </div>
      ) : null}
    </Card>
  );
}

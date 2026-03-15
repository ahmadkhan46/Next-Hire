"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { History } from "lucide-react";

type TimelineEvent = {
  id: string;
  createdAt: string;
  title: string;
  description: string | null;
  type: string;
  source: "activity" | "decision";
};

function formatType(type: string) {
  const labels: Record<string, string> = {
    PROFILE_UPDATED: "Profile updated",
    RESUME_UPLOADED: "Resume uploaded",
    RESUME_PARSED: "Resume parsed",
    RESUME_PARSE_FAILED: "Resume parse failed",
    MATCH_STATUS_CHANGED: "Match status changed",
    SKILL_ADDED: "Skill added",
    SKILL_REMOVED: "Skill removed",
    EXPERIENCE_ADDED: "Experience added",
    EXPERIENCE_UPDATED: "Experience updated",
    EXPERIENCE_REMOVED: "Experience removed",
    EDUCATION_ADDED: "Education added",
    EDUCATION_UPDATED: "Education updated",
    EDUCATION_REMOVED: "Education removed",
    NOTE_ADDED: "Note added",
    NOTE_UPDATED: "Note updated",
    NOTE_REMOVED: "Note removed",
    INTERVIEW_SCHEDULED: "Interview scheduled",
    INTERVIEW_UPDATED: "Interview updated",
    INTERVIEW_COMPLETED: "Interview completed",
    INTERVIEW_CANCELLED: "Interview cancelled",
    COMMUNICATION_SENT: "Communication sent",
  };
  return labels[type] ?? type.replaceAll("_", " ").toLowerCase();
}

function typeBadgeClass(type: string) {
  if (type.includes("FAILED") || type.includes("REMOVED")) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (type.includes("ADDED") || type.includes("PARSED")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (type === "MATCH_STATUS_CHANGED") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function CandidateActivityTimeline({
  orgId,
  candidateId,
  events,
}: {
  orgId: string;
  candidateId: string;
  events: TimelineEvent[];
}) {
  const PAGE_SIZE = 15;
  const FILTER_KEY = `candidate-timeline-filters:${candidateId}`;
  const [allEvents, setAllEvents] = useState<TimelineEvent[]>(events);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(events.length === PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(FILTER_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        typeFilter?: string;
        fromDate?: string;
        toDate?: string;
      };
      if (parsed.typeFilter) setTypeFilter(parsed.typeFilter);
      if (parsed.fromDate) setFromDate(parsed.fromDate);
      if (parsed.toDate) setToDate(parsed.toDate);
    } catch {
      // ignore malformed storage
    }
  }, [FILTER_KEY]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      FILTER_KEY,
      JSON.stringify({
        typeFilter,
        fromDate,
        toDate,
      })
    );
  }, [FILTER_KEY, fromDate, toDate, typeFilter]);

  const typeOptions = useMemo(() => {
    const unique = Array.from(new Set(allEvents.map((e) => e.type))).sort((a, b) =>
      a.localeCompare(b)
    );
    return ["ALL", ...unique];
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;

    return allEvents.filter((event) => {
      const eventDate = new Date(event.createdAt);

      if (typeFilter !== "ALL" && event.type !== typeFilter) return false;
      if (from && eventDate < from) return false;
      if (to && eventDate > to) return false;
      return true;
    });
  }, [allEvents, fromDate, toDate, typeFilter]);

  useEffect(() => {
    setVisibleCount(1);
  }, [typeFilter, fromDate, toDate]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetch(
        `/api/orgs/${orgId}/candidates/${candidateId}/timeline?page=${nextPage}&limit=${PAGE_SIZE}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load timeline");
      const incoming = (json.events ?? []) as TimelineEvent[];
      setAllEvents((prev) => [...prev, ...incoming]);
      setPage(nextPage);
      setHasMore(Boolean(json.pagination?.hasMore));
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
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
              {option === "ALL" ? "All types" : option.replaceAll("_", " ")}
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

      {filteredEvents.length === 0 ? (
        <div className="text-sm text-muted-foreground">No activity for current filter.</div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.slice(0, visibleCount).map((event) => (
            <div
              key={event.id}
              className="premium-subblock rounded-2xl border border-slate-300/80 bg-white/70 p-4 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{event.title}</div>
                  {event.description ? (
                    <div className="mt-1 text-xs text-muted-foreground">{event.description}</div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full capitalize">
                    {formatType(event.type)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`rounded-full capitalize ${typeBadgeClass(event.type)}`}
                  >
                    {event.source === "decision" ? "decision log" : "activity"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredEvents.length > 0 ? (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const hasVisibleHidden = visibleCount < filteredEvents.length;
              if (hasVisibleHidden) {
                setVisibleCount((prev) => prev + 5);
                return;
              }

              if (hasMore) {
                await loadMore();
                setVisibleCount((prev) => prev + 5);
              }
            }}
            disabled={loadingMore || (!hasMore && visibleCount >= filteredEvents.length)}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {loadingMore ? "Loading..." : "Show more activity"}
          </button>

          {visibleCount > 1 ? (
            <button
              type="button"
              onClick={() => setVisibleCount(1)}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm hover:bg-slate-50"
            >
              Show less
            </button>
          ) : null}

          <div className="ml-auto text-xs text-muted-foreground">
            Showing {Math.min(visibleCount, filteredEvents.length)} of {filteredEvents.length}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Briefcase, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

type MatchItem = {
  id: string;
  score: number;
  status: string;
  statusUpdatedAt: string | null;
  job: {
    id: string;
    title: string;
    location: string | null;
    status: "OPEN" | "CLOSED";
  } | null;
};

export function CandidateMatchesPanel({
  orgId,
  candidateId,
  initialMatches,
  initialHasMore,
}: {
  orgId: string;
  candidateId: string;
  initialMatches: MatchItem[];
  initialHasMore: boolean;
}) {
  const PAGE_SIZE = 10;
  const [jobFilter, setJobFilter] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");
  const [sortBy, setSortBy] = useState<"score_desc" | "updated_desc">("score_desc");
  const [matches, setMatches] = useState<MatchItem[]>(initialMatches);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const didMountRef = useRef(false);

  const fetchMatches = useCallback(
    async (nextPage: number, append: boolean) => {
      const query = new URLSearchParams({
        page: String(nextPage),
        limit: String(PAGE_SIZE),
        sort: sortBy,
        status: jobFilter,
      });
      const res = await fetch(
        `/api/orgs/${orgId}/candidates/${candidateId}/matches?${query.toString()}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load matches");

      const incoming = (json.matches ?? []) as MatchItem[];
      setMatches((prev) => (append ? [...prev, ...incoming] : incoming));
      setPage(nextPage);
      setHasMore(Boolean(json.pagination?.hasMore));
    },
    [candidateId, orgId, sortBy, jobFilter]
  );

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    setLoading(true);
    fetchMatches(1, false)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Failed to load matches";
        toast.error(message);
      })
      .finally(() => setLoading(false));
  }, [fetchMatches]);

  const filtered = useMemo(() => {
    return matches.filter((match) => {
      if (jobFilter === "ALL") return true;
      return match.job?.status === jobFilter;
    });
  }, [jobFilter, matches]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      await fetchMatches(page + 1, true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load more matches";
      toast.error(message);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  async function updateMatchStatus(
    match: MatchItem,
    nextStatus: "SHORTLISTED" | "REJECTED" | "NONE"
  ) {
    if (!match.job?.id) return;
    if (match.status === nextStatus) return;

    const key = `${match.id}:${nextStatus}`;
    setUpdatingKey(key);
    try {
      const res = await fetch(`/api/jobs/${match.job.id}/matches/${candidateId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          note:
            nextStatus === "SHORTLISTED"
              ? "Shortlisted from candidate profile."
              : nextStatus === "REJECTED"
              ? "Rejected from candidate profile."
              : "Reset to NONE from candidate profile.",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update status");

      setMatches((prev) =>
        prev.map((m) =>
          m.id === match.id
            ? { ...m, status: nextStatus, statusUpdatedAt: new Date().toISOString() }
            : m
        )
      );
      toast.success(
        nextStatus === "SHORTLISTED"
          ? "Candidate shortlisted"
          : nextStatus === "REJECTED"
          ? "Candidate rejected"
          : "Status reset"
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update status";
      toast.error(message);
    } finally {
      setUpdatingKey(null);
    }
  }

  return (
    <Card className="premium-block relative overflow-hidden rounded-3xl border border-slate-300 bg-gradient-to-br from-white via-white/90 to-slate-50 p-6 shadow-[0_26px_60px_-32px_rgba(15,23,42,0.4)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
          <div className="text-sm text-muted-foreground">Matches</div>
          <div className="text-lg font-semibold">Recent opportunities</div>
        </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "score_desc" | "updated_desc")}
            className="h-9 rounded-full border border-slate-300 bg-white px-3 text-xs"
          >
            <option value="score_desc">Sort: Highest score</option>
            <option value="updated_desc">Sort: Latest update</option>
          </select>

          <div className="inline-flex items-center gap-1 rounded-full border border-slate-300/80 bg-white/80 p-1">
            {(["ALL", "OPEN", "CLOSED"] as const).map((filterValue) => (
              <button
                key={filterValue}
                type="button"
                onClick={() => setJobFilter(filterValue)}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  jobFilter === filterValue
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {filterValue}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Separator className="my-4" />

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading matches...</div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No match results for this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="premium-subblock relative overflow-hidden flex items-center justify-between gap-4 rounded-2xl border border-slate-300/80 bg-white/70 p-4 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]"
            >
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold">
                    {m.job?.title ?? "Untitled job"}
                  </div>
                  {Math.round((m.score ?? 0) * 100) >= 90 ? (
                    <Badge className="rounded-full bg-emerald-600 text-white hover:bg-emerald-600">
                      Best fit
                    </Badge>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {m.job?.location ?? "--"}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant="outline" className="rounded-full">
                  {Math.round((m.score ?? 0) * 100)}%
                </Badge>
                <Badge
                  variant={
                    m.status === "SHORTLISTED"
                      ? "secondary"
                      : m.status === "REJECTED"
                      ? "destructive"
                      : "outline"
                  }
                  className="rounded-full"
                >
                  {m.status}
                </Badge>
                <Badge
                  variant={m.job?.status === "OPEN" ? "secondary" : "outline"}
                  className="rounded-full"
                >
                  {m.job?.status ?? "UNKNOWN"}
                </Badge>
                <button
                  type="button"
                  onClick={() => updateMatchStatus(m, "SHORTLISTED")}
                  disabled={
                    !m.job?.id ||
                    m.status === "SHORTLISTED" ||
                    m.job?.status !== "OPEN" ||
                    updatingKey === `${m.id}:SHORTLISTED`
                  }
                  className="inline-flex items-center rounded-full border bg-white px-3 py-1 text-xs font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updatingKey === `${m.id}:SHORTLISTED` ? "Saving..." : "Shortlist"}
                </button>
                <button
                  type="button"
                  onClick={() => updateMatchStatus(m, "REJECTED")}
                  disabled={!m.job?.id || m.status === "REJECTED" || updatingKey === `${m.id}:REJECTED`}
                  className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updatingKey === `${m.id}:REJECTED` ? "Saving..." : "Reject"}
                </button>
                <button
                  type="button"
                  onClick={() => updateMatchStatus(m, "NONE")}
                  disabled={!m.job?.id || m.status === "NONE" || updatingKey === `${m.id}:NONE`}
                  className="inline-flex items-center rounded-full border bg-white px-3 py-1 text-xs font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updatingKey === `${m.id}:NONE` ? "Saving..." : "Reset"}
                </button>
                {m.job?.id ? (
                  <Link
                    href={`/orgs/${orgId}/matchboard?jobId=${m.job.id}`}
                    className="inline-flex items-center gap-1 rounded-full border bg-background/40 px-3 py-1 text-xs hover:bg-accent/60 transition"
                  >
                    View <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {loadingMore ? "Loading..." : "Load more matches"}
          </button>
        </div>
      ) : null}
    </Card>
  );
}

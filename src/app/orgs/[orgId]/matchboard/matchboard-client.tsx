"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, RefreshCw, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Job = {
  id: string;
  title?: string;
  department?: string | null;
  location?: string | null;
};

type MatchStatus = "NONE" | "SHORTLISTED" | "REJECTED";

type MatchRow = {
  candidateId: string;
  fullName: string;
  email?: string | null;
  score: number; // 0..1
  matched: string[];
  missing: string[];
  missingCritical: string[];
  status: MatchStatus;
  statusUpdatedAt?: string | null;
};

type MatchDecisionEntry = {
  id: string;
  createdAt: string;
  fromStatus: MatchStatus;
  toStatus: MatchStatus;
  note?: string | null;
  decidedBy?: string | null;
};

type JobDetail = {
  skills: Array<{
    id?: string;
    name: string;
    weight?: number;
    isCritical?: boolean;
  }>;
};

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${url}`);
  return res.json();
}

function normalizeArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (v == null) return [];
  if (typeof v === "string") {
    const s = v.trim();
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map((x) => String(x));
      } catch {
        // ignore
      }
    }
    if (s.includes(",")) return s.split(",").map((x) => x.trim()).filter(Boolean);
    return [s];
  }
  return [String(v)];
}

export function MatchboardClient({
  orgId,
  jobs,
  initialJobId,
}: {
  orgId: string;
  jobs: Job[];
  initialJobId: string | null;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const [jobId, setJobId] = React.useState<string | null>(
    sp.get("jobId") ?? initialJobId
  );
  const [jobDetail, setJobDetail] = React.useState<JobDetail | null>(null);
  const [matches, setMatches] = React.useState<MatchRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<MatchRow | null>(null);
  const [q, setQ] = React.useState("");
  const [statusBusyIds, setStatusBusyIds] = React.useState<Set<string>>(new Set());
  const [sort, setSort] = React.useState<
    "score" | "critical" | "missingCount" | "unreviewedFirst"
  >("score");
  const [statusFilter, setStatusFilter] = React.useState<
    "ALL" | "NONE" | "SHORTLISTED" | "REJECTED"
  >("ALL");
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [history, setHistory] = React.useState<MatchDecisionEntry[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);

  const activeJob = React.useMemo(
    () => jobs.find((j) => j.id === jobId) ?? null,
    [jobs, jobId]
  );

  React.useEffect(() => {
    const baseUrl = `/orgs/${orgId}/matchboard`;
    if (!jobId) {
      router.replace(baseUrl);
      return;
    }
    router.replace(`${baseUrl}?jobId=${encodeURIComponent(jobId)}`);
  }, [jobId, orgId, router]);

  const fetchAll = React.useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const [skillsRes, matchesRes] = await Promise.all([
        getJSON<any>(`/api/jobs/${jobId}/skills`).catch(() => ({ skills: [] })),
        getJSON<any>(`/api/jobs/${jobId}/matches?take=50`).catch(() => ({ matches: [] })),
      ]);

      const skills = (skillsRes?.skills ?? [])
        .map((s: any) => ({
          id: s.id,
          name: s.name,
          weight: typeof s.weight === "number" ? s.weight : 1,
          isCritical:
            typeof s.isCritical === "boolean"
              ? s.isCritical
              : (typeof s.weight === "number" ? s.weight : 1) >= 4,
        }))
        .sort((a: any, b: any) => (b.weight ?? 1) - (a.weight ?? 1));

      const normalized: MatchRow[] = (matchesRes?.matches ?? []).map((m: any) => ({
        candidateId: m.candidateId,
        fullName: m.fullName,
        email: m.email ?? null,
        score: Number(m.score ?? 0),
        matched: normalizeArray(m.matched),
        missing: normalizeArray(m.missing),
        missingCritical: normalizeArray(m.missingCritical),
        status: (m.status ?? "NONE") as MatchStatus,
        statusUpdatedAt: m.statusUpdatedAt ?? null,
      }));

      setJobDetail({ skills });
      setMatches(normalized);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load matchboard");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  React.useEffect(() => {
    if (!jobId) return;
    fetchAll();
  }, [jobId, fetchAll]);

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    let rows = matches.filter((m) => {
      const statusOk =
        statusFilter === "ALL"
          ? true
          : statusFilter === "NONE"
          ? m.status === "NONE"
          : m.status === statusFilter;
      return statusOk;
    });

    if (query) {
      rows = rows.filter((m) => {
        return (
          (m.fullName ?? "").toLowerCase().includes(query) ||
          (m.email ?? "").toLowerCase().includes(query) ||
          (m.missing ?? []).join(" ").toLowerCase().includes(query) ||
          (m.missingCritical ?? []).join(" ").toLowerCase().includes(query) ||
          (m.matched ?? []).join(" ").toLowerCase().includes(query)
        );
      });
    }

    rows.sort((a, b) => {
      if (sort === "unreviewedFirst") {
        const aIsNone = a.status === "NONE";
        const bIsNone = b.status === "NONE";
        if (aIsNone !== bIsNone) return aIsNone ? -1 : 1;
      }
      if (sort === "score") return (b.score ?? 0) - (a.score ?? 0);
      if (sort === "critical") {
        return (b.missingCritical?.length ?? 0) - (a.missingCritical?.length ?? 0);
      }
      if (sort === "missingCount") {
        const am = (a.missing?.length ?? 0) + (a.missingCritical?.length ?? 0);
        const bm = (b.missing?.length ?? 0) + (b.missingCritical?.length ?? 0);
        return bm - am;
      }
      return (a.fullName ?? "").localeCompare(b.fullName ?? "");
    });

    return rows;
  }, [matches, q, sort, statusFilter]);

  const topMatch = React.useMemo(() => {
    if (filtered.length === 0) return null;
    return [...filtered].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null;
  }, [filtered]);

  async function updateStatus(
    candidateId: string,
    status: MatchStatus,
    note?: string
  ) {
    if (!jobId || statusBusyIds.has(candidateId)) return;
    setStatusBusyIds((prev) => new Set(prev).add(candidateId));
    try {
      const res = await fetch(`/api/jobs/${jobId}/matches/${candidateId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to update status");

      setMatches((prev) =>
        prev.map((m) =>
          m.candidateId === candidateId
            ? {
                ...m,
                status,
                statusUpdatedAt: data?.statusUpdatedAt ?? new Date().toISOString(),
              }
            : m
        )
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Update failed");
    } finally {
      setStatusBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(candidateId);
        return next;
      });
    }
  }

  async function rerunMatch() {
    if (!jobId || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/match`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to recompute matches");
      await fetchAll();
      toast.success("Matchboard updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Re-run failed");
    } finally {
      setLoading(false);
    }
  }

  async function bulkUpdate(status: MatchStatus, ids: string[], note?: string) {
    if (!jobId || bulkBusy || ids.length === 0) return;
    setBulkBusy(true);
    try {
      for (const id of ids) {
        await updateStatus(id, status, note);
      }
      toast.success(`Updated ${ids.length} candidates`);
    } catch (e: any) {
      toast.error(e?.message ?? "Bulk update failed");
    } finally {
      setBulkBusy(false);
    }
  }

  React.useEffect(() => {
    if (!selected || !jobId) return;
    let cancelled = false;
    setHistoryLoading(true);
    fetch(`/api/jobs/${jobId}/matches/${selected.candidateId}/history`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setHistory(data?.history ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setHistory([]);
      })
      .finally(() => {
        if (cancelled) return;
        setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, selected]);

  if (!jobId) {
    return (
      <Card className="premium-block rounded-3xl border bg-card/50 p-8 shadow-sm">
        <div className="text-sm text-muted-foreground">Matchboard</div>
        <div className="mt-2 text-2xl font-semibold">No job selected</div>
        <div className="mt-2 text-sm text-muted-foreground">
          Create a job to generate matches and view intelligence insights.
        </div>
      </Card>
    );
  }

  return (
    <Card className="premium-block rounded-3xl border bg-card/50 p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs text-muted-foreground">Active job</div>
          <div className="mt-1 text-lg font-semibold">
            {activeJob?.title ?? "Select a job"}
          </div>
          <div className="text-xs text-muted-foreground">
            {(activeJob?.department ?? "--") + " - " + (activeJob?.location ?? "--")}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={jobId ?? ""}
              onChange={(e) => setJobId(e.target.value || null)}
              className="h-10 w-56 appearance-none rounded-2xl border bg-background/40 px-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="" disabled>
                Select a job...
              </option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title ?? j.id}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
          </div>

          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={fetchAll}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>

          <Button
            className="rounded-2xl"
            onClick={rerunMatch}
            disabled={loading}
            title="Re-run matching"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Re-run
          </Button>
        </div>
      </div>

      <Separator className="my-5" />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 rounded-2xl pl-9"
            placeholder="Search name, email, skills..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs text-muted-foreground">
            {filtered.length} of {matches.length} candidates
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-9 w-full max-w-[220px] rounded-xl border bg-background/40 px-3 text-xs outline-none md:w-auto"
          >
            <option value="ALL">All statuses</option>
            <option value="NONE">Unreviewed</option>
            <option value="SHORTLISTED">Shortlisted</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="h-9 w-full max-w-[220px] rounded-xl border bg-background/40 px-3 text-xs outline-none md:w-auto"
          >
            <option value="score">Sort: score</option>
            <option value="critical">Sort: critical gaps</option>
            <option value="missingCount">Sort: total missing</option>
            <option value="unreviewedFirst">Sort: unreviewed first</option>
          </select>
        </div>
      </div>

      <Separator className="my-5" />

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Button
          variant="outline"
          className="rounded-2xl"
          disabled={bulkBusy}
          onClick={() => {
            const ids = filtered.filter((m) => (m.score ?? 0) >= 0.8).map((m) => m.candidateId);
            bulkUpdate("SHORTLISTED", ids, "Auto-shortlist: score >= 80%");
          }}
        >
          Shortlist 80%+
        </Button>
        <Button
          variant="outline"
          className="rounded-2xl"
          disabled={bulkBusy}
          onClick={() => {
            const ids = filtered
              .filter((m) => (m.missingCritical?.length ?? 0) > 0)
              .map((m) => m.candidateId);
            bulkUpdate("REJECTED", ids, "Auto-reject: missing critical requirements");
          }}
        >
          Reject critical gaps
        </Button>
        <Button
          variant="outline"
          className="rounded-2xl"
          disabled={bulkBusy}
          onClick={() => {
            const ids = filtered.map((m) => m.candidateId);
            bulkUpdate("NONE", ids, "Bulk reset from matchboard");
          }}
        >
          Reset to unreviewed
        </Button>
      </div>

      <Separator className="my-5" />

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="premium-subblock rounded-2xl border border-dashed bg-background/40 p-6 text-sm text-muted-foreground">
          No matches yet. Try re-running the match or adjust skills.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => {
            const scorePct = Math.round((m.score ?? 0) * 100);
            const missingCount = m.missing?.length ?? 0;
            const criticalCount = m.missingCritical?.length ?? 0;

            return (
              <button
                key={m.candidateId}
                className="premium-subblock w-full rounded-2xl border bg-background/40 p-4 text-left transition hover:bg-accent/40"
                onClick={() => setSelected(m)}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-base font-semibold">{m.fullName}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {m.email ?? "--"}
                      {m.statusUpdatedAt ? (
                        <span className="ml-2">Updated {new Date(m.statusUpdatedAt).toLocaleDateString()}</span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="rounded-full">
                        Score: {scorePct}%
                      </Badge>
                      <Badge variant="outline" className="rounded-full">
                        Missing: {missingCount}
                      </Badge>
                      <Badge variant={criticalCount > 0 ? "destructive" : "outline"} className="rounded-full">
                        Critical: {criticalCount}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
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

                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      disabled={statusBusyIds.has(m.candidateId)}
                      onClick={(e) => {
                        e.preventDefault();
                        updateStatus(m.candidateId, "NONE");
                      }}
                    >
                      Reset
                    </Button>

                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      disabled={statusBusyIds.has(m.candidateId)}
                      onClick={(e) => {
                        e.preventDefault();
                        updateStatus(m.candidateId, "SHORTLISTED");
                      }}
                    >
                      Shortlist
                    </Button>

                    <Button
                      variant="destructive"
                      className="rounded-2xl"
                      disabled={statusBusyIds.has(m.candidateId)}
                      onClick={(e) => {
                        e.preventDefault();
                        updateStatus(m.candidateId, "REJECTED", "Manual reject from matchboard");
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl rounded-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {selected?.fullName ?? "Candidate"}
            </DialogTitle>
          </DialogHeader>

          {selected ? (
            <div className="space-y-6">
              <Card className="premium-subblock rounded-2xl border bg-card/40 p-4">
                <div className="text-sm font-medium">Match breakdown</div>
                <Separator className="my-3" />
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Matched skills</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(selected.matched ?? []).slice(0, 12).map((s) => (
                        <Badge key={s} variant="secondary" className="rounded-full">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Missing skills</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(selected.missing ?? []).slice(0, 12).map((s) => (
                        <Badge key={s} variant="outline" className="rounded-full">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              {jobDetail?.skills?.length ? (
                <Card className="premium-subblock rounded-2xl border bg-card/40 p-4">
                  <div className="text-sm font-medium">Role skills</div>
                  <Separator className="my-3" />
                  <div className="flex flex-wrap gap-2">
                    {jobDetail.skills.slice(0, 12).map((s) => (
                      <Badge
                        key={s.id ?? s.name}
                        variant={s.isCritical ? "destructive" : "outline"}
                        className="rounded-full"
                      >
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                </Card>
              ) : null}

              {topMatch && topMatch.candidateId !== selected.candidateId ? (
                <Card className="premium-subblock rounded-2xl border bg-card/40 p-4">
                  <div className="text-sm font-medium">Compare to top match</div>
                  <Separator className="my-3" />
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Score delta</div>
                      <div className="mt-2 text-sm font-semibold">
                        {Math.round((selected.score ?? 0) * 100) -
                          Math.round((topMatch.score ?? 0) * 100)}
                        %
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Critical gaps</div>
                      <div className="mt-2 text-sm font-semibold">
                        {(selected.missingCritical?.length ?? 0) -
                          (topMatch.missingCritical?.length ?? 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Missing skills</div>
                      <div className="mt-2 text-sm font-semibold">
                        {(selected.missing?.length ?? 0) - (topMatch.missing?.length ?? 0)}
                      </div>
                    </div>
                  </div>
                </Card>
              ) : null}

              <Card className="premium-subblock rounded-2xl border bg-card/40 p-4">
                <div className="text-sm font-medium">Decision history</div>
                <Separator className="my-3" />
                {historyLoading ? (
                  <div className="text-sm text-muted-foreground">Loading...</div>
                ) : history.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No decisions yet.</div>
                ) : (
                  <div className="space-y-2">
                    {history.slice(0, 8).map((h) => (
                      <div key={h.id} className="premium-subblock rounded-2xl border bg-background/40 p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            <Badge variant="outline" className="rounded-full">
                              {h.fromStatus}
                            </Badge>
                            <span className="px-2 text-muted-foreground">{"->"}</span>
                            <Badge className="rounded-full">{h.toStatus}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(h.createdAt).toLocaleString()}
                            {h.decidedBy ? ` - ${h.decidedBy}` : ""}
                          </div>
                        </div>
                        {h.note ? (
                          <div className="mt-2 text-xs text-muted-foreground italic">
                            "{h.note}"
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

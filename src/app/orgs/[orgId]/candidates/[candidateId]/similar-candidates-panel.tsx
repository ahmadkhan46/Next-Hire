"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowUpRight, Users } from "lucide-react";
import { toast } from "sonner";

type SimilarCandidate = {
  id: string;
  fullName: string;
  email: string | null;
  currentTitle: string | null;
  scorePercent: number;
  overlapCount?: number;
  yearsOfExperience: number | null;
  sharedSkills: string[];
  topMatchPercent: number | null;
  source: "semantic" | "skills";
};

export function SimilarCandidatesPanel({
  orgId,
  candidateId,
  items,
}: {
  orgId: string;
  candidateId: string;
  items: SimilarCandidate[];
}) {
  const [loading, setLoading] = useState(items.length === 0);
  const [resolvedItems, setResolvedItems] = useState<SimilarCandidate[]>(items);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/orgs/${orgId}/candidates/${candidateId}/similar?limit=8`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load similar candidates");
        if (!cancelled) {
          setResolvedItems((json.results ?? []) as SimilarCandidate[]);
        }
      } catch {
        if (!cancelled) {
          toast.error("Unable to load similar candidates");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orgId, candidateId]);

  function toggleSelection(candidateId: string) {
    setSelectedIds((prev) => {
      if (prev.includes(candidateId)) return prev.filter((id) => id !== candidateId);
      if (prev.length >= 2) return [prev[1], candidateId];
      return [...prev, candidateId];
    });
  }

  const sortedItems = useMemo(
    () =>
      resolvedItems
        .filter((item) => item.scorePercent >= 30)
        .sort((a, b) => b.scorePercent - a.scorePercent),
    [resolvedItems]
  );

  const selectedItems = useMemo(
    () =>
      selectedIds
        .map((id) => sortedItems.find((item) => item.id === id))
        .filter(Boolean) as SimilarCandidate[],
    [selectedIds, sortedItems]
  );

  const canCompare = selectedItems.length === 2;

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => sortedItems.some((item) => item.id === id)));
  }, [sortedItems]);

  const topItems = sortedItems.slice(0, 2);
  const overflowItems = sortedItems.slice(2);

  return (
    <Card className="premium-block rounded-3xl border border-slate-300 bg-gradient-to-br from-white via-white/90 to-slate-50 p-6 shadow-[0_26px_60px_-32px_rgba(15,23,42,0.4)]">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">AI Discovery</div>
          <div className="text-lg font-semibold">Similar candidates</div>
        </div>
        <div className="ml-auto">
          <Link
            href={`/orgs/${orgId}/candidates/compare?from=${candidateId}`}
            className="inline-flex items-center gap-1 rounded-full border bg-background/40 px-3 py-1 text-xs hover:bg-accent/60 transition"
          >
            Compare with other candidates <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <Separator className="my-4" />

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading similar candidates...</div>
      ) : sortedItems.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No similar candidates above 30% similarity yet. Upload and parse more resumes to improve recommendations.
        </div>
      ) : (
        <>
          <div className="mb-3 text-xs text-muted-foreground">
            Select up to 2 candidates to compare side-by-side.
          </div>

          <div className="space-y-3">
            {topItems.map((item) => {
              const selected = selectedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`premium-subblock rounded-2xl border bg-white/70 p-4 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)] ${
                    selected ? "border-blue-300 ring-1 ring-blue-200" : "border-slate-300/80"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{item.fullName}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {item.currentTitle || "--"}
                        {item.email ? ` • ${item.email}` : ""}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleSelection(item.id)}
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          selected
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {selected ? "Selected" : "Compare"}
                      </button>
                      <Link
                        href={`/orgs/${orgId}/candidates/${item.id}`}
                        className="inline-flex items-center gap-1 rounded-full border bg-background/40 px-3 py-1 text-xs hover:bg-accent/60 transition"
                      >
                        View <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full">
                      {item.scorePercent}% similar
                    </Badge>
                    {typeof item.overlapCount === "number" ? (
                      <Badge variant="secondary" className="rounded-full">
                        {item.overlapCount} shared skills
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className="rounded-full capitalize">
                      {item.source}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>

          {overflowItems.length > 0 ? (
            <div className="mt-3">
              <div className="mb-2 text-xs text-muted-foreground">
                More similar candidates ({overflowItems.length})
              </div>
              <div className="max-h-80 space-y-3 overflow-y-auto inner-scroll pr-1">
                {overflowItems.map((item) => {
                  const selected = selectedIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`premium-subblock rounded-2xl border bg-white/70 p-4 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)] ${
                        selected ? "border-blue-300 ring-1 ring-blue-200" : "border-slate-300/80"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{item.fullName}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {item.currentTitle || "--"}
                            {item.email ? ` • ${item.email}` : ""}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleSelection(item.id)}
                            className={`rounded-full border px-3 py-1 text-xs transition ${
                              selected
                                ? "border-blue-300 bg-blue-50 text-blue-700"
                                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {selected ? "Selected" : "Compare"}
                          </button>
                          <Link
                            href={`/orgs/${orgId}/candidates/${item.id}`}
                            className="inline-flex items-center gap-1 rounded-full border bg-background/40 px-3 py-1 text-xs hover:bg-accent/60 transition"
                          >
                            View <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full">
                          {item.scorePercent}% similar
                        </Badge>
                        {typeof item.overlapCount === "number" ? (
                          <Badge variant="secondary" className="rounded-full">
                            {item.overlapCount} shared skills
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className="rounded-full capitalize">
                          {item.source}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {canCompare ? (
            <div className="mt-5 rounded-2xl border border-slate-300/80 bg-white/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Comparison</div>
                <Link
                  href={`/orgs/${orgId}/candidates/compare?ids=${selectedIds.join(",")}&from=${candidateId}`}
                  className="inline-flex items-center gap-1 rounded-full border bg-background/40 px-3 py-1 text-xs hover:bg-accent/60 transition"
                >
                  Compare full profile <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {selectedItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-300/80 bg-white/80 p-4"
                  >
                    <div className="text-sm font-semibold">{item.fullName}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.currentTitle ?? "--"}
                    </div>
                    <div className="mt-3 grid gap-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Similarity</span>
                        <span className="font-medium">{item.scorePercent}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Experience</span>
                        <span className="font-medium">
                          {item.yearsOfExperience != null ? `${item.yearsOfExperience} years` : "--"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Top match</span>
                        <span className="font-medium">
                          {item.topMatchPercent != null ? `${item.topMatchPercent}%` : "--"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="mb-2 text-xs font-medium text-muted-foreground">
                        Shared skills
                      </div>
                      {item.sharedSkills.length === 0 ? (
                        <div className="text-xs text-muted-foreground">No shared skills found.</div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {item.sharedSkills.slice(0, 10).map((skill) => (
                            <Badge key={`${item.id}-${skill}`} variant="outline" className="rounded-full text-[11px]">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-xs text-muted-foreground">
              Select two candidates to view comparison.
            </div>
          )}
        </>
      )}
    </Card>
  );
}


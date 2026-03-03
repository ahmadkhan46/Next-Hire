"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

type CandidateOption = {
  id: string;
  fullName: string;
  email: string | null;
  currentTitle: string | null;
  similarityPercent?: number | null;
};

export function ManualComparePicker({
  orgId,
  fromCandidateId,
  candidates,
}: {
  orgId: string;
  fromCandidateId?: string;
  candidates: CandidateOption[];
}) {
  const router = useRouter();
  const defaultFirst = fromCandidateId && candidates.some((c) => c.id === fromCandidateId)
    ? fromCandidateId
    : candidates[0]?.id ?? "";
  const defaultSecond = candidates.find((c) => c.id !== defaultFirst)?.id ?? "";

  const [firstId, setFirstId] = useState(defaultFirst);
  const [secondId, setSecondId] = useState(defaultSecond);

  const canCompare = useMemo(
    () => Boolean(firstId) && Boolean(secondId) && firstId !== secondId,
    [firstId, secondId]
  );

  function goToCompare() {
    if (!canCompare) return;
    const params = new URLSearchParams();
    params.set("ids", `${firstId},${secondId}`);
    if (fromCandidateId) params.set("from", fromCandidateId);
    router.push(`/orgs/${orgId}/candidates/compare?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Candidate A
          </div>
          <select
            value={firstId}
            onChange={(e) => setFirstId(e.target.value)}
            className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-3 text-sm"
          >
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.fullName}
                {candidate.similarityPercent != null ? ` (${candidate.similarityPercent}%)` : ""}
                {candidate.email ? ` - ${candidate.email}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Candidate B
          </div>
          <select
            value={secondId}
            onChange={(e) => setSecondId(e.target.value)}
            className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-3 text-sm"
          >
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.fullName}
                {candidate.similarityPercent != null ? ` (${candidate.similarityPercent}%)` : ""}
                {candidate.email ? ` - ${candidate.email}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={goToCompare}
        disabled={!canCompare}
        className="inline-flex items-center gap-2 rounded-2xl border bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Compare full profile <ArrowUpRight className="h-4 w-4" />
      </button>
    </div>
  );
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CandidatesFilters({
  initialStatus,
  initialSource,
  initialSort,
}: {
  initialStatus: string;
  initialSource: string;
  initialSort: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState(initialStatus);
  const [source, setSource] = useState(initialSource);
  const [sort, setSort] = useState(initialSort);

  function applyChange(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleStatus(val: string) {
    setStatus(val);
    applyChange("status", val);
  }

  function handleSource(val: string) {
    setSource(val);
    applyChange("source", val);
  }

  function handleSort(val: string) {
    setSort(val);
    const params = new URLSearchParams(searchParams.toString());
    if (val && val !== "newest") params.set("sort", val); else params.delete("sort");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearAll() {
    setStatus(""); setSource(""); setSort("newest");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("status"); params.delete("source"); params.delete("sort");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const hasFilters = status || source || (sort && sort !== "newest");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status */}
      <select
        value={status}
        onChange={(e) => handleStatus(e.target.value)}
        className="h-10 rounded-2xl border bg-background px-3 text-sm"
      >
        <option value="">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Inactive</option>
        <option value="HIRED">Hired</option>
        <option value="REJECTED">Rejected</option>
        <option value="NEEDS_REVIEW">Needs Review</option>
      </select>

      {/* Source */}
      <select
        value={source}
        onChange={(e) => handleSource(e.target.value)}
        className="h-10 rounded-2xl border bg-background px-3 text-sm"
      >
        <option value="">All sources</option>
        <option value="MANUAL">Manual</option>
        <option value="IMPORT">Import</option>
        <option value="REFERRAL">Referral</option>
        <option value="LINKEDIN">LinkedIn</option>
        <option value="AGENCY">Agency</option>
        <option value="CAREER_SITE">Career Site</option>
        <option value="JOB_BOARD">Job Board</option>
      </select>

      {/* Sort */}
      <select
        value={sort}
        onChange={(e) => handleSort(e.target.value)}
        className="h-10 rounded-2xl border bg-background px-3 text-sm"
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="name_asc">Name A→Z</option>
        <option value="name_desc">Name Z→A</option>
      </select>

      {hasFilters ? (
        <Button variant="ghost" size="sm" className="rounded-2xl" onClick={clearAll}>
          <X className="mr-1 h-3 w-3" />
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}

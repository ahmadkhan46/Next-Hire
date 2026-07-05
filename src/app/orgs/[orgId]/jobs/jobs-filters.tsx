"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function JobsFilters({
  initialQuery,
  initialStatus,
  initialWorkMode,
}: {
  initialQuery: string;
  initialStatus: string;
  initialWorkMode: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [workMode, setWorkMode] = useState(initialWorkMode);

  function buildUrl(q: string, s: string, wm: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (q.trim()) params.set("q", q.trim()); else params.delete("q");
    if (s) params.set("status", s); else params.delete("status");
    if (wm) params.set("workMode", wm); else params.delete("workMode");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  // Debounced search query
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentQ = searchParams.get("q")?.trim() ?? "";
      if (query.trim() === currentQ) return;
      router.replace(buildUrl(query, status, workMode));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleStatusChange(val: string) {
    setStatus(val);
    router.replace(buildUrl(query, val, workMode));
  }

  function handleWorkModeChange(val: string) {
    setWorkMode(val);
    router.replace(buildUrl(query, status, val));
  }

  function clearAll() {
    setQuery("");
    setStatus("");
    setWorkMode("");
    router.replace(pathname);
  }

  const hasFilters = query.trim() || status || workMode;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or company..."
          className="h-10 rounded-2xl border border-slate-300/80 bg-white/80 pl-10 pr-10"
        />
        {query ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-xl"
            onClick={() => setQuery("")}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {/* Status filter */}
      <select
        value={status}
        onChange={(e) => handleStatusChange(e.target.value)}
        className="h-10 rounded-2xl border bg-background px-3 text-sm"
      >
        <option value="">All statuses</option>
        <option value="OPEN">Open</option>
        <option value="CLOSED">Closed</option>
      </select>

      {/* Work mode filter */}
      <select
        value={workMode}
        onChange={(e) => handleWorkModeChange(e.target.value)}
        className="h-10 rounded-2xl border bg-background px-3 text-sm"
      >
        <option value="">All work modes</option>
        <option value="REMOTE">Remote</option>
        <option value="ONSITE">Onsite</option>
        <option value="HYBRID">Hybrid</option>
      </select>

      {hasFilters ? (
        <Button variant="ghost" size="sm" className="rounded-2xl" onClick={clearAll}>
          <X className="mr-1 h-3 w-3" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}

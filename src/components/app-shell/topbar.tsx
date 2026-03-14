"use client";

import { Input } from "@/components/ui/input";
import {
  Search,
  Users,
  Briefcase,
  Loader2,
  LayoutDashboard,
  Settings,
  Upload,
  Brain,
  ListChecks,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { SignedOut } from "@clerk/nextjs";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette } from "@/components/command-palette";
import { isClerkClientEnabled } from "@/lib/clerk-config";

type SearchResults = {
  candidates: Array<{ id: string; name: string; email: string }>;
  jobs: Array<{ id: string; title: string; department: string }>;
  pages: Array<{ name: string; path: string }>;
};

const NotificationBell = dynamic(
  () =>
    import("@/components/notification-bell").then((m) => ({
      default: m.NotificationBell,
    })),
  { ssr: false }
);

export function Topbar({ orgId }: { orgId: string }) {
  const clerkEnabled = isClerkClientEnabled();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResults>({
    candidates: [],
    jobs: [],
    pages: [],
  });
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ candidates: [], jobs: [], pages: [] });
      setShowResults(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/orgs/${orgId}/search?q=${encodeURIComponent(query)}`
        );
        if (!res.ok) {
          setError("Search unavailable");
          setShowResults(true);
          return;
        }
        const data = (await res.json()) as SearchResults;
        setResults(data);
        setShowResults(true);
      } catch (e) {
        console.error("Search failed:", e);
        setError("Search failed");
        setShowResults(true);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, orgId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const navigate = (path: string) => {
    setShowResults(false);
    setQuery("");
    router.push(path);
  };

  const pageIcon = (pageName: string) => {
    const name = pageName.toLowerCase();
    if (name.includes("dashboard")) {
      return <LayoutDashboard className="h-4 w-4 text-slate-600" />;
    }
    if (name.includes("candidate")) return <Users className="h-4 w-4 text-slate-600" />;
    if (name.includes("job")) return <Briefcase className="h-4 w-4 text-slate-600" />;
    if (name.includes("upload")) return <Upload className="h-4 w-4 text-slate-600" />;
    if (name.includes("intelligence")) return <Brain className="h-4 w-4 text-slate-600" />;
    if (name.includes("match")) return <ListChecks className="h-4 w-4 text-slate-600" />;
    if (name.includes("setting")) return <Settings className="h-4 w-4 text-slate-600" />;
    return <Search className="h-4 w-4 text-slate-600" />;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      const allResults = [...results.pages, ...results.candidates, ...results.jobs];
      if (allResults.length > 0) {
        const first = allResults[0];
        const path =
          "path" in first
            ? first.path
            : "id" in first && results.candidates.includes(first as (typeof results.candidates)[number])
            ? `/orgs/${orgId}/candidates/${first.id}`
            : `/orgs/${orgId}/jobs/${first.id}/skills`;
        navigate(path);
      }
    }
  };

  const totalResults =
    results.pages.length + results.candidates.length + results.jobs.length;

  return (
    <header className="sticky top-0 z-30 border-b bg-background/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-3 px-4 py-3 md:px-8">
        <CommandPalette
          orgId={orgId}
          open={commandOpen}
          onOpenChange={setCommandOpen}
        />

        <div className="relative flex-1" ref={searchRef}>
          <div className="pointer-events-none absolute inset-y-1 left-0 w-[3px] rounded-full bg-gradient-to-b from-transparent via-slate-400/70 to-transparent" />
          {loading ? (
            <Loader2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : (
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          )}
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query.trim() && setShowResults(true)}
            className="h-11 rounded-2xl border border-slate-300/80 bg-white/80 pl-10 pr-20 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]"
            placeholder="Search candidates, jobs, and pages..."
          />
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-50"
            aria-label="Open command palette"
          >
            Ctrl+K
          </button>

          {showResults && (
            <div className="absolute top-full z-50 mt-2 max-h-[420px] w-full overflow-y-auto inner-scroll rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur">
              {loading && (
                <div className="px-3 py-3 text-sm text-muted-foreground">
                  Searching...
                </div>
              )}

              {!loading && error && (
                <div className="px-3 py-3 text-sm text-red-600">{error}</div>
              )}

              {!loading && !error && totalResults === 0 && (
                <div className="px-3 py-3 text-sm text-muted-foreground">
                  No results found
                </div>
              )}

              {!loading && !error && totalResults > 0 && (
                <>
                  {results.pages.length > 0 ? (
                    <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Pages
                    </div>
                  ) : null}
                  {results.pages.map((page, i) => (
                    <button
                      key={`${page.path}-${i}`}
                      type="button"
                      onClick={() => navigate(page.path)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-accent"
                    >
                      {pageIcon(page.name)}
                      <div>
                        <div className="text-sm font-medium">{page.name}</div>
                        <div className="text-xs text-muted-foreground">Page</div>
                      </div>
                    </button>
                  ))}

                  {results.candidates.length > 0 ? (
                    <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Candidates
                    </div>
                  ) : null}
                  {results.candidates.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => navigate(`/orgs/${orgId}/candidates/${candidate.id}`)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-accent"
                    >
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {candidate.name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {candidate.email}
                        </div>
                      </div>
                    </button>
                  ))}

                  {results.jobs.length > 0 ? (
                    <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Jobs
                    </div>
                  ) : null}
                  {results.jobs.map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() =>
                        navigate(`/orgs/${orgId}/jobs/${job.id}/skills`)
                      }
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-accent"
                    >
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {job.title}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {job.department}
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <NotificationBell orgId={orgId} />

        {clerkEnabled ? (
          <SignedOut>
            <Link
              href="/sign-in"
              className="ml-1 inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)] hover:bg-slate-100"
            >
              Sign in
            </Link>
          </SignedOut>
        ) : (
          <Link
            href="/sign-in"
            className="ml-1 inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)] hover:bg-slate-100"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}


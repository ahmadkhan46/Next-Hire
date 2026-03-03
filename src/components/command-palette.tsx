"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Users,
  Briefcase,
  Loader2,
  LayoutDashboard,
  FileText,
  Settings,
  Upload,
} from "lucide-react";

type SearchResults = {
  candidates: Array<{ id: string; name: string; email: string }>;
  jobs: Array<{ id: string; title: string; department: string }>;
  pages: Array<{ name: string; path: string }>;
};

export function CommandPalette({
  orgId,
  open,
  onOpenChange,
}: {
  orgId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<SearchResults>({
    candidates: [],
    jobs: [],
    pages: [],
  });

  React.useEffect(() => {
    if (!query.trim()) {
      setResults({ candidates: [], jobs: [], pages: [] });
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/orgs/${orgId}/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = (await res.json()) as SearchResults;
          setResults(data);
        }
      } catch (e) {
        console.error("Search failed:", e);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, orgId]);

  const navigate = (path: string) => {
    onOpenChange?.(false);
    setQuery("");
    router.push(path);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || loading) return;

    const allResults = [...results.pages, ...results.candidates, ...results.jobs];
    if (allResults.length === 0) return;

    const first = allResults[0];
    const path =
      "path" in first
        ? first.path
        : results.candidates.some((c) => c.id === first.id)
        ? `/orgs/${orgId}/candidates/${first.id}`
        : `/orgs/${orgId}/jobs/${first.id}/skills`;

    navigate(path);
  };

  const totalResults =
    results.pages.length + results.candidates.length + results.jobs.length;

  const pageIcon = (pageName: string) => {
    const key = pageName.toLowerCase();
    if (key.includes("dashboard")) {
      return <LayoutDashboard className="h-5 w-5 text-muted-foreground" />;
    }
    if (key.includes("upload")) {
      return <Upload className="h-5 w-5 text-muted-foreground" />;
    }
    if (key.includes("setting")) {
      return <Settings className="h-5 w-5 text-muted-foreground" />;
    }
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Command Palette</DialogTitle>
          <DialogDescription>
            Search candidates, jobs, and pages and navigate quickly.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center border-b px-3">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search candidates, jobs, or pages..."
            className="h-12 border-0 focus-visible:ring-0"
            autoFocus
          />
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {!query.trim() ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Type to search candidates, jobs, or pages
            </div>
          ) : totalResults === 0 && !loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No results found
            </div>
          ) : (
            <>
              {results.pages.map((page, i) => (
                <button
                  key={`${page.path}-${i}`}
                  type="button"
                  onClick={() => navigate(page.path)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent"
                >
                  {pageIcon(page.name)}
                  <div>
                    <div className="font-medium">{page.name}</div>
                    <div className="text-xs text-muted-foreground">Page</div>
                  </div>
                </button>
              ))}

              {results.candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => navigate(`/orgs/${orgId}/candidates/${candidate.id}`)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent"
                >
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{candidate.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {candidate.email}
                    </div>
                  </div>
                </button>
              ))}

              {results.jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => navigate(`/orgs/${orgId}/jobs/${job.id}/skills`)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent"
                >
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{job.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {job.department}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Archive,
  CheckSquare,
  Download,
  FileText,
  Loader2,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type Candidate = {
  id: string;
  fullName: string;
  email: string | null;
};

type ZipMode = "all" | "selected";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

export function ExportCandidates({ orgId }: { orgId: string }) {
  const [exporting, setExporting] = useState(false);
  const [showZipModal, setShowZipModal] = useState(false);
  const [zipMode, setZipMode] = useState<ZipMode>("all");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidates;
    const q = searchQuery.toLowerCase();
    return candidates.filter(
      (candidate) =>
        candidate.fullName.toLowerCase().includes(q) ||
        candidate.email?.toLowerCase().includes(q)
    );
  }, [candidates, searchQuery]);

  const loadCandidates = async () => {
    setLoadingCandidates(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates?limit=1000`);
      if (!res.ok) throw new Error("Failed to load candidates");
      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load candidates");
    } finally {
      setLoadingCandidates(false);
    }
  };

  const openZipExport = async () => {
    setShowZipModal(true);
    setZipMode("all");
    setSelected(new Set());
    setSearchQuery("");
    await loadCandidates();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllVisible = () => {
    const visibleIds = filteredCandidates.map((candidate) => candidate.id);
    const allVisibleSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }

    setSelected((prev) => {
      const next = new Set(prev);
      visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/export?format=csv`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `candidates-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("CSV exported successfully");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to export CSV"));
    } finally {
      setExporting(false);
    }
  };

  const downloadZip = async (ids?: string[]) => {
    setExporting(true);
    try {
      toast.info("Preparing resumes for download...");
      const idsParam = ids?.length ? `&ids=${ids.join(",")}` : "";
      const res = await fetch(
        `/api/orgs/${orgId}/candidates/export?format=zip${idsParam}`
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed");
      }

      const blob = await res.blob();
      if (blob.size === 0) throw new Error("No resumes available to export");

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resumes-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("ZIP exported successfully");

      setShowZipModal(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to export ZIP"));
    } finally {
      setExporting(false);
    }
  };

  const handleZipExport = async () => {
    if (zipMode === "selected") {
      if (selected.size === 0) {
        toast.error("Select at least one candidate");
        return;
      }
      await downloadZip(Array.from(selected));
      return;
    }
    await downloadZip();
  };

  const allVisibleSelected =
    filteredCandidates.length > 0 &&
    filteredCandidates.every((candidate) => selected.has(candidate.id));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 rounded-2xl" disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-64 rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.45)]"
        >
          <DropdownMenuItem
            onClick={exportCSV}
            disabled={exporting}
            className="cursor-pointer rounded-xl px-3 py-2.5"
          >
            <FileText className="mr-2 h-4 w-4" />
            Export candidates (CSV)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={openZipExport}
            disabled={exporting}
            className="cursor-pointer rounded-xl px-3 py-2.5"
          >
            <Archive className="mr-2 h-4 w-4" />
            Export resumes (ZIP)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showZipModal} onOpenChange={setShowZipModal}>
        <DialogContent className="w-[min(980px,96vw)] max-w-none rounded-3xl p-0">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="text-2xl">Export Resumes as ZIP</DialogTitle>
            <DialogDescription className="text-sm">
              Choose whether to export all candidates or only selected candidates.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 p-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setZipMode("all")}
                className={`rounded-2xl border p-4 text-left transition ${
                  zipMode === "all"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2 text-base font-semibold">
                  <Archive className="h-4 w-4" />
                  Export all resumes
                </div>
                <p
                  className={`mt-1 text-sm ${
                    zipMode === "all" ? "text-slate-200" : "text-muted-foreground"
                  }`}
                >
                  Include every candidate resume currently available.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setZipMode("selected")}
                className={`rounded-2xl border p-4 text-left transition ${
                  zipMode === "selected"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2 text-base font-semibold">
                  <CheckSquare className="h-4 w-4" />
                  Export selected resumes
                </div>
                <p
                  className={`mt-1 text-sm ${
                    zipMode === "selected" ? "text-slate-200" : "text-muted-foreground"
                  }`}
                >
                  Pick specific candidates before exporting.
                </p>
              </button>
            </div>

            {zipMode === "selected" ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search candidates by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-11 rounded-xl bg-white pl-9"
                  />
                </div>

                <div className="mt-3 flex flex-col gap-2 rounded-xl border bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAllVisible} />
                    <span className="text-sm font-medium">
                      {selected.size} of {candidates.length} selected
                    </span>
                  </div>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>

                {loadingCandidates ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto inner-scroll pr-1">
                    {filteredCandidates.map((candidate) => (
                      <div
                        key={candidate.id}
                        role="button"
                        tabIndex={0}
                        className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                          selected.has(candidate.id)
                            ? "border-slate-900 bg-slate-900/5"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                        onClick={() => toggleSelect(candidate.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleSelect(candidate.id);
                          }
                        }}
                      >
                        <div
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={selected.has(candidate.id)}
                            onCheckedChange={() => toggleSelect(candidate.id)}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-base font-medium">
                            {candidate.fullName}
                          </div>
                          <div className="truncate text-sm text-muted-foreground">
                            {candidate.email || "No email"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-muted-foreground">
                All resumes will be included in one ZIP download.
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="outline" onClick={() => setShowZipModal(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleZipExport}
              disabled={exporting || (zipMode === "selected" && selected.size === 0)}
              className="min-w-[190px] rounded-xl"
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : zipMode === "selected" ? (
                `Export ${selected.size} Resume${selected.size === 1 ? "" : "s"}`
              ) : (
                "Export All Resumes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


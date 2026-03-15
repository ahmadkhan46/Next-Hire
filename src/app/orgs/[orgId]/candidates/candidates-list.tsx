"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Trash2, CheckSquare, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Candidate = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
};

export function CandidatesList({
  orgId,
  candidates,
  emptyMessage,
}: {
  orgId: string;
  candidates: Candidate[];
  emptyMessage: string;
}) {
  const router = useRouter();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelected(new Set());
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === candidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map((c) => c.id)));
    }
  }

  async function handleBulkDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success(`Deleted ${data.deleted} candidate(s)`);
      setConfirmOpen(false);
      setSelectMode(false);
      setSelected(new Set());
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  const allSelected = candidates.length > 0 && selected.size === candidates.length;

  if (candidates.length === 0) {
    return (
      <div className="premium-subblock rounded-2xl border border-dashed bg-background/40 p-6 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      {/* Select mode toolbar */}
      <div className="mb-3 flex items-center gap-2">
        <Button
          size="sm"
          variant={selectMode ? "secondary" : "outline"}
          className="rounded-2xl"
          onClick={toggleSelectMode}
        >
          {selectMode ? (
            <>
              <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
            </>
          ) : (
            <>
              <CheckSquare className="mr-1.5 h-3.5 w-3.5" /> Select
            </>
          )}
        </Button>

        {selectMode && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-2xl text-xs"
              onClick={toggleAll}
            >
              {allSelected ? "Deselect all" : "Select all"}
            </Button>
            {selected.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                className="rounded-2xl"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete {selected.size} selected
              </Button>
            )}
          </>
        )}
      </div>

      <div className="space-y-3">
        {candidates.map((c) => (
          <div
            key={c.id}
            className={`premium-subblock group rounded-2xl border bg-background/40 p-4 transition ${
              selectMode && selected.has(c.id)
                ? "border-destructive/40 bg-destructive/5"
                : "hover:bg-accent/40"
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              {selectMode && (
                <button
                  onClick={() => toggleOne(c.id)}
                  className="shrink-0 self-center text-muted-foreground hover:text-foreground"
                  aria-label={selected.has(c.id) ? "Deselect" : "Select"}
                >
                  {selected.has(c.id) ? (
                    <CheckSquare className="h-5 w-5 text-destructive" />
                  ) : (
                    <Square className="h-5 w-5" />
                  )}
                </button>
              )}
              <div
                className="flex-1 cursor-pointer"
                onClick={() => selectMode && toggleOne(c.id)}
              >
                <div className="text-base font-semibold">{c.fullName}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {c.email ?? "--"} {c.phone ? `- ${c.phone}` : ""}
                </div>
              </div>

              {!selectMode && (
                <Link
                  href={`/orgs/${orgId}/candidates/${c.id}`}
                  className="inline-flex w-full items-center justify-center gap-1 rounded-full border bg-background/40 px-3 py-1 text-sm transition hover:bg-accent/60 sm:w-auto"
                >
                  View <ArrowUpRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bulk delete confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {selected.size} candidate{selected.size !== 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              All their data (resumes, matches, notes) will be permanently deleted. This cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-2xl"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleting ? "Deleting…" : `Yes, delete ${selected.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

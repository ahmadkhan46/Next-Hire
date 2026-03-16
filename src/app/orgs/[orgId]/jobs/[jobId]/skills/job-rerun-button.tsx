"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function JobRerunButton({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/match`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to re-run matching");
      toast.success("Matching re-run complete");
    } catch (e: any) {
      toast.error(e?.message ?? "Re-run failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border bg-card/60 px-4 py-2 text-sm transition hover:bg-accent/60 sm:w-auto"
      onClick={onClick}
      disabled={loading}
    >
      <Sparkles className={loading ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
      {loading ? "Running..." : "Re-run matching"}
    </Button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function RefreshMatches({
  orgId,
  candidateId,
}: {
  orgId: string;
  candidateId: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/auto-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Auto-match failed");
      toast.success("Matches refreshed");
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Auto-match failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" className="rounded-2xl" onClick={onClick} disabled={loading}>
      <RefreshCw className="mr-2 h-4 w-4" />
      {loading ? "Refreshing..." : "Refresh matches"}
    </Button>
  );
}

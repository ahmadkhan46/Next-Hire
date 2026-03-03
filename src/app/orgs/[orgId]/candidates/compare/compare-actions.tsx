"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";

export function CompareActions() {
  const [copying, setCopying] = useState(false);

  async function copyLink() {
    if (copying) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Comparison link copied");
    } catch {
      toast.error("Unable to copy link");
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={copyLink}
        disabled={copying}
        className="rounded-2xl"
      >
        <Copy className="h-4 w-4" />
        {copying ? "Copying..." : "Copy link"}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => window.print()}
        className="rounded-2xl"
      >
        <Download className="h-4 w-4" />
        Export PDF
      </Button>
    </div>
  );
}

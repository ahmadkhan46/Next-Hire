"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Save } from "lucide-react";

export function OrgSettingsClient({
  orgId,
  resumeParseTimeoutSeconds,
}: {
  orgId: string;
  resumeParseTimeoutSeconds: number;
}) {
  const [timeout, setTimeout] = useState(String(resumeParseTimeoutSeconds));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const val = parseInt(timeout, 10);
    if (!Number.isFinite(val) || val < 10 || val > 120) {
      toast.error("Timeout must be between 10 and 120 seconds");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeParseTimeoutSeconds: val }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success("Settings saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="premium-block rounded-3xl border bg-card/50 p-6 shadow-sm space-y-6">
      <div>
        <h2 className="text-lg font-semibold">AI Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure AI parsing behaviour for this organisation.
        </p>
      </div>

      <Separator />

      <div className="max-w-sm space-y-3">
        <div>
          <label className="text-sm font-medium" htmlFor="llm-timeout">
            Resume parse timeout (seconds)
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Maximum time allowed per AI resume parse. Default: 30 s. Increase if you
            frequently see &quot;LLM timeout&quot; errors. Range: 10 – 120 s.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            id="llm-timeout"
            type="number"
            min={10}
            max={120}
            value={timeout}
            onChange={(e) => setTimeout(e.target.value)}
            className="w-32 rounded-2xl"
          />
          <Button
            onClick={save}
            disabled={saving}
            size="sm"
            className="rounded-2xl"
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

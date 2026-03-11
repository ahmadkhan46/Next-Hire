"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Plus, Trash2, Save, Sparkles, AlertTriangle } from "lucide-react";

type SkillRow = {
  id?: string;
  name: string;
  weight: number; // 1..5
};

type SkillSuggestion = {
  name: string;
  category: string;
  source: "org" | "taxonomy";
};

type GeneratePreview = {
  wouldChange: boolean;
  reason?: string;
  existingCount: number;
  generatedCount: number;
  newSkills: Array<{ name: string; weight: number }>;
  weightUpdates: Array<{ name: string; from: number; to: number }>;
  unchangedCount: number;
};

type PreviewWeightUpdate = GeneratePreview["weightUpdates"][number];

function clampWeight(n: unknown) {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 1;
  return Math.max(1, Math.min(5, Math.round(x)));
}

function cleanName(s: unknown) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

function isCritical(w: number) {
  return w >= 4;
}

function isRiskyNewWeight(weight: number) {
  return weight >= 4;
}

function weightUpdateRisk(change: PreviewWeightUpdate) {
  if (change.to >= 4 && change.from < 4) return 3;
  if (change.to >= 4) return 2;
  if (change.to > change.from) return 1;
  return 0;
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${url}`);
  return res.json();
}

export function JobSkillsEditor({
  orgId,
  jobId,
  initialSkills,
}: {
  orgId: string;
  jobId: string;
  initialSkills: SkillRow[];
}) {
  const router = useRouter();

  const [rows, setRows] = React.useState<SkillRow[]>(
    (initialSkills ?? []).map((s) => ({
      id: s.id,
      name: cleanName(s.name),
      weight: clampWeight(s.weight),
    }))
  );

  const [newName, setNewName] = React.useState("");
  const [newWeight, setNewWeight] = React.useState(3);
  const [suggestions, setSuggestions] = React.useState<SkillSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = React.useState(false);

  const [saving, setSaving] = React.useState(false);
  const [rerunning, setRerunning] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [preparingPreview, setPreparingPreview] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<GeneratePreview | null>(null);
  const [diffMode, setDiffMode] = React.useState(true);

  // Keep an original snapshot to detect dirty state.
  const original = React.useMemo(() => {
    const norm = (initialSkills ?? [])
      .map((s) => ({ name: cleanName(s.name).toLowerCase(), weight: clampWeight(s.weight) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return JSON.stringify(norm);
  }, [initialSkills]);

  const current = React.useMemo(() => {
    const norm = rows
      .map((s) => ({ name: cleanName(s.name).toLowerCase(), weight: clampWeight(s.weight) }))
      .filter((s) => s.name.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    return JSON.stringify(norm);
  }, [rows]);

  const dirty = current !== original;

  const stats = React.useMemo(() => {
    const total = rows.length;
    const critical = rows.filter((r) => isCritical(r.weight)).length;
    return { total, critical };
  }, [rows]);

  const previewNewSkills = React.useMemo(() => {
    if (!preview) return [];
    const list = [...preview.newSkills];
    if (!diffMode) return list;

    list.sort((a, b) => {
      const riskDelta =
        Number(isRiskyNewWeight(b.weight)) - Number(isRiskyNewWeight(a.weight));
      if (riskDelta !== 0) return riskDelta;
      if (b.weight !== a.weight) return b.weight - a.weight;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [preview, diffMode]);

  const previewWeightUpdates = React.useMemo(() => {
    if (!preview) return [];
    const list = [...preview.weightUpdates];
    if (!diffMode) return list;

    list.sort((a, b) => {
      const riskDelta = weightUpdateRisk(b) - weightUpdateRisk(a);
      if (riskDelta !== 0) return riskDelta;
      const magnitudeDelta = Math.abs(b.to - b.from) - Math.abs(a.to - a.from);
      if (magnitudeDelta !== 0) return magnitudeDelta;
      if (b.to !== a.to) return b.to - a.to;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [preview, diffMode]);

  function addSkillInline(name: string, weight: number) {
    const n = cleanName(name);
    if (!n) return;

    const key = n.toLowerCase();
    setRows((prev) => {
      const idx = prev.findIndex((p) => p.name.toLowerCase() === key);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], weight: Math.max(copy[idx].weight, clampWeight(weight)) };
        return copy;
      }
      return [{ name: n, weight: clampWeight(weight) }, ...prev];
    });
    setSuggestions([]);
  }

  function removeAt(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateName(i: number, name: string) {
    const n = cleanName(name);
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, name: n } : r)));
  }

  function updateWeight(i: number, weight: number) {
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, weight: clampWeight(weight) } : r))
    );
  }

  async function refreshFromServer(opts?: { silent?: boolean }) {
    setRefreshing(true);
    try {
      const data = await getJSON<any>(`/api/jobs/${jobId}/skills`).catch(() => ({ skills: [] }));
      const serverRows: SkillRow[] = (data?.skills ?? []).map((s: any) => ({
        id: s.id,
        name: cleanName(s.name),
        weight: clampWeight(s.weight),
      }));
      setRows(serverRows);
      if (!opts?.silent) {
        toast.success("Skills refreshed");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  }

  function normalizeForSave(input: SkillRow[]) {
    const map = new Map<string, SkillRow>();
    for (const r of input) {
      const name = cleanName(r.name);
      if (!name) continue;
      const key = name.toLowerCase();
      const w = clampWeight(r.weight);
      const prev = map.get(key);
      if (!prev || w > prev.weight) map.set(key, { name, weight: w });
    }
    return Array.from(map.values());
  }

  async function saveSkills() {
    const payload = normalizeForSave(rows);

    if (payload.length === 0) {
      toast.error("Add at least one skill before saving");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/skills`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: payload }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save skills");

      const updated: SkillRow[] = (data?.skills ?? []).map((s: any) => ({
        id: s.id,
        name: cleanName(s.name),
        weight: clampWeight(s.weight),
      }));

      setRows(updated);
      toast.success("Skills saved");
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function rerunMatching() {
    setRerunning(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/match`, { method: "POST", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to re-run matching");
      toast.success("Matchboard updated");
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Re-run failed");
    } finally {
      setRerunning(false);
    }
  }

  async function applyGeneratedSkills() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/skills/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyWhenEmpty: false, maxSkills: 15 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to generate skills");

      await refreshFromServer({ silent: true });

      const generated = Number(data?.generated ?? 0);
      if (generated > 0) {
        toast.success(`Generated ${generated} skill${generated === 1 ? "" : "s"} from description`);
      } else {
        toast.message("No matching skills detected in description");
      }
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Generate failed");
    } finally {
      setGenerating(false);
      setPreviewOpen(false);
      setPreview(null);
    }
  }

  async function openGeneratePreview() {
    setPreparingPreview(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/skills/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyWhenEmpty: false, maxSkills: 15, preview: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to prepare generation preview");

      const nextPreview = data?.preview as GeneratePreview | undefined;
      if (!nextPreview) throw new Error("Invalid generation preview response");
      setPreview(nextPreview);
      setPreviewOpen(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not prepare preview");
    } finally {
      setPreparingPreview(false);
    }
  }

  React.useEffect(() => {
    const q = newName.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(
          `/api/orgs/${orgId}/skills/suggestions?query=${encodeURIComponent(q)}&limit=8`,
          { signal: controller.signal }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Failed to load suggestions");
        setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLoadingSuggestions(false);
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [newName, orgId]);

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Card className="premium-block lg:col-span-8 rounded-3xl border bg-card/50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Required skills</div>
            <div className="mt-1 text-lg font-semibold">
              {stats.total} skills{" "}
              {stats.critical > 0 ? (
                <span className="ml-2 align-middle">
                  <Badge variant="destructive" className="rounded-full">
                    {stats.critical} critical
                  </Badge>
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Weights are 1-5. Critical = 4-5.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={openGeneratePreview}
              disabled={preparingPreview || generating || saving || refreshing || rerunning}
              title="Generate skills from job description"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {preparingPreview ? "Preparing..." : generating ? "Generating..." : "Generate from description"}
            </Button>

            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() => {
                void refreshFromServer();
              }}
              disabled={refreshing || generating || saving || rerunning}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>

            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={rerunMatching}
              disabled={rerunning}
              title="Compute + persist matches"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {rerunning ? "Re-running..." : "Re-run matching"}
            </Button>

            <Button
              className="rounded-2xl"
              onClick={saveSkills}
              disabled={!dirty || saving}
              title={!dirty ? "No changes to save" : "Save changes"}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <Separator className="my-5" />

        <div className="grid gap-2 md:grid-cols-12">
          <div className="md:col-span-8">
            <div className="relative">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Add a skill (e.g., React, Prisma, PostgreSQL)"
                className="h-10 rounded-2xl"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkillInline(newName, newWeight);
                    setNewName("");
                  }
                }}
              />
              {loadingSuggestions ? (
                <div className="mt-1 text-xs text-muted-foreground">Loading suggestions...</div>
              ) : null}
              {suggestions.length > 0 ? (
                <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border bg-background p-1 shadow-sm">
                  {suggestions.map((item) => (
                    <button
                      key={`${item.name}-${item.source}`}
                      type="button"
                      onClick={() => {
                        addSkillInline(item.name, newWeight);
                        setNewName("");
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent"
                    >
                      <span>{item.name}</span>
                      <span className="text-[11px] text-muted-foreground">{item.category}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="md:col-span-3">
            <select
              value={newWeight}
              onChange={(e) => setNewWeight(clampWeight(Number(e.target.value)))}
              className="h-10 w-full appearance-none rounded-2xl border bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={1}>Weight 1</option>
              <option value={2}>Weight 2</option>
              <option value={3}>Weight 3</option>
              <option value={4}>Weight 4 (critical)</option>
              <option value={5}>Weight 5 (critical)</option>
            </select>
          </div>

          <div className="md:col-span-1">
            <Button
              variant="outline"
              className="h-10 w-full rounded-2xl"
              onClick={() => {
                addSkillInline(newName, newWeight);
                setNewName("");
              }}
              disabled={!cleanName(newName)}
              title="Add"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator className="my-5" />

        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No skills yet. Add some above and hit <span className="font-medium text-foreground">Save</span>.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r, i) => {
              const critical = isCritical(r.weight);

              return (
                <div
                  key={`${r.name}-${i}`}
                  className="premium-subblock flex flex-col gap-2 rounded-2xl border bg-background/40 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Input
                        value={r.name}
                        onChange={(e) => updateName(i, e.target.value)}
                        className="h-10 rounded-2xl"
                        placeholder="Skill name"
                      />
                      {critical ? (
                        <Badge variant="destructive" className="rounded-full">
                          <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                          Critical
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="rounded-full">
                          Standard
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Weight influences match score weighting.
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:pl-4">
                    <select
                      value={r.weight}
                      onChange={(e) => updateWeight(i, Number(e.target.value))}
                      className="h-10 w-[160px] appearance-none rounded-2xl border bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      title="Weight"
                    >
                      <option value={1}>Weight 1</option>
                      <option value={2}>Weight 2</option>
                      <option value={3}>Weight 3</option>
                      <option value={4}>Weight 4 (critical)</option>
                      <option value={5}>Weight 5 (critical)</option>
                    </select>

                    <Button
                      variant="outline"
                      className="h-10 rounded-2xl"
                      onClick={() => removeAt(i)}
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 text-xs text-muted-foreground">
          Tip: Add skills first, <span className="font-medium text-foreground">Save</span>, then{" "}
          <span className="font-medium text-foreground">Re-run matching</span> to refresh the Matchboard.
        </div>
      </Card>

      <Card className="premium-block lg:col-span-4 rounded-3xl border bg-card/50 p-6 shadow-sm">
        <div className="text-sm text-muted-foreground">Guidance</div>
        <div className="mt-2 text-lg font-semibold">How scoring works</div>

        <Separator className="my-4" />

        <div className="space-y-3 text-sm text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">Score</span> = matched weight / total weight.
          </div>
          <div>
            <span className="font-medium text-foreground">Critical skills</span> (weight 4-5) show up as critical gaps if missing.
          </div>
          <div>
            Keep the set lean: focus on must-haves, not nice-to-haves.
          </div>
        </div>

        <Separator className="my-4" />

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Changes</span>
            {dirty ? (
              <Badge className="rounded-full" variant="secondary">
                Unsaved
              </Badge>
            ) : (
              <Badge className="rounded-full" variant="outline">
                Saved
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Critical skills</span>
            <span className="font-medium text-foreground">{stats.critical}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total skills</span>
            <span className="font-medium text-foreground">{stats.total}</span>
          </div>
        </div>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-xl rounded-3xl">
          <DialogHeader>
            <DialogTitle>Generate Skills From Description</DialogTitle>
            <DialogDescription>
              Review changes before applying generated skills.
            </DialogDescription>
          </DialogHeader>

          {preview ? (
            <div className="space-y-4">
              {preview.reason ? (
                <div className="rounded-2xl border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {preview.reason}
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border bg-muted/30 p-3 text-sm">
                  <div className="text-muted-foreground">New skills</div>
                  <div className="text-lg font-semibold">{preview.newSkills.length}</div>
                </div>
                <div className="rounded-2xl border bg-muted/30 p-3 text-sm">
                  <div className="text-muted-foreground">Weight updates</div>
                  <div className="text-lg font-semibold">{preview.weightUpdates.length}</div>
                </div>
                <div className="rounded-2xl border bg-muted/30 p-3 text-sm">
                  <div className="text-muted-foreground">Unchanged</div>
                  <div className="text-lg font-semibold">{preview.unchangedCount}</div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border bg-muted/20 px-3 py-2">
                <div className="text-xs text-muted-foreground">
                  Diff mode: critical changes (W4/W5) are highlighted and sorted first.
                </div>
                <Button
                  type="button"
                  variant={diffMode ? "default" : "outline"}
                  className="h-8 rounded-xl px-3 text-xs"
                  onClick={() => setDiffMode((v) => !v)}
                >
                  {diffMode ? "Diff mode: On" : "Diff mode: Off"}
                </Button>
              </div>

              {previewNewSkills.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">New skills to add</div>
                  <div className="rounded-2xl border bg-muted/20 p-3 text-sm">
                    <div className="mb-2 grid grid-cols-[1fr_auto] gap-2 border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <span>Skills</span>
                      <span>Weight</span>
                    </div>
                    <div className="max-h-56 overflow-y-auto pr-1">
                      {previewNewSkills.map((s) => {
                        const risky = diffMode && isRiskyNewWeight(s.weight);
                        return (
                        <div
                          key={s.name}
                          className={`grid grid-cols-[1fr_auto] items-center gap-2 rounded-md px-1 py-1 ${
                            risky ? "bg-red-50 text-red-700" : ""
                          }`}
                        >
                          <span>{s.name}</span>
                          <span className={risky ? "text-red-700" : "text-muted-foreground"}>
                            W{s.weight}
                          </span>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              {previewWeightUpdates.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Weight changes</div>
                  <div className="rounded-2xl border bg-muted/20 p-3 text-sm">
                    <div className="mb-2 grid grid-cols-[1fr_auto] gap-2 border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <span>Skills</span>
                      <span>Weight</span>
                    </div>
                    <div className="max-h-56 overflow-y-auto pr-1">
                      {previewWeightUpdates.map((s) => {
                        const risky = diffMode && s.to >= 4;
                        return (
                        <div
                          key={s.name}
                          className={`grid grid-cols-[1fr_auto] items-center gap-2 rounded-md px-1 py-1 ${
                            risky ? "bg-red-50 text-red-700" : ""
                          }`}
                        >
                          <span>{s.name}</span>
                          <span className={risky ? "text-red-700" : "text-muted-foreground"}>
                            W{s.from} -&gt; W{s.to}
                          </span>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              {!preview.wouldChange ? (
                <div className="rounded-2xl border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  No changes will be applied.
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => setPreviewOpen(false)}
              disabled={generating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-2xl"
              onClick={applyGeneratedSkills}
              disabled={generating || !preview || !preview.wouldChange}
            >
              {generating ? "Generating..." : "Proceed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

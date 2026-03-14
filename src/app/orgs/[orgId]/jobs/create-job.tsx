"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CreateJob({ orgId }: { orgId: string }) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [workMode, setWorkMode] = useState<"REMOTE" | "ONSITE" | "HYBRID" | "OTHER" | "">("");
  const [workModeOther, setWorkModeOther] = useState("");
  const [skills, setSkills] = useState<Array<{ name: string; weight: number }>>([]);
  const [skillInput, setSkillInput] = useState("");
  const [skillWeight, setSkillWeight] = useState(3);
  const [suggestions, setSuggestions] = useState<
    Array<{ name: string; category: string; source: "org" | "taxonomy" }>
  >([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<
    Array<{ label: string; value: string; type: "city" | "country" }>
  >([]);
  const [loadingLocationSuggestions, setLoadingLocationSuggestions] = useState(false);
  const [locationFocused, setLocationFocused] = useState(false);

  function normalizeSkillName(value: string) {
    return value.trim().replace(/\s+/g, " ");
  }

  function clampWeight(value: number) {
    if (!Number.isFinite(value)) return 3;
    return Math.max(1, Math.min(5, Math.round(value)));
  }

  function addSkill(name: string, weight: number) {
    const normalized = normalizeSkillName(name);
    if (!normalized) return;

    setSkills((prev) => {
      const key = normalized.toLowerCase();
      const idx = prev.findIndex((s) => s.name.toLowerCase() === key);
      const nextWeight = clampWeight(weight);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], weight: Math.max(next[idx].weight, nextWeight) };
        return next;
      }
      return [...prev, { name: normalized, weight: nextWeight }];
    });
  }

  function removeSkill(name: string) {
    const key = name.toLowerCase();
    setSkills((prev) => prev.filter((s) => s.name.toLowerCase() !== key));
  }

  function addSkillFromInput() {
    addSkill(skillInput, skillWeight);
    setSkillInput("");
    setSuggestions([]);
  }

  async function onSubmit() {
    const t = title.trim();
    const d = description.trim();
    const l = location.trim();

    if (!t) {
      toast.error("Title is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          description: d || null,
          location: l || null,
          workMode: workMode || null,
          workModeOther: workMode === "OTHER" ? workModeOther.trim() || null : null,
          skills,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create job");
      }

      toast.success("Job created");

      // reset UI
      setOpen(false);
      setTitle("");
      setDescription("");
      setLocation("");
      setWorkMode("");
      setWorkModeOther("");
      setSkills([]);
      setSkillInput("");
      setSkillWeight(3);
      setSuggestions([]);
      setLocationSuggestions([]);

      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function onCancel() {
    setOpen(false);
  }

  // Debounced suggestions
  // Kept lightweight because this runs inside a dialog and we only fetch while typing.
  useEffect(() => {
    const q = skillInput.trim();
    if (!open || q.length < 2) {
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
  }, [open, orgId, skillInput]);

  useEffect(() => {
    const q = location.trim();
    if (!open || !locationFocused || q.length < 2) {
      setLocationSuggestions([]);
      setLoadingLocationSuggestions(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoadingLocationSuggestions(true);
      try {
        const res = await fetch(
          `/api/locations/suggestions?query=${encodeURIComponent(q)}&limit=8`,
          { signal: controller.signal }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Failed to load location suggestions");
        setLocationSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
      } catch {
        if (!controller.signal.aborted) setLocationSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLoadingLocationSuggestions(false);
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, location, locationFocused]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-2xl">
          <Plus className="mr-2 h-4 w-4" />
          Create Job
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[560px] rounded-3xl">
        <DialogHeader>
          <DialogTitle>Create job</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <div className="text-sm text-muted-foreground">Title</div>
            <Input
              className="mt-2 rounded-2xl"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Frontend Engineer"
            />
          </div>

          <div>
            <div className="text-sm text-muted-foreground">
              Description (optional)
            </div>
            <Textarea
              className="mt-2 min-h-[120px] rounded-2xl"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Next.js + TS + Tailwind..."
            />
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Location (optional)</div>
            <div className="relative mt-2">
              <Input
                className="rounded-2xl"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onFocus={() => setLocationFocused(true)}
                onBlur={() => setTimeout(() => setLocationFocused(false), 120)}
                placeholder="Ireland / Remote"
              />
              {loadingLocationSuggestions ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  Loading location suggestions...
                </div>
              ) : null}
              {locationSuggestions.length > 0 ? (
                <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto inner-scroll rounded-xl border bg-background p-1 shadow-sm">
                  {locationSuggestions.map((item) => (
                    <button
                      key={`${item.type}-${item.value}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setLocation(item.value);
                        setLocationSuggestions([]);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent"
                    >
                      <span>{item.label}</span>
                      <span className="text-[11px] text-muted-foreground capitalize">{item.type}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Work mode</div>
            <select
              className="mt-2 h-10 w-full rounded-2xl border bg-background px-3 text-sm"
              value={workMode}
              onChange={(e) =>
                setWorkMode(
                  e.target.value === "REMOTE" ||
                    e.target.value === "ONSITE" ||
                    e.target.value === "HYBRID" ||
                    e.target.value === "OTHER"
                    ? e.target.value
                    : ""
                )
              }
            >
              <option value="">Not specified</option>
              <option value="REMOTE">Remote</option>
              <option value="ONSITE">Onsite</option>
              <option value="HYBRID">Hybrid</option>
              <option value="OTHER">Other</option>
            </select>
            {workMode === "OTHER" ? (
              <Input
                className="mt-2 rounded-2xl"
                value={workModeOther}
                onChange={(e) => setWorkModeOther(e.target.value)}
                placeholder="Enter custom work mode"
              />
            ) : null}
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Skills (optional)</div>
            <div className="mt-2 grid gap-2 md:grid-cols-[1fr_140px_auto]">
              <div className="relative">
                <Input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  placeholder="Type a skill (e.g., React, PostgreSQL)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkillFromInput();
                    }
                  }}
                />
                {loadingSuggestions ? (
                  <div className="mt-1 text-xs text-muted-foreground">Loading suggestions...</div>
                ) : null}
                {suggestions.length > 0 ? (
                  <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto inner-scroll rounded-xl border bg-background p-1 shadow-sm">
                    {suggestions.map((item) => (
                      <button
                        key={`${item.name}-${item.source}`}
                        type="button"
                        onClick={() => {
                          addSkill(item.name, skillWeight);
                          setSkillInput("");
                          setSuggestions([]);
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
              <select
                value={skillWeight}
                onChange={(e) => setSkillWeight(clampWeight(Number(e.target.value)))}
                className="h-10 rounded-2xl border bg-background px-3 text-sm"
              >
                <option value={1}>Weight 1</option>
                <option value={2}>Weight 2</option>
                <option value={3}>Weight 3</option>
                <option value={4}>Weight 4</option>
                <option value={5}>Weight 5</option>
              </select>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={addSkillFromInput}
                disabled={!normalizeSkillName(skillInput)}
              >
                Add
              </Button>
            </div>
            {skills.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <Badge key={skill.name} variant="outline" className="gap-1 rounded-full">
                    {skill.name} (w{skill.weight})
                    <button
                      type="button"
                      onClick={() => removeSkill(skill.name)}
                      className="rounded-full p-0.5 hover:bg-accent"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-xs text-muted-foreground">
                Optional. You can also add skills later from the Skills page.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              className="rounded-2xl"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>

            <Button
              className="rounded-2xl"
              onClick={onSubmit}
              disabled={loading}
            >
              {loading ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


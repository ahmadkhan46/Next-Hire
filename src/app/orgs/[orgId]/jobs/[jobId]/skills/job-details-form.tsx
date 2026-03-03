"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type JobDetailsShape = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  status: "OPEN" | "CLOSED";
  workMode: "REMOTE" | "ONSITE" | "HYBRID" | "OTHER" | null;
  workModeOther: string | null;
};

export function JobDetailsForm({
  orgId,
  job,
}: {
  orgId: string;
  job: JobDetailsShape;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState(job.title ?? "");
  const [description, setDescription] = useState(job.description ?? "");
  const [location, setLocation] = useState(job.location ?? "");
  const [status, setStatus] = useState<"OPEN" | "CLOSED">(job.status ?? "OPEN");
  const [workMode, setWorkMode] = useState<"REMOTE" | "ONSITE" | "HYBRID" | "OTHER" | "">(job.workMode ?? "");
  const [workModeOther, setWorkModeOther] = useState(job.workModeOther ?? "");
  const [locationSuggestions, setLocationSuggestions] = useState<
    Array<{ label: string; value: string; type: "city" | "country" }>
  >([]);
  const [loadingLocationSuggestions, setLoadingLocationSuggestions] = useState(false);
  const [locationFocused, setLocationFocused] = useState(false);

  const originalSnapshot = JSON.stringify({
    title: (job.title ?? "").trim(),
    description: (job.description ?? "").trim(),
    location: (job.location ?? "").trim(),
    status: job.status ?? "OPEN",
    workMode: job.workMode ?? "",
    workModeOther: (job.workModeOther ?? "").trim(),
  });

  const currentSnapshot = JSON.stringify({
    title: title.trim(),
    description: description.trim(),
    location: location.trim(),
    status,
    workMode: workMode || "",
    workModeOther: workMode === "OTHER" ? workModeOther.trim() : "",
  });

  const dirty = currentSnapshot !== originalSnapshot;

  async function onSave() {
    const t = title.trim();
    if (!t) {
      toast.error("Title is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          description: description.trim() || null,
          location: location.trim() || null,
          status,
          workMode: workMode || null,
          workModeOther: workMode === "OTHER" ? workModeOther.trim() || null : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to update job");

      toast.success("Job details updated");
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const q = location.trim();
    if (!locationFocused || q.length < 2) {
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
  }, [location, locationFocused]);

  return (
    <Card className="premium-block rounded-3xl border bg-card/50 p-6 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <div className="text-sm text-muted-foreground">Title</div>
          <Input
            className="mt-2 rounded-2xl"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Frontend Engineer"
          />
        </div>

        <div className="md:col-span-2">
          <div className="text-sm text-muted-foreground">Description (optional)</div>
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
              <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border bg-background p-1 shadow-sm">
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
          <div className="text-sm text-muted-foreground">Status</div>
          <select
            className="mt-2 h-10 w-full rounded-2xl border bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value === "CLOSED" ? "CLOSED" : "OPEN")}
          >
            <option value="OPEN">OPEN</option>
            <option value="CLOSED">CLOSED</option>
          </select>
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
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          className="rounded-2xl"
          onClick={onSave}
          disabled={loading || !dirty}
          title={!dirty ? "No changes to save" : "Save changes"}
        >
          {loading ? "Saving..." : "Save job details"}
        </Button>
      </div>
    </Card>
  );
}

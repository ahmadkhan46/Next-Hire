"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, X } from "lucide-react";

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
  requiredYearsOfExperience: number | null;
};

const WORK_MODE_LABELS: Record<string, string> = {
  REMOTE: "Remote",
  ONSITE: "Onsite",
  HYBRID: "Hybrid",
  OTHER: "Other",
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
  const [editing, setEditing] = useState(false);

  const [title, setTitle] = useState(job.title ?? "");
  const [description, setDescription] = useState(job.description ?? "");
  const [location, setLocation] = useState(job.location ?? "");
  const [status, setStatus] = useState<"OPEN" | "CLOSED">(job.status ?? "OPEN");
  const [workMode, setWorkMode] = useState<"REMOTE" | "ONSITE" | "HYBRID" | "OTHER" | "">(job.workMode ?? "");
  const [workModeOther, setWorkModeOther] = useState(job.workModeOther ?? "");
  const [requiredYears, setRequiredYears] = useState(
    job.requiredYearsOfExperience != null ? String(job.requiredYearsOfExperience) : "0"
  );
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
    requiredYears: job.requiredYearsOfExperience != null ? String(job.requiredYearsOfExperience) : "0",
  });

  const currentSnapshot = JSON.stringify({
    title: title.trim(),
    description: description.trim(),
    location: location.trim(),
    status,
    workMode: workMode || "",
    workModeOther: workMode === "OTHER" ? workModeOther.trim() : "",
    requiredYears: requiredYears.trim(),
  });

  const dirty = currentSnapshot !== originalSnapshot;

  function handleCancel() {
    setTitle(job.title ?? "");
    setDescription(job.description ?? "");
    setLocation(job.location ?? "");
    setStatus(job.status ?? "OPEN");
    setWorkMode(job.workMode ?? "");
    setWorkModeOther(job.workModeOther ?? "");
    setRequiredYears(job.requiredYearsOfExperience != null ? String(job.requiredYearsOfExperience) : "0");
    setLocationSuggestions([]);
    setEditing(false);
  }

  async function onSave() {
    const t = title.trim();
    if (!t) {
      toast.error("Title is required");
      return;
    }

    const yearsNum = Number(requiredYears.trim());
    if (!requiredYears.trim() || !Number.isFinite(yearsNum) || yearsNum < 0) {
      toast.error("Min. years of experience is required (use 0 if none)");
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
          requiredYearsOfExperience: yearsNum,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to update job");

      setEditing(false);
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

  const readOnlyClass =
    "mt-2 min-h-[40px] cursor-default rounded-2xl border bg-background/40 px-3 py-2.5 text-sm text-foreground leading-relaxed select-none";
  const mutedReadOnlyClass =
    "mt-2 min-h-[40px] cursor-default rounded-2xl border bg-background/40 px-3 py-2.5 text-sm text-muted-foreground italic leading-relaxed select-none";

  return (
    <Card className="premium-block rounded-3xl border bg-card/50 p-6 shadow-sm">
      {/* Edit / Cancel header button */}
      <div className="mb-4 flex justify-end">
        {editing ? (
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-2 rounded-2xl border bg-card/60 px-4 py-2 text-sm transition hover:bg-accent/60"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 rounded-2xl border bg-card/60 px-4 py-2 text-sm transition hover:bg-accent/60"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Title */}
        <div className="md:col-span-2">
          <div className="text-sm text-muted-foreground">Title</div>
          {editing ? (
            <Input
              className="mt-2 rounded-2xl"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Frontend Engineer"
            />
          ) : (
            <div className={title.trim() ? readOnlyClass : mutedReadOnlyClass}>
              {title.trim() || "No title"}
            </div>
          )}
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <div className="text-sm text-muted-foreground">Description</div>
          {editing ? (
            <Textarea
              className="mt-2 min-h-[120px] rounded-2xl"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the role, responsibilities, and tech stack..."
            />
          ) : (
            <div className="mt-2 min-h-[64px] cursor-default rounded-2xl border bg-background/40 px-3 py-2.5 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed select-none">
              {description.trim() || (
                <span className="italic opacity-50">No description yet. Click Edit to add one.</span>
              )}
            </div>
          )}
        </div>

        {/* Location */}
        <div>
          <div className="text-sm text-muted-foreground">Location (optional)</div>
          {editing ? (
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
          ) : (
            <div className={location.trim() ? readOnlyClass : mutedReadOnlyClass}>
              {location.trim() || "Not specified"}
            </div>
          )}
        </div>

        {/* Status */}
        <div>
          <div className="text-sm text-muted-foreground">Status</div>
          {editing ? (
            <select
              className="mt-2 h-10 w-full rounded-2xl border bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value === "CLOSED" ? "CLOSED" : "OPEN")}
            >
              <option value="OPEN">OPEN</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          ) : (
            <div className={readOnlyClass}>{status}</div>
          )}
        </div>

        {/* Work mode */}
        <div>
          <div className="text-sm text-muted-foreground">Work mode</div>
          {editing ? (
            <>
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
            </>
          ) : (
            <div className={workMode ? readOnlyClass : mutedReadOnlyClass}>
              {workMode
                ? workMode === "OTHER"
                  ? workModeOther.trim() || "Other"
                  : WORK_MODE_LABELS[workMode]
                : "Not specified"}
            </div>
          )}
        </div>

        {/* Min. years of experience */}
        <div>
          <div className="text-sm text-muted-foreground">
            Min. years of experience <span className="text-destructive">*</span>
          </div>
          {editing ? (
            <>
              <Input
                type="number"
                min={0}
                max={50}
                className="mt-2 rounded-2xl"
                value={requiredYears}
                onChange={(e) => setRequiredYears(e.target.value)}
                placeholder="0"
              />
              <div className="mt-1 text-xs text-muted-foreground">
                Required. Use 0 for no minimum. Candidates below this are disqualified.
                Scoring: 60% experience + 30% skills + 10% projects.
              </div>
            </>
          ) : (
            <div className={readOnlyClass}>
              {requiredYears === "0" || requiredYears === ""
                ? "No minimum"
                : `${requiredYears} year${Number(requiredYears) === 1 ? "" : "s"}`}
            </div>
          )}
        </div>
      </div>

      {editing && (
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
      )}
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "AED", "SGD"];

type JobDetailsShape = {
  id: string;
  title: string;
  company: string | null;
  department: string | null;
  description: string | null;
  location: string | null;
  status: "OPEN" | "CLOSED";
  workMode: "REMOTE" | "ONSITE" | "HYBRID" | "OTHER" | null;
  workModeOther: string | null;
  requiredYearsOfExperience: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  closingDate: Date | null;
  openingsCount: number | null;
};

const WORK_MODE_LABELS: Record<string, string> = {
  REMOTE: "Remote",
  ONSITE: "Onsite",
  HYBRID: "Hybrid",
  OTHER: "Other",
};

export function JobDetailsForm({ orgId, job }: { orgId: string; job: JobDetailsShape }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  const [title, setTitle] = useState(job.title ?? "");
  const [company, setCompany] = useState(job.company ?? "");
  const [department, setDepartment] = useState(job.department ?? "");
  const [description, setDescription] = useState(job.description ?? "");
  const [location, setLocation] = useState(job.location ?? "");
  const [status, setStatus] = useState<"OPEN" | "CLOSED">(job.status ?? "OPEN");
  const [workMode, setWorkMode] = useState<"REMOTE" | "ONSITE" | "HYBRID" | "OTHER" | "">(job.workMode ?? "");
  const [workModeOther, setWorkModeOther] = useState(job.workModeOther ?? "");
  const [requiredYears, setRequiredYears] = useState(
    job.requiredYearsOfExperience != null ? String(job.requiredYearsOfExperience) : "0"
  );
  const [salaryMin, setSalaryMin] = useState(job.salaryMin != null ? String(job.salaryMin) : "");
  const [salaryMax, setSalaryMax] = useState(job.salaryMax != null ? String(job.salaryMax) : "");
  const [salaryCurrency, setSalaryCurrency] = useState(job.salaryCurrency ?? "USD");
  const [closingDate, setClosingDate] = useState(
    job.closingDate ? new Date(job.closingDate).toISOString().slice(0, 10) : ""
  );
  const [openingsCount, setOpeningsCount] = useState(
    job.openingsCount != null ? String(job.openingsCount) : ""
  );
  const [locationSuggestions, setLocationSuggestions] = useState<
    Array<{ label: string; value: string; type: "city" | "country" }>
  >([]);
  const [loadingLocationSuggestions, setLoadingLocationSuggestions] = useState(false);
  const [locationFocused, setLocationFocused] = useState(false);

  const makeSnapshot = (
    t: string, c: string, dep: string, desc: string, loc: string,
    st: string, wm: string, wmo: string, ry: string,
    sMin: string, sMax: string, sCur: string, cd: string, oc: string
  ) => JSON.stringify({
    title: t.trim(), company: c.trim(), department: dep.trim(),
    description: desc.trim(), location: loc.trim(), status: st,
    workMode: wm || "", workModeOther: wm === "OTHER" ? wmo.trim() : "",
    requiredYears: ry.trim(), salaryMin: sMin.trim(), salaryMax: sMax.trim(),
    salaryCurrency: sCur, closingDate: cd, openingsCount: oc.trim(),
  });

  const originalSnapshot = makeSnapshot(
    job.title, job.company ?? "", job.department ?? "",
    job.description ?? "", job.location ?? "", job.status ?? "OPEN",
    job.workMode ?? "", job.workModeOther ?? "",
    job.requiredYearsOfExperience != null ? String(job.requiredYearsOfExperience) : "0",
    job.salaryMin != null ? String(job.salaryMin) : "",
    job.salaryMax != null ? String(job.salaryMax) : "",
    job.salaryCurrency ?? "USD",
    job.closingDate ? new Date(job.closingDate).toISOString().slice(0, 10) : "",
    job.openingsCount != null ? String(job.openingsCount) : "",
  );

  const currentSnapshot = makeSnapshot(
    title, company, department, description, location, status,
    workMode, workModeOther, requiredYears,
    salaryMin, salaryMax, salaryCurrency, closingDate, openingsCount,
  );

  const dirty = currentSnapshot !== originalSnapshot;

  function handleCancel() {
    setTitle(job.title ?? "");
    setCompany(job.company ?? "");
    setDepartment(job.department ?? "");
    setDescription(job.description ?? "");
    setLocation(job.location ?? "");
    setStatus(job.status ?? "OPEN");
    setWorkMode(job.workMode ?? "");
    setWorkModeOther(job.workModeOther ?? "");
    setRequiredYears(job.requiredYearsOfExperience != null ? String(job.requiredYearsOfExperience) : "0");
    setSalaryMin(job.salaryMin != null ? String(job.salaryMin) : "");
    setSalaryMax(job.salaryMax != null ? String(job.salaryMax) : "");
    setSalaryCurrency(job.salaryCurrency ?? "USD");
    setClosingDate(job.closingDate ? new Date(job.closingDate).toISOString().slice(0, 10) : "");
    setOpeningsCount(job.openingsCount != null ? String(job.openingsCount) : "");
    setLocationSuggestions([]);
    setEditing(false);
  }

  async function onSave() {
    const t = title.trim();
    if (!t) { toast.error("Title is required"); return; }

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
          company: company.trim() || null,
          department: department.trim() || null,
          description: description.trim() || null,
          location: location.trim() || null,
          status,
          workMode: workMode || null,
          workModeOther: workMode === "OTHER" ? workModeOther.trim() || null : null,
          requiredYearsOfExperience: yearsNum,
          salaryMin: salaryMin.trim() ? Number(salaryMin) : null,
          salaryMax: salaryMax.trim() ? Number(salaryMax) : null,
          salaryCurrency: (salaryMin.trim() || salaryMax.trim()) ? salaryCurrency : null,
          closingDate: closingDate || null,
          openingsCount: openingsCount.trim() ? Number(openingsCount) : null,
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

    return () => { controller.abort(); clearTimeout(timer); };
  }, [location, locationFocused]);

  const ro = "mt-2 min-h-[40px] cursor-text rounded-2xl border bg-background/40 px-3 py-2.5 text-sm text-foreground leading-relaxed select-text";
  const rom = "mt-2 min-h-[40px] cursor-text rounded-2xl border bg-background/40 px-3 py-2.5 text-sm text-muted-foreground italic leading-relaxed select-text";

  return (
    <Card className="premium-block rounded-3xl border bg-card/50 p-6 shadow-sm">
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
            <Input className="mt-2 rounded-2xl" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Frontend Engineer" />
          ) : (
            <div className={title.trim() ? ro : rom}>{title.trim() || "No title"}</div>
          )}
        </div>

        {/* Company */}
        <div>
          <div className="text-sm text-muted-foreground">Company</div>
          {editing ? (
            <Input className="mt-2 rounded-2xl" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corp" />
          ) : (
            <div className={company.trim() ? ro : rom}>{company.trim() || "Not specified"}</div>
          )}
        </div>

        {/* Department */}
        <div>
          <div className="text-sm text-muted-foreground">Department</div>
          {editing ? (
            <Input className="mt-2 rounded-2xl" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Engineering" />
          ) : (
            <div className={department.trim() ? ro : rom}>{department.trim() || "Not specified"}</div>
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
            <div className="mt-2 min-h-[64px] cursor-text rounded-2xl border bg-background/40 px-3 py-2.5 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed select-text">
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
                <div className="mt-1 text-xs text-muted-foreground">Loading location suggestions...</div>
              ) : null}
              {locationSuggestions.length > 0 ? (
                <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto inner-scroll rounded-xl border bg-background p-1 shadow-sm">
                  {locationSuggestions.map((item) => (
                    <button
                      key={`${item.type}-${item.value}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setLocation(item.value); setLocationSuggestions([]); }}
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
            <div className={location.trim() ? ro : rom}>{location.trim() || "Not specified"}</div>
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
            <div className={ro}>{status}</div>
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
                    ["REMOTE", "ONSITE", "HYBRID", "OTHER"].includes(e.target.value)
                      ? (e.target.value as any)
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
            <div className={workMode ? ro : rom}>
              {workMode
                ? workMode === "OTHER"
                  ? workModeOther.trim() || "Other"
                  : WORK_MODE_LABELS[workMode]
                : "Not specified"}
            </div>
          )}
        </div>

        {/* Min years */}
        <div>
          <div className="text-sm text-muted-foreground">
            Min. years of experience <span className="text-destructive">*</span>
          </div>
          {editing ? (
            <>
              <Input
                type="number" min={0} max={50}
                className="mt-2 rounded-2xl"
                value={requiredYears}
                onChange={(e) => setRequiredYears(e.target.value)}
                placeholder="0"
              />
              <div className="mt-1 text-xs text-muted-foreground">
                Use 0 for no minimum. Scoring: 60% experience + 30% skills + 10% projects.
              </div>
            </>
          ) : (
            <div className={ro}>
              {requiredYears === "0" || requiredYears === ""
                ? "No minimum"
                : `${requiredYears} year${Number(requiredYears) === 1 ? "" : "s"}`}
            </div>
          )}
        </div>

        {/* Openings */}
        <div>
          <div className="text-sm text-muted-foreground">Number of openings</div>
          {editing ? (
            <Input
              type="number" min={1}
              className="mt-2 rounded-2xl"
              value={openingsCount}
              onChange={(e) => setOpeningsCount(e.target.value)}
              placeholder="1"
            />
          ) : (
            <div className={openingsCount.trim() ? ro : rom}>
              {openingsCount.trim() ? `${openingsCount} position${Number(openingsCount) !== 1 ? "s" : ""}` : "Not specified"}
            </div>
          )}
        </div>

        {/* Salary */}
        <div className="md:col-span-2">
          <div className="text-sm text-muted-foreground">Salary range</div>
          {editing ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_100px]">
              <Input
                type="number" min={0} className="rounded-2xl"
                value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)}
                placeholder="Min e.g. 60000"
              />
              <Input
                type="number" min={0} className="rounded-2xl"
                value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)}
                placeholder="Max e.g. 90000"
              />
              <select
                className="h-10 rounded-2xl border bg-background px-3 text-sm"
                value={salaryCurrency}
                onChange={(e) => setSalaryCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          ) : (
            <div className={(salaryMin || salaryMax) ? ro : rom}>
              {salaryMin || salaryMax
                ? [salaryMin ? Number(salaryMin).toLocaleString() : null, salaryMax ? Number(salaryMax).toLocaleString() : null]
                    .filter(Boolean).join(" – ") + ` ${salaryCurrency}`.trim()
                : "Not specified"}
            </div>
          )}
        </div>

        {/* Closing date */}
        <div>
          <div className="text-sm text-muted-foreground">Application closing date</div>
          {editing ? (
            <Input
              type="date" className="mt-2 rounded-2xl"
              value={closingDate} onChange={(e) => setClosingDate(e.target.value)}
            />
          ) : (
            <div className={closingDate ? ro : rom}>
              {closingDate
                ? new Date(closingDate).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
                : "Not specified"}
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

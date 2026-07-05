import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowUpRight, Briefcase, Building2, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CreateJob } from "./create-job";
import { JobsFilters } from "./jobs-filters";
import { RefreshAllMatches } from "@/components/refresh-all-matches";
import type { Prisma, WorkMode } from "@prisma/client";

export default async function JobsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ q?: string; status?: string; workMode?: string }>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const statusFilter = sp.status === "OPEN" || sp.status === "CLOSED" ? sp.status : undefined;
  const workModeFilter = (["REMOTE", "ONSITE", "HYBRID", "OTHER"] as WorkMode[]).includes(
    sp.workMode as WorkMode
  )
    ? (sp.workMode as WorkMode)
    : undefined;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  });

  if (!org) redirect("/orgs/demo");

  const where: Prisma.JobWhereInput = { orgId };
  if (statusFilter) where.status = statusFilter;
  if (workModeFilter) where.workMode = workModeFilter;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { department: { contains: q, mode: "insensitive" } },
    ];
  }

  const [totalJobs, jobs] = await Promise.all([
    prisma.job.count({ where: { orgId } }),
    prisma.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        company: true,
        department: true,
        description: true,
        location: true,
        status: true,
        workMode: true,
        workModeOther: true,
        requiredYearsOfExperience: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        closingDate: true,
        openingsCount: true,
        createdAt: true,
        _count: { select: { matches: true, skills: true } },
        matches: {
          where: { status: "SHORTLISTED" },
          select: { id: true },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5" />
            Jobs
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Open Roles</h1>
          <p className="mt-2 text-muted-foreground">
            Create roles, attach skills, then generate a ranked matchboard.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Link
            href={`/orgs/${orgId}`}
            className="inline-flex items-center gap-2 rounded-2xl border bg-card/60 px-4 py-2 text-sm hover:bg-accent/60 transition"
          >
            Back <ArrowUpRight className="h-4 w-4" />
          </Link>
          <RefreshAllMatches
            orgId={orgId}
            label="Re-run All Matchboards"
            loadingLabel="Re-running..."
            successMessage="All job matchboards updated"
            errorMessage="Failed to re-run all matchboards"
          />
          <CreateJob orgId={orgId} />
        </div>
      </div>

      <Card className="premium-block rounded-3xl border bg-card/50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="mt-1 text-lg font-semibold">
              {totalJobs} job{totalJobs !== 1 ? "s" : ""}
              {jobs.length !== totalJobs ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({jobs.length} shown)
                </span>
              ) : null}
            </div>
          </div>
          <JobsFilters
            initialQuery={q}
            initialStatus={statusFilter ?? ""}
            initialWorkMode={workModeFilter ?? ""}
          />
        </div>

        <Separator className="my-4" />

        {jobs.length === 0 ? (
          <div className="premium-subblock rounded-2xl border border-dashed bg-background/40 p-6 text-sm text-muted-foreground">
            {totalJobs === 0
              ? "No jobs yet. Create your first role to unlock skills and matchboard."
              : "No jobs match your filters."}
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((j) => {
              const shortlistedCount = j.matches.length;
              const totalMatches = j._count.matches;
              const skillCount = j._count.skills;
              const descPreview = j.description
                ? j.description.replace(/\s+/g, " ").slice(0, 120).trimEnd() +
                  (j.description.length > 120 ? "…" : "")
                : null;

              const salaryStr =
                j.salaryMin || j.salaryMax
                  ? [
                      j.salaryMin ? j.salaryMin.toLocaleString() : null,
                      j.salaryMax ? j.salaryMax.toLocaleString() : null,
                    ]
                      .filter(Boolean)
                      .join(" – ") +
                    (j.salaryCurrency ? ` ${j.salaryCurrency}` : "")
                  : null;

              const closingStr = j.closingDate
                ? new Date(j.closingDate).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : null;

              return (
                <div
                  key={j.id}
                  className="premium-subblock group rounded-2xl border bg-background/40 p-4 transition hover:bg-accent/40"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      {/* Title + badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-semibold">{j.title}</div>
                        <Badge
                          variant={j.status === "OPEN" ? "default" : "secondary"}
                          className="rounded-full text-xs"
                        >
                          {j.status ?? "OPEN"}
                        </Badge>
                        {j.workMode ? (
                          <Badge variant="outline" className="rounded-full text-xs">
                            {j.workMode === "OTHER" ? j.workModeOther ?? "Other" : j.workMode}
                          </Badge>
                        ) : null}
                        {j.openingsCount ? (
                          <Badge variant="outline" className="rounded-full text-xs">
                            {j.openingsCount} opening{j.openingsCount !== 1 ? "s" : ""}
                          </Badge>
                        ) : null}
                      </div>

                      {/* Company / department / location */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        {j.company ? (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {j.company}
                            {j.department ? ` · ${j.department}` : ""}
                          </span>
                        ) : j.department ? (
                          <span>{j.department}</span>
                        ) : null}
                        {j.location ? <span>{j.location}</span> : null}
                        {j.requiredYearsOfExperience ? (
                          <span>{j.requiredYearsOfExperience}+ yrs</span>
                        ) : null}
                        {salaryStr ? <span>{salaryStr}</span> : null}
                        {closingStr ? (
                          <span className="text-amber-600">Closes {closingStr}</span>
                        ) : null}
                      </div>

                      {/* Description preview */}
                      {descPreview ? (
                        <p className="mt-2 text-sm text-muted-foreground/80 line-clamp-2">
                          {descPreview}
                        </p>
                      ) : null}

                      {/* Stats */}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {skillCount > 0 ? (
                          <span>{skillCount} skill{skillCount !== 1 ? "s" : ""}</span>
                        ) : (
                          <span className="text-amber-600">No skills yet</span>
                        )}
                        {totalMatches > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {totalMatches} matched
                            {shortlistedCount > 0 ? (
                              <span className="ml-1 font-medium text-emerald-600">
                                · {shortlistedCount} shortlisted
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                        <span>
                          {new Date(j.createdAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Action links */}
                    <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                      <Link
                        href={`/orgs/${orgId}/jobs/${j.id}/skills`}
                        className="inline-flex w-full items-center justify-center gap-1 rounded-full border bg-background/40 px-3 py-1 text-sm transition hover:bg-accent/60 sm:w-auto"
                      >
                        View <ArrowUpRight className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/orgs/${orgId}/matchboard?jobId=${j.id}`}
                        className="inline-flex w-full items-center justify-center gap-1 rounded-full border bg-card/60 px-3 py-1 text-sm transition hover:bg-accent/60 sm:w-auto"
                      >
                        Matchboard <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

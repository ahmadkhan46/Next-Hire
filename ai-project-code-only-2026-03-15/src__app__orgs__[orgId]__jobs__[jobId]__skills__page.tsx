import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { JobSkillsEditor } from "./skills-editor";
import { JobDetailsForm } from "./job-details-form";
import { JobDeleteButton } from "./job-delete-button";
import { JobAuditTimeline } from "./job-audit-timeline";
import { fetchJobAuditEvents } from "@/lib/job-audit";

export const runtime = "nodejs";

export default async function JobSkillsPage({
  params,
}: {
  params: Promise<{ orgId: string; jobId: string }>;
}) {
  const { orgId, jobId } = await params;

  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId },
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      status: true,
      workMode: true,
      workModeOther: true,
    },
  });

  if (!job) {
    return (
      <Card className="premium-block rounded-3xl border bg-card/50 p-6 shadow-sm">
        Job not found.
      </Card>
    );
  }

  const rows = await prisma.jobSkill.findMany({
    where: { jobId: job.id },
    include: { skill: true },
    orderBy: [{ weight: "desc" }, { createdAt: "asc" }],
  });

  const initialSkills = rows.map((r) => ({
    id: r.skill.id,
    name: r.skill.name,
    weight: r.weight ?? 1,
  }));

  const auditData = await fetchJobAuditEvents({
    orgId,
    jobId: job.id,
    take: 25,
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Job skills
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {job.title}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Define required skills + weights. Weight {'>='} 4 is treated as critical.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Link
            href={`/orgs/${orgId}/jobs`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border bg-card/60 px-4 py-2 text-sm transition hover:bg-accent/60 sm:w-auto"
          >
            Back to Jobs <ArrowUpRight className="h-4 w-4" />
          </Link>

          <Link
            href={`/orgs/${orgId}/matchboard?jobId=${jobId}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border bg-card/60 px-4 py-2 text-sm transition hover:bg-accent/60 sm:w-auto"
          >
            Open Matchboard <ArrowUpRight className="h-4 w-4" />
          </Link>

          <JobDeleteButton orgId={orgId} jobId={jobId} />
        </div>
      </div>

      <JobDetailsForm
        orgId={orgId}
        job={{
          id: job.id,
          title: job.title,
          description: job.description,
          location: job.location,
          status: job.status,
          workMode: job.workMode,
          workModeOther: job.workModeOther,
        }}
      />

      <Separator />

      <JobSkillsEditor orgId={orgId} jobId={jobId} initialSkills={initialSkills} />

      <JobAuditTimeline
        jobId={job.id}
        initialEvents={auditData.events}
        initialHasMore={auditData.hasMore}
        initialNextCursor={auditData.nextCursor}
      />
    </div>
  );
}



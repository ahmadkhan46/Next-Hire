import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowUpRight, Briefcase } from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CreateJob } from "./create-job";
import { RefreshAllMatches } from "@/components/refresh-all-matches";

export default async function JobsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  });

  if (!org) redirect("/orgs/demo");

  const jobs = await prisma.job.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      status: true,
      workMode: true,
      workModeOther: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5" />
            Jobs
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Open Roles
          </h1>
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="mt-1 text-lg font-semibold">{jobs.length} jobs</div>
          </div>
          <Badge variant="secondary" className="rounded-full">
            Live
          </Badge>
        </div>

        <Separator className="my-4" />

        {jobs.length === 0 ? (
          <div className="premium-subblock rounded-2xl border border-dashed bg-background/40 p-6 text-sm text-muted-foreground">
            No jobs yet. Create your first role to unlock skills and matchboard.
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((j) => (
              <div
                key={j.id}
                className="premium-subblock group rounded-2xl border bg-background/40 p-4 transition hover:bg-accent/40"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-base font-semibold">{j.title}</div>
                      <Badge variant="secondary" className="rounded-full text-xs">
                        {j.status ?? "OPEN"}
                      </Badge>
                      {j.workMode ? (
                        <Badge variant="outline" className="rounded-full text-xs">
                          {j.workMode === "OTHER" ? j.workModeOther ?? "OTHER" : j.workMode}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {j.location ?? "--"}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/orgs/${orgId}/jobs/${j.id}/skills`}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-full border bg-background/40 px-3 py-1 text-sm transition hover:bg-accent/60 sm:w-auto"
                    >
                      Edit <ArrowUpRight className="h-4 w-4" />
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
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

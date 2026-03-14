import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Briefcase, Sparkles, BarChart3 } from "lucide-react";
import { MatchboardClient } from "./matchboard-client";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";

export default async function MatchboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ jobId?: string }>;
}) {
  const { orgId } = await params;
  const { jobId } = await searchParams;

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
      createdAt: true,
    },
  });

  const requestedJobId = jobId ?? null;
  const hasRequested =
    requestedJobId && jobs.some((j) => j.id === requestedJobId);

  const initialJobId = hasRequested ? requestedJobId : (jobs?.[0]?.id ?? null);

  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="prestige-bg" />
      <div className="prestige-grid" />

      <div className="relative z-10 mx-auto w-full max-w-[1400px] space-y-8 px-3 py-6 sm:px-4 md:px-6 md:py-8">
        {/* Premium Header */}
        <div className="premium-block prestige-card rounded-[28px] p-5 sm:p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] prestige-pill">
                <Sparkles className="h-4 w-4 text-slate-700" />
                MATCHBOARD
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
                Candidate Intelligence
              </h1>
              <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
                Precision matching with weighted scoring, critical gap analysis, and audit-ready decisions.
              </p>
            </div>

            <div className="prestige-surface w-full rounded-2xl p-4 lg:w-auto">
              <div className="flex items-center gap-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Active Jobs</div>
                  <div className="text-lg font-bold text-slate-900">{jobs.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Section */}
        {initialJobId && (
          <div className="premium-block prestige-card rounded-[28px] p-5 sm:p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">Job Analytics</h2>
            </div>
            <AnalyticsDashboard orgId={orgId} jobId={initialJobId} />
          </div>
        )}

        {/* Matchboard Client */}
        {jobs.length === 0 ? (
          <div className="premium-block prestige-card rounded-[28px] p-5 sm:p-6 md:p-8">
            <div className="text-sm text-slate-500">Matchboard</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">
              No jobs found
            </div>
            <p className="mt-2 text-slate-600">
              Create a job to generate candidate matches and enable intelligence views.
            </p>
          </div>
        ) : (
          <MatchboardClient orgId={orgId} jobs={jobs} initialJobId={initialJobId} />
        )}
      </div>
    </div>
  );
}

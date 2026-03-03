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
    <div className="min-h-screen relative overflow-hidden">
      <div className="prestige-bg" />
      <div className="prestige-grid" />

      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-6 py-10 space-y-10">
        {/* Premium Header */}
        <div className="premium-block prestige-card rounded-[28px] p-8">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] prestige-pill">
                <Sparkles className="h-4 w-4 text-slate-700" />
                MATCHBOARD
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                Candidate Intelligence
              </h1>
              <p className="text-base text-slate-600 max-w-2xl">
                Precision matching with weighted scoring, critical gap analysis, and audit-ready decisions.
              </p>
            </div>

            <div className="prestige-surface rounded-2xl p-4">
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
          <div className="premium-block prestige-card rounded-[28px] p-8">
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
          <div className="premium-block prestige-card rounded-[28px] p-8">
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

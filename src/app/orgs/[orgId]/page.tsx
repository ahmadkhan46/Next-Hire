import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowUpRight, Briefcase, Users, Sparkles, BarChart3 } from "lucide-react";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { ExportAuditPanelClient } from "@/components/export-audit-panel-client";

export default async function OrgDashboardPage({
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

  const [candidatesCount, jobs] = await Promise.all([
    prisma.candidate.count({ where: { orgId } }),
    prisma.job.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        location: true,
      },
      take: 50,
    }),
  ]);

  const newestJob = jobs?.[0] ?? null;
  const avgScore = newestJob
    ? (await prisma.matchResult.aggregate({
        where: { jobId: newestJob.id },
        _avg: { score: true },
      }))._avg.score
    : null;

  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="prestige-bg" />
      <div className="prestige-grid" />

      <div className="relative z-10 mx-auto w-full max-w-[1200px] space-y-8 px-3 py-6 sm:px-4 md:space-y-10 md:px-6 md:py-10">
        <div className="premium-block prestige-card rounded-[32px] p-6 sm:p-8 md:p-10 lg:p-12">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] prestige-pill">
                <Sparkles className="h-4 w-4 text-slate-700" />
                AI-POWERED INTELLIGENCE
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-black tracking-tight text-slate-900">
                Recruitment
                <span className="block prestige-title">Intelligence</span>
              </h1>

              <p className="max-w-2xl text-sm sm:text-base md:text-lg leading-relaxed text-slate-600">
                A precise, elegant command center for hiring teams. Real-time analytics,
                autonomous matching, and audit-ready compliance in one place.
              </p>

              <div className="flex flex-wrap gap-3 sm:gap-4">
                <Link
                  href="#analytics"
                  className="prestige-accent rounded-2xl px-5 py-2 sm:px-7 sm:py-3 text-xs sm:text-sm font-semibold shadow-lg"
                >
                  Launch Dashboard
                </Link>
              </div>
            </div>

            <div className="flex items-start justify-start lg:justify-end">
              <div className="prestige-surface rounded-3xl p-4">
                <ExportAuditPanelClient orgId={orgId} />
              </div>
            </div>
          </div>
        </div>

        <div id="analytics" className="premium-block prestige-card rounded-[28px] p-5 sm:p-6 md:p-8 lg:p-10">
          <div className="flex flex-wrap items-center gap-4 mb-8">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-white">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 md:text-3xl">
              Neural Analytics
            </h2>
            <span className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] prestige-pill">
              Live Signals
            </span>
          </div>

          <AnalyticsDashboard orgId={orgId} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
          <div className="premium-block prestige-card rounded-3xl p-4 sm:p-7">
            <div className="flex items-center justify-between gap-4 sm:gap-6">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Talent Pool
                </div>
                <div className="mt-2 sm:mt-3 text-2xl sm:text-4xl font-black text-slate-900">
                  {candidatesCount}
                </div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Active Candidates
                </div>
              </div>
              <div className="grid h-10 w-10 sm:h-14 sm:w-14 place-items-center rounded-2xl bg-slate-900 text-white shrink-0">
                <Users className="h-5 w-5 sm:h-7 sm:w-7" />
              </div>
            </div>

            <div className="my-4 sm:my-6 h-px w-full bg-slate-200" />

            <Link
              href={`/orgs/${orgId}/candidates`}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-900"
            >
              Access Talent Pool <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </Link>
          </div>

          <div className="premium-block prestige-card rounded-3xl p-4 sm:p-7">
            <div className="flex items-center justify-between gap-4 sm:gap-6">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Active Jobs
                </div>
                <div className="mt-2 sm:mt-3 text-2xl sm:text-4xl font-black text-slate-900">
                  {jobs.length}
                </div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Open Positions
                </div>
              </div>
              <div className="grid h-10 w-10 sm:h-14 sm:w-14 place-items-center rounded-2xl bg-slate-900 text-white shrink-0">
                <Briefcase className="h-5 w-5 sm:h-7 sm:w-7" />
              </div>
            </div>

            <div className="my-4 sm:my-6 h-px w-full bg-slate-200" />

            <Link
              href={`/orgs/${orgId}/jobs`}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-900"
            >
              Manage Jobs <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </Link>
          </div>

          <div className="premium-block prestige-card rounded-3xl p-4 sm:p-7">
            <div className="flex items-center justify-between gap-4 sm:gap-6">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  AI Matching
                </div>
                <div className="mt-2 sm:mt-3 text-2xl sm:text-4xl font-black text-slate-900">
                  {avgScore ? `${Math.round(avgScore)}%` : "--"}
                </div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Match Score
                </div>
              </div>
              <div className="grid h-10 w-10 sm:h-14 sm:w-14 place-items-center rounded-2xl bg-slate-900 text-white shrink-0">
                <Sparkles className="h-5 w-5 sm:h-7 sm:w-7" />
              </div>
            </div>

            <div className="my-4 sm:my-6 h-px w-full bg-slate-200" />

            {newestJob ? (
              <Link
                href={`/orgs/${orgId}/matchboard?jobId=${newestJob.id}`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"
              >
                Enter Matchboard <ArrowUpRight className="h-4 w-4" />
              </Link>
            ) : (
              <button className="text-sm font-semibold text-slate-400">
                Create Job to Activate AI
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

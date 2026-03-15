import { TrendingUp, Users, Briefcase, Activity } from "lucide-react";
import { getOrgAnalytics } from "@/lib/analytics";
import { SkillsAnalysisPanel } from "@/components/skills-analysis-panel";

export async function AnalyticsDashboard({ orgId, jobId }: { orgId: string; jobId?: string }) {
  let data;

  try {
    data = await getOrgAnalytics(orgId, jobId);
  } catch (error) {
    console.error("Failed to load analytics:", error);
    return <div className="text-sm text-muted-foreground">Analytics unavailable</div>;
  }

  const total = (data.pipeline?.none || 0) + (data.pipeline?.shortlisted || 0) + (data.pipeline?.rejected || 0);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="premium-block prestige-card p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-white">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Candidates</span>
              <div className="text-3xl font-black text-slate-900">{data.overview?.totalCandidates || 0}</div>
            </div>
          </div>
        </div>

        <div className="premium-block prestige-card p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-white">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Active Jobs</span>
              <div className="text-3xl font-black text-slate-900">{data.overview?.totalJobs || 0}</div>
            </div>
          </div>
        </div>

        <div className="premium-block prestige-card p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-white">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Activity</span>
              <div className="text-3xl font-black text-slate-900">{data.overview?.recentActivity || 0}</div>
            </div>
          </div>
        </div>

        <div className="premium-block prestige-card p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-white">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Success Rate</span>
              <div className="text-3xl font-black text-slate-900">{data.overview?.shortlistRate || 0}%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="premium-block prestige-card p-8 md:p-10">
        <h3 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
            <TrendingUp className="h-5 w-5" />
          </div>
          Pipeline Flow
        </h3>

        <div className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span className="text-sm font-semibold text-slate-600">Unreviewed Candidates</span>
            <div className="flex items-center gap-4">
              <div className="w-56 h-3 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-800 transition-all duration-700 ease-out"
                  style={{ width: `${total > 0 ? ((data.pipeline?.none || 0) / total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-700 w-12 text-right">
                {data.pipeline?.none || 0}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span className="text-sm font-semibold text-slate-600">Shortlisted Talents</span>
            <div className="flex items-center gap-4">
              <div className="w-56 h-3 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-700 ease-out"
                  style={{ width: `${total > 0 ? ((data.pipeline?.shortlisted || 0) / total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-700 w-12 text-right">
                {data.pipeline?.shortlisted || 0}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span className="text-sm font-semibold text-slate-600">Filtered Out</span>
            <div className="flex items-center gap-4">
              <div className="w-56 h-3 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-400 transition-all duration-700 ease-out"
                  style={{ width: `${total > 0 ? ((data.pipeline?.rejected || 0) / total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-700 w-12 text-right">
                {data.pipeline?.rejected || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      <SkillsAnalysisPanel skillsGaps={data.skillsGaps || []} />
    </div>
  );
}

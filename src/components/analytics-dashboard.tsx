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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        <div className="premium-block prestige-card p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="grid h-9 w-9 sm:h-11 sm:w-11 place-items-center rounded-2xl bg-slate-900 text-white shrink-0">
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 block">Candidates</span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 truncate">{data.overview?.totalCandidates || 0}</div>
            </div>
          </div>
        </div>

        <div className="premium-block prestige-card p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="grid h-9 w-9 sm:h-11 sm:w-11 place-items-center rounded-2xl bg-slate-900 text-white shrink-0">
              <Briefcase className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 block">Active Jobs</span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 truncate">{data.overview?.totalJobs || 0}</div>
            </div>
          </div>
        </div>

        <div className="premium-block prestige-card p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="grid h-9 w-9 sm:h-11 sm:w-11 place-items-center rounded-2xl bg-slate-900 text-white shrink-0">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 block">Activity</span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 truncate">{data.overview?.recentActivity || 0}</div>
            </div>
          </div>
        </div>

        <div className="premium-block prestige-card p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="grid h-9 w-9 sm:h-11 sm:w-11 place-items-center rounded-2xl bg-slate-900 text-white shrink-0">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 block">Success Rate</span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 truncate">{data.overview?.shortlistRate || 0}%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="premium-block prestige-card p-6 md:p-8 lg:p-10">
        <h3 className="text-lg md:text-xl font-semibold text-slate-900 mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
          <div className="grid h-9 w-9 md:h-10 md:w-10 place-items-center rounded-2xl bg-slate-900 text-white shrink-0">
            <TrendingUp className="h-4 w-4 md:h-5 md:w-5" />
          </div>
          Pipeline Flow
        </h3>

        <div className="space-y-4 md:space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span className="text-xs md:text-sm font-semibold text-slate-600">Unreviewed Candidates</span>
            <div className="flex items-center gap-2 md:gap-4">
              <div className="w-full max-w-56 h-3 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-800 transition-all duration-700 ease-out"
                  style={{ width: `${total > 0 ? ((data.pipeline?.none || 0) / total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs md:text-sm font-semibold text-slate-700 w-10 md:w-12 text-right shrink-0">
                {data.pipeline?.none || 0}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span className="text-xs md:text-sm font-semibold text-slate-600">Shortlisted Talents</span>
            <div className="flex items-center gap-2 md:gap-4">
              <div className="w-full max-w-56 h-3 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-700 ease-out"
                  style={{ width: `${total > 0 ? ((data.pipeline?.shortlisted || 0) / total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs md:text-sm font-semibold text-slate-700 w-10 md:w-12 text-right shrink-0">
                {data.pipeline?.shortlisted || 0}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span className="text-xs md:text-sm font-semibold text-slate-600">Filtered Out</span>
            <div className="flex items-center gap-2 md:gap-4">
              <div className="w-full max-w-56 h-3 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-400 transition-all duration-700 ease-out"
                  style={{ width: `${total > 0 ? ((data.pipeline?.rejected || 0) / total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs md:text-sm font-semibold text-slate-700 w-10 md:w-12 text-right shrink-0">
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

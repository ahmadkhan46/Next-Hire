"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Users, Briefcase, Activity, AlertTriangle } from "lucide-react";

interface AnalyticsData {
  overview: {
    totalCandidates: number;
    totalJobs: number;
    recentActivity: number;
    shortlistRate: number;
  };
  pipeline: {
    none: number;
    shortlisted: number;
    rejected: number;
  };
  skillsGaps: Array<{
    skill_name: string;
    gap_count: number;
  }>;
}

export function AnalyticsDashboard({ orgId, jobId }: { orgId: string; jobId?: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const url = `/api/orgs/${orgId}/analytics${jobId ? `?jobId=${jobId}` : ''}`;
        const response = await fetch(url);
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [orgId, jobId]);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="premium-block prestige-card p-6 animate-pulse">
              <div className="h-16 bg-slate-100 rounded-xl"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
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

      {(data.skillsGaps?.length || 0) > 0 && (
        <div className="premium-block prestige-card p-8 md:p-10">
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900">Skills Analysis</h3>
            <span className="prestige-pill rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]">
              AI Insights
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data.skillsGaps || []).slice(0, 9).map((skill, i) => (
              <div key={i} className="premium-subblock prestige-surface rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {skill.skill_name}
                  </span>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    {skill.gap_count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

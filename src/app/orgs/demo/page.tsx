"use client";

import { ArrowUpRight, Briefcase, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const demoMetrics = [
  { label: "Active Candidates", value: "248", icon: Users },
  { label: "Open Jobs", value: "12", icon: Briefcase },
  { label: "Match Score", value: "87%", icon: Sparkles },
];

const demoJobs = [
  { title: "Senior Product Designer", location: "Remote", status: "Open" },
  { title: "Frontend Engineer", location: "Berlin", status: "Open" },
  { title: "AI Research Analyst", location: "Toronto", status: "Paused" },
];

export default function DemoOrgDashboard() {
  const router = useRouter();
  const [orgHref, setOrgHref] = useState<string | null>(null);
  const [hasOrg, setHasOrg] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/orgs/my")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        const orgId = data?.orgId as string | undefined;
        const href = orgId ? `/orgs/${orgId}` : "/";
        setOrgHref(href);
        setHasOrg(Boolean(orgId));
        if (orgId) {
          router.replace(href);
        }
      })
      .catch(() => {
        if (!active) return;
        setOrgHref("/");
        setHasOrg(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-[1200px] px-6 py-10 space-y-10">
        <div className="premium-block prestige-card rounded-[28px] p-8 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] prestige-pill">
                Demo Workspace
              </div>
              <h1 className="text-3xl font-black text-slate-900 md:text-4xl">
                Welcome to NextHire
              </h1>
              <p className="text-slate-600 max-w-2xl">
                Explore a read-only preview of the hiring intelligence platform.
                Sign in to unlock live data and automation.
              </p>
            </div>
            {hasOrg ? (
              <Link
                href={orgHref ?? "/"}
                className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white inline-flex items-center"
              >
                Go to my org <ArrowUpRight className="inline h-4 w-4 ml-2" />
              </Link>
            ) : (
              <Link
                href="/sign-in"
                className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white inline-flex items-center"
              >
                Sign in for full access <ArrowUpRight className="inline h-4 w-4 ml-2" />
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {demoMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="premium-block prestige-card rounded-3xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {metric.label}
                    </div>
                    <div className="mt-3 text-3xl font-black text-slate-900">
                      {metric.value}
                    </div>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="premium-block prestige-card rounded-[28px] p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Recent Jobs</h2>
            <span className="text-sm text-slate-500">Read-only preview</span>
          </div>
          <div className="space-y-4">
            {demoJobs.map((job) => (
              <div
                key={job.title}
                className="premium-subblock flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {job.title}
                  </div>
                  <div className="text-xs text-slate-500">{job.location}</div>
                </div>
                <span className="rounded-full px-3 py-1 text-xs font-semibold prestige-pill">
                  {job.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

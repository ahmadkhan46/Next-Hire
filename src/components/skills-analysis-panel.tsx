"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

type SkillGap = {
  skill_name: string;
  gap_count: number;
};

export function SkillsAnalysisPanel({ skillsGaps }: { skillsGaps: SkillGap[] }) {
  const [visible, setVisible] = useState(false);

  if (skillsGaps.length === 0) {
    return null;
  }

  const rows: SkillGap[][] = [];
  for (let i = 0; i < skillsGaps.length; i += 3) {
    rows.push(skillsGaps.slice(i, i + 3));
  }

  return (
    <div className="premium-block prestige-card p-8 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">Skills Analysis</h3>
          <span className="prestige-pill rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]">
            AI Insights
          </span>
        </div>

        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="inline-flex items-center gap-2 rounded-2xl border bg-background/50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-accent/60"
        >
          {visible ? "Hide skills analytics" : "Show skills analytics"}
          {visible ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {visible ? (
        <div className="mt-6 space-y-4">
          <div className="h-[13rem] snap-y snap-mandatory overflow-y-auto pr-2 scroll-smooth overscroll-contain">
            <div className="space-y-4">
              {rows.map((row, rowIndex) => (
                <div
                  key={`skills-row-${rowIndex}`}
                  className="grid snap-start grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
                >
                  {row.map((skill, skillIndex) => (
                    <div
                      key={`${skill.skill_name}-${rowIndex}-${skillIndex}`}
                      className="premium-subblock prestige-surface min-h-[6rem] rounded-2xl p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
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
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

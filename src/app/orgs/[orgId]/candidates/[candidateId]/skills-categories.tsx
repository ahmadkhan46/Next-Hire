"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";

type Entry = { category: string; items: string[] };

export function SkillsCategories({ entries }: { entries: Entry[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? entries : entries.slice(0, 4);
  const hiddenCount = Math.max(entries.length - 4, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((entry) => (
          <div
            key={entry.category}
            className="premium-subblock relative overflow-hidden rounded-2xl border border-slate-300/80 bg-white/70 p-4 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {entry.category}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {entry.items.map((item) => (
                <Badge key={item} variant="outline" className="rounded-full">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
      {hiddenCount > 0 ? (
        <button
          type="button"
          className="text-xs font-medium text-slate-600 hover:text-slate-900"
          onClick={() => setShowAll((prev) => !prev)}
        >
          {showAll ? "Show fewer categories" : `Show ${hiddenCount} more categories`}
        </button>
      ) : null}
    </div>
  );
}

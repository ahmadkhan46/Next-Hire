"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

export function Sidebar({ orgId }: { orgId: string }) {
  const pathname = usePathname();
  const items = navItems(orgId);
  const dashboardHref = `/orgs/${orgId}`;

  return (
    <aside className="relative hidden w-[280px] shrink-0 border-r border-slate-200/80 bg-gradient-to-b from-white via-white/95 to-slate-50/80 backdrop-blur-xl md:flex md:flex-col">
      <div className="pointer-events-none absolute inset-y-6 left-0 w-[3px] bg-gradient-to-b from-transparent via-slate-300/70 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[2px] bg-gradient-to-b from-transparent via-slate-300/60 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[10px] bg-gradient-to-r from-transparent to-slate-200/20" />

      <div className="flex items-center gap-3 px-4 py-5">
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-300/80 bg-white shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">NextHire</span>
            <Badge variant="secondary" className="h-5 px-2 text-[10px]">
              ALPHA
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Talent Intelligence Platform
          </div>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="relative overflow-hidden rounded-2xl border border-slate-300/80 bg-white/85 p-3 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]">
          <div className="pointer-events-none absolute inset-y-4 left-0 w-[3px] bg-gradient-to-b from-transparent via-slate-300/70 to-transparent" />
          <div className="pointer-events-none absolute inset-x-4 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-slate-300/50 to-transparent" />
          <div className="text-xs text-muted-foreground">Organization</div>
          <div className="mt-1 text-sm font-medium">Active Workspace</div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-2 pb-6">
        <nav className="space-y-2 px-2 pt-2">
          {items.map((item) => {
            const active =
              item.href === dashboardHref
                ? pathname === dashboardHref || pathname === `${dashboardHref}/`
                : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition border border-transparent",
                  "hover:bg-white hover:border-slate-200/70 hover:text-foreground hover:shadow-[0_12px_24px_-20px_rgba(15,23,42,0.35)]",
                  active
                    ? "bg-slate-900 text-white shadow-[0_14px_30px_-20px_rgba(15,23,42,0.45)] border-slate-900"
                    : "text-slate-600"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 transition",
                    active ? "text-white" : "text-slate-500",
                    "group-hover:text-foreground"
                  )}
                />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="border-t px-4 py-4">
        <div className="relative overflow-hidden rounded-2xl border border-slate-300/80 bg-white/85 p-3 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]">
          <div className="pointer-events-none absolute inset-y-4 left-0 w-[3px] bg-gradient-to-b from-transparent via-slate-300/70 to-transparent" />
          <div className="pointer-events-none absolute inset-x-4 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-slate-300/50 to-transparent" />
          <div className="text-xs text-muted-foreground">Tip</div>
          <div className="mt-1 text-sm">
            Press <span className="font-semibold">Ctrl+K</span> for command palette
          </div>
        </div>
      </div>
    </aside>
  );
}

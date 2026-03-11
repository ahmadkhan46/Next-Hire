"use client";

import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, BarChart3, Users, Briefcase, Brain, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type HeaderSection =
  | "dashboard"
  | "candidates"
  | "jobs"
  | "intelligence"
  | "settings"
  | null;

function getActiveSection(pathname: string | null, orgId?: string): HeaderSection {
  if (!pathname || !orgId) return null;

  const orgBase = `/orgs/${orgId}`;
  if (pathname === orgBase || pathname === `${orgBase}/`) return "dashboard";

  if (
    pathname.startsWith(`${orgBase}/candidates`) ||
    pathname.startsWith(`${orgBase}/uploads`)
  ) {
    return "candidates";
  }

  if (
    pathname.startsWith(`${orgBase}/jobs`) ||
    pathname.startsWith(`${orgBase}/matchboard`)
  ) {
    return "jobs";
  }

  if (pathname.startsWith(`${orgBase}/intelligence`)) return "intelligence";
  if (pathname.startsWith(`${orgBase}/settings`)) return "settings";

  return null;
}

export function Navigation() {
  const { user } = useUser();
  const pathname = usePathname();
  const orgMatch = pathname?.match(/^\/orgs\/([^/]+)/);
  const orgId = orgMatch?.[1];
  const activeSection = getActiveSection(pathname, orgId);

  const navLinkClass = (active: boolean) =>
    cn(
      "group relative px-4 py-2 text-sm font-medium rounded-xl transition-all",
      active
        ? "bg-slate-900 text-white shadow-[0_12px_24px_-18px_rgba(15,23,42,0.5)]"
        : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
    );

  const navIconClass = (active: boolean) =>
    cn("inline h-4 w-4 mr-2", active ? "text-white" : "text-slate-500");

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-lg font-black text-slate-900">NextHire</span>
            </Link>

            {orgId && (
              <div className="hidden md:flex items-center gap-1">
              <Link
                href={`/orgs/${orgId}`}
                className={navLinkClass(activeSection === "dashboard")}
                aria-current={activeSection === "dashboard" ? "page" : undefined}
              >
                <BarChart3 className={navIconClass(activeSection === "dashboard")} />
                Dashboard
              </Link>
              <Link
                href={`/orgs/${orgId}/candidates`}
                className={navLinkClass(activeSection === "candidates")}
                aria-current={activeSection === "candidates" ? "page" : undefined}
              >
                <Users className={navIconClass(activeSection === "candidates")} />
                Candidates
              </Link>
              <Link
                href={`/orgs/${orgId}/jobs`}
                className={navLinkClass(activeSection === "jobs")}
                aria-current={activeSection === "jobs" ? "page" : undefined}
              >
                <Briefcase className={navIconClass(activeSection === "jobs")} />
                Jobs
              </Link>
              <Link
                href={`/orgs/${orgId}/intelligence`}
                className={navLinkClass(activeSection === "intelligence")}
                aria-current={activeSection === "intelligence" ? "page" : undefined}
              >
                <Brain className={navIconClass(activeSection === "intelligence")} />
                Intelligence
              </Link>
              <Link
                href={`/orgs/${orgId}/settings`}
                className={navLinkClass(activeSection === "settings")}
                aria-current={activeSection === "settings" ? "page" : undefined}
              >
                <Settings className={navIconClass(activeSection === "settings")} />
                Settings
              </Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <SignedIn>
              <div className="hidden md:block text-sm text-slate-600">
                {user?.emailAddresses[0]?.emailAddress}
              </div>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-9 w-9",
                  },
                }}
              />
            </SignedIn>
            <SignedOut>
              <Link
                href="/sign-in"
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Sign In
              </Link>
            </SignedOut>
          </div>
        </div>
      </div>
    </nav>
  );
}

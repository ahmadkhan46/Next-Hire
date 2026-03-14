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
  const orgLinks = orgId
    ? [
        {
          href: `/orgs/${orgId}`,
          label: "Dashboard",
          icon: BarChart3,
          active: activeSection === "dashboard",
        },
        {
          href: `/orgs/${orgId}/candidates`,
          label: "Candidates",
          icon: Users,
          active: activeSection === "candidates",
        },
        {
          href: `/orgs/${orgId}/jobs`,
          label: "Jobs",
          icon: Briefcase,
          active: activeSection === "jobs",
        },
        {
          href: `/orgs/${orgId}/intelligence`,
          label: "Intelligence",
          icon: Brain,
          active: activeSection === "intelligence",
        },
        {
          href: `/orgs/${orgId}/settings`,
          label: "Settings",
          icon: Settings,
          active: activeSection === "settings",
        },
      ]
    : [];

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
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="flex min-h-16 flex-col justify-center gap-3 py-3 md:h-16 md:flex-row md:items-center md:justify-between md:gap-6 md:py-0">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-lg font-black text-slate-900">NextHire</span>
            </Link>

            <div className="flex items-center gap-3 md:hidden">
              <SignedIn>
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
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  Sign In
                </Link>
              </SignedOut>
            </div>
          </div>

          {orgLinks.length > 0 ? (
            <div className="hidden flex-1 items-center gap-1 md:flex">
              {orgLinks.map(({ href, label, icon: Icon, active }) => (
                <Link
                  key={href}
                  href={href}
                  className={navLinkClass(active)}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className={navIconClass(active)} />
                  {label}
                </Link>
              ))}
            </div>
          ) : null}

          <div className="hidden items-center gap-4 md:flex">
            <SignedIn>
              <div className="hidden text-sm text-slate-600 lg:block">
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
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                Sign In
              </Link>
            </SignedOut>
          </div>
        </div>

        {orgLinks.length > 0 ? (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 inner-scroll md:hidden">
            {orgLinks.map(({ href, label, icon: Icon, active }) => (
              <Link
                key={href}
                href={href}
                className={cn(navLinkClass(active), "shrink-0 whitespace-nowrap")}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={navIconClass(active)} />
                {label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </nav>
  );
}

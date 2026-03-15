import Link from "next/link";
import { Sparkles, Zap, Shield, BarChart3, ArrowRight } from "lucide-react";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { isClerkClientEnabled } from "@/lib/clerk-config";

export default async function HomePage() {
  const clerkEnabled = isClerkClientEnabled();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="prestige-bg" />
      <div className="prestige-grid" />

      <div className="relative z-10">
        {/* Hero Section */}
        <div className="mx-auto max-w-[1200px] px-6 pt-20 pb-32">
          <div className="text-center space-y-8">
            <div className="inline-flex items-center gap-3 rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] prestige-pill">
              <Sparkles className="h-4 w-4 text-slate-700" />
              AI-POWERED RECRUITMENT
            </div>

            <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900">
              Hire Smarter,
              <span className="block prestige-title">Not Harder</span>
            </h1>

            <p className="max-w-2xl mx-auto text-xl text-slate-600 leading-relaxed">
              Transform your recruitment with AI-powered matching, real-time analytics,
              and automated workflows. Built for modern hiring teams.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              {clerkEnabled ? (
              <SignedOut>
                <Link
                  href="/sign-up"
                  className="prestige-accent rounded-2xl px-8 py-4 text-base font-semibold shadow-lg inline-flex items-center gap-2"
                >
                  Get Started Free <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/sign-in"
                  className="rounded-2xl px-8 py-4 text-base font-semibold prestige-stroke text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Sign In
                </Link>
              </SignedOut>
              ) : (
                <>
                  <Link
                    href="/sign-up"
                    className="prestige-accent rounded-2xl px-8 py-4 text-base font-semibold shadow-lg inline-flex items-center gap-2"
                  >
                    Get Started Free <ArrowRight className="h-5 w-5" />
                  </Link>
                  <Link
                    href="/sign-in"
                    className="rounded-2xl px-8 py-4 text-base font-semibold prestige-stroke text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Sign In
                  </Link>
                </>
              )}
              {clerkEnabled ? (
              <SignedIn>
                <Link
                  href="/orgs/demo"
                  className="prestige-accent rounded-2xl px-8 py-4 text-base font-semibold shadow-lg inline-flex items-center gap-2"
                >
                  Go to workspace <ArrowRight className="h-5 w-5" />
                </Link>
              </SignedIn>
              ) : null}
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mx-auto max-w-[1200px] px-6 pb-32">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="premium-block prestige-card rounded-3xl p-8">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-white mb-6">
                <Zap className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">AI Matching</h3>
              <p className="text-slate-600 leading-relaxed">
                Weighted skill matching with critical gap detection. Find the perfect
                candidates in seconds, not hours.
              </p>
            </div>

            <div className="premium-block prestige-card rounded-3xl p-8">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-white mb-6">
                <BarChart3 className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Real-Time Analytics</h3>
              <p className="text-slate-600 leading-relaxed">
                Pipeline insights, skills gap analysis, and success metrics. Make
                data-driven hiring decisions.
              </p>
            </div>

            <div className="premium-block prestige-card rounded-3xl p-8">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-white mb-6">
                <Shield className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Audit Ready</h3>
              <p className="text-slate-600 leading-relaxed">
                Complete decision logs, compliance reports, and export capabilities.
                Enterprise-grade security.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mx-auto max-w-[1200px] px-6 pb-32">
          <div className="premium-block prestige-card rounded-[32px] p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
              <div>
                <div className="text-5xl font-black text-slate-900 mb-2">95%</div>
                <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Match Accuracy
                </div>
              </div>
              <div>
                <div className="text-5xl font-black text-slate-900 mb-2">10x</div>
                <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Faster Screening
                </div>
              </div>
              <div>
                <div className="text-5xl font-black text-slate-900 mb-2">100%</div>
                <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Audit Compliant
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

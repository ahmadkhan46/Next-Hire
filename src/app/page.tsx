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
        <div className="mx-auto max-w-[1200px] px-4 pt-12 pb-20 sm:px-6 sm:pt-20 sm:pb-32">
          <div className="text-center space-y-6 sm:space-y-8">
            <div className="inline-flex items-center gap-2 sm:gap-3 rounded-full px-4 py-1.5 sm:px-5 sm:py-2 text-xs font-semibold uppercase tracking-[0.2em] prestige-pill">
              <Sparkles className="h-4 w-4 text-slate-700" />
              <span className="hidden sm:inline">AI-POWERED RECRUITMENT</span>
              <span className="sm:hidden">AI RECRUITMENT</span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-7xl font-black tracking-tight text-slate-900">
              Hire Smarter,
              <span className="block prestige-title">Not Harder</span>
            </h1>

            <p className="max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-slate-600 leading-relaxed">
              Transform your recruitment with AI-powered matching, real-time analytics,
              and automated workflows. Built for modern hiring teams.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-2 sm:pt-4">
              {clerkEnabled ? (
              <SignedOut>
                <Link
                  href="/sign-up"
                  className="prestige-accent rounded-2xl px-6 py-2.5 sm:px-8 sm:py-4 text-sm sm:text-base font-semibold shadow-lg inline-flex items-center gap-2"
                >
                  <span className="hidden sm:inline">Get Started Free</span>
                  <span className="sm:hidden">Get Started</span>
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </Link>
                <Link
                  href="/sign-in"
                  className="rounded-2xl px-6 py-2.5 sm:px-8 sm:py-4 text-sm sm:text-base font-semibold prestige-stroke text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Sign In
                </Link>
              </SignedOut>
              ) : (
                <>
                  <Link
                    href="/sign-up"
                    className="prestige-accent rounded-2xl px-6 py-2.5 sm:px-8 sm:py-4 text-sm sm:text-base font-semibold shadow-lg inline-flex items-center gap-2"
                  >
                    <span className="hidden sm:inline">Get Started Free</span>
                    <span className="sm:hidden">Get Started</span>
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Link>
                  <Link
                    href="/sign-in"
                    className="rounded-2xl px-6 py-2.5 sm:px-8 sm:py-4 text-sm sm:text-base font-semibold prestige-stroke text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Sign In
                  </Link>
                </>
              )}
              {clerkEnabled ? (
              <SignedIn>
                <Link
                  href="/orgs/demo"
                  className="prestige-accent rounded-2xl px-6 py-2.5 sm:px-8 sm:py-4 text-sm sm:text-base font-semibold shadow-lg inline-flex items-center gap-2"
                >
                  Go to workspace <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </Link>
              </SignedIn>
              ) : null}
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6 sm:pb-32">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="premium-block prestige-card rounded-2xl sm:rounded-3xl p-5 sm:p-8">
              <div className="grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-2xl bg-slate-900 text-white mb-4 sm:mb-6">
                <Zap className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <h3 className="text-lg sm:text-2xl font-bold text-slate-900 mb-2 sm:mb-3">AI Matching</h3>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Weighted skill matching with critical gap detection. Find the perfect
                candidates in seconds, not hours.
              </p>
            </div>

            <div className="premium-block prestige-card rounded-2xl sm:rounded-3xl p-5 sm:p-8">
              <div className="grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-2xl bg-slate-900 text-white mb-4 sm:mb-6">
                <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <h3 className="text-lg sm:text-2xl font-bold text-slate-900 mb-2 sm:mb-3">Real-Time Analytics</h3>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Pipeline insights, skills gap analysis, and success metrics. Make
                data-driven hiring decisions.
              </p>
            </div>

            <div className="premium-block prestige-card rounded-2xl sm:rounded-3xl p-5 sm:p-8">
              <div className="grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-2xl bg-slate-900 text-white mb-4 sm:mb-6">
                <Shield className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <h3 className="text-lg sm:text-2xl font-bold text-slate-900 mb-2 sm:mb-3">Audit Ready</h3>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Complete decision logs, compliance reports, and export capabilities.
                Enterprise-grade security.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6 sm:pb-32">
          <div className="premium-block prestige-card rounded-2xl sm:rounded-[32px] p-6 sm:p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-12 text-center">
              <div>
                <div className="text-3xl sm:text-5xl font-black text-slate-900 mb-1 sm:mb-2">95%</div>
                <div className="text-xs sm:text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Match Accuracy
                </div>
              </div>
              <div>
                <div className="text-3xl sm:text-5xl font-black text-slate-900 mb-1 sm:mb-2">10x</div>
                <div className="text-xs sm:text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Faster Screening
                </div>
              </div>
              <div>
                <div className="text-3xl sm:text-5xl font-black text-slate-900 mb-1 sm:mb-2">100%</div>
                <div className="text-xs sm:text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
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

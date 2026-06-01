import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { isClerkClientEnabled } from "@/lib/clerk-config";

export default function SignUpPage() {
  const clerkEnabled = isClerkClientEnabled();

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center">
      <div className="tech-bg" />
      <div className="tech-grid" />

      <div className="absolute left-[-20px] top-20 tech-orb tech-orb-sm" />
      <div className="absolute right-[-80px] bottom-16 tech-orb" />

      <div className="relative z-10 w-full max-w-md px-4 sm:px-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400/20 border border-cyan-400/30">
            <Sparkles className="h-4 w-4 text-cyan-400" />
          </div>
          <span className="text-xl font-black text-white tracking-tight">NextHire</span>
        </div>

        <div className="tech-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 overflow-hidden">
          <div className="mb-6 text-center">
            <h1 className="text-2xl sm:text-3xl font-black tech-title mb-1.5">Create account</h1>
            <p className="tech-muted text-sm">Start hiring smarter today</p>
          </div>

          <div className="rounded-xl tech-auth">
            {clerkEnabled ? (
              <SignUp
                fallbackRedirectUrl="/orgs/demo"
                appearance={{
                  variables: {
                    colorPrimary: "#38bdf8",
                    colorText: "#e2e8f0",
                    colorTextSecondary: "#94a3b8",
                    colorBackground: "transparent",
                    colorInputBackground: "rgba(15, 23, 42, 0.6)",
                    colorInputText: "#e2e8f0",
                    borderRadius: "12px",
                  },
                  elements: {
                    rootBox: "mx-auto w-full",
                    card: "shadow-none bg-transparent border-0 p-0 w-full",
                    cardBox: "w-full shadow-none",
                    main: "w-full",
                    header: "hidden",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    formButtonPrimary: "tech-accent rounded-xl h-11 text-sm font-semibold w-full",
                    formFieldInput:
                      "bg-slate-900/70 border-slate-700 text-slate-100 focus:ring-2 focus:ring-cyan-400/30 h-11",
                    formFieldLabel: "text-slate-300 text-xs uppercase tracking-wider",
                    dividerText: "text-slate-400 text-xs uppercase tracking-[0.2em]",
                    dividerLine: "bg-slate-700",
                    socialButtonsBlockButton:
                      "h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-100",
                    socialButtonsBlockButtonText: "text-sm font-semibold text-slate-900",
                    footerActionText: "hidden",
                    footerActionLink: "hidden",
                    footer: "hidden",
                    form: "gap-5",
                    formFieldRow: "gap-3",
                    footerAction: "hidden",
                    footerAction__signUp: "hidden",
                    footerMainContent: "hidden",
                    identityPreviewText: "text-slate-400 text-xs",
                    identityPreviewEditButton: "text-cyan-300",
                    badge: "hidden",
                    badge__lastUsed: "hidden",
                    badge__lastUsedContainer: "hidden",
                    socialButtonsBlockButtonBadge: "hidden",
                    socialButtonsBlockButton__lastUsed: "hidden",
                  },
                }}
              />
            ) : (
              <div className="rounded-xl border border-amber-300/30 bg-amber-100/10 p-4 text-left text-sm text-slate-200">
                Sign-up is temporarily unavailable because Clerk is not configured in this deployment.
              </div>
            )}
          </div>

          {/* Sign-in link */}
          <p className="mt-5 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        {/* Guest access */}
        <div className="mt-4">
          <Link
            href="/orgs/demo"
            className="flex w-full items-center justify-center rounded-xl border border-slate-700/60 bg-slate-900/40 px-4 py-3 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
          >
            Continue as guest
          </Link>
        </div>
      </div>
    </div>
  );
}

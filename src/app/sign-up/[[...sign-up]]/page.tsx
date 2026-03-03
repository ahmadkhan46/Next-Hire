import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      <div className="tech-bg" />
      <div className="tech-grid" />

      <div className="absolute left-[-20px] top-20 tech-orb tech-orb-sm" />
      <div className="absolute right-[-80px] bottom-16 tech-orb" />

      <div className="relative z-10 w-full max-w-lg px-6">
        <div className="tech-card rounded-[36px] p-10 text-center">
          <div className="mx-auto mb-6 h-12 w-12 rounded-2xl bg-white/10 grid place-items-center">
            <div className="h-5 w-5 rounded-full bg-gradient-to-br from-cyan-300 to-blue-500" />
          </div>
          <h1 className="text-3xl font-black tech-title mb-2">Get Started</h1>
          <p className="tech-muted mb-10">
            Create your account to unlock the recruitment intelligence platform.
          </p>

          <div className="rounded-2xl tech-auth">
            <SignUp
              fallbackRedirectUrl="/"
              appearance={{
                variables: {
                  colorPrimary: "#38bdf8",
                  colorText: "#e2e8f0",
                  colorTextSecondary: "#94a3b8",
                  colorBackground: "transparent",
                  colorInputBackground: "rgba(15, 23, 42, 0.6)",
                  colorInputText: "#e2e8f0",
                  borderRadius: "14px",
                },
                elements: {
                  rootBox: "mx-auto w-full",
                  card: "shadow-none bg-transparent border-0 p-0",
                  header: "hidden",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  formButtonPrimary: "tech-accent rounded-xl h-11 text-sm font-semibold",
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
                  footerActionLink__signUp: "text-cyan-300",
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
          </div>

          <div className="mt-6">
            <Link
              href="/orgs/demo"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-800"
            >
              Continue as Guest
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

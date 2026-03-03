import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowUpRight, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${url}`);
  return res.json();
}

function scoreLabel(score: number) {
  if (score >= 0.9) return { text: "Excellent", variant: "secondary" as const };
  if (score >= 0.75) return { text: "Strong", variant: "secondary" as const };
  if (score >= 0.5) return { text: "Good", variant: "secondary" as const };
  return { text: "Low", variant: "secondary" as const };
}

export default async function JobMatchboardPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const [skillsRes, matchesRes] = await Promise.all([
    getJSON<any>(`${base}/api/jobs/${jobId}/skills`).catch(() => ({ skills: [] })),
    getJSON<any>(`${base}/api/jobs/${jobId}/matches`).catch(() => ({ matches: [] })),
  ]);

  const requiredSkills: Array<{ name: string; weight?: number }> =
    skillsRes?.skills ?? [];

  const matches: Array<{
    candidateId: string;
    fullName: string;
    email?: string | null;
    score: number;
    matched: any;
    missing: any;
    matchedWeight?: number;
    totalWeight?: number;
    computedAt?: string;
  }> = matchesRes?.matches ?? [];

  const top = matches[0];
  const avgScore =
    matches.length > 0
      ? matches.reduce((sum, m) => sum + Number(m.score || 0), 0) / matches.length
      : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Matchboard
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Job Matchboard
          </h1>
          <p className="mt-2 text-muted-foreground">
            Ranked candidates based on weighted skill overlap.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl border bg-card/60 px-4 py-2 text-sm hover:bg-accent/60 transition"
          >
            Back to Dashboard <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="premium-block relative overflow-hidden rounded-3xl border bg-card/50 p-6 shadow-sm">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-[hsl(var(--primary)/0.18)] blur-3xl" />
          <div className="text-sm text-muted-foreground">Candidates ranked</div>
          <div className="mt-3 text-4xl font-semibold">{matches.length}</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Saved match results
          </div>
        </Card>

        <Card className="premium-block relative overflow-hidden rounded-3xl border bg-card/50 p-6 shadow-sm">
          <div className="pointer-events-none absolute -top-24 left-1/3 h-48 w-48 rounded-full bg-[hsl(var(--muted-foreground)/0.14)] blur-3xl" />
          <div className="text-sm text-muted-foreground">Avg score</div>
          <div className="mt-3 text-4xl font-semibold">
            {avgScore === null ? "—" : avgScore.toFixed(2)}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Across all candidates
          </div>
        </Card>

        <Card className="premium-block relative overflow-hidden rounded-3xl border bg-card/50 p-6 shadow-sm">
          <div className="pointer-events-none absolute -top-24 right-10 h-48 w-48 rounded-full bg-[hsl(var(--primary)/0.12)] blur-3xl" />
          <div className="text-sm text-muted-foreground">Top match</div>
          <div className="mt-3 text-xl font-semibold">
            {top?.fullName ?? "—"}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            {top ? `${Math.round(top.score * 100)}%` : "No matches yet"}
          </div>
        </Card>
      </div>

      {/* Required skills */}
      <Card className="premium-block rounded-3xl border bg-card/50 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Required skills</div>
            <div className="mt-1 text-lg font-semibold">
              {requiredSkills.length ? "Target profile" : "No job skills set"}
            </div>
          </div>

          <Badge variant="secondary" className="rounded-full">
            Weighted
          </Badge>
        </div>

        <Separator className="my-4" />

        {requiredSkills.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Add required skills via <code>/api/jobs/[jobId]/skills</code> first.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {requiredSkills.map((s) => (
              <span
                key={s.name}
                className="inline-flex items-center gap-2 rounded-full border bg-background/40 px-3 py-1 text-sm"
              >
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  w:{s.weight ?? 1}
                </span>
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Ranked matches */}
      <div className="grid gap-4 lg:grid-cols-2">
        {matches.length === 0 ? (
          <Card className="premium-block rounded-3xl border bg-card/50 p-6 shadow-sm lg:col-span-2">
            <div className="text-lg font-semibold">No matches yet</div>
            <p className="mt-2 text-muted-foreground">
              Run <code>/api/jobs/{jobId}/match</code> to compute & save matches.
            </p>
          </Card>
        ) : (
          matches.slice(0, 12).map((m) => {
            const pct = Math.round(Number(m.score) * 100);
            const label = scoreLabel(Number(m.score));
            const matched = Array.isArray(m.matched) ? m.matched : (m.matched ?? []);
            const missing = Array.isArray(m.missing) ? m.missing : (m.missing ?? []);

            return (
              <Card
                key={m.candidateId}
                className="premium-block relative overflow-hidden rounded-3xl border bg-card/50 p-6 shadow-sm"
              >
                <div className="pointer-events-none absolute -top-20 right-0 h-40 w-40 rounded-full bg-[hsl(var(--primary)/0.10)] blur-3xl" />

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold">{m.fullName}</div>
                    <div className="text-sm text-muted-foreground">
                      {m.email ?? "—"}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-semibold">{pct}%</div>
                    <Badge variant={label.variant} className="mt-1 rounded-full">
                      {label.text}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[hsl(var(--primary))]"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <Separator className="my-4" />

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      Matched
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {matched.length ? (
                        matched.slice(0, 8).map((s: string) => (
                          <span
                            key={s}
                            className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                          >
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      Missing
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {missing.length ? (
                        missing.slice(0, 8).map((s: string) => (
                          <span
                            key={s}
                            className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-800 dark:text-amber-300 border border-amber-500/20"
                          >
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                  <div>
                    Weights:{" "}
                    <span className="font-medium text-foreground">
                      {m.matchedWeight ?? "—"}/{m.totalWeight ?? "—"}
                    </span>
                  </div>
                  <Link
                    href={`/candidates/${m.candidateId}`}
                    className="inline-flex items-center gap-1 rounded-full border bg-background/40 px-3 py-1 hover:bg-accent/60 transition"
                  >
                    View profile <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

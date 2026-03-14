import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowUpRight, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CandidatesActions } from "./candidates-actions";
import { CandidateSearch } from "./candidate-search";
import type { Prisma } from "@prisma/client";

export default async function CandidatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { orgId } = await params;
  const qp = await searchParams;
  const q = (qp.q ?? "").trim();

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  });

  if (!org) redirect("/orgs/demo");

  const where: Prisma.CandidateWhereInput = { orgId };
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [totalCandidates, candidates] = await Promise.all([
    prisma.candidate.count({ where: { orgId } }),
    prisma.candidate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Candidates
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Talent Pool
          </h1>
          <p className="mt-2 text-muted-foreground">
            Your organization&apos;s candidates with skills extracted and tracked.
          </p>
        </div>

        <CandidatesActions orgId={orgId} />
      </div>

      <Card className="premium-block rounded-3xl border bg-card/50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="mt-1 text-lg font-semibold">
              {candidates.length} candidates
            </div>
          </div>
          <Badge variant="secondary" className="rounded-full">
            Live
          </Badge>
        </div>

        <Separator className="my-4" />

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CandidateSearch initialQuery={q} />
          {q ? (
            <div className="text-sm text-muted-foreground">
              {candidates.length} of {totalCandidates}
            </div>
          ) : null}
        </div>

        {candidates.length === 0 ? (
          <div className="premium-subblock rounded-2xl border border-dashed bg-background/40 p-6 text-sm text-muted-foreground">
            {q
              ? "No candidates found for this search."
              : "No candidates yet. Use import to add multiple candidates with resumes."}
          </div>
        ) : (
          <div className="space-y-3">
            {candidates.map((c) => (
              <div
                key={c.id}
                className="premium-subblock group rounded-2xl border bg-background/40 p-4 transition hover:bg-accent/40"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-base font-semibold">{c.fullName}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {c.email ?? "--"} {c.phone ? `- ${c.phone}` : ""}
                    </div>
                  </div>

                  <Link
                    href={`/orgs/${orgId}/candidates/${c.id}`}
                    className="inline-flex w-full items-center justify-center gap-1 rounded-full border bg-background/40 px-3 py-1 text-sm transition hover:bg-accent/60 sm:w-auto"
                  >
                    View <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

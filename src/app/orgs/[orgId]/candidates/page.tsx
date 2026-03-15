import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Users } from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CandidatesActions } from "./candidates-actions";
import { CandidateSearch } from "./candidate-search";
import { CandidatesList } from "./candidates-list";
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

        <CandidatesList
          orgId={orgId}
          candidates={candidates}
          emptyMessage={
            q
              ? "No candidates found for this search."
              : "No candidates yet. Use import to add multiple candidates with resumes."
          }
        />
      </Card>
    </div>
  );
}

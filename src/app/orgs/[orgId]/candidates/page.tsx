import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Users } from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CandidatesActions } from "./candidates-actions";
import { CandidateSearch } from "./candidate-search";
import { CandidatesFilters } from "./candidates-filters";
import { CandidatesList } from "./candidates-list";
import type { Prisma } from "@prisma/client";

const VALID_STATUSES = ["ACTIVE", "INACTIVE", "HIRED", "REJECTED", "NEEDS_REVIEW"] as const;
const VALID_SOURCES = ["MANUAL", "IMPORT", "REFERRAL", "LINKEDIN", "AGENCY", "CAREER_SITE", "JOB_BOARD"] as const;
const VALID_SORTS = ["newest", "oldest", "name_asc", "name_desc"] as const;

type Sort = (typeof VALID_SORTS)[number];

export default async function CandidatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ q?: string; status?: string; source?: string; sort?: string }>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const statusFilter = VALID_STATUSES.includes(sp.status as any) ? sp.status! : "";
  const sourceFilter = VALID_SOURCES.includes(sp.source as any) ? sp.source! : "";
  const sort: Sort = VALID_SORTS.includes(sp.sort as any) ? (sp.sort as Sort) : "newest";

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  });

  if (!org) redirect("/orgs/demo");

  const where: Prisma.CandidateWhereInput = { orgId };
  if (statusFilter) where.status = statusFilter;
  if (sourceFilter) where.source = sourceFilter;
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.CandidateOrderByWithRelationInput =
    sort === "oldest"
      ? { createdAt: "asc" }
      : sort === "name_asc"
      ? { fullName: "asc" }
      : sort === "name_desc"
      ? { fullName: "desc" }
      : { createdAt: "desc" };

  const [totalCandidates, candidates] = await Promise.all([
    prisma.candidate.count({ where: { orgId } }),
    prisma.candidate.findMany({ where, orderBy, take: 200 }),
  ]);

  const isFiltered = q || statusFilter || sourceFilter || sort !== "newest";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Candidates
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Talent Pool</h1>
          <p className="mt-2 text-muted-foreground">
            Your organization&apos;s candidates with skills extracted and tracked.
          </p>
        </div>

        <CandidatesActions orgId={orgId} />
      </div>

      <Card className="premium-block rounded-3xl border bg-card/50 p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="mt-1 text-lg font-semibold">
              {totalCandidates} candidate{totalCandidates !== 1 ? "s" : ""}
              {isFiltered && candidates.length !== totalCandidates ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({candidates.length} shown)
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="mb-4 flex flex-col gap-3">
          <CandidateSearch initialQuery={q} />
          <CandidatesFilters
            initialStatus={statusFilter}
            initialSource={sourceFilter}
            initialSort={sort}
          />
        </div>

        <CandidatesList
          orgId={orgId}
          candidates={candidates}
          emptyMessage={
            isFiltered
              ? "No candidates match your filters."
              : "No candidates yet. Use import to add multiple candidates with resumes."
          }
        />
      </Card>
    </div>
  );
}

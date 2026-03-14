import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  Briefcase,
  FolderKanban,
  GraduationCap,
  User,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { findSimilarCandidates } from "@/lib/semantic-search";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ManualComparePicker } from "./manual-compare-picker";
import { CompareActions } from "./compare-actions";

type ComparePageProps = {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ ids?: string; from?: string }>;
};

function parseIds(raw: string | undefined) {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    )
  ).slice(0, 2);
}

export default async function CompareCandidatesPage({
  params,
  searchParams,
}: ComparePageProps) {
  const { orgId } = await params;
  const query = await searchParams;
  const ids = parseIds(query.ids);
  const fromCandidateId = typeof query.from === "string" ? query.from : undefined;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  });
  if (!org) redirect("/orgs/demo");

  const manualOptions = await prisma.candidate.findMany({
    where: { orgId },
    orderBy: [{ fullName: "asc" }],
    take: 300,
    select: {
      id: true,
      fullName: true,
      email: true,
      currentTitle: true,
    },
  });

  let rankedManualOptions: Array<{
    id: string;
    fullName: string;
    email: string | null;
    currentTitle: string | null;
    similarityPercent: number | null;
  }> = manualOptions.map((candidate) => ({
    ...candidate,
    similarityPercent: null,
  }));

  if (fromCandidateId) {
    try {
      const sourceCandidate = await prisma.candidate.findFirst({
        where: { id: fromCandidateId, orgId },
        select: { id: true, fullName: true, email: true, currentTitle: true },
      });

      const similar = await findSimilarCandidates(fromCandidateId, orgId, 60);
      const similarityById = new Map(
        similar.map((item) => [item.id, Math.round((item.similarity ?? 0) * 100)])
      );

      const filtered = manualOptions
        .filter((candidate) => candidate.id !== fromCandidateId)
        .map((candidate) => ({
          ...candidate,
          similarityPercent: similarityById.get(candidate.id) ?? null,
        }))
        .filter((candidate) => (candidate.similarityPercent ?? 0) >= 30)
        .sort((a, b) => {
          const scoreA = a.similarityPercent ?? 0;
          const scoreB = b.similarityPercent ?? 0;
          if (scoreA !== scoreB) return scoreB - scoreA;
          return a.fullName.localeCompare(b.fullName);
        });

      if (sourceCandidate && filtered.length > 0) {
        rankedManualOptions = [
          { ...sourceCandidate, similarityPercent: 100 },
          ...filtered,
        ];
      }
    } catch {
      // keep default alphabetical fallback
    }
  }

  if (ids.length < 2) {
    return (
      <div className="space-y-6">
        <Card className="rounded-3xl border border-slate-300 bg-white/90 p-6">
          <h1 className="text-2xl font-semibold">Compare candidates</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pick any two candidates from your organization.
          </p>
          <div className="mt-4">
            <ManualComparePicker
              orgId={orgId}
              fromCandidateId={fromCandidateId}
              candidates={rankedManualOptions}
            />
          </div>
          <div className="mt-4">
            <Link
              href={
                fromCandidateId
                  ? `/orgs/${orgId}/candidates/${fromCandidateId}`
                  : `/orgs/${orgId}/candidates`
              }
              className="inline-flex items-center gap-2 rounded-2xl border bg-card/60 px-4 py-2 text-sm hover:bg-accent/60 transition"
            >
              Go back <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const candidates = await prisma.candidate.findMany({
    where: { orgId, id: { in: ids } },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      location: true,
      currentTitle: true,
      yearsOfExperience: true,
      skills: {
        select: { skill: { select: { name: true } } },
      },
      experiences: {
        orderBy: { startMonth: "desc" },
        take: 5,
        select: {
          id: true,
          role: true,
          company: true,
          startMonth: true,
          endMonth: true,
          isCurrent: true,
        },
      },
      educations: {
        orderBy: [{ endYear: "desc" }, { startYear: "desc" }],
        take: 4,
        select: {
          id: true,
          school: true,
          degree: true,
          location: true,
          startYear: true,
          endYear: true,
        },
      },
      projects: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          dates: true,
          techStack: true,
          bullets: true,
        },
      },
      matches: {
        orderBy: { score: "desc" },
        take: 5,
        select: {
          id: true,
          score: true,
          status: true,
          job: {
            select: { id: true, title: true, status: true },
          },
        },
      },
    },
  });

  const candidateMap = new Map(candidates.map((c) => [c.id, c]));
  const ordered = ids
    .map((id) => candidateMap.get(id))
    .filter((candidate): candidate is (typeof candidates)[number] => Boolean(candidate));
  if (ordered.length < 2) {
    redirect(`/orgs/${orgId}/candidates/compare`);
  }

  const left = ordered[0];
  const right = ordered[1];
  if (!left || !right) {
    redirect(`/orgs/${orgId}/candidates/compare`);
  }
  const leftSkills = new Set(left.skills.map((s) => s.skill.name.toLowerCase()));
  const rightSkills = new Set(right.skills.map((s) => s.skill.name.toLowerCase()));
  const sharedSkills = left.skills
    .map((s) => s.skill.name)
    .filter((name) => rightSkills.has(name.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Candidate Comparison</h1>
          <p className="mt-2 text-muted-foreground">
            Side-by-side profile comparison for decision support.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <CompareActions />
          <Link
            href={fromCandidateId ? `/orgs/${orgId}/candidates/${fromCandidateId}` : `/orgs/${orgId}/candidates`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border bg-card/60 px-4 py-2 text-sm transition hover:bg-accent/60 sm:w-auto"
          >
            Back <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <Card className="premium-block rounded-3xl border border-slate-300 bg-gradient-to-br from-white via-white/90 to-slate-50 p-6 shadow-[0_26px_60px_-32px_rgba(15,23,42,0.4)]">
        <div className="text-sm font-medium text-muted-foreground">Shared skills</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {sharedSkills.length ? (
            sharedSkills.map((skill) => (
              <Badge key={skill} variant="outline" className="rounded-full">
                {skill}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No strong shared skills found.</span>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {[left, right].map((candidate) => {
          const topMatch = candidate.matches[0];
          const ownSkills = candidate.skills.map((s) => s.skill.name);
          const uniqueVsOther =
            candidate.id === left.id
              ? ownSkills.filter((name) => !rightSkills.has(name.toLowerCase()))
              : ownSkills.filter((name) => !leftSkills.has(name.toLowerCase()));

          return (
            <Card
              key={candidate.id}
              className="premium-block rounded-3xl border border-slate-300 bg-gradient-to-br from-white via-white/90 to-slate-50 p-6 shadow-[0_26px_60px_-32px_rgba(15,23,42,0.4)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xl font-semibold">{candidate.fullName}</div>
                  <div className="text-sm text-muted-foreground">{candidate.currentTitle ?? "--"}</div>
                </div>
                <Link
                  href={`/orgs/${orgId}/candidates/${candidate.id}`}
                  className="inline-flex items-center gap-1 rounded-full border bg-background/40 px-3 py-1 text-xs hover:bg-accent/60 transition"
                >
                  Open <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <Separator className="my-4" />

              <div className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Email</div>
                  <div className="font-medium">{candidate.email ?? "--"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Phone</div>
                  <div className="font-medium">{candidate.phone ?? "--"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Location</div>
                  <div className="font-medium">{candidate.location ?? "--"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Experience</div>
                  <div className="font-medium">
                    {candidate.yearsOfExperience != null ? `${candidate.yearsOfExperience} years` : "--"}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-300/80 bg-white/70 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <User className="h-4 w-4" />
                  Skills
                </div>
                <div className="flex flex-wrap gap-1">
                  {candidate.skills.length ? (
                    candidate.skills.slice(0, 20).map((skill) => (
                      <Badge
                        key={`${candidate.id}-${skill.skill.name}`}
                        variant="outline"
                        className="rounded-full text-[11px]"
                      >
                        {skill.skill.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No skills recorded.</span>
                  )}
                </div>
                <div className="mt-3">
                  <div className="mb-1 text-xs text-muted-foreground">Unique vs other</div>
                  <div className="flex flex-wrap gap-1">
                    {uniqueVsOther.length ? (
                      uniqueVsOther.slice(0, 10).map((skill) => (
                        <Badge
                          key={`${candidate.id}-unique-${skill}`}
                          variant="secondary"
                          className="rounded-full text-[11px]"
                        >
                          {skill}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No unique skills.</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-300/80 bg-white/70 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Briefcase className="h-4 w-4" />
                  Top matches
                </div>
                {candidate.matches.length ? (
                  <div className="space-y-2">
                    {candidate.matches.map((match) => (
                      <div
                        key={match.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium">{match.job?.title ?? "--"}</div>
                          <div className="text-[11px] text-muted-foreground">{match.job?.status ?? "--"}</div>
                        </div>
                        <Badge variant="outline" className="rounded-full">
                          {Math.round((match.score ?? 0) * 100)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No matches yet.</div>
                )}
                {topMatch ? (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Best score:{" "}
                    <span className="font-medium text-slate-700">
                      {Math.round((topMatch.score ?? 0) * 100)}%
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-300/80 bg-white/70 p-4">
                <div className="mb-2 text-sm font-semibold">Recent experience</div>
                {candidate.experiences.length ? (
                  <div className="space-y-2">
                    {candidate.experiences.map((exp) => (
                      <div key={exp.id} className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                        <div className="text-xs font-medium">{exp.role}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {exp.company}
                          {" • "}
                          {new Date(exp.startMonth).toLocaleDateString(undefined, {
                            month: "short",
                            year: "numeric",
                          })}
                          {" - "}
                          {exp.isCurrent || !exp.endMonth
                            ? "Present"
                            : new Date(exp.endMonth).toLocaleDateString(undefined, {
                                month: "short",
                                year: "numeric",
                              })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No experience records.</div>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-300/80 bg-white/70 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <GraduationCap className="h-4 w-4" />
                  Education
                </div>
                {candidate.educations.length ? (
                  <div className="space-y-2">
                    {candidate.educations.map((edu) => (
                      <div key={edu.id} className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                        <div className="text-xs font-medium">{edu.degree ?? "--"}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {edu.school ?? "--"}
                          {edu.location ? ` • ${edu.location}` : ""}
                        </div>
                        {edu.startYear || edu.endYear ? (
                          <div className="text-[11px] text-muted-foreground">
                            {edu.startYear && edu.endYear
                              ? `${edu.startYear} - ${edu.endYear}`
                              : edu.startYear
                              ? `${edu.startYear}`
                              : `${edu.endYear}`}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No education records.</div>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-300/80 bg-white/70 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <FolderKanban className="h-4 w-4" />
                  Projects
                </div>
                {candidate.projects.length ? (
                  <div className="space-y-2">
                    {candidate.projects.map((project) => (
                      <div key={project.id} className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                        <div className="text-xs font-medium">{project.title}</div>
                        {project.techStack ? (
                          <div className="text-[11px] text-muted-foreground">{project.techStack}</div>
                        ) : null}
                        {project.dates ? (
                          <div className="text-[11px] text-muted-foreground">{project.dates}</div>
                        ) : null}
                        {project.bullets?.length ? (
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {project.bullets.slice(0, 2).join(" • ")}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No projects recorded.</div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

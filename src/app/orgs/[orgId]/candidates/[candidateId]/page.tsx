import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowUpRight, User, Briefcase, Sparkles } from "lucide-react";
import { ResumeUploader } from "./resume-uploader";
import CandidateActions from "./candidate-actions";
import { SkillsCategories } from "./skills-categories";
import { CandidateMoreInsightsSection } from "./candidate-more-insights-section";
import { CandidateMatchesPanel } from "./candidate-matches-panel";
import { QuickActions } from "@/components/quick-actions";
import { JobRecommendations } from "@/components/job-recommendations";
import { CandidateComparison } from "@/components/candidate-comparison";

import { categorizeSkill } from "@/lib/skills-taxonomy";
import { mergeSkillCategory } from "@/lib/skill-category-merge";

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; candidateId: string }>;
}) {
  const { orgId, candidateId } = await params;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  });
  if (!org) redirect("/orgs/demo");

  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, orgId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      location: true,
      currentTitle: true,
      yearsOfExperience: true,
      notes: true,
      status: true,
      educationSchool: true,
      educationDegree: true,
      educationYear: true,
      createdAt: true,
      tags: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
      educations: {
        orderBy: [{ endYear: "desc" }, { startYear: "desc" }],
        select: {
          id: true,
          school: true,
          degree: true,
          location: true,
          startYear: true,
          endYear: true,
        },
      },
      skills: {
        select: {
          skill: { select: { name: true } },
          level: true,
          source: true,
        },
      },
      experiences: {
        orderBy: { startMonth: "desc" },
        select: {
          id: true,
          company: true,
          role: true,
          location: true,
          startMonth: true,
          endMonth: true,
          isCurrent: true,
          bullets: true,
        },
      },
      projects: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          dates: true,
          techStack: true,
          link: true,
          bullets: true,
        },
      },
      technologies: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          category: true,
          items: true,
        },
      },
      matches: {
        select: {
          id: true,
          score: true,
          status: true,
          statusUpdatedAt: true,
          matched: true,
          missing: true,
          job: { select: { id: true, title: true, location: true, status: true } },
        },
        orderBy: { score: "desc" },
        take: 10,
      },
    },
  });

  if (!candidate) {
    redirect(`/orgs/${orgId}/candidates`);
  }

  const latestResume = await prisma.resume.findFirst({
    where: { candidateId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      parseStatus: true,
      parseError: true,
      parsedAt: true,
      parseModel: true,
      promptVersion: true,
    },
  });

  const [
    initialNotesRaw,
    notesCount,
    initialActivitiesRaw,
    initialDecisionLogsRaw,
    initialInterviewsRaw,
    totalMatches,
    shortlistedCount,
    rejectedCount,
    matchAggregate,
  ] =
    await Promise.all([
      prisma.candidateNote.findMany({
        where: { orgId, candidateId },
        orderBy: [{ isImportant: "desc" }, { createdAt: "desc" }],
        take: 10,
        select: {
          id: true,
          content: true,
          isImportant: true,
          createdAt: true,
          updatedAt: true,
          authorId: true,
        },
      }),
      prisma.candidateNote.count({
        where: { orgId, candidateId },
      }),
      prisma.candidateActivity.findMany({
        where: { orgId, candidateId },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          createdAt: true,
          title: true,
          description: true,
          type: true,
        },
      }),
      prisma.matchDecisionLog.findMany({
        where: { orgId, candidateId },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          createdAt: true,
          fromStatus: true,
          toStatus: true,
          note: true,
          job: { select: { title: true } },
        },
      }),
      prisma.candidateInterview.findMany({
        where: { orgId, candidateId },
        orderBy: [{ scheduledAt: "desc" }],
        take: 8,
        select: {
          id: true,
          title: true,
          round: true,
          scheduledAt: true,
          durationMinutes: true,
          timezone: true,
          meetingType: true,
          meetingLink: true,
          location: true,
          interviewer: true,
          notes: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.matchResult.count({
        where: { orgId, candidateId },
      }),
      prisma.matchResult.count({
        where: { orgId, candidateId, status: "SHORTLISTED" },
      }),
      prisma.matchResult.count({
        where: { orgId, candidateId, status: "REJECTED" },
      }),
      prisma.matchResult.aggregate({
        where: { orgId, candidateId },
        _max: { score: true },
        _avg: { score: true },
      }),
    ]);

  const initialNotes = initialNotesRaw.map((note) => ({
    ...note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  }));
  const notesNextCursor =
    initialNotesRaw.length === 10 ? initialNotesRaw[initialNotesRaw.length - 1]?.id ?? null : null;
  const initialInterviews = initialInterviewsRaw.map((item) => ({
    ...item,
    scheduledAt: item.scheduledAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
  }));

  const skills = candidate.skills.map((s) => ({
    name: s.skill.name,
    level: s.level,
    source: s.source,
  }));

  const mergedSkillsByCategory = skills.reduce((acc, skill) => {
    const category = mergeSkillCategory(categorizeSkill(skill.name));
    if (!acc[category]) acc[category] = new Set<string>();
    acc[category].add(skill.name);
    return acc;
  }, {} as Record<string, Set<string>>);

  for (const tech of candidate.technologies) {
    const category = mergeSkillCategory(tech.category);
    if (!mergedSkillsByCategory[category]) mergedSkillsByCategory[category] = new Set<string>();
    tech.items.forEach((item) => mergedSkillsByCategory[category].add(item));
  }

  const mergedCategoryEntries = Object.entries(mergedSkillsByCategory)
    .map(([category, items]) => ({
      category,
      items: Array.from(items).sort((a, b) => a.localeCompare(b)),
    }))
    .filter((entry) => entry.items.length > 0)
    .sort((a, b) => b.items.length - a.items.length);

  const timelineEvents = [
    ...initialActivitiesRaw.map((activity) => ({
      id: `activity-${activity.id}`,
      createdAt: activity.createdAt.toISOString(),
      title: activity.title,
      description: activity.description,
      type: activity.type,
      source: "activity" as const,
    })),
    ...initialDecisionLogsRaw.map((log) => ({
      id: `decision-${log.id}`,
      createdAt: log.createdAt.toISOString(),
      title: `Match status changed (${log.fromStatus} -> ${log.toStatus})`,
      description: log.note ?? `Updated for ${log.job?.title ?? "a job"}`,
      type: "MATCH_STATUS_CHANGED",
      source: "decision" as const,
    })),
  ]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 15);

  const bestMatchPercent = Math.round((matchAggregate._max.score ?? 0) * 100);
  const latestActivityAt = timelineEvents[0]?.createdAt ?? null;
  const toStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === "string");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            Candidate
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {candidate.fullName}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Candidate profile and recent match activity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <CandidateActions
            orgId={orgId}
            candidateId={candidateId}
            candidate={candidate}
          />
          <Link
            href={`/orgs/${orgId}/candidates`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border bg-card/60 px-4 py-2 text-sm transition hover:bg-accent/60 sm:w-auto"
          >
            Back <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <ResumeUploader
        orgId={orgId}
        candidateId={candidateId}
        latestResume={
          latestResume
            ? {
                ...latestResume,
                parsedAt: latestResume.parsedAt
                  ? latestResume.parsedAt.toISOString()
                  : null,
              }
            : null
        }
      />

      <Card className="premium-block rounded-3xl border border-slate-300 bg-gradient-to-br from-white via-white/90 to-slate-50 p-6 shadow-[0_26px_60px_-32px_rgba(15,23,42,0.4)]">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm text-muted-foreground">Workflow</div>
            <div className="text-lg font-semibold">Quick actions</div>
          </div>
          <CandidateComparison
            orgId={orgId}
            currentCandidate={{
              id: candidate.id,
              fullName: candidate.fullName,
              email: candidate.email,
              currentTitle: candidate.currentTitle,
              yearsOfExperience: candidate.yearsOfExperience,
              location: candidate.location,
              skills: skills.map((s) => s.name),
              avgMatchScore: matchAggregate._avg.score ?? 0,
            }}
          />
        </div>

        <QuickActions
          candidateId={candidateId}
          orgId={orgId}
          candidateName={candidate.fullName}
          candidateEmail={candidate.email}
          tags={candidate.tags}
          status={candidate.status}
        />
      </Card>

      <Card className="premium-block rounded-3xl border border-slate-300 bg-gradient-to-br from-white via-white/90 to-slate-50 p-4 shadow-[0_26px_60px_-32px_rgba(15,23,42,0.4)] md:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="premium-subblock rounded-2xl border border-slate-300/80 bg-white/70 p-4 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Total matches</div>
            <div className="mt-1 text-2xl font-semibold">{totalMatches}</div>
          </div>
          <div className="premium-subblock rounded-2xl border border-slate-300/80 bg-white/70 p-4 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Best score</div>
            <div className="mt-1 text-2xl font-semibold">{bestMatchPercent}%</div>
          </div>
          <div className="premium-subblock rounded-2xl border border-slate-300/80 bg-white/70 p-4 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Shortlisted</div>
            <div className="mt-1 text-2xl font-semibold">{shortlistedCount}</div>
          </div>
          <div className="premium-subblock rounded-2xl border border-slate-300/80 bg-white/70 p-4 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Rejected</div>
            <div className="mt-1 text-2xl font-semibold">{rejectedCount}</div>
          </div>
          <div className="premium-subblock rounded-2xl border border-slate-300/80 bg-white/70 p-4 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Latest activity</div>
            <div className="mt-1 text-sm font-semibold">
              {latestActivityAt ? new Date(latestActivityAt).toLocaleString() : "No activity yet"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{notesCount} notes logged</div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
        <Card className="premium-block relative overflow-hidden rounded-3xl border border-slate-300 bg-gradient-to-br from-white via-white/90 to-slate-50 p-6 shadow-[0_26px_60px_-32px_rgba(15,23,42,0.4)]">
          <div className="pointer-events-none absolute -top-24 right-8 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
              <User className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Personal</div>
              <div className="text-lg font-semibold">{candidate.fullName}</div>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Email
                </div>
                <div className="font-medium">{candidate.email ?? "--"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Location
                </div>
                <div className="font-medium">{candidate.location ?? "--"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Experience
                </div>
                <div className="font-medium">
                  {candidate.yearsOfExperience ?? "--"} years
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Phone
                </div>
                <div className="font-medium">{candidate.phone ?? "--"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Current title
                </div>
                <div className="font-medium">
                  {candidate.currentTitle ?? "--"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Added
                </div>
                <div className="font-medium">
                  {candidate.createdAt.toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          {candidate.notes ? (
            <div className="mt-4 text-sm text-muted-foreground">
              {candidate.notes}
            </div>
          ) : null}
        </Card>

        <Card className="premium-block relative overflow-hidden rounded-3xl border border-slate-300 bg-gradient-to-br from-white via-white/90 to-slate-50 p-6 shadow-[0_26px_60px_-32px_rgba(15,23,42,0.4)]">
          <div className="pointer-events-none absolute -top-24 left-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Skills & Technologies</div>
              <div className="text-lg font-semibold">Capabilities</div>
            </div>
          </div>

          <Separator className="my-4" />

          {mergedCategoryEntries.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No skills recorded yet.
            </div>
          ) : (
            <SkillsCategories entries={mergedCategoryEntries} />
          )}
        </Card>
      </div>

      <Card className="premium-block relative overflow-hidden rounded-3xl border border-slate-300 bg-gradient-to-br from-white via-white/90 to-slate-50 p-6 shadow-[0_26px_60px_-32px_rgba(15,23,42,0.4)]">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Education</div>
            <div className="text-lg font-semibold">Academic background</div>
          </div>
        </div>

        <Separator className="my-4" />

        {candidate.educations.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {candidate.educations.map((edu) => (
              <div
                key={edu.id}
                className="premium-subblock rounded-2xl border border-slate-300/80 bg-white/70 p-4 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]"
              >
                <div className="text-sm font-semibold">{edu.degree ?? "Degree"}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {edu.school ?? "--"}
                  {edu.location ? ` - ${edu.location}` : ""}
                </div>
                {edu.startYear || edu.endYear ? (
                  <div className="mt-2 text-xs text-muted-foreground">
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
        ) : candidate.educationDegree || candidate.educationSchool || candidate.educationYear ? (
          <div className="premium-subblock rounded-2xl border border-slate-300/80 bg-white/70 p-4 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]">
            <div className="text-sm font-semibold">
              {candidate.educationDegree ?? "Degree"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {candidate.educationSchool ?? "--"}
            </div>
            {candidate.educationYear ? (
              <div className="mt-2 text-xs text-muted-foreground">
                {candidate.educationYear}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No education added.</div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="premium-block relative overflow-hidden rounded-3xl border border-slate-300 bg-gradient-to-br from-white via-white/90 to-slate-50 p-6 shadow-[0_26px_60px_-32px_rgba(15,23,42,0.4)]">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Experience</div>
              <div className="text-lg font-semibold">Work history</div>
            </div>
          </div>

          <Separator className="my-4" />

          {candidate.experiences.length === 0 ? (
            <div className="text-sm text-muted-foreground">No experience added.</div>
          ) : (
            <div className="space-y-4">
              {candidate.experiences.map((exp) => (
                <div
                  key={exp.id}
                  className="premium-subblock relative overflow-hidden rounded-2xl border border-slate-300/80 bg-white/70 p-4 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{exp.role}</div>
                      <div className="text-xs text-muted-foreground">
                        {exp.company}
                        {exp.location ? ` - ${exp.location}` : ""}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
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
                  {exp.bullets?.length ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {exp.bullets.slice(0, 6).map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="premium-block relative overflow-hidden rounded-3xl border border-slate-300 bg-gradient-to-br from-white via-white/90 to-slate-50 p-6 shadow-[0_26px_60px_-32px_rgba(15,23,42,0.4)]">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Projects</div>
              <div className="text-lg font-semibold">Recent work</div>
            </div>
          </div>

          <Separator className="my-4" />

          {candidate.projects.length === 0 ? (
            <div className="text-sm text-muted-foreground">No projects added.</div>
          ) : (
            <div className="space-y-4">
              {candidate.projects.map((project) => (
                <div
                  key={project.id}
                  className="premium-subblock relative overflow-hidden rounded-2xl border border-slate-300/80 bg-white/70 p-4 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{project.title}</div>
                      {project.techStack ? (
                        <div className="text-xs text-muted-foreground">
                          {project.techStack}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">{project.dates ?? ""}</div>
                  </div>
                  {project.bullets?.length ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {project.bullets.slice(0, 5).map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                  {project.link ? (
                    <Link
                      href={project.link}
                      className="mt-3 inline-flex items-center gap-1 rounded-full border bg-background/40 px-3 py-1 text-xs hover:bg-accent/60 transition"
                    >
                      View <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <JobRecommendations
        orgId={orgId}
        candidateId={candidateId}
        jobs={candidate.matches
          .filter((m) => Boolean(m.job?.id))
          .map((m) => ({
            id: m.job?.id ?? "",
            title: m.job?.title ?? "Untitled job",
            location: m.job?.location ?? null,
            status: m.job?.status ?? "CLOSED",
            score: m.score,
            matchedSkills: toStringArray(m.matched),
            missingSkills: toStringArray(m.missing),
            criticalGaps: [],
            matchStatus: m.status,
          }))}
      />

      <CandidateMatchesPanel
        orgId={orgId}
        candidateId={candidateId}
        initialHasMore={candidate.matches.length < totalMatches}
        initialMatches={candidate.matches.map((m) => ({
          id: m.id,
          score: m.score,
          status: m.status,
          statusUpdatedAt: m.statusUpdatedAt ? m.statusUpdatedAt.toISOString() : null,
          job: m.job
            ? {
                id: m.job.id,
                title: m.job.title,
                location: m.job.location,
                status: m.job.status,
              }
            : null,
        }))}
      />

      <CandidateMoreInsightsSection
        orgId={orgId}
        candidateId={candidateId}
        initialNotes={initialNotes}
        initialNextCursor={notesNextCursor}
        totalCount={notesCount}
        similarCandidates={[]}
        initialInterviews={initialInterviews}
        timelineEvents={timelineEvents}
      />
    </div>
  );
}



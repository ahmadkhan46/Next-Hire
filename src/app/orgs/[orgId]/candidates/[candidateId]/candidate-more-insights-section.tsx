"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CandidateNotesPanel } from "./candidate-notes-panel";
import { SimilarCandidatesPanel } from "./similar-candidates-panel";
import { CandidateActivityTimeline } from "./candidate-activity-timeline";
import { CandidateInterviewsPanel } from "./candidate-interviews-panel";

type Note = {
  id: string;
  content: string;
  isImportant: boolean;
  createdAt: string;
  updatedAt: string;
  authorId: string | null;
};

type TimelineEvent = {
  id: string;
  createdAt: string;
  title: string;
  description: string | null;
  type: string;
  source: "activity" | "decision";
};

type SimilarCandidate = {
  id: string;
  fullName: string;
  email: string | null;
  currentTitle: string | null;
  scorePercent: number;
  overlapCount?: number;
  yearsOfExperience: number | null;
  sharedSkills: string[];
  topMatchPercent: number | null;
  source: "semantic" | "skills";
};

type Interview = {
  id: string;
  title: string;
  round: string | null;
  scheduledAt: string;
  durationMinutes: number;
  timezone: string;
  meetingType: string;
  meetingLink: string | null;
  location: string | null;
  interviewer: string | null;
  notes: string | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  createdAt: string;
};

export function CandidateMoreInsightsSection({
  orgId,
  candidateId,
  initialNotes,
  initialNextCursor,
  totalCount,
  similarCandidates,
  initialInterviews,
  timelineEvents,
}: {
  orgId: string;
  candidateId: string;
  initialNotes: Note[];
  initialNextCursor: string | null;
  totalCount: number;
  similarCandidates: SimilarCandidate[];
  initialInterviews: Interview[];
  timelineEvents: TimelineEvent[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      {!open ? (
        <div className="flex justify-center">
          <Button onClick={() => setOpen(true)} className="rounded-2xl px-6">
            More insights
          </Button>
        </div>
      ) : null}

      {open ? (
        <>
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-2xl px-6">
              Show less
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <CandidateInterviewsPanel
              orgId={orgId}
              candidateId={candidateId}
              initialInterviews={initialInterviews}
            />
            <CandidateNotesPanel
              orgId={orgId}
              candidateId={candidateId}
              initialNotes={initialNotes}
              initialNextCursor={initialNextCursor}
              totalCount={totalCount}
            />
            <SimilarCandidatesPanel
              orgId={orgId}
              candidateId={candidateId}
              items={similarCandidates}
            />
          </div>

          <CandidateActivityTimeline orgId={orgId} candidateId={candidateId} events={timelineEvents} />
        </>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditCandidateEnhanced } from "@/components/edit-candidate-enhanced";
import { RefreshMatches } from "./refresh-matches";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

type CandidateShape = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  currentTitle: string | null;
  yearsOfExperience: number | null;
  notes: string | null;
  educationSchool: string | null;
  educationDegree: string | null;
  educationYear: number | null;
  skills?: Array<{ skill: { name: string } }>;
  experiences?: Array<{
    id: string;
    company: string;
    role: string;
    location: string | null;
    startMonth: string | Date;
    endMonth: string | Date | null;
    isCurrent: boolean;
    bullets: string[];
  }>;
  educations?: Array<{
    id: string;
    school: string;
    degree: string | null;
    location: string | null;
    startYear: number | null;
    endYear: number | null;
  }>;
  projects?: Array<{
    id: string;
    title: string;
    dates: string | null;
    techStack: string | null;
    link: string | null;
    bullets: string[];
  }>;
};

export default function CandidateActions({
  orgId,
  candidateId,
  candidate,
}: {
  orgId: string;
  candidateId: string;
  candidate: CandidateShape;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this candidate? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/${candidateId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete');

      toast.success('Candidate deleted');
      router.push(`/orgs/${orgId}/candidates`);
      router.refresh();
    } catch {
      toast.error('Failed to delete candidate');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <EditCandidateEnhanced orgId={orgId} candidate={candidate} />
      <RefreshMatches orgId={orgId} candidateId={candidateId} />
      <Button
        variant="outline"
        className="rounded-2xl text-destructive hover:bg-destructive/10"
        onClick={handleDelete}
        disabled={deleting}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {deleting ? 'Deleting...' : 'Delete'}
      </Button>
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";

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
};

export function EditCandidate({
  orgId,
  candidate,
}: {
  orgId: string;
  candidate: CandidateShape;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState(candidate.fullName ?? "");
  const [email, setEmail] = useState(candidate.email ?? "");
  const [phone, setPhone] = useState(candidate.phone ?? "");
  const [location, setLocation] = useState(candidate.location ?? "");
  const [currentTitle, setCurrentTitle] = useState(candidate.currentTitle ?? "");
  const [yearsOfExperience, setYearsOfExperience] = useState(
    candidate.yearsOfExperience?.toString() ?? ""
  );
  const [notes, setNotes] = useState(candidate.notes ?? "");
  const [educationSchool, setEducationSchool] = useState(
    candidate.educationSchool ?? ""
  );
  const [educationDegree, setEducationDegree] = useState(
    candidate.educationDegree ?? ""
  );
  const [educationYear, setEducationYear] = useState(
    candidate.educationYear?.toString() ?? ""
  );

  async function onSubmit() {
    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/candidates/${candidate.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName,
            email: email.trim() || null,
            phone: phone.trim() || null,
            location: location.trim() || null,
            currentTitle: currentTitle.trim() || null,
            yearsOfExperience: yearsOfExperience.trim()
              ? Number(yearsOfExperience)
              : null,
            notes: notes.trim() || null,
            educationSchool: educationSchool.trim() || null,
            educationDegree: educationDegree.trim() || null,
            educationYear: educationYear.trim()
              ? Number(educationYear)
              : null,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update candidate");

      toast.success("Candidate updated");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-2xl">
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[520px] rounded-3xl">
        <DialogHeader>
          <DialogTitle>Edit candidate</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <div className="text-sm text-muted-foreground">Full name</div>
            <Input
              className="mt-2 rounded-2xl"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
            />
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Email (optional)</div>
            <Input
              className="mt-2 rounded-2xl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@company.com"
            />
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Phone (optional)</div>
            <Input
              className="mt-2 rounded-2xl"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+353..."
            />
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Location (optional)</div>
            <Input
              className="mt-2 rounded-2xl"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="London, UK"
            />
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Current title (optional)</div>
            <Input
              className="mt-2 rounded-2xl"
              value={currentTitle}
              onChange={(e) => setCurrentTitle(e.target.value)}
              placeholder="Senior Frontend Engineer"
            />
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Years of experience (optional)</div>
            <Input
              className="mt-2 rounded-2xl"
              value={yearsOfExperience}
              onChange={(e) => setYearsOfExperience(e.target.value)}
              placeholder="5"
              inputMode="numeric"
            />
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Notes (optional)</div>
            <Input
              className="mt-2 rounded-2xl"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Strong in React, open to relocation..."
            />
          </div>

          <div className="pt-2 text-sm font-medium">Education</div>

          <div>
            <div className="text-sm text-muted-foreground">School (optional)</div>
            <Input
              className="mt-2 rounded-2xl"
              value={educationSchool}
              onChange={(e) => setEducationSchool(e.target.value)}
              placeholder="University of Toronto"
            />
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Degree (optional)</div>
            <Input
              className="mt-2 rounded-2xl"
              value={educationDegree}
              onChange={(e) => setEducationDegree(e.target.value)}
              placeholder="BSc Computer Science"
            />
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Graduation year (optional)</div>
            <Input
              className="mt-2 rounded-2xl"
              value={educationYear}
              onChange={(e) => setEducationYear(e.target.value)}
              placeholder="2022"
              inputMode="numeric"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" className="rounded-2xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-2xl" onClick={onSubmit} disabled={loading}>
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


"use client";

import { useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

type EducationDraft = {
  school: string;
  degree: string;
  location: string;
  startYear: string;
  endYear: string;
};

type ExperienceDraft = {
  company: string;
  role: string;
  location: string;
  startMonth: string;
  endMonth: string;
  isCurrent: boolean;
  bullets: string;
};

type ProjectDraft = {
  title: string;
  dates: string;
  techStack: string;
  link: string;
  bullets: string;
};

type TechnologyDraft = {
  category: string;
  items: string;
};

export function CreateCandidate({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [notes, setNotes] = useState("");

  const [educations, setEducations] = useState<EducationDraft[]>([]);
  const [educationDraft, setEducationDraft] = useState<EducationDraft>({
    school: "",
    degree: "",
    location: "",
    startYear: "",
    endYear: "",
  });

  const [experiences, setExperiences] = useState<ExperienceDraft[]>([]);
  const [experienceDraft, setExperienceDraft] = useState<ExperienceDraft>({
    company: "",
    role: "",
    location: "",
    startMonth: "",
    endMonth: "",
    isCurrent: false,
    bullets: "",
  });

  const [projects, setProjects] = useState<ProjectDraft[]>([]);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>({
    title: "",
    dates: "",
    techStack: "",
    link: "",
    bullets: "",
  });

  const [technologies, setTechnologies] = useState<TechnologyDraft[]>([]);
  const [technologyDraft, setTechnologyDraft] = useState<TechnologyDraft>({
    category: "",
    items: "",
  });

  const primaryEducation = useMemo(() => educations[0], [educations]);

  function addEducation() {
    if (!educationDraft.school.trim()) {
      toast.error("Education school is required");
      return;
    }

    setEducations((prev) => [...prev, { ...educationDraft }]);
    setEducationDraft({
      school: "",
      degree: "",
      location: "",
      startYear: "",
      endYear: "",
    });
  }

  function addExperience() {
    if (!experienceDraft.company.trim() || !experienceDraft.role.trim()) {
      toast.error("Experience company and role are required");
      return;
    }
    if (!experienceDraft.startMonth) {
      toast.error("Experience start month is required");
      return;
    }

    setExperiences((prev) => [...prev, { ...experienceDraft }]);
    setExperienceDraft({
      company: "",
      role: "",
      location: "",
      startMonth: "",
      endMonth: "",
      isCurrent: false,
      bullets: "",
    });
  }

  function addProject() {
    if (!projectDraft.title.trim()) {
      toast.error("Project title is required");
      return;
    }

    setProjects((prev) => [...prev, { ...projectDraft }]);
    setProjectDraft({
      title: "",
      dates: "",
      techStack: "",
      link: "",
      bullets: "",
    });
  }

  function addTechnology() {
    if (!technologyDraft.category.trim() || !technologyDraft.items.trim()) {
      toast.error("Technology category and items are required");
      return;
    }

    setTechnologies((prev) => [...prev, { ...technologyDraft }]);
    setTechnologyDraft({ category: "", items: "" });
  }

  async function onSubmit() {
    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.trim())) {
      toast.error("Please enter a valid email");
      return;
    }

    setLoading(true);
    try {
      const educationYearFallback =
        primaryEducation?.endYear || primaryEducation?.startYear || "";
      const res = await fetch(`/api/orgs/${orgId}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          location: location.trim() || null,
          currentTitle: currentTitle.trim() || null,
          yearsOfExperience: yearsOfExperience.trim()
            ? Number(yearsOfExperience)
            : null,
          notes: notes.trim() || null,
          educationSchool: primaryEducation?.school?.trim() || null,
          educationDegree: primaryEducation?.degree?.trim() || null,
          educationYear: educationYearFallback
            ? Number(educationYearFallback)
            : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create candidate");

      const candidateId = data?.candidate?.id as string;
      const errors: string[] = [];

      const postJson = async (url: string, payload: unknown) => {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const detail = await response.json().catch(() => ({}));
          throw new Error(detail?.error || "Request failed");
        }
      };

      if (candidateId) {
        const educationRequests = educations.map((edu) =>
          postJson(`/api/orgs/${orgId}/candidates/${candidateId}/education`, {
            school: edu.school.trim(),
            degree: edu.degree.trim() || undefined,
            location: edu.location.trim() || undefined,
            startYear: edu.startYear.trim()
              ? Number(edu.startYear)
              : undefined,
            endYear: edu.endYear.trim() ? Number(edu.endYear) : undefined,
          }).catch((err) => errors.push(`Education: ${err.message}`))
        );

        const experienceRequests = experiences.map((exp) => {
          const startMonth = new Date(
            `${exp.startMonth}-01T00:00:00.000Z`
          ).toISOString();
          const endMonth = exp.isCurrent || !exp.endMonth
            ? null
            : new Date(`${exp.endMonth}-01T00:00:00.000Z`).toISOString();
          const bullets = exp.bullets
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

          return postJson(
            `/api/orgs/${orgId}/candidates/${candidateId}/experience`,
            {
              company: exp.company.trim(),
              role: exp.role.trim(),
              location: exp.location.trim() || undefined,
              startMonth,
              endMonth,
              isCurrent: exp.isCurrent,
              bullets: bullets.length ? bullets : undefined,
            }
          ).catch((err) => errors.push(`Experience: ${err.message}`));
        });

        const projectRequests = projects.map((proj) => {
          const bullets = proj.bullets
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

          return postJson(
            `/api/orgs/${orgId}/candidates/${candidateId}/projects`,
            {
              title: proj.title.trim(),
              dates: proj.dates.trim() || undefined,
              techStack: proj.techStack.trim() || undefined,
              link: proj.link.trim() || undefined,
              bullets: bullets.length ? bullets : undefined,
            }
          ).catch((err) => errors.push(`Project: ${err.message}`));
        });

        const technologyRequests = technologies.map((tech) => {
          const items = tech.items
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);

          return postJson(
            `/api/orgs/${orgId}/candidates/${candidateId}/technologies`,
            {
              category: tech.category.trim(),
              items,
            }
          ).catch((err) => errors.push(`Technology: ${err.message}`));
        });

        await Promise.allSettled([
          ...educationRequests,
          ...experienceRequests,
          ...projectRequests,
          ...technologyRequests,
        ]);
      }

      toast.success("Candidate added");
      if (errors.length) {
        toast.error(`Some sections failed to save: ${errors.join(" | ")}`);
      }
      setOpen(false);
      setFullName("");
      setEmail("");
      setPhone("");
      setLocation("");
      setCurrentTitle("");
      setYearsOfExperience("");
      setNotes("");
      setEducations([]);
      setEducationDraft({
        school: "",
        degree: "",
        location: "",
        startYear: "",
        endYear: "",
      });
      setExperiences([]);
      setExperienceDraft({
        company: "",
        role: "",
        location: "",
        startMonth: "",
        endMonth: "",
        isCurrent: false,
        bullets: "",
      });
      setProjects([]);
      setProjectDraft({
        title: "",
        dates: "",
        techStack: "",
        link: "",
        bullets: "",
      });
      setTechnologies([]);
      setTechnologyDraft({ category: "", items: "" });

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
        <Button className="rounded-2xl">
          <Plus className="mr-2 h-4 w-4" />
          Add Candidate
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] sm:max-w-[720px] rounded-[32px] border border-slate-200/80 bg-white/95 p-0 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.6)] overflow-hidden">
        <div className="relative overflow-hidden rounded-[32px]">
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-slate-50 via-white to-slate-100" />
          <div className="relative px-6 pt-6">
            <DialogHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div>
                  <DialogTitle className="text-xl font-semibold">
                    Add Candidate
                  </DialogTitle>
                  <div className="text-sm text-muted-foreground">
                    Personal details to start the profile.
                  </div>
                </div>
                <Badge className="rounded-full bg-slate-900 text-white">
                  Step 1 of 4
                </Badge>
              </div>
            </DialogHeader>

              <div className="mt-4 flex items-center gap-2">
                <div className="h-2 flex-1 rounded-full bg-slate-100">
                  <div className="h-2 w-20 rounded-full bg-slate-900" />
                </div>
                <span className="text-xs text-muted-foreground">Personal</span>
              </div>
          </div>

          <div className="space-y-5 px-6 pb-6 pt-6 max-h-[70vh] overflow-y-auto inner-scroll pr-2">
            <div>
              <div className="text-sm text-muted-foreground">Full name *</div>
              <Input
                className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm text-muted-foreground">
                  Email *
                </div>
                <Input
                  type="email"
                  className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@company.com"
                />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Phone (optional)
                </div>
                <Input
                  className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+353..."
                />
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">
                Location (optional)
              </div>
              <Input
                className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="London, UK"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm text-muted-foreground">
                  Current title (optional)
                </div>
                <Input
                  className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                  value={currentTitle}
                  onChange={(e) => setCurrentTitle(e.target.value)}
                  placeholder="Senior Frontend Engineer"
                />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Years of experience (optional)
                </div>
                <Input
                  className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                  value={yearsOfExperience}
                  onChange={(e) => setYearsOfExperience(e.target.value)}
                  placeholder="5"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.4)]">
              <div className="text-sm font-semibold">Notes</div>
              <div className="text-xs text-muted-foreground">
                Short summary or standout highlights.
              </div>
              <Input
                className="mt-3 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Strong in React, open to relocation..."
              />
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.4)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Education</div>
                  <div className="text-xs text-muted-foreground">
                    Highest or most relevant degree.
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-full">
                  Optional
                </Badge>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground">School</div>
                  <Input
                    className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                    value={educationDraft.school}
                    onChange={(e) =>
                      setEducationDraft((prev) => ({
                        ...prev,
                        school: e.target.value,
                      }))
                    }
                    placeholder="University of Toronto"
                  />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Degree</div>
                  <Input
                    className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                    value={educationDraft.degree}
                    onChange={(e) =>
                      setEducationDraft((prev) => ({
                        ...prev,
                        degree: e.target.value,
                      }))
                    }
                    placeholder="BSc Computer Science"
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground">Location</div>
                  <Input
                    className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                    value={educationDraft.location}
                    onChange={(e) =>
                      setEducationDraft((prev) => ({
                        ...prev,
                        location: e.target.value,
                      }))
                    }
                    placeholder="Dublin, Ireland"
                  />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Start year</div>
                  <Input
                    className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                    value={educationDraft.startYear}
                    onChange={(e) =>
                      setEducationDraft((prev) => ({
                        ...prev,
                        startYear: e.target.value,
                      }))
                    }
                    placeholder="2018"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">End year</div>
                  <Input
                    className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                    value={educationDraft.endYear}
                    onChange={(e) =>
                      setEducationDraft((prev) => ({
                        ...prev,
                        endYear: e.target.value,
                      }))
                    }
                    placeholder="2022"
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={addEducation}
                >
                  Add education
                </Button>
              </div>
              {educations.length ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {educations.map((edu, index) => (
                    <div
                      key={`${edu.school}-${index}`}
                      className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 text-xs shadow-sm"
                    >
                      <div className="font-semibold text-sm">
                        {edu.degree || "Degree"}
                      </div>
                      <div className="text-muted-foreground">
                        {edu.school}
                        {edu.location ? ` · ${edu.location}` : ""}
                      </div>
                      {(edu.startYear || edu.endYear) && (
                        <div className="text-muted-foreground">
                          {edu.startYear || "--"} - {edu.endYear || "--"}
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        className="mt-2 h-7 rounded-full px-3 text-xs"
                        onClick={() =>
                          setEducations((prev) =>
                            prev.filter((_, i) => i !== index)
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.4)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Work Experience</div>
                  <div className="text-xs text-muted-foreground">
                    Add the most relevant roles.
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-full">
                  Optional
                </Badge>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground">Company</div>
                  <Input
                    className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                    value={experienceDraft.company}
                    onChange={(e) =>
                      setExperienceDraft((prev) => ({
                        ...prev,
                        company: e.target.value,
                      }))
                    }
                    placeholder="Affy Clouds"
                  />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Role</div>
                  <Input
                    className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                    value={experienceDraft.role}
                    onChange={(e) =>
                      setExperienceDraft((prev) => ({
                        ...prev,
                        role: e.target.value,
                      }))
                    }
                    placeholder="AI Engineer"
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground">Location</div>
                  <Input
                    className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                    value={experienceDraft.location}
                    onChange={(e) =>
                      setExperienceDraft((prev) => ({
                        ...prev,
                        location: e.target.value,
                      }))
                    }
                    placeholder="Bhopal, India"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-sm text-muted-foreground">Start</div>
                    <Input
                      type="month"
                      className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                      value={experienceDraft.startMonth}
                      onChange={(e) =>
                        setExperienceDraft((prev) => ({
                          ...prev,
                          startMonth: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">End</div>
                    <Input
                      type="month"
                      className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                      value={experienceDraft.endMonth}
                      onChange={(e) =>
                        setExperienceDraft((prev) => ({
                          ...prev,
                          endMonth: e.target.value,
                        }))
                      }
                      disabled={experienceDraft.isCurrent}
                    />
                  </div>
                </div>
              </div>
              <label className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={experienceDraft.isCurrent}
                  onChange={(e) =>
                    setExperienceDraft((prev) => ({
                      ...prev,
                      isCurrent: e.target.checked,
                      endMonth: e.target.checked ? "" : prev.endMonth,
                    }))
                  }
                />
                Currently in this role
              </label>
              <div className="mt-4">
                <div className="text-sm text-muted-foreground">Highlights</div>
                <Textarea
                  className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                  value={experienceDraft.bullets}
                  onChange={(e) =>
                    setExperienceDraft((prev) => ({
                      ...prev,
                      bullets: e.target.value,
                    }))
                  }
                  placeholder="One achievement per line"
                />
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={addExperience}
                >
                  Add experience
                </Button>
              </div>
              {experiences.length ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {experiences.map((exp, index) => (
                    <div
                      key={`${exp.company}-${exp.role}-${index}`}
                      className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 text-xs shadow-sm"
                    >
                      <div className="font-semibold text-sm">{exp.role}</div>
                      <div className="text-muted-foreground">
                        {exp.company}
                        {exp.location ? ` · ${exp.location}` : ""}
                      </div>
                      <div className="text-muted-foreground">
                        {exp.startMonth || "--"} -
                        {exp.isCurrent ? " Present" : ` ${exp.endMonth || "--"}`}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="mt-2 h-7 rounded-full px-3 text-xs"
                        onClick={() =>
                          setExperiences((prev) =>
                            prev.filter((_, i) => i !== index)
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.4)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Projects</div>
                  <div className="text-xs text-muted-foreground">
                    Showcase notable work.
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-full">
                  Optional
                </Badge>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground">Title</div>
                  <Input
                    className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                    value={projectDraft.title}
                    onChange={(e) =>
                      setProjectDraft((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="Resume Screening Tool"
                  />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Dates</div>
                  <Input
                    className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                    value={projectDraft.dates}
                    onChange={(e) =>
                      setProjectDraft((prev) => ({
                        ...prev,
                        dates: e.target.value,
                      }))
                    }
                    placeholder="Jan 2025 - May 2025"
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground">Tech stack</div>
                  <Input
                    className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                    value={projectDraft.techStack}
                    onChange={(e) =>
                      setProjectDraft((prev) => ({
                        ...prev,
                        techStack: e.target.value,
                      }))
                    }
                    placeholder="Python, NLP, LLMs"
                  />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Link</div>
                  <Input
                    className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                    value={projectDraft.link}
                    onChange={(e) =>
                      setProjectDraft((prev) => ({
                        ...prev,
                        link: e.target.value,
                      }))
                    }
                    placeholder="https://project.com"
                  />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm text-muted-foreground">Highlights</div>
                <Textarea
                  className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                  value={projectDraft.bullets}
                  onChange={(e) =>
                    setProjectDraft((prev) => ({
                      ...prev,
                      bullets: e.target.value,
                    }))
                  }
                  placeholder="One achievement per line"
                />
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={addProject}
                >
                  Add project
                </Button>
              </div>
              {projects.length ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {projects.map((proj, index) => (
                    <div
                      key={`${proj.title}-${index}`}
                      className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 text-xs shadow-sm"
                    >
                      <div className="font-semibold text-sm">{proj.title}</div>
                      <div className="text-muted-foreground">
                        {proj.dates || "Dates not set"}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="mt-2 h-7 rounded-full px-3 text-xs"
                        onClick={() =>
                          setProjects((prev) => prev.filter((_, i) => i !== index))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.4)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Capabilities</div>
                  <div className="text-xs text-muted-foreground">
                    Group skills into categories.
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-full">
                  Optional
                </Badge>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground">Category</div>
                  <Input
                    className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                    value={technologyDraft.category}
                    onChange={(e) =>
                      setTechnologyDraft((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                    placeholder="Languages"
                  />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Items</div>
                  <Input
                    className="mt-2 rounded-2xl border-slate-200 bg-white/90 shadow-sm focus-visible:ring-slate-400"
                    value={technologyDraft.items}
                    onChange={(e) =>
                      setTechnologyDraft((prev) => ({
                        ...prev,
                        items: e.target.value,
                      }))
                    }
                    placeholder="Python, JavaScript, SQL"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={addTechnology}
                >
                  Add category
                </Button>
              </div>
              {technologies.length ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {technologies.map((tech, index) => (
                    <div
                      key={`${tech.category}-${index}`}
                      className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 text-xs shadow-sm"
                    >
                      <div className="font-semibold text-sm">{tech.category}</div>
                      <div className="text-muted-foreground">{tech.items}</div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="mt-2 h-7 rounded-full px-3 text-xs"
                        onClick={() =>
                          setTechnologies((prev) =>
                            prev.filter((_, i) => i !== index)
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                className="rounded-2xl"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button className="rounded-2xl" onClick={onSubmit} disabled={loading}>
                {loading ? "Creating..." : "Create candidate"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


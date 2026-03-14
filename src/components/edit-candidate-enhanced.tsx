'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type CandidateShape = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  currentTitle: string | null;
  yearsOfExperience: number | null;
  notes: string | null;
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

export function EditCandidateEnhanced({
  orgId,
  candidate,
}: {
  orgId: string;
  candidate: CandidateShape;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');

  // Personal
  const [fullName, setFullName] = useState(candidate.fullName ?? '');
  const [email, setEmail] = useState(candidate.email ?? '');
  const [phone, setPhone] = useState(candidate.phone ?? '');
  const [location, setLocation] = useState(candidate.location ?? '');
  const [currentTitle, setCurrentTitle] = useState(candidate.currentTitle ?? '');
  const [yearsOfExperience, setYearsOfExperience] = useState(candidate.yearsOfExperience?.toString() ?? '');
  const [notes, setNotes] = useState(candidate.notes ?? '');

  // Experience form
  const [expCompany, setExpCompany] = useState('');
  const [expRole, setExpRole] = useState('');
  const [expLocation, setExpLocation] = useState('');
  const [expStart, setExpStart] = useState('');
  const [expEnd, setExpEnd] = useState('');
  const [expCurrent, setExpCurrent] = useState(false);
  const [expBullets, setExpBullets] = useState('');
  const [editingExperienceId, setEditingExperienceId] = useState<string | null>(null);

  // Education form
  const [eduSchool, setEduSchool] = useState('');
  const [eduDegree, setEduDegree] = useState('');
  const [eduLocation, setEduLocation] = useState('');
  const [eduStart, setEduStart] = useState('');
  const [eduEnd, setEduEnd] = useState('');
  const [editingEducationId, setEditingEducationId] = useState<string | null>(null);

  // Project form
  const [projTitle, setProjTitle] = useState('');
  const [projDates, setProjDates] = useState('');
  const [projTech, setProjTech] = useState('');
  const [projLink, setProjLink] = useState('');
  const [projBullets, setProjBullets] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  // Skill form
  const [skillName, setSkillName] = useState('');
  const [showAllSkills, setShowAllSkills] = useState(false);
  const skillsPreviewCount = 4;

  function toInputDate(value?: string | Date | null) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }

  async function updatePersonal() {
    if (!fullName.trim()) {
      toast.error('Full name is required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/${candidate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email: email.trim() || null,
          phone: phone.trim() || null,
          location: location.trim() || null,
          currentTitle: currentTitle.trim() || null,
          yearsOfExperience: yearsOfExperience.trim() ? Number(yearsOfExperience) : null,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to update');

      toast.success('Personal info updated');
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function addExperience() {
    if (!expCompany || !expRole || !expStart) {
      toast.error('Company, role, and start date required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/${candidate.id}/experience`, {
        method: editingExperienceId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingExperienceId || undefined,
          company: expCompany,
          role: expRole,
          location: expLocation || undefined,
          startMonth: new Date(expStart).toISOString(),
          endMonth: expCurrent ? null : expEnd ? new Date(expEnd).toISOString() : null,
          isCurrent: expCurrent,
          bullets: expBullets.split('\n').filter(b => b.trim()),
        }),
      });

      if (!res.ok) throw new Error('Failed to save experience');

      toast.success(editingExperienceId ? 'Experience updated' : 'Experience added');
      setExpCompany('');
      setExpRole('');
      setExpLocation('');
      setExpStart('');
      setExpEnd('');
      setExpCurrent(false);
      setExpBullets('');
      setEditingExperienceId(null);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function addEducation() {
    if (!eduSchool) {
      toast.error('School name required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/${candidate.id}/education`, {
        method: editingEducationId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingEducationId || undefined,
          school: eduSchool,
          degree: eduDegree || undefined,
          location: eduLocation || undefined,
          startYear: eduStart ? parseInt(eduStart) : undefined,
          endYear: eduEnd ? parseInt(eduEnd) : undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to save education');

      toast.success(editingEducationId ? 'Education updated' : 'Education added');
      setEduSchool('');
      setEduDegree('');
      setEduLocation('');
      setEduStart('');
      setEduEnd('');
      setEditingEducationId(null);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function addProject() {
    if (!projTitle) {
      toast.error('Project title required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/${candidate.id}/projects`, {
        method: editingProjectId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingProjectId || undefined,
          title: projTitle,
          dates: projDates || undefined,
          techStack: projTech || undefined,
          link: projLink || undefined,
          bullets: projBullets.split('\n').filter(b => b.trim()),
        }),
      });

      if (!res.ok) throw new Error('Failed to save project');

      toast.success(editingProjectId ? 'Project updated' : 'Project added');
      setProjTitle('');
      setProjDates('');
      setProjTech('');
      setProjLink('');
      setProjBullets('');
      setEditingProjectId(null);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function addSkill() {
    if (!skillName.trim()) {
      toast.error('Skill name required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/${candidate.id}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: skillName.trim() }),
      });

      if (!res.ok) throw new Error('Failed to add skill');

      toast.success('Skill added');
      setSkillName('');
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function deleteSkill(name: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/${candidate.id}/skills`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to delete skill');
      toast.success('Skill removed');
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function deleteExperience(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/${candidate.id}/experience`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to delete experience');
      toast.success('Experience removed');
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function deleteEducation(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/${candidate.id}/education`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to delete education');
      toast.success('Education removed');
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function deleteProject(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/${candidate.id}/projects`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to delete project');
      toast.success('Project removed');
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Something went wrong');
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

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto inner-scroll rounded-3xl border border-slate-200/80 shadow-2xl">
        <DialogHeader>
          <DialogTitle>Edit Candidate Profile</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="experience">Experience</TabsTrigger>
            <TabsTrigger value="education">Education</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4">
            <div>
              <Label>Full Name *</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Current Title</Label>
                <Input value={currentTitle} onChange={(e) => setCurrentTitle(e.target.value)} />
              </div>
              <div>
                <Label>Years of Experience</Label>
                <Input type="number" value={yearsOfExperience} onChange={(e) => setYearsOfExperience(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
            <div className="flex justify-end">
              <Button onClick={updatePersonal} disabled={loading}>
                Save Personal Info
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="experience" className="space-y-4">
            {candidate.experiences?.length ? (
              <div className="space-y-2">
                {candidate.experiences.map((exp) => (
                  <div key={exp.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{exp.role} @ {exp.company}</div>
                        <div className="text-xs text-muted-foreground">
                          {toInputDate(exp.startMonth)} - {exp.isCurrent ? 'Present' : toInputDate(exp.endMonth)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingExperienceId(exp.id);
                            setExpCompany(exp.company);
                            setExpRole(exp.role);
                            setExpLocation(exp.location ?? '');
                            setExpStart(toInputDate(exp.startMonth));
                            setExpEnd(toInputDate(exp.endMonth));
                            setExpCurrent(exp.isCurrent);
                            setExpBullets(exp.bullets?.join('\n') ?? '');
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteExperience(exp.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Company *</Label>
                <Input value={expCompany} onChange={(e) => setExpCompany(e.target.value)} />
              </div>
              <div>
                <Label>Role *</Label>
                <Input value={expRole} onChange={(e) => setExpRole(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Location</Label>
              <Input value={expLocation} onChange={(e) => setExpLocation(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date *</Label>
                <Input type="date" value={expStart} onChange={(e) => setExpStart(e.target.value)} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={expEnd} onChange={(e) => setExpEnd(e.target.value)} disabled={expCurrent} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={expCurrent} onChange={(e) => setExpCurrent(e.target.checked)} />
              <Label>Currently working here</Label>
            </div>
            <div>
              <Label>Responsibilities (one per line)</Label>
              <Textarea value={expBullets} onChange={(e) => setExpBullets(e.target.value)} rows={4} />
            </div>
            <div className="flex justify-end">
              <Button onClick={addExperience} disabled={loading}>
                <Plus className="h-4 w-4 mr-2" /> {editingExperienceId ? 'Update Experience' : 'Add Experience'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="education" className="space-y-4">
            {candidate.educations?.length ? (
              <div className="space-y-2">
                {candidate.educations.map((edu) => (
                  <div key={edu.id} className="rounded-2xl border bg-white/70 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{edu.degree ?? 'Degree'} • {edu.school}</div>
                        <div className="text-xs text-muted-foreground">
                          {edu.startYear ?? ''}{edu.endYear ? ` - ${edu.endYear}` : ''}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setEditingEducationId(edu.id);
                                setEduSchool(edu.school);
                                setEduDegree(edu.degree ?? '');
                                setEduLocation(edu.location ?? '');
                                setEduStart(edu.startYear?.toString() ?? '');
                                setEduEnd(edu.endYear?.toString() ?? '');
                              }}
                              aria-label="Edit education"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => deleteEducation(edu.id)}
                              aria-label="Delete education"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {editingEducationId ? (
              <div className="rounded-2xl border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Editing education entry. Update the fields below and click “Update Education”.
              </div>
            ) : null}
            <div>
              <Label>School *</Label>
              <Input value={eduSchool} onChange={(e) => setEduSchool(e.target.value)} />
            </div>
            <div>
              <Label>Degree</Label>
              <Input value={eduDegree} onChange={(e) => setEduDegree(e.target.value)} />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={eduLocation} onChange={(e) => setEduLocation(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Year</Label>
                <Input type="number" value={eduStart} onChange={(e) => setEduStart(e.target.value)} />
              </div>
              <div>
                <Label>End Year</Label>
                <Input type="number" value={eduEnd} onChange={(e) => setEduEnd(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={addEducation} disabled={loading}>
                <Plus className="h-4 w-4 mr-2" /> {editingEducationId ? 'Update Education' : 'Add Education'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="skills" className="space-y-4">
            {candidate.skills?.length ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(showAllSkills ? candidate.skills : candidate.skills.slice(0, skillsPreviewCount)).map((s) => (
                  <span key={s.skill.name} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs">
                    {s.skill.name}
                    <button type="button" onClick={() => deleteSkill(s.skill.name)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
                </div>
                {candidate.skills.length > skillsPreviewCount ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-slate-600 hover:text-slate-900"
                    onClick={() => setShowAllSkills((prev) => !prev)}
                  >
                    {showAllSkills
                      ? "Show fewer skills"
                      : `Show ${candidate.skills.length - skillsPreviewCount} more skills`}
                  </button>
                ) : null}
              </div>
            ) : null}
            <div>
              <Label>Skill Name *</Label>
              <Input 
                value={skillName} 
                onChange={(e) => setSkillName(e.target.value)} 
                placeholder="React, Project Management, Sales..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill();
                  }
                }}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={addSkill} disabled={loading}>
                <Plus className="h-4 w-4 mr-2" /> Add Skill
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            {candidate.projects?.length ? (
              <div className="space-y-2">
                {candidate.projects.map((project) => (
                  <div key={project.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{project.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {project.dates ?? ''}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingProjectId(project.id);
                            setProjTitle(project.title);
                            setProjDates(project.dates ?? '');
                            setProjTech(project.techStack ?? '');
                            setProjLink(project.link ?? '');
                            setProjBullets(project.bullets?.join('\n') ?? '');
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteProject(project.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div>
              <Label>Project Title *</Label>
              <Input value={projTitle} onChange={(e) => setProjTitle(e.target.value)} />
            </div>
            <div>
              <Label>Dates</Label>
              <Input value={projDates} onChange={(e) => setProjDates(e.target.value)} />
            </div>
            <div>
              <Label>Tech Stack</Label>
              <Input value={projTech} onChange={(e) => setProjTech(e.target.value)} />
            </div>
            <div>
              <Label>Link</Label>
              <Input value={projLink} onChange={(e) => setProjLink(e.target.value)} />
            </div>
            <div>
              <Label>Bullets (one per line)</Label>
              <Textarea value={projBullets} onChange={(e) => setProjBullets(e.target.value)} rows={4} />
            </div>
            <div className="flex justify-end">
              <Button onClick={addProject} disabled={loading}>
                <Plus className="h-4 w-4 mr-2" /> {editingProjectId ? 'Update Project' : 'Add Project'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}


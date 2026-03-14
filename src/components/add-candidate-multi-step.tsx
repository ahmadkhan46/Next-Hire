'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, ArrowRight, ArrowLeft, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const STEPS = ['Personal', 'Experience', 'Education', 'Skills', 'Projects'];

export function AddCandidateMultiStep({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Personal Info
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [currentTitle, setCurrentTitle] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');

  // Experience
  const [experiences, setExperiences] = useState<any[]>([]);
  const [expCompany, setExpCompany] = useState('');
  const [expRole, setExpRole] = useState('');
  const [expLocation, setExpLocation] = useState('');
  const [expStart, setExpStart] = useState('');
  const [expEnd, setExpEnd] = useState('');
  const [expCurrent, setExpCurrent] = useState(false);
  const [expBullets, setExpBullets] = useState('');

  // Education
  const [educations, setEducations] = useState<any[]>([]);
  const [eduSchool, setEduSchool] = useState('');
  const [eduDegree, setEduDegree] = useState('');
  const [eduLocation, setEduLocation] = useState('');
  const [eduStart, setEduStart] = useState('');
  const [eduEnd, setEduEnd] = useState('');

  // Skills
  const [skills, setSkills] = useState('');

  // Projects
  const [projects, setProjects] = useState<any[]>([]);
  const [projTitle, setProjTitle] = useState('');
  const [projDates, setProjDates] = useState('');
  const [projTech, setProjTech] = useState('');
  const [projLink, setProjLink] = useState('');
  const [projBullets, setProjBullets] = useState('');

  const resetForm = () => {
    setStep(0);
    setFullName('');
    setEmail('');
    setPhone('');
    setLocation('');
    setCurrentTitle('');
    setYearsOfExperience('');
    setExperiences([]);
    setEducations([]);
    setSkills('');
    setProjects([]);
  };

  const handleNext = () => {
    if (step === 0) {
      if (!fullName.trim()) {
        toast.error('Name is required');
        return;
      }
      if (!email.trim()) {
        toast.error('Email is required');
        return;
      }
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email.trim())) {
        toast.error('Please enter a valid email');
        return;
      }
      setStep(1);
    } else if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  };

  const addExperience = () => {
    if (!expCompany || !expRole || !expStart) {
      toast.error('Company, role, and start date required');
      return;
    }
    setExperiences([...experiences, {
      company: expCompany,
      role: expRole,
      location: expLocation,
      startMonth: expStart,
      endMonth: expCurrent ? null : expEnd,
      isCurrent: expCurrent,
      bullets: expBullets.split('\n').filter(b => b.trim()),
    }]);
    setExpCompany('');
    setExpRole('');
    setExpLocation('');
    setExpStart('');
    setExpEnd('');
    setExpCurrent(false);
    setExpBullets('');
    toast.success('Experience added');
  };

  const addEducation = () => {
    if (!eduSchool) {
      toast.error('School name required');
      return;
    }
    setEducations([...educations, {
      school: eduSchool,
      degree: eduDegree,
      location: eduLocation,
      startYear: eduStart ? parseInt(eduStart) : undefined,
      endYear: eduEnd ? parseInt(eduEnd) : undefined,
    }]);
    setEduSchool('');
    setEduDegree('');
    setEduLocation('');
    setEduStart('');
    setEduEnd('');
    toast.success('Education added');
  };

  const addProject = () => {
    if (!projTitle) {
      toast.error('Project title required');
      return;
    }
    setProjects([...projects, {
      title: projTitle,
      dates: projDates,
      techStack: projTech,
      link: projLink,
      bullets: projBullets.split('\n').filter(b => b.trim()),
    }]);
    setProjTitle('');
    setProjDates('');
    setProjTech('');
    setProjLink('');
    setProjBullets('');
    toast.success('Project added');
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      // 1. Create candidate
      const candidateRes = await fetch(`/api/orgs/${orgId}/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone || undefined,
          location: location || undefined,
          currentTitle: currentTitle || undefined,
          yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience) : undefined,
        }),
      });

      if (!candidateRes.ok) throw new Error('Failed to create candidate');

      const { id: newCandidateId } = await candidateRes.json();

      // 2. Save experiences
      for (const exp of experiences) {
        await fetch(`/api/orgs/${orgId}/candidates/${newCandidateId}/experience`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(exp),
        });
      }

      // 3. Save educations
      for (const edu of educations) {
        await fetch(`/api/orgs/${orgId}/candidates/${newCandidateId}/education`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(edu),
        });
      }

      // 4. Save projects
      for (const proj of projects) {
        await fetch(`/api/orgs/${orgId}/candidates/${newCandidateId}/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(proj),
        });
      }

      // 5. Save skills
      if (skills.trim()) {
        const skillList = skills.split(',').map(s => s.trim()).filter(Boolean);
        for (const skillName of skillList) {
          await fetch(`/api/orgs/${orgId}/candidates/${newCandidateId}/skills`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: skillName }),
          });
        }
      }

      // 6. Trigger auto-matching after all data is added
      await fetch(`/api/orgs/${orgId}/auto-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: newCandidateId }),
      });

      toast.success('Candidate created successfully!');
      setOpen(false);
      resetForm();
      router.push(`/orgs/${orgId}/candidates/${newCandidateId}`);
      router.refresh();
    } catch {
      toast.error('Failed to create candidate');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button className="rounded-2xl">
          <Plus className="h-4 w-4" /> Add Candidate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto inner-scroll rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Add Candidate - {STEPS[step]}</DialogTitle>
          <div className="flex gap-2 mt-4">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full transition-all ${
                  i <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === 0 && (
            <>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Full Name *</Label>
                  <Input className="mt-2 rounded-2xl" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Email *</Label>
                    <Input className="mt-2 rounded-2xl" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Phone (optional)</Label>
                    <Input className="mt-2 rounded-2xl" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="555-1234" />
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Location</Label>
                  <Input className="mt-2 rounded-2xl" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="San Francisco, CA" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Current Title</Label>
                    <Input className="mt-2 rounded-2xl" value={currentTitle} onChange={(e) => setCurrentTitle(e.target.value)} placeholder="Senior Developer" />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Years of Experience</Label>
                    <Input className="mt-2 rounded-2xl" type="number" value={yearsOfExperience} onChange={(e) => setYearsOfExperience(e.target.value)} placeholder="5" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button className="rounded-2xl" onClick={handleNext} disabled={loading}>
                  Next <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-3 mb-4">
                {experiences.map((exp, i) => (
                  <div key={i} className="premium-subblock rounded-2xl border bg-background/40 p-4 flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{exp.role} at {exp.company}</div>
                      <div className="text-sm text-muted-foreground">{exp.startMonth} - {exp.isCurrent ? 'Present' : exp.endMonth}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExperiences(experiences.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
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
                <Textarea value={expBullets} onChange={(e) => setExpBullets(e.target.value)} rows={3} />
              </div>
              <Button onClick={addExperience} variant="outline" size="sm" className="rounded-2xl">
                <Plus className="h-4 w-4 mr-2" /> Add Experience
              </Button>
              <div className="flex justify-between pt-4">
                <Button variant="outline" className="rounded-2xl" onClick={() => setStep(0)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-2xl" onClick={handleSkip}>
                    Skip
                  </Button>
                  <Button className="rounded-2xl" onClick={() => setStep(2)}>
                    Next <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-3 mb-4">
                {educations.map((edu, i) => (
                  <div key={i} className="premium-subblock rounded-2xl border bg-background/40 p-4 flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{edu.degree || 'Degree'}</div>
                      <div className="text-sm text-muted-foreground">{edu.school}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEducations(educations.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
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
              <Button onClick={addEducation} variant="outline" size="sm" className="rounded-2xl">
                <Plus className="h-4 w-4 mr-2" /> Add Education
              </Button>
              <div className="flex justify-between pt-4">
                <Button variant="outline" className="rounded-2xl" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-2xl" onClick={handleSkip}>
                    Skip
                  </Button>
                  <Button className="rounded-2xl" onClick={() => setStep(3)}>
                    Next <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <Label>Skills (comma-separated)</Label>
                <Textarea
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="React, Node.js, Python, AWS..."
                  rows={4}
                />
              </div>
              <div className="flex justify-between pt-4">
                <Button variant="outline" className="rounded-2xl" onClick={() => setStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-2xl" onClick={handleSkip}>
                    Skip
                  </Button>
                  <Button className="rounded-2xl" onClick={() => setStep(4)}>
                    Next <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="space-y-3 mb-4">
                {projects.map((proj, i) => (
                  <div key={i} className="premium-subblock rounded-2xl border bg-background/40 p-4 flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{proj.title}</div>
                      <div className="text-sm text-muted-foreground">{proj.techStack}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setProjects(projects.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <div>
                <Label>Project Title *</Label>
                <Input value={projTitle} onChange={(e) => setProjTitle(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Dates</Label>
                  <Input value={projDates} onChange={(e) => setProjDates(e.target.value)} placeholder="2023 - Present" />
                </div>
                <div>
                  <Label>Tech Stack</Label>
                  <Input value={projTech} onChange={(e) => setProjTech(e.target.value)} placeholder="React, Node.js" />
                </div>
              </div>
              <div>
                <Label>Link</Label>
                <Input type="url" value={projLink} onChange={(e) => setProjLink(e.target.value)} />
              </div>
              <div>
                <Label>Description (one per line)</Label>
                <Textarea value={projBullets} onChange={(e) => setProjBullets(e.target.value)} rows={3} />
              </div>
              <Button onClick={addProject} variant="outline" size="sm" className="rounded-2xl">
                <Plus className="h-4 w-4 mr-2" /> Add Project
              </Button>
              <div className="flex justify-between pt-4">
                <Button variant="outline" className="rounded-2xl" onClick={() => setStep(3)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-2xl" onClick={handleFinish} disabled={loading}>
                    Skip & Finish
                  </Button>
                  <Button className="rounded-2xl" onClick={handleFinish} disabled={loading}>
                    <Check className="h-4 w-4 mr-2" /> Finish
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


import { type CandidateProfileExtract } from "@/lib/resume-extract-schema";

function toMonthDate(input: { year: number; month: number } | null) {
  if (!input) return null;
  const { year, month } = input;
  return new Date(Date.UTC(year, month - 1, 1));
}

function normalizeArray(items: string[] | null | undefined) {
  return Array.from(
    new Set(
      (items ?? [])
        .map((s) => String(s).trim())
        .filter((s) => s.length > 0)
    )
  );
}

function normalizeEmail(email?: string | null) {
  return email ? email.toLowerCase().trim() : null;
}

function normalizePhone(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits || null;
}

export function buildCandidateUpdate(extract: CandidateProfileExtract) {
  const updateCandidate: Record<string, unknown> = {};
  const personal = extract.personal ?? {};

  if (personal.fullName) updateCandidate.fullName = personal.fullName;
  if (personal.email) updateCandidate.email = normalizeEmail(personal.email);
  if (personal.phone) updateCandidate.phone = normalizePhone(personal.phone);
  if (personal.location) updateCandidate.location = personal.location;
  if (personal.currentTitle) updateCandidate.currentTitle = personal.currentTitle;
  if (personal.yearsOfExperience !== null && personal.yearsOfExperience !== undefined) {
    updateCandidate.yearsOfExperience = personal.yearsOfExperience;
  }
  if (personal.notes) updateCandidate.notes = personal.notes;

  const educations = (extract.educations ?? [])
    .map((edu) => ({
      school: edu.school ?? null,
      degree: edu.degree ?? null,
      location: edu.location ?? null,
      startYear: edu.startYear ?? null,
      endYear: edu.endYear ?? null,
    }))
    .filter((edu) => !!edu.school && edu.school.trim().length > 0)
    .map((edu) => ({
      ...edu,
      school: edu.school!.trim(),
    }));

  const primaryEducation =
    educations
      .slice()
      .sort((a, b) => {
        const aEnd = a.endYear ?? a.startYear ?? 0;
        const bEnd = b.endYear ?? b.startYear ?? 0;
        return bEnd - aEnd;
      })[0] ?? null;

  if (primaryEducation) {
    updateCandidate.educationSchool = primaryEducation.school;
    if (primaryEducation.degree) updateCandidate.educationDegree = primaryEducation.degree;
    if (primaryEducation.endYear ?? primaryEducation.startYear) {
      updateCandidate.educationYear = primaryEducation.endYear ?? primaryEducation.startYear;
    }
  } else if (personal.education) {
    if (personal.education.school) updateCandidate.educationSchool = personal.education.school;
    if (personal.education.degree) updateCandidate.educationDegree = personal.education.degree;
    if (personal.education.year !== null && personal.education.year !== undefined) {
      updateCandidate.educationYear = personal.education.year;
    }
  }

  const experiences = (extract.experiences ?? [])
    .map((exp) => {
      const start = toMonthDate(exp.start ?? null);
      if (!start) return null;
      const end = exp.isCurrent ? null : toMonthDate(exp.end ?? null);
      return {
        company: exp.company,
        role: exp.role,
        location: exp.location ?? null,
        startMonth: start,
        endMonth: end,
        isCurrent: exp.isCurrent,
        bullets: normalizeArray(exp.bullets),
      };
    })
    .filter(Boolean) as Array<{
    company: string;
    role: string;
    location: string | null;
    startMonth: Date;
    endMonth: Date | null;
    isCurrent: boolean;
    bullets: string[];
  }>;

  const projects = (extract.projects ?? []).map((project) => ({
    title: project.title,
    dates: project.dates ?? null,
    techStack: project.techStack ?? null,
    link: project.link ?? null,
    bullets: normalizeArray(project.bullets),
  }));

  const technologies = (extract.technologies ?? []).map((tech) => ({
    category: String(tech.category || "").trim().toUpperCase(),
    items: normalizeArray(tech.items),
  }));

  const skills = normalizeArray(extract.skillsFlat);

  return { updateCandidate, experiences, projects, technologies, skills, educations };
}

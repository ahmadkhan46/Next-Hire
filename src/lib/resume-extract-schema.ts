import { z } from "zod";

const monthSchema = z.number().int().min(1).max(12);
const yearSchema = z.number().int().min(1900).max(2100);

const monthYearSchema = z.object({
  year: yearSchema,
  month: monthSchema,
});

export const candidateProfileExtractSchema = z.object({
  personal: z.object({
    fullName: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    location: z.string().nullable(),
    currentTitle: z.string().nullable(),
    yearsOfExperience: z.number().int().nonnegative().nullable(),
    notes: z.string().nullable(),
    education: z
      .object({
        school: z.string().nullable(),
        degree: z.string().nullable(),
        year: yearSchema.nullable(),
      })
      .nullable(),
  }),
  educations: z.array(
    z.object({
      school: z.string().nullable(),
      degree: z.string().nullable(),
      location: z.string().nullable(),
      startYear: yearSchema.nullable(),
      endYear: yearSchema.nullable(),
    })
  ),
  skillsFlat: z.array(z.string()),
  technologies: z.array(
    z.object({
      category: z.string(),
      items: z.array(z.string()),
    })
  ),
  experiences: z.array(
    z.object({
      company: z.string(),
      role: z.string(),
      location: z.string().nullable(),
      start: monthYearSchema.nullable(),
      end: monthYearSchema.nullable(),
      isCurrent: z.boolean(),
      bullets: z.array(z.string()),
    })
  ),
  projects: z.array(
    z.object({
      title: z.string(),
      dates: z.string().nullable(),
      techStack: z.string().nullable(),
      link: z.string().nullable(),
      bullets: z.array(z.string()),
    })
  ),
});

export type CandidateProfileExtract = z.infer<typeof candidateProfileExtractSchema>;

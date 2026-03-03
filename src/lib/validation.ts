import { z } from 'zod';

// Candidate schemas
export const candidateCreateSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  dateOfBirth: z.string().datetime().optional().or(z.literal('')),
  location: z.string().max(200).optional(),
  currentTitle: z.string().max(200).optional(),
  yearsOfExperience: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(5000).optional(),
});

export const candidateImportSchema = z.object({
  targetJobId: z.string().cuid().optional().or(z.literal('')),
  candidates: z.array(
    z.object({
      fullName: z.string().min(1).max(200),
      externalId: z.string().max(100).optional().or(z.literal('')),
      email: z.string().email(),
      phone: z.string().max(50).optional().or(z.literal('')),
      dateOfBirth: z.string().datetime().optional().or(z.literal('')),
      location: z.string().max(200).optional().or(z.literal('')),
      currentTitle: z.string().max(200).optional().or(z.literal('')),
      yearsOfExperience: z.number().int().min(0).max(100).optional(),
      linkedinUrl: z.string().url().optional().or(z.literal('')),
      githubUrl: z.string().url().optional().or(z.literal('')),
      portfolioUrl: z.string().url().optional().or(z.literal('')),
      status: z.enum(['ACTIVE', 'ARCHIVED', 'BLACKLISTED', 'HIRED', 'WITHDRAWN']).optional(),
      source: z.enum(['MANUAL', 'IMPORT', 'REFERRAL', 'LINKEDIN', 'AGENCY', 'CAREER_SITE', 'JOB_BOARD']).optional(),
      notes: z.string().max(5000).optional().or(z.literal('')),
      skills: z.array(z.string().max(100)).max(50).optional(),
      resumeText: z.string().max(50000).optional().or(z.literal('')),
      // Education
      educationSchool: z.string().max(200).optional().or(z.literal('')),
      educationDegree: z.string().max(200).optional().or(z.literal('')),
      educationYear: z.number().int().min(1900).max(2100).optional(),
      // Experience 1
      experience1Company: z.string().max(200).optional().or(z.literal('')),
      experience1Role: z.string().max(200).optional().or(z.literal('')),
      experience1StartMonth: z.string().optional().or(z.literal('')),
      experience1EndMonth: z.string().optional().or(z.literal('')),
      experience1Location: z.string().max(200).optional().or(z.literal('')),
      experience1Bullets: z.string().max(5000).optional().or(z.literal('')),
      // Experience 2
      experience2Company: z.string().max(200).optional().or(z.literal('')),
      experience2Role: z.string().max(200).optional().or(z.literal('')),
      experience2StartMonth: z.string().optional().or(z.literal('')),
      experience2EndMonth: z.string().optional().or(z.literal('')),
      experience2Location: z.string().max(200).optional().or(z.literal('')),
      experience2Bullets: z.string().max(5000).optional().or(z.literal('')),
      // Project 1
      project1Title: z.string().max(200).optional().or(z.literal('')),
      project1Dates: z.string().max(100).optional().or(z.literal('')),
      project1TechStack: z.string().max(500).optional().or(z.literal('')),
      project1Link: z.string().url().optional().or(z.literal('')),
      project1Bullets: z.string().max(5000).optional().or(z.literal('')),
      // Project 2
      project2Title: z.string().max(200).optional().or(z.literal('')),
      project2Dates: z.string().max(100).optional().or(z.literal('')),
      project2TechStack: z.string().max(500).optional().or(z.literal('')),
      project2Link: z.string().url().optional().or(z.literal('')),
      project2Bullets: z.string().max(5000).optional().or(z.literal('')),
    })
  ).min(1).max(100),
});

// Job schemas
export const jobCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional(),
  location: z.string().max(200).optional(),
  status: z.enum(['OPEN', 'CLOSED', 'DRAFT']).default('OPEN'),
});

export const jobSkillSchema = z.object({
  skillId: z.string().cuid(),
  weight: z.number().int().min(1).max(5).optional(),
});

// Skill schemas
export const skillCreateSchema = z.object({
  name: z.string().min(1).max(100),
});

// Match status schemas
export const matchStatusUpdateSchema = z.object({
  status: z.enum(['NONE', 'SHORTLISTED', 'REJECTED']),
  note: z.string().min(5).max(1000).optional(),
});

export const bulkStatusUpdateSchema = z.object({
  candidateIds: z.array(z.string().cuid()).min(1).max(50),
  status: z.enum(['NONE', 'SHORTLISTED', 'REJECTED']),
  note: z.string().min(5).max(1000).optional(),
});

// Resume upload schema
export const resumeUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().regex(/^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/plain)$/),
  sizeBytes: z.number().int().min(1).max(10485760), // Max 10MB
  rawText: z.string().min(10).max(100000),
});

// Query params validation
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// Helper to validate and parse
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

// Helper for safe validation (returns error instead of throwing)
export function safeValidateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

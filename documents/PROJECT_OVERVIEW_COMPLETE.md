# NextHire Project Overview (Single-File Reference)

## 1) What this project is

NextHire is an enterprise hiring platform built on Next.js that helps teams:
- Manage candidates and resumes
- Create jobs with weighted skills
- Run candidate-job matching
- Track decisions and audit events
- Operate in multi-tenant organizations with role-based access

The product includes both:
- A live org workspace (`/orgs/[orgId]/*`)
- A demo/read-only workspace (`/orgs/demo`)

## 2) Core outcomes for HR/recruiting teams

- Faster screening using weighted match scoring and critical gap detection
- Structured candidate data from resume parsing and enrichment
- Consistent hiring workflows with shortlist/reject/reset states
- Better governance via candidate timelines, job audit timelines, and decision logs
- Scalable ingestion via CSV import and bulk resume upload

## 3) Current tech stack

- Frontend: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- Auth: Clerk (`@clerk/nextjs`)
- Database: PostgreSQL + Prisma ORM
- Background processing: BullMQ/Redis mode or in-memory queue mode
- AI services: OpenAI (resume parsing + embeddings)
- Search: keyword + semantic search support
- Observability/utilities: Winston logging, validation/sanitization, rate limiting

## 4) Architecture summary

- App layer: `src/app` (UI pages + API routes)
- Domain logic: `src/lib` (matching, audit, security, parsing, queue, RBAC)
- Workers: `src/workers` (bulk import + resume parse pipelines)
- Data layer: Prisma models in `prisma/schema.prisma`

Multi-tenancy is enforced by organization-scoped routes and org membership checks.

## 5) Main product modules

### Candidate Management
- Candidate list/search/filter/sort
- Candidate profile with full sections:
  - personal info
  - skills
  - experience
  - education
  - projects
  - notes
  - tags
  - interviews
  - similar candidates
  - activity timeline
- CSV import and resume upload
- Candidate export

### Job Management
- Job create/edit/delete
- Location + work mode support (`REMOTE`, `ONSITE`, `HYBRID`, `OTHER`)
- Skills and weights management
- Optional skill generation from job description
- Job audit timeline

### Matchboard
- Job-based candidate ranking
- Score, missing skills, critical gaps
- Bulk actions:
  - shortlist by threshold
  - reject by critical gaps
  - reset statuses
- Decision logging and rerun support

### Intelligence and Analytics
- Org analytics and operational metrics
- LLM usage analytics endpoints
- Search + semantic search APIs

### Notifications
- Notification feed
- Mark single or all as read

## 6) AI/ML usage (OpenAI)

OpenAI key is used for:
- Resume parsing (`src/lib/resume-llm.ts`)
- Embeddings (`src/lib/embeddings.ts`)

Job skill generation from description currently uses an internal taxonomy-driven heuristic in:
- `src/lib/job-skill-generation.ts`

That means job skill generation can work without OpenAI, while resume LLM parsing cannot.

## 7) Inputs and outputs

### Inputs
- Manual candidate/job form data
- CSV files for candidate bulk import
- PDF/DOCX resumes for extraction/parsing
- Job descriptions for skill suggestion/generation

### Outputs
- Structured candidate records and resume entities
- Weighted job skills and generated suggestions
- Match scores and status decisions
- Candidate activity events + job audit events
- Analytics summaries and export files

## 8) Data model overview

From current Prisma schema:
- 24 models
- 12 enums

Key entities:
- `User`, `Organization`, `Membership`
- `Candidate`, `Resume`, `CandidateSkill`, `CandidateExperience`, `CandidateEducation`, `CandidateProject`, `CandidateTechnology`
- `Job`, `Skill`, `JobSkill`
- `MatchResult`, `MatchDecisionLog`
- `ResumeUploadBatch`, `ResumeUploadItem`
- `Notification`
- `CandidateActivity`, `CandidateNote`, `CandidateInterview`, `CandidateTag`
- `JobPageAuditEvent`, `JobSkillGenerationAudit`

## 9) API surface snapshot

Current route files: 58 (`src/app/api/**/route.ts`)

Primary API groups:
- `/api/orgs/my`
- `/api/orgs/[orgId]/candidates/*`
- `/api/orgs/[orgId]/jobs/*`
- `/api/orgs/[orgId]/auto-match`
- `/api/orgs/[orgId]/audit`
- `/api/orgs/[orgId]/analytics`
- `/api/orgs/[orgId]/notifications/*`
- `/api/orgs/[orgId]/search`
- `/api/orgs/[orgId]/semantic-search`
- `/api/orgs/[orgId]/skills/suggestions`
- `/api/orgs/[orgId]/ops/metrics`
- `/api/orgs/[orgId]/llm-analytics`

## 10) Security and controls

- Clerk authentication with server/client key validation guards
- RBAC via membership roles (`OWNER`, `ADMIN`, `MEMBER`)
- API middleware wrappers for auth/org checks and permission gating
- Input validation and sanitization utilities
- Rate limiting support (Upstash + safe fallbacks)
- Audit trail support for candidate and job-level actions

## 11) Environment and runtime behavior

### Localhost (`.env.local`)
- Uses your local values (local Postgres, local URLs, local Clerk test keys)
- Typical queue mode: `QUEUE_MODE=memory` (or Redis if configured)

### Vercel
- Does not read local `.env.local`
- Requires project Environment Variables in Vercel dashboard:
  - `DATABASE_URL` (remote DB, not localhost)
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
  - Optional OpenAI/Redis vars depending on enabled features

Recommended pattern:
- Keep one `.env.example` template in repo
- Keep real secrets only in:
  - local `.env.local` (developer machine)
  - Vercel Environment Variables (cloud)

## 12) Deployment notes

Pre-deploy checks exist:
- `npm run predeploy:check`

Useful scripts:
- `npm run build`
- `npm run smoke:test`
- `npm run db:health`
- `npx prisma migrate deploy` (production DB migration step)

## 13) Current repository quick stats

- API route files: 58
- App pages: 21
- Component files under `src/components`: 45
- Worker files: 4

## 14) File map for deeper reference

- Project architecture: `documents/ARCHITECTURE.md`
- API details: `documents/API_DOCUMENTATION.md`
- Platform docs: `documents/PLATFORM_DOCUMENTATION.md`
- Deployment precheck: `documents/DEPLOYMENT_PRECHECK_RUNBOOK.md`
- Existing long report: `documents/docs/COMPREHENSIVE_PROJECT_REPORT.md`

---

If you want, this file can be promoted as the canonical overview and we can auto-sync it during releases.

# NextHire — AI-Powered Talent Intelligence Platform

[![CI](https://github.com/ahmadkhan46/Next-Hire/actions/workflows/ci.yml/badge.svg)](https://github.com/ahmadkhan46/Next-Hire/actions/workflows/ci.yml)

**Live Website:** [https://next-hire-blush.vercel.app/](https://next-hire-blush.vercel.app/)

NextHire is a production-grade, AI-powered Applicant Tracking System (ATS) built for modern hiring teams. It automates the most time-consuming parts of recruiting — resume parsing, candidate scoring, skill extraction, and matching — so HR professionals can focus on making great hiring decisions rather than processing paperwork.

---

## What NextHire Does

Traditional ATS tools require HR teams to manually read hundreds of resumes, copy-paste candidate details, and subjectively rank applicants. NextHire replaces that workflow with intelligent automation:

- Upload a batch of resumes (PDF or DOCX) and get every candidate's skills, experience, and qualifications extracted instantly by AI
- Post a job with required skills and experience, and the system automatically scores every candidate against it
- See a ranked matchboard of candidates sorted by fit percentage, with one-click shortlisting
- Track every change to a job posting through a full audit timeline
- Search across all candidates and jobs in real time from the top bar

---

## Features & Functionalities

### Resume Upload & AI Parsing
HR teams can upload resumes in bulk (PDF or DOCX format). The system queues each file for background processing via BullMQ workers, then uses OpenAI GPT-4o-mini to extract:
- Candidate name, email, phone, and location
- Work experience (companies, roles, years of experience)
- Education history
- Skills and technologies
- Projects and achievements

Parsed candidates are stored immediately and ready for matching — no manual data entry required. Upload history is tracked per batch, including who uploaded, when, and how many files were processed.

### Candidate Management
A searchable, filterable directory of all candidates across the organization. HR teams can:
- View full candidate profiles with parsed resume data
- See match scores across multiple jobs
- Filter by skills, experience level, or match score
- View a candidate's complete history and status across all open roles
- Export candidate data to CSV or DOCX

### Job Management
Create and manage job postings with structured data:
- Title, department, location, and description
- Required skills (with a searchable skill taxonomy)
- Required years of experience
- AI-assisted skill generation — describe the role and NextHire suggests the relevant skills automatically

Each job has its own candidate matchboard, audit timeline, and workflow settings.

### AI Candidate Matching (Matchboard)
The core feature of NextHire. For any job, click "Re-run Matches" to score every candidate in the organization against the role. The scoring formula weighs:
- **60%** — Experience match (years of experience vs. required)
- **30%** — Skills match (candidate skills vs. required skills)
- **10%** — Projects and additional signals

Candidates below the required years of experience are hard-disqualified (score = 0). The matchboard displays:
- Each candidate's overall match percentage
- Individual experience, skills, and project sub-scores
- Filterable threshold slider (e.g., show only 80%+ matches)
- Status filters: All, Shortlisted, Rejected, In Review
- "Shortlist 80%+" button — instantly filters the view to high-fit candidates and bulk-shortlists them in one click
- Bulk status updates with notes

### Real-Time Search
A unified search bar in the top navigation searches across candidates (by name/email), jobs (by title/department), and internal pages simultaneously. Results appear as you type with a 250ms debounce. Keyboard shortcut **Ctrl+K** opens the full command palette for quick navigation anywhere in the app.

### Intelligence Dashboard
A dedicated analytics section giving hiring teams a high-level view of:
- Candidate pipeline metrics
- Job fill rates and match score distributions
- LLM usage and AI cost tracking per operation
- Skill gap analysis across open roles

### Job Audit Timeline
Every change to a job is recorded in an immutable audit trail:
- Job details updated (title, description, location)
- Skills added or removed
- AI skill generation events
- Candidate status changes with notes and timestamps

The timeline is visible per job and exportable as a report, giving hiring managers full visibility into how a role evolved over time.

### Notifications
An in-app notification bell alerts HR users to important events — new candidate uploads completed, match runs finished, and status changes — without needing to refresh or check manually.

### Export & Reporting
Export candidate lists and job reports to:
- **CSV** — for use in spreadsheets or other HR tools
- **DOCX** — formatted reports for sharing with hiring managers

Bulk export supports filtered views, so you can export just shortlisted candidates for a specific role.

### Duplicate Detection
When uploading resumes, NextHire automatically detects if a candidate already exists in the system (by email or name similarity) and flags duplicates rather than creating redundant profiles.

### Multi-Tenant Organization Support
NextHire supports multiple organizations (tenants) on a single deployment. Each organization has its own isolated candidates, jobs, settings, and data. Authentication is handled by Clerk, supporting secure sign-in and organization switching.

### Settings
Organization-level settings for:
- Workspace configuration
- Notification preferences
- Integration settings

### Demo Mode
A `/orgs/demo/` route provides a fully functional demo experience with static data — no database required — so stakeholders can explore the platform without creating an account.

---

## What HR Teams Can Achieve

| Task | Without NextHire | With NextHire |
|------|-----------------|---------------|
| Process 50 resumes | 4–6 hours of manual reading | Under 5 minutes (automated) |
| Find best-fit candidates | Subjective gut feeling | Ranked by objective match score |
| Shortlist for a role | Email threads and spreadsheets | One-click bulk shortlist from matchboard |
| Track job history | Notes scattered across tools | Complete audit timeline per job |
| Search for a candidate | Browse spreadsheet rows | Type and get instant results |
| Report to hiring manager | Manual report writing | One-click export to DOCX/CSV |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4, Radix UI (shadcn/ui), Framer Motion |
| Charts | Recharts |
| Database | PostgreSQL (Neon serverless), Prisma ORM v6, pgvector |
| AI / LLM | OpenAI GPT-4o-mini, Pinecone vector DB |
| Auth | Clerk (multi-tenant) |
| Background Jobs | BullMQ + ioredis |
| Rate Limiting | Upstash Redis |
| Deployment | Vercel |
| Testing | Vitest (unit), Playwright (e2e) |

---

## License

This project was built as part of a university academic project.

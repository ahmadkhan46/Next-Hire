# NextHire — Master Project Knowledge Document

> **This is the single source of truth for the entire NextHire project.**
> All documentation from every source is merged here.
> Use this file as: Claude project knowledge, AI agent briefing, video demo script, HR presentation reference.
> Last updated: 2026-07-05

---

## TABLE OF CONTENTS

1. [What Is NextHire?](#1-what-is-nexthire)
2. [How It Was Built — The Story](#2-how-it-was-built--the-story)
3. [Tech Stack — Every Technology Used](#3-tech-stack--every-technology-used)
4. [Architecture](#4-architecture)
5. [Authentication & Multi-Tenancy](#5-authentication--multi-tenancy)
6. [All Pages — Complete Reference](#6-all-pages--complete-reference)
7. [Data Model](#7-data-model)
8. [AI Pipelines](#8-ai-pipelines)
9. [Matching Algorithm — Deep Dive](#9-matching-algorithm--deep-dive)
10. [Skills Taxonomy](#10-skills-taxonomy)
11. [Candidate Identity & Duplicate Detection](#11-candidate-identity--duplicate-detection)
12. [CSV Import Guide](#12-csv-import-guide)
13. [Bulk Resume Upload](#13-bulk-resume-upload)
14. [API Reference](#14-api-reference)
15. [Security & Permissions](#15-security--permissions)
16. [Database Optimizations](#16-database-optimizations)
17. [Design System & UI Components](#17-design-system--ui-components)
18. [Development Setup & Commands](#18-development-setup--commands)
19. [Deployment Guide](#19-deployment-guide)
20. [Challenges Faced & How We Solved Them](#20-challenges-faced--how-we-solved-them)
21. [Enterprise Roadmap](#21-enterprise-roadmap)
22. [Environment Variables](#22-environment-variables)
23. [Video Walkthrough Script](#23-video-walkthrough-script)

---

## 1. What Is NextHire?

**NextHire is an AI-powered recruitment platform built for hiring teams and HR professionals.**

It transforms the hiring process from slow, manual resume screening into a fast, intelligent, audit-ready workflow. Instead of a recruiter spending days reading hundreds of resumes, NextHire does it in seconds — parsing each resume with a fine-tuned AI model, extracting skills and experience, then scoring every candidate against every job using a transparent weighted algorithm.

### Who Uses It
HR managers, recruiters, and hiring teams at companies of any size. They use it to:
- Post job openings and define required skills
- Build a candidate talent pool (manually, via CSV, or bulk resume upload)
- Let AI parse and categorize every resume
- Get an instant ranked leaderboard of best-fit candidates for any job
- Track shortlist and reject decisions with a full audit trail

### This is NOT a job-seeker app
NextHire is used BY companies TO find candidates — not by job seekers to find jobs.

### Creator
**Ahmad Khan** — Built this from scratch as a personal project using his own idea, design, and architecture.
- GitHub: AhmadKhan46
- Email: ahmadsaidkhan46@gmail.com
- GitHub Repo: https://github.com/ahmadkhan46/Next-Hire

### URLs
- Local dev: http://localhost:3000
- Deployed: Vercel (auto-deploys on push to `main` branch)

---

## 2. How It Was Built — The Story

NextHire was built entirely by Ahmad Khan from January 2025 onwards. Here is the honest story of how it was built, what decisions were made, and what challenges were encountered.

### Phase 1 — Core Foundation (Jan–Feb 2025)
Started with the core data model: Organizations, Candidates, Jobs, Skills, Matches. Built the Prisma schema first, then the API routes, then the UI. Used Clerk for auth from day one to avoid building auth from scratch.

### Phase 2 — AI Resume Parsing (Feb 2025)
Integrated OpenAI GPT-4o-mini for resume parsing. Built the text extraction pipeline (pdf-parse for PDFs, mammoth for DOCX). Created a structured output schema so the LLM returns clean JSON that maps directly to the database schema.

### Phase 3 — Matching Engine (Feb 2025)
Built the weighted skill matching algorithm from scratch — pure TypeScript, no ML library. The algorithm accounts for skill weight (critical vs nice-to-have), experience years, and project relevance. This became the core differentiator.

### Phase 4 — Fine-Tuned Local Models (Mar–Jun 2025)
Ahmad fine-tuned two custom Ollama models:
1. `apex-resume-qwen-3b:latest` — QLoRA fine-tune of Qwen2.5-3B on resume parsing. 1.9GB, runs on local RTX GPU. Zero cost, no rate limits. Replaced OpenAI as primary parser.
2. `apex-resume-8b` — 8B model fine-tuned on resume tailoring data (master profile + JD → tailored CV + cover letter). Trained with 6000+ examples from synthetic data.

Training happened in `C:\Learning\apps\apex-hunter-v1\apex-hunter\model training\` using Unsloth + QLoRA.

### Phase 5 — Polish & Production (Jun–Jul 2025)
Fixed auth bootstrap race condition, fixed Turbopack panics, fixed JD text selectability, fixed sign-in UI alignment, improved skill extraction (word-boundary regex + denylist), added audit timeline, improved analytics, cleaned up codebase.

### Key Architectural Decisions
- **Next.js App Router** — Server Components by default, 'use client' only when needed for interactivity
- **Ollama-first AI strategy** — Fine-tuned local models first (free, fast, private), fall back to OpenAI only when Ollama is unavailable. Zero AI cost in development.
- **Pure algorithmic matching** — No ML for the matching engine, just weighted arithmetic. Transparent, explainable, deterministic. HRs can understand and trust it.
- **Org-scoped multi-tenancy** — Every piece of data belongs to an organization. One user can only see their org's data.
- **Audit everything** — Every decision (shortlist/reject), every edit, every skill generation run is logged.

---

## 3. Tech Stack — Every Technology Used

| Category | Technology | Version | Why |
|---|---|---|---|
| Framework | Next.js | 15 (App Router) | Server Components, file-based routing, API routes in same project |
| Language | TypeScript | 5.x | Type safety, better DX, prevents runtime errors |
| Styling | Tailwind CSS | v4 | Utility-first, no context switching, fast iteration |
| UI Components | shadcn/ui + Radix UI | Latest | Accessible, unstyled primitives, easy to customize |
| Animations | Framer Motion | Latest | Smooth page transitions and micro-animations |
| Auth | Clerk | Latest | Enterprise auth with Google OAuth, magic link, OTP — no auth code to maintain |
| Database | PostgreSQL | 14+ | Reliable relational DB, supports pgvector, runs locally and on Supabase/Railway |
| ORM | Prisma | Latest | Type-safe queries, migrations, great DX with TypeScript |
| AI — Resume Parsing | Ollama (`apex-resume-qwen-3b:latest`) | — | Fine-tuned Qwen2.5-3B, runs local, zero cost, no rate limits |
| AI — Resume Tailoring | Ollama (`apex-resume-8b`) | — | Fine-tuned 8B model, master profile + JD → tailored CV + cover letter |
| AI — Fallback | OpenAI GPT-4o-mini | — | Cheap fallback when Ollama unavailable (production/Vercel) |
| AI — Embeddings | Ollama `nomic-embed-text` | — | 384-dim embeddings for semantic candidate search |
| Charts | Recharts | Latest | React-native charting, good TypeScript support |
| Toast Notifications | Sonner | Latest | Beautiful toast notifications, dark/light theme |
| Logging | Winston | Latest | Structured logging with file transports |
| Queue | BullMQ + ioredis | Latest | Background job processing for bulk imports |
| Rate Limiting | @upstash/ratelimit + @upstash/redis | Latest | Serverless Redis rate limiting |
| File Parsing | pdf-parse + pdfjs-dist | Latest | PDF text extraction |
| File Parsing | mammoth | Latest | DOCX → plain text extraction |
| Phone Validation | libphonenumber-js | Latest | International phone number normalization |
| Export | docx | Latest | Generate DOCX files |
| Location Search | country-state-city | Latest | City/country autocomplete |
| Icons | Lucide React | Latest | Beautiful consistent icon set |
| State (server) | Next.js fetch + React cache | — | No client state library needed for server components |
| Validation | Zod | Latest | Runtime schema validation at API boundaries |
| Package Manager | npm | — | Standard |
| Deployment | Vercel | — | Auto-deploys from GitHub main branch |

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER (Next.js Frontend)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Dashboard │  │Candidates│  │   Jobs   │  │Matchboard│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / Server Actions
┌──────────────────────────────▼──────────────────────────────┐
│              API LAYER (Next.js API Routes)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Clerk  │  │   RBAC   │  │Rate Limit│  │  Zod Val │   │
│  │   Auth   │  │13 perms  │  │4-tier    │  │  Schema  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    BUSINESS LOGIC (src/lib/)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Matching │  │  Resume  │  │  Skill   │  │  Audit   │   │
│  │ Engine   │  │  Parser  │  │ Extract  │  │   Log    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└──────────────────────────────┬──────────────────────────────┘
                               │
       ┌───────────────────────┼────────────────────┐
       ▼                       ▼                    ▼
┌─────────────┐     ┌──────────────────┐    ┌────────────────┐
│  PostgreSQL │     │  Ollama (Local)  │    │  OpenAI API    │
│  via Prisma │     │  apex-resume-3b  │    │  gpt-4o-mini   │
│  (ai_career)│     │  apex-resume-8b  │    │  (fallback)    │
│             │     │  nomic-embed-text│    │                │
└─────────────┘     └──────────────────┘    └────────────────┘
```

### Key Architectural Principles

**1. Server Components by default**
Every page is a React Server Component that fetches its own data directly from the database. No intermediate API calls for page rendering. `'use client'` only used for interactive forms, buttons, and real-time updates.

**2. All data is org-scoped**
Every database query includes `orgId` as a filter. The layout middleware verifies org membership before rendering any page. It is architecturally impossible to see another org's data.

**3. AI is pluggable**
`src/lib/ollama-resume-llm.ts` → Ollama (free, local)
`src/lib/resume-llm.ts` → orchestrates: try Ollama first, fall back to OpenAI
`src/lib/ollama-tailor-llm.ts` → Ollama for resume tailoring
Swapping models requires only changing an environment variable.

**4. Everything is audited**
Candidate activities (25+ event types), job page actions, match decisions, skill generation runs — all logged with actor, timestamp, before/after snapshots.

---

## 5. Authentication & Multi-Tenancy

### How Sign-In Works (Full Flow)

1. User visits `/sign-in` — sees custom-styled Clerk form (logo at top, centered card, no misalignment)
2. Clerk authenticates (Google OAuth or email+password on test instance, OTP on live instance)
3. After sign-in → Clerk redirects to `/orgs/demo`
4. **Auto-bootstrap** fires: `GET /api/orgs/my` runs automatically
   - Checks if DB user exists (by Clerk userId or email)
   - If NOT: creates `User` + `Organization` + `Membership` in one DB transaction
   - Returns `{ orgId }` of the user's workspace
5. Client redirects from `/orgs/demo` to `/orgs/[realOrgId]`

This solves the **auth chicken-and-egg problem**: new users have a Clerk session but no DB record, so the bootstrap step creates everything on first hit.

### Layout Authentication (Every Org Page)

`src/app/orgs/[orgId]/layout.tsx` runs on every org page:
1. Gets Clerk `userId` — if none, redirect to `/sign-in`
2. Reads email from Clerk session claims (avoids extra API call)
3. Looks up `User` in DB by Clerk userId or email
4. If user not found → redirect to `/orgs/demo`
5. Checks `Membership` record: `{ userId, orgId }` must exist
6. If no membership → redirect to `/orgs/demo`
7. Backfills name/email in DB if missing (from Clerk profile)
8. Renders `<AppShell>` with the org's sidebar and topbar

### Role-Based Access Control

Three roles: `OWNER`, `ADMIN`, `MEMBER`

13 permissions enforced in API routes via `src/lib/rbac.ts`:

| Permission | Description |
|---|---|
| `candidates:read` | View candidate list and profiles |
| `candidates:write` | Create, edit candidates, upload resumes |
| `candidates:delete` | Delete candidates |
| `jobs:read` | View jobs and skills |
| `jobs:write` | Create, edit jobs, generate skills |
| `jobs:delete` | Delete jobs |
| `matches:read` | View match results |
| `matches:write` | Update shortlist/reject status |
| `analytics:read` | View analytics dashboard |
| `settings:read` | View org settings |
| `settings:write` | Update org name, parse timeout |
| `members:read` | View org members |
| `members:write` | Add/remove members, change roles |

### Local Dev vs Production Auth

Two separate Clerk instances exist:
- **Test instance** (local dev): Email + password auth, easy for testing
- **Live instance** (production/Vercel): OTP and/or Google OAuth, more secure

This is intentional. Different Clerk instances = different auth strategies. The deployed version will prompt for OTP, the local version accepts passwords.

---

## 6. All Pages — Complete Reference

### Navigation Structure (Sidebar)

When logged in, every org page shows a sidebar with:
- Dashboard (`/orgs/[orgId]`)
- Jobs (`/orgs/[orgId]/jobs`)
- Candidates (`/orgs/[orgId]/candidates`)
- Matchboard (`/orgs/[orgId]/matchboard`)
- Intelligence (`/orgs/[orgId]/intelligence`)
- Uploads (`/orgs/[orgId]/uploads`)
- Settings (`/orgs/[orgId]/settings`)

Plus a topbar with: org name, notification bell, user profile dropdown.

---

### 6.1 Landing Page (`/`)
**Access:** Public (no auth)

The marketing homepage for NextHire.

**Hero Section:**
- Background: dark diagonal gradient + subtle dot grid overlay (CSS: `prestige-bg`, `prestige-grid`)
- Headline: "Hire Smarter," + gradient gradient text "Not Harder"
- Subtext: "Transform your recruitment with AI-powered matching..."
- Two CTAs: "Get Started Free" → `/sign-up`, "Sign In" → `/sign-in`
- If already logged in: shows "Go to workspace" → `/orgs/demo`

**Features Grid (3 cards):**
- AI Matching — "Weighted skill matching with critical gap detection"
- Real-Time Analytics — "Pipeline insights, skills gap analysis"
- Audit Ready — "Complete decision logs, compliance reports"

**Stats Row:**
- 95% Match Accuracy
- 10x Faster Screening
- 100% Audit Compliant

---

### 6.2 Sign-In Page (`/sign-in`)
**Access:** Public

Custom-styled Clerk sign-in page:
- NextHire logo at top
- Tagline: "AI-powered recruitment intelligence"
- Clerk `<SignIn>` component (full-width, centered, no shadow)
- "Don't have an account? Sign up" link below
- After sign-in: redirects to `/orgs/demo` which bootstraps the user

**Styling fixes applied:**
- `cardBox: "w-full shadow-none"` and `main: "w-full"` on Clerk appearance
- CSS overrides in `extraordinary.css` targeting `.cl-rootBox`, `.cl-card`, `.cl-cardBox`, `.cl-main`, `.cl-form` with `width: 100% !important` to fix left-alignment issue

---

### 6.3 Sign-Up Page (`/sign-up`)
**Access:** Public

Same layout as sign-in with Clerk `<SignUp>` component and "Already have an account? Sign in" link.

---

### 6.4 Dashboard Home (`/orgs/[orgId]`)
**Access:** Authenticated + org member

The main recruitment command center.

**Hero Block:**
- "Recruitment Intelligence" heading with "AI-POWERED INTELLIGENCE" pill badge
- Description and "Launch Dashboard" CTA
- Export/Audit panel (top right corner): allows exporting org data

**Neural Analytics Section:**
Full `AnalyticsDashboard` component with live charts:
- Candidates added over time (line chart with date range)
- Skill frequency across all candidates (horizontal bar chart)
- Job pipeline status (OPEN vs CLOSED)
- Match score distribution (how scores cluster)

**Three Stat Cards:**
1. **Talent Pool** — total candidate count → "Access Talent Pool" link
2. **Active Jobs** — count of all jobs → "Manage Jobs" link
3. **AI Matching** — average match score for most recent job → "Enter Matchboard" link

---

### 6.5 Jobs Page (`/orgs/[orgId]/jobs`)
**Access:** Authenticated

**Header:**
- "Open Roles" title with "Create roles, attach skills, then generate a ranked matchboard." subtitle
- **"Re-run All Matchboards"** button — triggers re-scoring of all candidates against all jobs
- **"New Job"** button → opens create form

**Job List Card:**
Shows all jobs with: title, location, status badge (OPEN/CLOSED), work mode, description preview (first 150 chars), created date.

Each job has a **"View"** button → goes to that job's skills/detail page.

**Create Job Form** (slides in):
- Title (required)
- Description (paste full JD here — this is what AI reads to extract skills)
- Location with city/country autocomplete
- Status (OPEN/CLOSED)
- Work Mode (Remote/Onsite/Hybrid/Other)
- Min. Years of Experience (0 = no minimum)
- On save: AI automatically generates skills from the description (taxonomy matching)

---

### 6.6 Job Detail / Skills Page (`/orgs/[orgId]/jobs/[jobId]/skills`)
**Access:** Authenticated

**This is the most feature-rich single page in the app.**

**Left Column — Job Details Card:**

Read-only view (all text is selectable and copyable):
- Title
- Description (full JD text with `whitespace-pre-wrap`, `select-text`)
- Location
- Status badge
- Work mode
- Min. years of experience

Click **"Edit"** → all fields become inline editable inputs/selects.
Click **"Cancel"** → resets all fields to saved values.
Click **"Save job details"** → PATCH to database, button disabled if no changes.

**Center — Skills Editor:**

List of all job skills with:
- Skill name
- Weight badge: Critical (W5), High (W4), Standard (W3), Low (W2), Baseline (W1)
- Delete button (trash icon)

**Add Skill** button → input + weight selector → saves immediately.

**"Generate from description"** button → opens preview dialog showing:
- New skills to be added (green, with proposed weight)
- Weight updates for existing skills (shows from → to)
- Unchanged skills count
- "Apply changes" button → persists to database

**"Re-run matching"** button → triggers AI matching for all candidates against this job, shows loading state, refreshes when done.

**Right Column — Audit Timeline:**
Chronological log of all changes to this job page:
- JOB_DETAILS_UPDATED — who edited what fields
- JOB_SKILLS_GENERATED — before/after skill snapshots
- JOB_SKILLS_UPDATED — individual skill changes
- JOB_MATCHING_RERUN — when matching was triggered, actor

**Bottom — Delete Job:**
Red "Delete job" button → opens confirmation dialog → deletes job + all associated matches, skills, audit logs.

---

### 6.7 Candidates Page (`/orgs/[orgId]/candidates`)
**Access:** Authenticated

**Header:**
- "Talent Pool" title with total candidate count
- Search bar (live search by name or email, debounced 300ms)
- Action buttons:
  - **"Add Candidate"** — opens 5-step wizard form
  - **"Bulk Import (CSV)"** — CSV upload dialog
  - **"Bulk Upload Resumes"** — ZIP/PDF/DOCX bulk upload
  - **"Compare"** → `/candidates/compare`

**Candidate List:**
Cards for each candidate showing: full name, email, current title, location, tags (color-coded labels), created date badge.

Click any candidate card → navigates to `/candidates/[candidateId]` detail page.

---

### 6.8 Candidate Detail Page (`/orgs/[orgId]/candidates/[candidateId]`)
**Access:** Authenticated

**The most comprehensive page in the app.**

**Profile Header Section:**
- Full name, email, phone, location, current title
- Years of experience (calculated from `CandidateExperience[]` work history, not manual entry)
- Status badge (ACTIVE, INACTIVE, HIRED, etc.)
- LinkedIn, GitHub, portfolio icons/links
- Color-coded tags (e.g., "Senior", "Python Dev", "Shortlisted")
- **Quick Actions panel** — shortcuts to frequent operations

**Resume Upload Section:**
- Drag-and-drop area or click to browse
- Accepts: PDF, DOCX
- Shows uploaded resume history
- After upload → AI parsing starts automatically:
  1. Text extracted from file (pdf-parse / mammoth)
  2. Sent to Ollama `apex-resume-qwen-3b:latest` (90s timeout)
  3. If Ollama fails → falls back to OpenAI GPT-4o-mini
  4. Extracted JSON mapped to DB schema
  5. All sections auto-populated

**Skills Section:**
Grid of all extracted skills grouped by category (Programming Languages, Frontend, Backend, etc.). Each skill shows name and optional proficiency level.

**Experience Section:**
Timeline of work history: company, role, start-end dates, bullet points.

**Education Section:**
Schools with degree, year.

**Projects Section:**
Project cards: title, tech stack (parsed from free text), dates, bullet points.

**Technologies Section:**
Grouped technology categories from AI parsing (e.g., LANGUAGES: Python, TypeScript; FRAMEWORKS: React, FastAPI).

**Job Matches Panel (right sidebar):**
All jobs this candidate has been matched against:
- Job title + company
- Match score % (large number)
- Matched skills (green pills)
- Missing skills (red pills, with CRITICAL badge for weight≥4)
- Status dropdown: NONE / SHORTLISTED / REJECTED
- Changing status creates a `MatchDecisionLog` entry

**Notes Panel:**
- Add recruiter notes with importance flag (starred)
- Edit notes inline
- Delete notes with confirmation
- Notes show author and timestamp

**Interviews Panel:**
- Schedule interview: title, round (e.g., "Round 1 Technical"), date/time, duration (default 45min), timezone, meeting type (Video/Phone/Onsite/Whiteboard), meeting link, interviewer name, notes
- Interview status: SCHEDULED → COMPLETED / CANCELLED / NO_SHOW
- Full interview history

**Communications Panel:**
- Log emails, phone calls, messages
- Source type + timestamp

**Activity Timeline:**
Full chronological audit of everything that happened to this candidate:
- PROFILE_UPDATED, RESUME_UPLOADED, RESUME_PARSED, RESUME_PARSE_FAILED
- MATCH_STATUS_CHANGED, SKILL_ADDED, SKILL_REMOVED
- EXPERIENCE_ADDED/UPDATED/REMOVED, EDUCATION_ADDED/UPDATED/REMOVED
- PROJECT_ADDED/UPDATED/REMOVED, NOTE_ADDED/UPDATED/REMOVED
- INTERVIEW_SCHEDULED/UPDATED/COMPLETED/CANCELLED
- COMMUNICATION_SENT

**Similar Candidates Panel:**
Uses semantic embedding similarity (cosine similarity on `nomic-embed-text` embeddings). Shows top-N similar candidates from the org's talent pool with similarity percentage.

**Job Recommendations:**
Based on candidate skills, shows which jobs they'd be a best fit for (even if not formally matched yet).

**"Refresh Matches" button:**
Re-runs matching for this specific candidate against all open jobs in the org.

---

### 6.9 Candidate Compare Page (`/orgs/[orgId]/candidates/compare`)
**Access:** Authenticated

**URL params:** `?ids=candidateId1,candidateId2` or empty for picker.

If no IDs in URL: shows `ManualComparePicker` — search and select two candidates.

**Comparison view:**
Side-by-side columns for each candidate:
- Education: school, degree, year
- Experience: all roles with dates
- Skills: all skills (highlighted if one has it and other doesn't)
- Projects: all projects
- Semantic similarity score between the two (cosine similarity on embeddings)

**Export:** Download comparison as report.

---

### 6.10 Matchboard (`/orgs/[orgId]/matchboard`)
**Access:** Authenticated

**The core AI intelligence feature — the "mission control" for hiring.**

**Job Selector:**
Dropdown of all jobs. Selecting one loads that job's match results. URL updates with `?jobId=...` so link is shareable.

**Match Results (ranked list):**
For the selected job, shows ALL candidates sorted by match score descending:
- Candidate name, email, current title
- Match score % (big number, color-coded: green=high, yellow=mid, red=low)
- Matched skills: green pills
- Missing skills: red pills, CRITICAL badge if weight≥4
- Experience score component (if job has min years requirement)
- `scoredAt` timestamp (when was last scored)
- Status: NONE / SHORTLISTED / REJECTED
- **"Shortlist"** and **"Reject"** buttons → updates status, logs decision

**Bulk Actions:**
- Select multiple candidates with checkboxes
- **"Bulk Shortlist"** / **"Bulk Reject"** → updates all selected

**Match History:**
Click "History" on any candidate → modal showing every status change for that job-candidate pair (who changed it, when, from what to what).

**"Re-run Matching"** button → triggers `/api/jobs/[jobId]/match`, shows loading state, auto-refreshes on completion.

**Filter:**
Filter by status: All / Shortlisted / Rejected / None.

---

### 6.11 Intelligence / Analytics (`/orgs/[orgId]/intelligence`)
**Access:** Authenticated

Full analytics dashboard with live data from the database.

**Charts included (via `AnalyticsDashboard` component):**
- **Candidates over time** — Line chart, shows how fast the talent pool is growing
- **Skill frequency** — Horizontal bar chart, top skills across all candidates
- **Job pipeline** — Pie/donut of OPEN vs CLOSED jobs
- **Match score distribution** — Histogram of match scores
- **Top candidates** — Table of highest-scoring candidates across all jobs
- **Hiring funnel** — From total candidates → shortlisted → interviews scheduled

Data source: `GET /api/orgs/[orgId]/analytics` aggregates live from DB.

---

### 6.12 Upload History (`/orgs/[orgId]/uploads`)
**Access:** Authenticated

Log of all resume upload batches and CSV imports.

**Filters:**
- Date range picker
- Source type: CSV, ZIP, PDF/DOCX
- Status: QUEUED, PROCESSING, COMPLETED, PARTIAL_FAILED, FAILED
- Sort: newest first / oldest first

**Batch List:**
Each batch shows:
- Source name (filename)
- Source type badge
- Status badge with color
- Counts: Total files / Processed / Created / Updated / Failed
- Started at, completed at, duration
- Expand → individual file results with filename, status, error if any

**Actions per batch:**
- **"Retry failed"** — re-processes only the failed items
- **"Export"** — download batch results as CSV (filename, status, error, candidate created/updated)

---

### 6.13 Settings (`/orgs/[orgId]/settings`)
**Access:** Authenticated

**Organization Info:**
- Org name (editable)
- Workspace creation date

**Stats:**
- Total jobs
- Total candidates
- Total skills
- Total members

**AI Settings:**
- Resume parse timeout (seconds, default 30) — how long to wait for AI parsing before timing out. Configurable because Ollama can be slow on first load.

**LLM Usage Analytics:**
- Total tokens used this month
- Cost breakdown (always $0 for Ollama calls, actual cost for OpenAI)
- Per-model breakdown

---

### 6.14 Demo Pages (`/orgs/demo/*`)
**Access:** Public fallback

Read-only stub pages used when:
- Not authenticated
- Auth succeeded but no DB user/org found (first sign-in before bootstrap completes)

Shows the same UI shell but with "Sign in to access your workspace" prompts instead of real data.

---

## 7. Data Model

Complete Prisma schema — every table, every field, every relationship.

### Core Tables

**User**
```
id (cuid), email (unique), name, createdAt, updatedAt
→ memberships[], candidates[] (created by this user), notifications[]
```

**Organization**
```
id (cuid), name, createdAt, updatedAt
resumeParseTimeoutSeconds (default 30)
→ memberships[], candidates[], skills[], jobs[], matches[], uploadBatches[], notifications[]
```

**Membership**
```
id (cuid), role (OWNER/ADMIN/MEMBER), createdAt
userId, orgId
@@unique([userId, orgId])
```

**Candidate**
```
id (cuid), fullName, email, phone, location, currentTitle
yearsOfExperience, notes, externalId, dateOfBirth
fingerprint (SHA-256 hash for duplicate detection)
linkedinUrl, githubUrl, portfolioUrl
status (ACTIVE/INACTIVE/HIRED/REJECTED/NEEDS_REVIEW)
source (MANUAL/IMPORT/REFERRAL/LINKEDIN/etc.)
educationSchool, educationDegree, educationYear (legacy fields)
orgId, createdBy (userId)
createdAt, updatedAt

Indexes: [orgId], [email], [status], [createdAt], [orgId,email], [orgId,phone],
         [orgId,fullName], [orgId,status], [orgId,createdAt]

→ resumes[], skills[], matches[], experiences[], projects[], technologies[],
   educations[], activities[], candidateNotes[], tags[], interviews[]
```

**Resume**
```
id (cuid), candidateId
fileName, mimeType, sizeBytes
rawText (full extracted text)
parsedJson (complete AI output)
parseStatus (QUEUED/EXTRACTING/SAVED/NEEDS_REVIEW/FAILED)
parseError, parsedAt, parseModel, promptVersion
embedding (JSON array from nomic-embed-text)
createdAt
```

**Job**
```
id (cuid), orgId
title, description, location
status (OPEN/CLOSED, default OPEN)
workMode (REMOTE/ONSITE/HYBRID/OTHER)
workModeOther (for custom work mode text)
requiredYearsOfExperience
embedding (JSON array for semantic job search)
createdAt, updatedAt

Indexes: [orgId], [status], [createdAt], [orgId,status], [orgId,createdAt]

→ skills[], matches[], decisionLogs[], uploadBatches[], skillGenerationAudits[], pageAuditEvents[]
```

**Skill** (org-scoped skill names)
```
id (cuid), orgId, name
@@unique([orgId, name])
→ candidates[], jobSkills[]
```

**CandidateSkill**
```
id (cuid), candidateId, skillId
level (1-5, optional)
source ("resume"/"manual"/"linkedin")
@@unique([candidateId, skillId])
```

**JobSkill**
```
id (cuid), jobId, skillId
weight (1-5, importance)
@@unique([jobId, skillId])
```

**MatchResult**
```
id (cuid), jobId, candidateId, orgId
score (float, 0-100)
matched (JSON array of matched skill names)
missing (JSON array of missing skill names)
matchedWeight (int, sum of matched skill weights)
totalWeight (int, sum of all job skill weights)
experienceScore (float, nullable)
scoredAt (datetime)
status (NONE/SHORTLISTED/REJECTED, default NONE)
statusUpdatedAt, statusUpdatedBy
@@unique([jobId, candidateId])

Indexes: [jobId], [candidateId], [orgId], [orgId,status], [jobId,score],
         [candidateId,score], [jobId,createdAt], [orgId,createdAt]
```

**MatchDecisionLog**
```
id (cuid), orgId, jobId, candidateId
fromStatus, toStatus (NONE/SHORTLISTED/REJECTED)
note (optional recruiter note)
decidedBy (userId)
createdAt
```

**CandidateExperience**
```
id (cuid), candidateId
company, role, location
startMonth (DateTime), endMonth (DateTime, nullable)
isCurrent (boolean)
bullets (String[])
```

**CandidateEducation**
```
id (cuid), candidateId
school, degree, location
startYear, endYear (nullable ints)
```

**CandidateProject**
```
id (cuid), candidateId
title, dates, techStack, link
bullets (String[])
```

**CandidateTechnology** (AI-categorized tech groups)
```
id (cuid), candidateId
category (e.g., "LANGUAGES", "FRAMEWORKS", "AI/ML")
items (String[])
```

**CandidateActivity** (audit log — 25+ event types)
```
id (cuid), orgId, candidateId
type (CandidateActivityType enum)
title, description, metadata (JSON)
actorId (userId), createdAt
```

**CandidateNote**
```
id (cuid), orgId, candidateId
content, isImportant (boolean)
authorId (userId), createdAt, updatedAt
```

**CandidateTag** (org-scoped colored labels)
```
id (cuid), orgId, name, color (#hex, default #64748b)
@@unique([orgId, name])
→ candidates[] (many-to-many)
```

**CandidateInterview**
```
id (cuid), orgId, candidateId
title, round, scheduledAt, durationMinutes (default 45)
timezone (default "UTC"), meetingType (default "Video")
meetingLink, location, interviewer, notes
status (SCHEDULED/COMPLETED/CANCELLED/NO_SHOW)
createdBy (userId), createdAt, updatedAt
```

**Notification**
```
id (cuid), orgId, userId
type (UPLOAD_COMPLETE/UPLOAD_FAILED/MATCH_FOUND/RESUME_PARSED/JOB_CREATED/SYSTEM)
title, message, link
read (boolean), readAt, metadata (JSON)
```

**ResumeUploadBatch** (bulk upload job)
```
id (cuid), orgId, targetJobId (optional)
sourceType (CSV/ZIP/PDF_DOCX), sourceName, uploadedBy
status (QUEUED/PROCESSING/COMPLETED/PARTIAL_FAILED/FAILED)
totalFiles, processed, createdCount, updatedCount, failedCount
createdAt, startedAt, completedAt
→ items[]
```

**ResumeUploadItem** (individual file in a batch)
```
id (cuid), batchId, fileName
candidateId (nullable), resumeId (nullable)
status (PENDING/PROCESSING/CREATED/UPDATED/SKIPPED/FAILED)
note, error, createdAt
```

**JobSkillGenerationAudit** (before/after snapshot of skill generation)
```
id (cuid), orgId, jobId, triggeredBy, source
onlyWhenEmpty, maxSkills, generatedCount
beforeSkills (JSON), afterSkills (JSON), generatedSkills (JSON)
createdAt
```

**JobPageAuditEvent** (every action on a job page)
```
id (cuid), orgId, jobId, action (enum), actorId, summary, metadata (JSON)
Actions: JOB_DETAILS_UPDATED, JOB_SKILLS_UPDATED, JOB_SKILLS_GENERATED, JOB_MATCHING_RERUN, JOB_DELETED
```

---

## 8. AI Pipelines

### 8.1 Resume Parsing Pipeline

**Where it runs:** `src/lib/resume-llm.ts` (orchestrator), `src/lib/ollama-resume-llm.ts` (Ollama client)

**Trigger:** Resume file uploaded on candidate detail page → `POST /api/orgs/[orgId]/candidates/[candidateId]/resumes/upload`

**Step-by-step:**
1. File received (PDF or DOCX, max ~10MB)
2. Text extraction:
   - PDF → `pdf-parse` or `pdfjs-dist` (handles scanned PDFs)
   - DOCX → `mammoth` (clean text extraction)
   - Raw text stored in `Resume.rawText`
3. `extractCandidateProfile(resumeText, orgId)` called:

   **Try Ollama first (if `OLLAMA_BASE_URL` is set):**
   - `extractWithOllama(resumeText, 90000ms timeout)`
   - Sends to Ollama `/api/chat` with `format: "json"`, `temperature: 0.1`, `num_ctx: 8192`
   - Model: `apex-resume-qwen-3b:latest`
   - Parses JSON output → `mapToAppSchema()` converts training schema → app schema
   - Period strings like "Jun 2024 to Sep 2024" → `{year: 2024, month: 6}` objects
   - If successful → return result immediately

   **Fallback to OpenAI (if Ollama failed or unavailable):**
   - `gpt-4o-mini` with `json_schema` structured output (strict mode)
   - Schema enforces: personal, educations[], skillsFlat[], technologies[], experiences[], projects[]
   - `temperature: 0`, validated with Zod
   - If first attempt fails with JSON/Zod error → retry once with the error message included in prompt
   - Track token usage + cost in `llm-tracking`

4. Extracted data applied to database:
   - `personal` → `Candidate.fullName`, `email`, `phone`, `location`, `currentTitle`, `yearsOfExperience`
   - `educations[]` → `CandidateEducation` records (upsert)
   - `experiences[]` → `CandidateExperience` records
   - `projects[]` → `CandidateProject` records
   - `skillsFlat[]` → `Skill` + `CandidateSkill` records (upsert by org+name)
   - `technologies[]` → `CandidateTechnology` records
5. `Resume.parseStatus` → `SAVED` (success) or `FAILED` (with error message)
6. `CandidateActivity` log entry created: `RESUME_PARSED`
7. Auto-matching triggered: new candidate scored against all open jobs

**Fine-tuned model details (`apex-resume-qwen-3b:latest`):**
- Base: Qwen2.5-3B
- Training method: QLoRA fine-tuning
- Training data: thousands of synthetic resumes in various formats
- Size: 1.9GB GGUF quantized
- Output schema: `{name, email, phone, location, linkedin, github, website, summary, skills{category:[items]}, experience[], education[], projects[], certifications[], achievements[], languages[], hobbies[]}`
- Maps to app schema via `mapToAppSchema()` function

---

### 8.2 Job Skill Extraction Pipeline

**Where it runs:** `src/lib/job-skill-generation.ts`

**Trigger:** Job created with a description, or "Generate from description" clicked on job skills page.

**Step-by-step:**
1. Job description text fetched from DB
2. `suggestJobSkillsFromDescription(description, {maxSkills: 15})` called:

   a. Text normalized: lowercase, NFKD unicode, diacritics stripped

   b. For each of 300+ skills in `SKILLS_TAXONOMY`:
      - Skip if in `GENERIC_SKILL_DENYLIST`: `{ai, ml, it, qa, hr, bi, ui, ux, api, sdk, audit, compliance, monitoring, logging, sales, marketing}`
      - Build regex: pure word-char skills use `\bskillname\b`, special char skills (C++, .NET) use lookahead/lookbehind
      - Count all matches in the normalized description text
      - If count = 0 → skip this skill

   c. For each matched skill, assign weight:
      - Search 80-char context window around first occurrence
      - Contains "must", "required", "essential", "mandatory", "critical" → weight = 5, score +3
      - Contains "nice to have", "preferred", "bonus", "good to have" → weight = 2
      - Frequency ≥ 2 → weight = 4, score +1
      - Otherwise → weight = 3

   d. Sort by: weight desc → score desc → frequency desc → name alphabetically

   e. Return top `maxSkills` (default 15, min 5, max 30)

3. Preview mode: returns diff vs existing skills (new / weight changes / unchanged)
4. Apply mode: for each generated skill:
   - `Skill` upserted (`orgId + name` unique)
   - `JobSkill` upserted with weight
5. `JobSkillGenerationAudit` created with before/after snapshots

**Important:** After changing `skills-taxonomy.ts`, must restart dev server — module-level constants don't hot-reload in Turbopack.

---

### 8.3 AI Matching Pipeline

**Where it runs:** `src/lib/auto-matching.ts`

**Trigger:** "Re-run matching" on job page, "Re-run All Matchboards" on jobs page, `POST /api/jobs/[jobId]/match`, or auto-triggered after resume parse.

The matching engine is **entirely algorithmic — no LLM involved**. It uses weighted arithmetic for transparency and explainability. Every HR manager can understand why a candidate scored what they scored.

(Full details in Section 9 below.)

---

### 8.4 Resume Tailoring Pipeline (NEW — Infrastructure Ready)

**Where it runs:** `src/lib/ollama-tailor-llm.ts`

**Model:** `apex-resume-8b` (8B fine-tuned model)

**What it does:** Takes a candidate's master profile + a job description → produces:
- `tailoring_decisions` — role family, seniority target, lead project, dropped projects, honest gaps, key JD vocabulary
- `tailored_cv` — rewritten resume tailored to the specific job (never fabricates, only edits)
- `tailored_cover_letter` — 6-paragraph business cover letter

**Rules the model follows (from training):**
1. Never fabricate — every skill, metric, company must exist in the master profile
2. Edit conservatively — keep ≥70% of original bullet words
3. Drop, don't dilute — omit irrelevant bullets entirely
4. Reorder projects — most relevant to this job comes first
5. Honest gaps — acknowledge missing skills rather than inventing them
6. No em dashes — use hyphens, commas, or "to"
7. Cover letter structure: opening → education/background → best project → secondary work → why this company → closing

**Model specs:** 8B parameters, 16k context, 180s timeout (3 min), temperature 0.2

**Status:** Infrastructure (Ollama client, types, env var) is built. UI integration is the next feature to build.

---

### 8.5 Semantic Search Pipeline

**Where it runs:** `src/lib/semantic-search.ts`, `src/lib/embeddings.ts`

**How it works:**
1. When a resume is parsed, `nomic-embed-text` (Ollama) generates a 384-dimension embedding of the resume text
2. Stored as `Resume.embedding` (JSON array in PostgreSQL)
3. `searchCandidatesBySemantics(query, orgId, limit, minSimilarity)`:
   - Generates embedding for the search query text
   - Fetches all candidates with embeddings (up to 100)
   - Computes cosine similarity between query embedding and each resume embedding in memory
   - Returns top-N above `minSimilarity` threshold (default 0.7)
4. Used for "Similar Candidates" panel (top similar people in org) and semantic search in search bar

**Note:** Current implementation computes cosine similarity in JavaScript (fine up to ~1000 candidates). For scale, would migrate to pgvector extension for native SQL similarity operations.

---

## 9. Matching Algorithm — Deep Dive

The matching algorithm in `src/lib/auto-matching.ts` is the heart of NextHire. Here is exactly how it works.

### Input
- Job skills: list of `{name, weight}` pairs (weight 1-5)
- Candidate skills: list of skill names
- Candidate's years of experience
- Job's `requiredYearsOfExperience` (may be null)

### Step 1 — Skill Normalization

Both job skills and candidate skills are normalized through an alias map before comparison:

```
node.js, nodejs → node
react.js → react
vue.js, vuejs → vue
angular.js, angularjs → angular
next.js → nextjs
nuxt.js → nuxtjs
golang → go
postgresql, psql → postgres
mongo → mongodb
k8s → kubernetes
js → javascript
ts → typescript
py → python
rb → ruby
c# → csharp
c++ → cpp
```

This means a job requiring "Node.js" will correctly match a candidate who has "NodeJS" or "node" in their skills.

### Step 2 — Skill Matching

For each job skill, check if the normalized candidate skill list contains it (exact match after normalization):
- `matchedWeight` += skill.weight for each matched skill
- `totalWeight` += skill.weight for ALL job skills (denominator)
- `matched[]` = names of matched skills
- `missing[]` = names of missing skills
- `missingCritical[]` = missing skills with weight ≥ 4

### Step 3 — Skill Score
```
skillScore = matchedWeight / totalWeight  (range: 0.0 to 1.0)
```

### Step 4 — Project Score
```
For each job skill:
  check if skill name appears in any project's techStack field (normalized)

relevance = matched job skills found in ANY project / total job skills
countBonus = min(projectCount / 5, 1.0)
projectScore = relevance × 0.70 + countBonus × 0.30
```

### Step 5 — Experience Score & Final Score

**Case A: No experience requirement (`requiredYearsOfExperience = null`)**
```
score = skillScore × 0.80 + projectScore × 0.20
```

**Case B: Job has minimum experience requirement**
```
Step 1 — Hard disqualification:
  if (candidateYears < requiredYears × 0.5) → score = 0  [severe underqualification]

Step 2 — Experience bonus for qualified candidates:
  expBonus = min(candidateYears / (requiredYears + 5), 1.0)
  
  (The +5 rewards extra experience: if job requires 3 years,
   someone with 8 years gets full 1.0 bonus, not capped at 3/3)

Final score = expBonus × 0.60 + skillScore × 0.30 + projectScore × 0.10
```

Final score is multiplied by 100 and stored as a float (0-100).

### Step 6 — Persistence

`MatchResult` is upserted (`jobId + candidateId` unique):
- Updates: `score`, `matched`, `missing`, `matchedWeight`, `totalWeight`, `experienceScore`, `scoredAt`
- Preserves: `status` (NONE/SHORTLISTED/REJECTED — never overwritten by re-scoring)

Results with score = 0 AND candidate has no skills are skipped (no record created).

### Why Pure Algorithmic (Not ML)?
- **Transparent:** Every HR manager can see exactly why a score is what it is
- **Predictable:** Same inputs always produce same output
- **Auditable:** Every component (matched skills, missing skills, weights) is stored and shown
- **Fast:** Scores 500 candidates in < 1 second, no model inference needed
- **Trustworthy:** Doesn't have ML bias from training data

---

## 10. Skills Taxonomy

**Location:** `src/lib/skills-taxonomy.ts`

The taxonomy is the source of truth for job skill extraction. It's code-based — no DB changes needed to add skills. Changes require dev server restart to take effect (module-level constants).

### All 17 Categories

| Category | Skill Count | Examples |
|---|---|---|
| Programming Languages | 29 | JavaScript, TypeScript, Python, Java, C++, C#, Go, Rust, PHP, Swift, Kotlin, Scala, R, Dart, Elixir |
| Frontend | 32 | React, Vue, Angular, Svelte, Next.js, Tailwind CSS, Bootstrap, Redux, Zustand, Webpack, Vite, PWA |
| Backend | 22 | Node.js, Express, Django, Flask, FastAPI, Spring Boot, NestJS, REST API, GraphQL, gRPC, Microservices, Serverless |
| Databases | 28 | SQL, PostgreSQL, MongoDB, Redis, Elasticsearch, Cassandra, DynamoDB, Firebase, Supabase, Prisma, TypeORM |
| Cloud & DevOps | 40 | AWS, Azure, GCP, Docker, Kubernetes, Terraform, Ansible, GitHub Actions, Jenkins, CI/CD, Prometheus, Grafana, ELK |
| Operating Systems | 12 | Linux, Unix, Windows, macOS, Ubuntu, Debian, CentOS, Red Hat, Kali Linux |
| Mobile | 19 | iOS, Android, React Native, Flutter, SwiftUI, Jetpack Compose, Capacitor |
| Data & AI | 55 | Machine Learning, TensorFlow, PyTorch, LangChain, RAG, Foundation Models, pgvector, Pinecone, Weaviate, LlamaIndex, Hugging Face, OpenAI API, Claude API, Gemini, Azure OpenAI, Amazon Bedrock, RLHF, DPO |
| Testing & QA | 28 | Jest, Mocha, Chai, Cypress, Selenium, Playwright, Puppeteer, Vitest, TDD, BDD, Load Testing |
| Version Control | 11 | Git, GitHub, GitLab, Bitbucket, Git Flow, Trunk Based Development |
| Design & UX | 16 | Figma, Sketch, Adobe XD, UI Design, UX Design, Wireframing, Prototyping, Design Systems |
| Project Management | 17 | Agile, Scrum, Kanban, Jira, Confluence, Trello, Asana, Product Management, Sprint Planning |
| Soft Skills | 24 | Leadership, Communication, Teamwork, Problem Solving, Critical Thinking, Mentoring, Strategic Thinking |
| Business & Marketing | 28 | SEO, SEM, Google Analytics, CRM, Salesforce, HubSpot, Business Analysis, Market Research |
| Finance & Accounting | 17 | Accounting, Financial Modeling, Excel, SAP, QuickBooks, GAAP, IFRS, Audit |
| Security | 27 | Cybersecurity, Penetration Testing, OAuth, JWT, IAM, RBAC, Zero Trust, SOC 2, GDPR, HIPAA |
| Networking | 16 | TCP/IP, DNS, Load Balancing, CDN, Cisco, VPN, Firewall Configuration |

### Generic Skill Denylist
These are NEVER extracted even if found in JD text (too generic, appear in almost every JD):
`ai, ml, it, qa, hr, bi, ui, ux, api, sdk, audit, compliance, monitoring, logging, sales, marketing`

### Adding New Skills
Edit `src/lib/skills-taxonomy.ts` → add to appropriate category → restart dev server.
No database migrations required. Auto-categorization works via `categorizeSkill()` function (direct match, then partial match, then "Other").

---

## 11. Candidate Identity & Duplicate Detection System

The platform uses a **3-layer identity system** to prevent duplicate candidates across imports and manual entry.

### Layer 1 — Database ID (Primary Key)
- Auto-generated CUID: `cmlbmr04w0000ecb8f1s36p81`
- Always exists, internal use only

### Layer 2 — External ID (User-Provided)
- User-defined string: `EMP-12345`, `GREENHOUSE-789`, `WORKDAY-456`
- For integration with external ATS/HR systems
- `@@unique([orgId, externalId])`

### Layer 3 — Fingerprint (Auto-Generated)
- SHA-256 hash of: `firstName + lastName + (email OR phone) + dateOfBirth`
- Generated automatically on creation
- Stable even when email changes (if name+phone+DOB same)
- `@@unique([orgId, fingerprint])`

### Matching Priority (on import/creation)
```
1. If externalId provided → match by externalId → UPDATE
2. If email provided → match by email → UPDATE
3. If fingerprint can be computed → match by fingerprint → UPDATE
4. No match → CREATE new candidate
```

### Real-World Scenarios

**Scenario 1: ATS Integration**
Company re-imports from Greenhouse. First import creates with `externalId: "GREENHOUSE-12345"`. Second import finds by externalId, updates data. No duplicates.

**Scenario 2: Email Change**
Candidate changes email. Email match fails. Fingerprint (name+phone+DOB) still matches. Updates existing record.

**Scenario 3: Same Name, Different Person**
Two "John Does" with different DOBs/phones → different fingerprints → two separate candidates. No false merges.

**Scenario 4: No External System**
Manually added candidate. Fingerprint generated. CSV import with same data matches by fingerprint. No duplicate.

---

## 12. CSV Import Guide

Two CSV templates available in `templates/` folder.

### Basic Template (`candidate-import-basic.csv`)
```csv
fullName,email,phone,dateOfBirth,externalId,skills
John Doe,john@example.com,555-1234,1990-01-15T00:00:00.000Z,EMP-001,"React,Node.js,Python"
```
6 columns. For quick imports without full profiles.

### Full Template (`candidate-import-full.csv`)
41 columns including:
- All personal fields + social URLs
- Education: school, degree, year
- Up to 2 experience entries (company, role, startMonth, endMonth, location, bullets as pipe-separated)
- Up to 2 projects (title, dates, techStack, link, bullets)
- `resumeText` — full resume text for AI parsing (unlimited experience/projects extracted)

### Field Formats

| Field | Format | Example |
|---|---|---|
| dateOfBirth | ISO 8601 | `1990-01-15T00:00:00.000Z` |
| skills | Quoted comma-separated | `"React,Node.js,Python"` |
| bullets | Pipe-separated, quoted | `"Led team \| Built APIs \| Deployed on AWS"` |
| experience dates | YYYY-MM-DD | `2018-01-01` |
| URLs | Must include https:// | `https://linkedin.com/in/johndoe` |
| status | One of: ACTIVE/INACTIVE/HIRED/REJECTED/NEEDS_REVIEW | `ACTIVE` |
| source | One of: MANUAL/IMPORT/REFERRAL/LINKEDIN/AGENCY/CAREER_SITE/JOB_BOARD | `REFERRAL` |

### Import Limits
- Max 100 candidates per CSV file
- Max 50 skills per candidate
- Max 2 experience entries per CSV row (use resumeText for more)
- Max resume text: 50,000 characters
- Max notes: 5,000 characters

### Import Process
1. Upload CSV → validation runs
2. Job queued in BullMQ
3. Background worker processes each row:
   - Duplicate detection (3-layer matching)
   - Creates/updates candidate
   - If `resumeText` provided → AI parsing (Ollama → OpenAI)
   - Auto-matches to open jobs
4. Real-time progress visible in UI
5. Completion notification appears
6. Results in `/orgs/[orgId]/uploads`

---

## 13. Bulk Resume Upload

### How It Works
1. Recruiter goes to `/orgs/[orgId]/candidates`
2. Clicks "Bulk Upload Resumes"
3. Drag-and-drop a ZIP file containing PDFs, or select multiple PDF/DOCX files directly
4. Optionally: assign all candidates to a specific target job
5. Upload starts: each file processed in sequence
6. For each file:
   - Text extracted
   - Existing candidate matched by fingerprint/email (if found: update + add resume)
   - New candidate created if no match
   - AI parsing runs for each resume
   - Auto-match triggered
7. Progress shown in real-time (files processed / created / updated / failed)
8. Completion notification
9. Full batch report in `/uploads`

### Batch States
`QUEUED` → `PROCESSING` → `COMPLETED` (all ok) / `PARTIAL_FAILED` (some failed) / `FAILED` (all failed)

### Retry Failed Items
Go to Upload History → expand batch → "Retry failed" button → re-processes only failed items.

---

## 14. API Reference

All routes return JSON. All protected routes require Clerk session cookie/header.

### Authentication Routes
```
GET /api/orgs/my           Bootstrap: create user+org+membership if new. Returns {orgId}
GET /api/health            Health check. Returns {ok: true}
```

### Job Routes
```
GET    /api/orgs/[orgId]/jobs                    List all jobs
POST   /api/orgs/[orgId]/jobs                    Create job (body: {title,description,location,status,workMode,workModeOther,requiredYearsOfExperience})
GET    /api/orgs/[orgId]/jobs/[jobId]            Get job details
PATCH  /api/orgs/[orgId]/jobs/[jobId]            Update job
DELETE /api/orgs/[orgId]/jobs/[jobId]            Delete job (cascades everything)

GET    /api/jobs/[jobId]/skills                  Get job skills with weights
POST   /api/jobs/[jobId]/skills                  Add skill to job
DELETE /api/jobs/[jobId]/skills                  Remove skill

POST   /api/jobs/[jobId]/skills/generate         AI skill generation
                                                 body: {preview:bool, onlyWhenEmpty:bool, maxSkills:int}
                                                 preview=true: returns diff without saving

POST   /api/jobs/[jobId]/match                   Run AI matching for this job → scores all candidates

GET    /api/jobs/[jobId]/matches                 Get match results (ranked by score)
PATCH  /api/jobs/[jobId]/matches/[candidateId]/status  Update status + log decision
POST   /api/jobs/[jobId]/matches/bulk-status     Bulk update: {candidateIds[], status, note}
GET    /api/jobs/[jobId]/matches/[candidateId]/history  Decision history for this pair

GET    /api/jobs/[jobId]/audit                   Job page audit timeline
GET    /api/jobs/[jobId]/audit/export            Export audit as CSV
POST   /api/jobs/[jobId]/workflow               Trigger workflow automation
```

### Candidate Routes
```
GET    /api/orgs/[orgId]/candidates              List candidates (query: q=search)
POST   /api/orgs/[orgId]/candidates              Create candidate (full profile)
GET    /api/orgs/[orgId]/candidates/[cId]        Get candidate + all relations
PATCH  /api/orgs/[orgId]/candidates/[cId]        Update candidate profile
DELETE /api/orgs/[orgId]/candidates/[cId]        Delete (cascades all data)

POST   /api/orgs/[orgId]/candidates/[cId]/resumes/upload           Upload + parse resume
POST   /api/orgs/[orgId]/candidates/[cId]/resumes/[rId]/parse      Re-parse resume

GET/POST /api/orgs/[orgId]/candidates/[cId]/skills                 Skills CRUD
GET/POST /api/orgs/[orgId]/candidates/[cId]/experience             Experience CRUD
GET/POST /api/orgs/[orgId]/candidates/[cId]/education              Education CRUD
GET/POST /api/orgs/[orgId]/candidates/[cId]/projects               Projects CRUD
GET/POST /api/orgs/[orgId]/candidates/[cId]/technologies           Technologies CRUD
GET/POST /api/orgs/[orgId]/candidates/[cId]/notes                  Notes CRUD
PATCH/DELETE /api/orgs/[orgId]/candidates/[cId]/notes/[nId]        Note detail
GET/POST /api/orgs/[orgId]/candidates/[cId]/tags                   Tag CRUD
DELETE /api/orgs/[orgId]/candidates/[cId]/tags/[tagId]             Remove tag
GET/POST /api/orgs/[orgId]/candidates/[cId]/interviews             Interviews CRUD
PATCH/DELETE /api/orgs/[orgId]/candidates/[cId]/interviews/[iId]   Interview detail
POST /api/orgs/[orgId]/candidates/[cId]/communications             Log communication

GET /api/orgs/[orgId]/candidates/[cId]/matches                     All job matches
GET /api/orgs/[orgId]/candidates/[cId]/similar                     Semantic similar candidates
GET /api/orgs/[orgId]/candidates/[cId]/timeline                    Activity timeline

POST /api/orgs/[orgId]/candidates/import                           CSV bulk import
POST /api/orgs/[orgId]/candidates/resumes/upload                   Bulk resume ZIP/PDF upload
GET  /api/orgs/[orgId]/candidates/export                           Export candidates as CSV
GET  /api/orgs/[orgId]/candidates/uploads/history                  Upload batch history
POST /api/orgs/[orgId]/candidates/uploads/[bId]/retry             Retry failed batch items
GET  /api/orgs/[orgId]/candidates/uploads/[bId]/export            Export batch report CSV
```

### Org Routes
```
GET /api/orgs/[orgId]/analytics        Dashboard analytics (funnel, skills, scores, timeline)
GET /api/orgs/[orgId]/llm-analytics    LLM usage + cost tracking
GET /api/orgs/[orgId]/audit            Org-level audit log
GET/PATCH /api/orgs/[orgId]/settings   Org settings (name, parse timeout)
POST /api/orgs/[orgId]/auto-match      Re-run matching for all jobs in org
GET /api/orgs/[orgId]/search           Full-text search: candidates + jobs
GET /api/orgs/[orgId]/semantic-search  Semantic search with embeddings
GET /api/orgs/[orgId]/skills/suggestions  Skill name autocomplete
GET /api/orgs/[orgId]/notifications    In-app notifications list
PATCH /api/orgs/[orgId]/notifications/[id]/read    Mark one read
POST /api/orgs/[orgId]/notifications/read-all      Mark all read
GET /api/orgs/[orgId]/ops/metrics      Operations metrics (queue health, etc.)
GET /api/orgs/[orgId]/export           Full org data export
```

### Utility Routes
```
GET /api/locations/suggestions?query=... City/country autocomplete (country-state-city)
GET /api/jobs-status                      All jobs with current match counts
GET /api/candidates/[cId]/skills          (legacy unscoped, verified via membership check)
GET /api/candidates/[cId]/resumes         (legacy unscoped)
POST /api/candidates/[cId]/extract-skills (legacy unscoped)
```

### Error Response Format
```json
{ "error": "Message", "code": "ERROR_CODE", "details": [...] }
```
HTTP status: 400 (validation), 401 (no auth), 403 (no permission), 404 (not found), 429 (rate limit), 500 (server error)

### Rate Limits (4-tier system)
| Tier | Limit | Window |
|---|---|---|
| General API | 100 requests | 1 minute |
| LLM operations | 50 requests | 1 hour |
| Bulk import | 5 requests | 1 hour |
| Auth endpoints | 10 requests | 15 minutes |

---

## 15. Security & Permissions

### What Was Fixed (Security Audit — Feb 2025)

**1. XSS Prevention (4 fixes)**
- Created `sanitizeHtml()` in `src/lib/security.ts` — encodes `& < > " ' /`
- Applied to communication templates, error messages, bulk import display

**2. Log Injection Prevention (3 fixes)**
- Created `sanitizeForLog()` — removes newlines/tabs, truncates to 1000 chars
- Applied to all `console.error()` calls that include user input

**3. API Route Security**
All unscoped routes (`/api/candidates/*`, `/api/jobs/*`) protected via `verifyResourceAccess()`:
- Validates Clerk auth
- Looks up resource (candidate/job) in DB
- Verifies that resource's `orgId` matches the caller's org membership
- Returns 403 if mismatch

**Bootstrap endpoint** (`/api/bootstrap`): disabled in production (`NODE_ENV` check)
**Debug endpoint** (`/api/debug/user`): disabled in production

**4. Input Validation**
All API routes use Zod schemas for request body validation. Invalid input → 400 with field-level errors.

### Security Utilities (`src/lib/security.ts`)

```typescript
sanitizeForLog(input: string) → removes newlines, truncates
sanitizeHtml(input: string)   → HTML entity encoding
validateInternalUrl(url)      → ensures same-origin /api/ path
buildApiUrl(path)             → constructs safe internal API URL
sanitizeObjectForLog(obj)     → redacts password/token/secret/apiKey fields recursively
```

### RBAC Implementation

`src/lib/rbac.ts` — `enforcePermission(userId, orgId, permission)`:
- Looks up `Membership` for `userId + orgId`
- Role permission matrix:
  - OWNER: all 13 permissions
  - ADMIN: all except `members:write`, `settings:write`
  - MEMBER: read-only for most, `candidates:write` and `matches:write`
- Throws `PermissionError` (caught by route handlers → 403)

---

## 16. Database Optimizations

### Composite Indexes Added

| Table | Index | Purpose |
|---|---|---|
| Candidate | `[orgId, email]` | Fast duplicate lookup during import |
| Candidate | `[orgId, phone]` | Fast duplicate lookup by phone |
| Candidate | `[orgId, fullName]` | Fast name search |
| Candidate | `[orgId, status]` | Filter active/inactive candidates |
| Candidate | `[orgId, createdAt]` | Timeline queries |
| Job | `[orgId, status]` | List open positions |
| Job | `[orgId, createdAt]` | Newest jobs first |
| MatchResult | `[jobId, score]` | Sort candidates by score |
| MatchResult | `[candidateId, score]` | Best jobs for a candidate |
| MatchResult | `[jobId, createdAt]` | Match history timeline |
| MatchResult | `[orgId, createdAt]` | Analytics queries |
| MatchDecisionLog | `[orgId, createdAt]` | Audit log timeline |

### Performance Impact
Before: O(n) full table scan — ~500ms with 10K candidates
After: O(log n) B-tree index lookup — ~5ms
**100x faster** for common org-scoped queries.

### JobStatus Enum
Changed from free-form string to PostgreSQL enum: `OPEN` / `CLOSED`
Prevents invalid status values, adds type safety.

### Notes on Vector Embeddings
Current: `embedding Json?` — stores as JSON array
Future migration: `embedding Unsupported("vector(384)")` using pgvector extension
Should migrate when semantic search becomes slow (>1000 candidates with embeddings).

---

## 17. Design System & UI Components

### Theme — Prestige Aesthetic

The app uses a premium dark-slate prestige theme. Key design decisions:
- **No bright colors** — black, slate, white only, with subtle gradients
- **Rounded everything** — `rounded-3xl` (cards), `rounded-2xl` (buttons/inputs), `rounded-xl` (badges)
- **Glassmorphism** — cards have backdrop blur and semi-transparent backgrounds
- **Typography** — font-black for headings, font-semibold for labels, normal weight for body

### CSS Custom Classes (in `extraordinary.css`)

| Class | Description |
|---|---|
| `prestige-bg` | Dark diagonal gradient background on major pages |
| `prestige-grid` | Subtle dot grid overlay |
| `prestige-card` | Glass card: `backdrop-blur`, `bg-white/5`, border |
| `prestige-accent` | Primary CTA: dark background, white text |
| `prestige-pill` | Small info badge with background |
| `prestige-title` | Gradient text (slate-900 to slate-600) |
| `prestige-stroke` | Outlined button style |
| `prestige-surface` | Slightly elevated surface |
| `premium-block` | Content container with shadow |
| `premium-subblock` | Nested section within a block |
| `inner-scroll` | Scrollable inner container |
| `tech-auth` | Auth page container (used for Clerk centering fixes) |

### Clerk Centering Overrides

Sign-in/sign-up pages have these CSS overrides to fix Clerk's default left-alignment:
```css
.tech-auth .cl-rootBox,
.tech-auth .cl-card,
.tech-auth .cl-cardBox,
.tech-auth .cl-main,
.tech-auth .cl-form {
  width: 100% !important;
  max-width: 100% !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
}
```

### shadcn/ui Components Used

From `src/components/ui/`: Card, Badge, Button, Input, Textarea, Dialog, AlertDialog, Separator, Tabs, Tooltip, DropdownMenu, ScrollArea, Avatar, Select, Label, Skeleton, Progress

### Key Custom Components

**`AnalyticsDashboard`** (`src/components/analytics-dashboard.tsx`) — full Recharts dashboard. Used on both `/` dashboard home and `/intelligence`.

**`AppShell`** (`src/components/app-shell/app-shell.tsx`) — outer layout: sidebar (left) + topbar (top) + main content area.

**`Sidebar`** (`src/components/app-shell/sidebar.tsx`) — navigation links, org name, user avatar. Collapses on mobile.

**`Topbar`** (`src/components/app-shell/topbar.tsx`) — org name pill, notification bell (with unread count badge), user profile dropdown.

**`ResumeUploader`** — drag-and-drop resume upload with parsing feedback.

**`RefreshAllMatches`** — "Re-run All Matchboards" button with loading state.

**`ExportAuditPanelClient`** — Export org data controls on dashboard.

### Responsive Design
- Mobile: sidebar collapses, grid becomes 1-column, padding reduces
- Tablet: `sm:` and `md:` breakpoints
- Desktop: `lg:` and `xl:` breakpoints, sidebar always visible

---

## 18. Development Setup & Commands

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (local or cloud)
- Ollama installed and running (for local AI — optional but recommended)
- npm

### Initial Setup
```bash
# 1. Clone repo
git clone https://github.com/ahmadkhan46/Next-Hire.git
cd Next-Hire

# 2. Install dependencies
npm install

# 3. Copy env file
cp .env.example .env
# Edit .env with your credentials (see Section 22)

# 4. Push schema to database
npm run db:push

# 5. (Optional) Seed sample data
npm run db:seed

# 6. Start dev server
npm run dev
```

### Available Commands
```bash
npm run dev          # Start dev server (Turbopack) at http://localhost:3000
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint check
npm run type-check   # TypeScript type check (no emit)
npm run db:push      # Push schema to DB without migration files
npm run db:migrate   # Run migration files
npm run db:studio    # Open Prisma Studio at localhost:5555
npm run db:seed      # Seed sample data
```

### Ollama Setup (for free local AI)
```bash
# 1. Install Ollama: https://ollama.com
# 2. Pull the models:
ollama pull apex-resume-qwen-3b:latest  # resume parsing (already fine-tuned)
ollama pull nomic-embed-text             # semantic embeddings

# 3. Verify
ollama list

# 4. Set in .env:
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_RESUME_MODEL=apex-resume-qwen-3b:latest
OLLAMA_TAILOR_MODEL=apex-resume-8b  # when this model is ready
```

### Important Dev Notes

1. **After changing `src/lib/skills-taxonomy.ts`** → restart dev server (`npm run dev`)
   - Module-level constants are cached by Turbopack and don't hot-reload

2. **After changing any module-level constant in API routes** → restart dev server

3. **If Turbopack panics** with "Next.js package not found":
   - Delete `.next` folder entirely
   - Run `npm run dev` again

4. **Database changes** → run `npm run db:push` (dev) or `npm run db:migrate` (prod)

5. **Prisma client out of date** → run `npx prisma generate`

---

## 19. Deployment Guide

### Current Setup: Vercel

The app auto-deploys to Vercel on every push to `main` branch.

### Vercel Environment Variables to Set
(Set these in Vercel dashboard → Project → Settings → Environment Variables)

```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
OPENAI_API_KEY=sk-...
OPENAI_RESUME_MODEL=gpt-4o-mini
PRISMA_CLIENT_ENGINE_TYPE=library
PRISMA_CLI_QUERY_ENGINE_TYPE=library
```

**Note:** Do NOT add `OLLAMA_BASE_URL` or `OLLAMA_RESUME_MODEL` to Vercel — Ollama only runs locally. In production, the app falls back to OpenAI automatically.

### Pre-Deploy Checklist
```bash
npm run predeploy:check   # runs scripts/predeploy-check.mjs
npm run build             # verify no build errors
npm run type-check        # verify no TypeScript errors
npm run lint              # verify no lint errors
npx prisma migrate deploy # apply migrations to production DB
```

### Alternative Deployment: Railway

Railway supports both the web app and a worker process from the same repo.

```bash
# Install Railway CLI
npm i -g @railway/cli
railway login
railway link

# Set variables
railway variables set DATABASE_URL=...
railway variables set OPENAI_API_KEY=...
# ... (all other required vars)

# Deploy web service
railway up  # Build: npm ci && npm run build, Start: npm run start

# Deploy worker service (separate Railway service, same repo)
railway up  # Start: npm run workers
```

### Alternative Deployment: Render

Create two Render services:
1. **Web Service** — Build: `npm ci && npm run build`, Start: `npm run start`
2. **Worker Service** — Build: `npm ci && npm run build`, Start: `npm run workers`

### Post-Deploy Steps
```bash
npx prisma migrate deploy   # apply schema migrations
npx prisma generate         # generate Prisma client
# Verify: GET /api/health
# Verify: GET /api/orgs/[orgId]/ops/metrics
```

---

## 20. Challenges Faced & How We Solved Them

### Challenge 1: Auth Bootstrap Race Condition
**Problem:** After Clerk sign-in, user redirects to `/orgs/demo`. The demo page checks for a DB `User` record — but none exists yet (Clerk authenticated successfully, but no DB record was created). User sees "Sign In" button again despite being authenticated. Required 3-4 page refreshes for the DB to "load".

**Root cause:** No mechanism to create the DB user record on first sign-in. Clerk and PostgreSQL are separate systems.

**Solution:** Made `/api/orgs/my` auto-bootstrap:
```typescript
// If no DB membership found, create User + Organization + Membership in one transaction
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.upsert({...});
  let org = await tx.organization.findFirst({...});
  if (!org) {
    org = await tx.organization.create({...});
    await tx.membership.create({...});
  }
  return { orgId: org.id };
});
```
Now first sign-in is instant — one API call creates everything.

---

### Challenge 2: Turbopack Cache Panics
**Problem:** Dev server showed `FATAL: Failed to write app endpoint — Next.js package not found` and crashed. Happened randomly, sometimes after cold starts.

**Root cause:** Two issues combined:
1. Stale `.next/node_modules` cache directory
2. `onDemandEntries` in `next.config.ts` — this is a webpack-only config option, invalid in Turbopack

**Solution:**
1. Removed `onDemandEntries` from `next.config.ts`
2. Deleted `.next` cache folder entirely
3. Restarted dev server

---

### Challenge 3: Skill Extraction False Positives
**Problem:** Skill extraction was finding "Chai" (JS testing library) in JDs that didn't mention Chai at all — because it was substring matching against the word "chai-lenging" or similar. Also extracting "AI", "Authentication" as skills.

**Root cause:** Using `String.indexOf()` (substring match) instead of word-boundary matching. "Chai" found in "chain", "chai-lenging", etc.

**Solution:**
```typescript
// Before: indexOf substring match
// After: word-boundary regex
const hasOnlyWordChars = /^\w+$/.test(needle);
const pattern = hasOnlyWordChars
  ? `\\b${escaped}\\b`           // pure word chars: use \b
  : `(?<![\\w])${escaped}(?![\\w])`;  // special chars (C++, .NET): use lookahead
const regex = new RegExp(pattern, "g");
```
Plus: added `GENERIC_SKILL_DENYLIST` to block single-letter acronyms and overly generic terms.
Plus: removed "AI" and "Authentication" from the taxonomy entirely.

---

### Challenge 4: Module Constants Don't Hot-Reload
**Problem:** After updating `SKILLS_TAXONOMY` in `skills-taxonomy.ts`, re-running skill generation still showed old results. Old skills still extracted, new ones not found.

**Root cause:** Turbopack (and webpack) cache module-level constants at server startup. The `SKILLS_TAXONOMY` object is computed once at import time and not re-evaluated on hot reload.

**Solution:** Must restart dev server (`npm run dev`) after changing any module-level constant in a file used by API routes. This is a fundamental Node.js/bundler behavior.

---

### Challenge 5: Ollama JSON Schema Mismatch
**Problem:** Fine-tuned `apex-resume-qwen-3b` model outputs JSON in a different schema than what the app's `CandidateProfileExtract` type expects. Naively using the model output failed Zod validation.

**Root cause:** Training data used a flat, simple schema. The app needs a nested schema with specific field names and types.

**Solution:** Created `mapToAppSchema()` function that converts:
- Training schema → App schema
- Flat `name`, `email` → `personal.fullName`, `personal.email`
- Experience `period: "Jun 2024 to Sep 2024"` → `{start: {year: 2024, month: 6}, end: ...}`
- Skills object `{Languages: [...]}` → `technologies: [{category: "LANGUAGES", items: [...]}]`

---

### Challenge 6: Sign-In UI Left-Alignment
**Problem:** Clerk's `<SignIn>` component rendered with significant left margin, appearing off-center even with `mx-auto` on the parent container. The centering instructions in Clerk docs didn't work.

**Root cause:** Clerk's internal `cardBox` and `main` elements have hardcoded left margin/width in their CSS.

**Solution:**
1. Pass `appearance` prop to Clerk:
```typescript
appearance={{
  elements: {
    cardBox: "w-full shadow-none",
    main: "w-full",
  }
}}
```
2. Plus CSS overrides targeting Clerk's internal class names with `!important`.

---

### Challenge 7: JD Text Not Selectable
**Problem:** The job description displayed in read-only mode had CSS classes `select-none` and `cursor-default`. Users couldn't select or copy the JD text.

**Solution:** Simple CSS fix — changed `select-none cursor-default` to `select-text cursor-text` on all read-only display divs in `job-details-form.tsx`.

---

### Challenge 8: Local vs Deployed Auth Difference
**Problem:** Local dev shows email+password form. Deployed Vercel version shows OTP only. User confused why they look different.

**Explanation:** Two separate Clerk application instances:
- **Test instance** (keys: `pk_test_...`) — used in local `.env.local`, configured with email+password strategy
- **Live instance** (keys: `pk_live_...`) — used in Vercel env vars, configured with OTP/Google strategy

This is intentional and correct. Test instance allows easy local testing. Live instance uses more secure passwordless auth.

---

### Challenge 9: Duplicate Skills Not Detected During Generation
**Problem:** After removing "AI" and "Authentication" from the taxonomy, old jobs still showed them as skills. Re-running skill generation showed "New: 0, Unchanged: 3" — the old skills persisted.

**Root causes:**
1. Old skills still in database — generation only ADDS/UPDATES, never DELETES
2. User was clicking "Re-run matching" instead of "Generate from description"
3. Taxonomy changes weren't reflected (needed dev server restart)

**Solution:** After taxonomy changes:
1. Restart dev server
2. Manually delete old bad skills via trash icon on job skills page
3. Click "Generate from description" (not "Re-run matching")

---

### Challenge 10: TypeScript Scope Error in Bootstrap Route
**Problem:** `/api/orgs/my/route.ts` had a TypeScript error: "Cannot find name 'email'" — 4 occurrences. The variable `email` was declared inside one `if (!membership)` block but referenced in a second separate `if (!membership)` block.

**Solution:** Renamed outer variable to `resolvedEmail` (declared before the first if-block), then `const email = resolvedEmail` inside the transaction block where it was needed.

---

## 21. Enterprise Roadmap

### Currently Implemented (Production-Ready)
- ✅ Multi-tenancy with org isolation
- ✅ RBAC with 13 permissions
- ✅ Rate limiting (4-tier)
- ✅ XSS prevention
- ✅ Log injection prevention
- ✅ Input validation (Zod on all API boundaries)
- ✅ Composite database indexes
- ✅ Audit logging (candidate activity, job page, match decisions, skill generation)
- ✅ LLM cost tracking
- ✅ Semantic search (cosine similarity on embeddings)
- ✅ Duplicate detection (3-layer identity system)
- ✅ Background job queue (BullMQ)
- ✅ Retry mechanism for failed uploads
- ✅ Full export capabilities

### Planned Enhancements (Prioritized)

**P0 — Critical**
- Global auth middleware (currently per-route checks, should be centralized)
- Data retention policies (GDPR right to erasure, automated cleanup)
- LLM budget caps per org

**P1 — High Value**
- pgvector native SQL similarity search (replace in-memory cosine)
- Resume tailoring UI (frontend for the `apex-resume-8b` pipeline already built)
- Interview scheduling integration (Google Calendar, Outlook)
- Email notifications (Resend integration)

**P2 — Growth**
- Stripe billing integration (SaaS monetization)
- Public API with API keys for customers
- Webhook system (candidate.created, match.status_changed events)
- ATS integrations (Greenhouse, Lever OAuth)
- Slack/Teams notifications

**P3 — Enterprise**
- SOC 2 compliance audit trail
- GDPR data export + deletion workflows
- Per-tenant database schemas (extreme isolation)
- Custom reporting/BI dashboards
- Bias detection in hiring decisions

---

## 22. Environment Variables

```env
# ─── Database ────────────────────────────────────────────
DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_career"
DIRECT_URL="postgresql://postgres:password@localhost:5432/ai_career"
PRISMA_CLIENT_ENGINE_TYPE="library"
PRISMA_CLI_QUERY_ENGINE_TYPE="library"

# ─── App ─────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ─── Clerk (Auth) ────────────────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/orgs/demo
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/orgs/demo

# ─── Ollama (Local AI — primary, zero cost) ──────────────
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_RESUME_MODEL=apex-resume-qwen-3b:latest
OLLAMA_TAILOR_MODEL=apex-resume-8b

# ─── OpenAI (Fallback — only used when Ollama unavailable) ─
OPENAI_API_KEY=sk-...
OPENAI_RESUME_MODEL=gpt-4o-mini
OPENAI_RESUME_TIMEOUT_MS=45000

# ─── Queue (BullMQ / optional Redis) ─────────────────────
QUEUE_MODE=memory          # "memory" (dev) or "redis" (production)
REDIS_URL=redis://...      # Required when QUEUE_MODE=redis

# ─── Rate Limiting (optional, uses in-memory fallback) ───
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# ─── Candidate Matching ───────────────────────────────────
MATCH_CANDIDATES_LIMIT=500  # Max candidates to score per job (default: 500)

# ─── NOT committed to git (.env is gitignored) ───────────
# Never commit credentials. .env* files are in .gitignore.
```

**Important:** `OLLAMA_*` variables are for local dev only — do NOT set on Vercel. The app detects their absence and uses OpenAI instead.

---

## 23. Video Walkthrough Script

> This section is written for an AI agent that will record a screen capture video of NextHire to show HR professionals.

### Pre-recording Checklist
- [ ] Start dev server: `npm run dev`
- [ ] Start Ollama: ensure `ollama list` shows `apex-resume-qwen-3b:latest`
- [ ] Open http://localhost:3000 in browser
- [ ] Have a sample PDF resume ready to upload
- [ ] Have a sample job description ready to paste

---

### Scene 1 — Landing Page (0:00–0:30)

**Navigate to:** http://localhost:3000

**Narrate:**
"This is NextHire — an AI-powered recruitment platform built for HR teams. The moment you visit, you see the core promise: hire smarter, not harder. Three pillars: AI matching, real-time analytics, and audit-ready compliance."

**Actions:**
- Scroll slowly down the landing page
- Point out the three feature cards (AI Matching, Real-Time Analytics, Audit Ready)
- Point out the stats row: 95% match accuracy, 10x faster screening, 100% audit compliant
- Click "Get Started Free" button

---

### Scene 2 — Sign In / Sign Up (0:30–1:00)

**Navigate to:** /sign-in

**Narrate:**
"Sign-in uses Clerk for enterprise-grade authentication. The UI is custom-designed to match NextHire's premium aesthetic — notice the centered form, clean typography, no distractions."

**Actions:**
- Show the sign-in page with logo at top
- Show the form centered properly
- Sign in with test credentials
- Watch the redirect happen automatically

---

### Scene 3 — Dashboard (1:00–2:00)

**Navigate to:** /orgs/[orgId]

**Narrate:**
"After signing in, you land on the Recruitment Intelligence dashboard. The Neural Analytics section gives you a live picture of your entire hiring operation — candidates over time, top skills in your talent pool, match score distribution."

**Actions:**
- Pause on the "Recruitment Intelligence" hero block
- Scroll down to show the analytics charts
- Point out each chart: "This shows how fast your candidate pool is growing. This shows the most common skills. This shows how matches are distributed across score ranges."
- Point out the three stat cards at the bottom: Talent Pool count, Active Jobs count, AI Match Score

---

### Scene 4 — Creating a Job (2:00–3:30)

**Navigate to:** /orgs/[orgId]/jobs

**Narrate:**
"Every hiring workflow starts with a job. Click New Job, give it a title, paste the full job description, and set the requirements."

**Actions:**
- Click "New Job" button
- Type title: "Senior Full-Stack Engineer"
- Paste a full job description (several paragraphs mentioning React, TypeScript, Node.js, PostgreSQL, AWS, Docker)
- Set Min. Years of Experience: 3
- Set Work Mode: Hybrid
- Click Create
- See the job appear in the list
- Click "View" to go to the job page

---

### Scene 5 — AI Skill Extraction (3:30–5:00)

**Navigate to:** /orgs/[orgId]/jobs/[jobId]/skills

**Narrate:**
"Here's where the AI earns its keep. The job description you pasted is analyzed automatically. Click 'Generate from description' and watch what happens."

**Actions:**
- Click "Generate from description" button
- Preview dialog appears — point out each section:
  - "New skills: React, TypeScript, Node.js, PostgreSQL, AWS, Docker — 6 skills found"
  - "Each skill has an automatically assigned weight. React appeared 4 times with 'required' context — Critical weight 5. Docker appeared once with 'nice to have' — Low weight 2."
- Click "Apply changes"
- Skills appear in the list with colored weight badges
- "Now the job has a clear skill requirement profile that the AI can match candidates against."

---

### Scene 6 — Adding a Candidate (5:00–7:00)

**Navigate to:** /orgs/[orgId]/candidates

**Narrate:**
"Now let's add a candidate. In real use, you'd upload a resume. Let me show you both the manual add and the AI resume parsing."

**Actions:**
- Click "Add Candidate"
- Fill in name: "Alex Johnson", email: "alex.johnson@email.com"
- Click save — candidate appears in list
- Click the candidate card
- In the resume section: drag and drop a PDF resume file
- Watch the parsing happen: "The AI is reading this resume right now — extracting every skill, work experience, project, and education entry."
- After parse completes: scroll through the populated sections
  - "Look — skills populated automatically: React, TypeScript, Node.js, PostgreSQL, three years of experience at Google, two personal projects. All from one PDF upload."

---

### Scene 7 — The Matchboard (7:00–9:00)

**Navigate to:** /orgs/[orgId]/matchboard

**Narrate:**
"This is the Matchboard — the heart of NextHire. Select the job we just created."

**Actions:**
- Select "Senior Full-Stack Engineer" from the job dropdown
- Click "Re-run Matching"
- Results appear: ranked list of candidates by score
- Point to the top candidate: "Alex Johnson scores 82%. Look at the matched skills in green — React, TypeScript, Node.js, PostgreSQL — all matched. Docker is missing in red, flagged as Low weight so it doesn't heavily penalize the score."
- Show the score breakdown: "The algorithm is transparent. 60% from experience years, 30% from skill matching, 10% from projects."
- Click "Shortlist" on the top candidate
- "Decision logged instantly with timestamp. Every shortlist and reject decision is permanently recorded."

---

### Scene 8 — Candidate Detail Deep Dive (9:00–11:00)

**Navigate to:** /orgs/[orgId]/candidates/[candidateId]

**Narrate:**
"Let's go inside Alex Johnson's profile."

**Actions:**
- Show the profile header: name, title, years of experience, tags
- Scroll to Skills section: "16 skills extracted from the resume, auto-categorized"
- Scroll to Experience section: "Every job with dates, company, role, and bullet points"
- Scroll to Job Matches panel: "The 82% match for Senior Full-Stack Engineer is right here. We can change status, see exactly which skills match and which don't."
- Show the Notes panel: type a quick recruiter note
- Show the Interviews panel: "We can schedule an interview right here — date, time, meeting type, interviewer name"
- Show the Activity Timeline: "Every single action is recorded — resume uploaded, parsed, skill added, status changed"

---

### Scene 9 — Analytics (11:00–11:30)

**Navigate to:** /orgs/[orgId]/intelligence

**Narrate:**
"The Intelligence page gives hiring managers a live view of their entire recruitment pipeline."

**Actions:**
- Show the analytics charts
- "Candidates over time, skill frequency, match score distribution — all live data"
- "This tells you: where are the skill gaps in your talent pool? Are you getting better matches as your pool grows?"

---

### Scene 10 — Closing (11:30–12:00)

**Navigate back to:** /orgs/[orgId]

**Narrate:**
"That's NextHire in 12 minutes. From posting a job to ranked candidates in seconds. AI-powered skill extraction, transparent weighted matching, full audit trail, and enterprise-grade security. Built entirely from scratch by Ahmad Khan."

**Actions:**
- Show the dashboard with real candidate count, job count, match score
- End on the "Recruitment Intelligence" heading

---

## Appendix: Key File Locations

| Feature | File Path |
|---|---|
| Matching algorithm | `src/lib/auto-matching.ts` |
| Skill extraction | `src/lib/job-skill-generation.ts` |
| Skills taxonomy | `src/lib/skills-taxonomy.ts` |
| Ollama resume parser | `src/lib/ollama-resume-llm.ts` |
| Ollama tailor client | `src/lib/ollama-tailor-llm.ts` |
| Resume orchestrator | `src/lib/resume-llm.ts` |
| Semantic search | `src/lib/semantic-search.ts` |
| Embeddings | `src/lib/embeddings.ts` |
| RBAC | `src/lib/rbac.ts` |
| Security utils | `src/lib/security.ts` |
| API middleware | `src/lib/api-middleware.ts` |
| Auth bootstrap | `src/app/api/orgs/my/route.ts` |
| DB client | `src/lib/prisma.ts` |
| Database schema | `prisma/schema.prisma` |
| Global CSS + Clerk fixes | `src/app/extraordinary.css` |
| App shell layout | `src/components/app-shell/app-shell.tsx` |
| Sign-in page | `src/app/sign-in/[[...sign-in]]/page.tsx` |
| Sign-up page | `src/app/sign-up/[[...sign-up]]/page.tsx` |
| Dashboard | `src/app/orgs/[orgId]/page.tsx` |
| Jobs list | `src/app/orgs/[orgId]/jobs/page.tsx` |
| Job skills page | `src/app/orgs/[orgId]/jobs/[jobId]/skills/page.tsx` |
| Candidates list | `src/app/orgs/[orgId]/candidates/page.tsx` |
| Candidate detail | `src/app/orgs/[orgId]/candidates/[candidateId]/page.tsx` |
| Matchboard | `src/app/orgs/[orgId]/matchboard/page.tsx` |
| Analytics | `src/app/orgs/[orgId]/intelligence/page.tsx` |
| Upload history | `src/app/orgs/[orgId]/uploads/page.tsx` |
| Settings | `src/app/orgs/[orgId]/settings/page.tsx` |
| Match API | `src/app/api/jobs/[jobId]/match/route.ts` |
| Skill generation API | `src/app/api/jobs/[jobId]/skills/generate/route.ts` |
| Resume upload API | `src/app/api/orgs/[orgId]/candidates/[candidateId]/resumes/upload/route.ts` |

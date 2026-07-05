# NextHire — Complete Project Knowledge File

> **Purpose of this file:** Single source of truth for the NextHire project. Used as Claude project knowledge, and as a briefing document for AI agents creating video walkthroughs or demos. Read this in full before doing anything with the project.

---

## 1. What Is NextHire?

NextHire is an **AI-powered recruitment platform built for hiring teams and HR professionals**. It transforms the hiring process from slow, manual resume screening into a fast, intelligent, audit-ready workflow.

**Core value proposition:**
- Post a job with a description → AI extracts required skills automatically
- Upload candidate resumes (bulk or single) → AI parses them, extracts skills, experience, education
- Click one button → AI scores every candidate against every job skill with weighted matching
- See a ranked leaderboard of candidates for any job
- Track shortlist/reject decisions with a full audit trail

**This is NOT a job-seeker app.** It is used by HR managers and recruiters to manage their own candidate pool and job openings.

**Creator:** Ahmad Khan (ahmadsaidkhan46@gmail.com / GitHub: AhmadKhan46)  
**App URL (local):** http://localhost:3000  
**GitHub:** https://github.com/ahmadkhan46/Next-Hire  
**Deployed:** Vercel (auto-deploys on push to main)

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 + shadcn/ui + Framer Motion |
| Auth | Clerk (Google OAuth + Email/Password + OTP — depends on instance) |
| Database | PostgreSQL (local: `ai_career` DB via Prisma ORM) |
| AI — Resume Parsing | Ollama local model `apex-resume-qwen-3b:latest` (fine-tuned QLoRA Qwen2.5-3B, 1.9GB) → fallback: OpenAI `gpt-4o-mini` |
| AI — Resume Tailoring | Ollama local model `apex-resume-8b` (fine-tuned, 8B params) |
| AI — Embeddings | Ollama `nomic-embed-text` → stored as JSON in PostgreSQL |
| AI — Matching | Pure algorithmic: weighted skill intersection scoring (no LLM) |
| Charts | Recharts |
| Notifications | Sonner (toast) |
| Logging | Winston |
| Rate Limiting | Upstash Redis + @upstash/ratelimit |
| Queue | BullMQ + ioredis |
| File Parsing | `pdf-parse` + `pdfjs-dist` (PDFs), `mammoth` (DOCX) |
| Phone Validation | libphonenumber-js |
| Export | `docx` npm package |

---

## 3. Project Structure

```
src/
├── app/                      — Next.js pages and API routes
│   ├── page.tsx              — Landing page (public)
│   ├── sign-in/              — Clerk sign-in page (custom styled)
│   ├── sign-up/              — Clerk sign-up page (custom styled)
│   ├── orgs/
│   │   ├── demo/             — Demo/fallback org pages
│   │   └── [orgId]/          — Main authenticated app (all features here)
│   │       ├── page.tsx      — Dashboard home
│   │       ├── jobs/         — Job management
│   │       ├── candidates/   — Candidate management
│   │       ├── matchboard/   — AI matching leaderboard
│   │       ├── intelligence/ — Analytics
│   │       ├── uploads/      — Resume upload history
│   │       └── settings/     — Org settings
│   └── api/                  — ~60 REST API endpoints
├── components/               — Shared React components
├── lib/                      — Business logic, AI clients, utilities
│   ├── auto-matching.ts      — Core weighted skill matching engine
│   ├── job-skill-generation.ts — Extract skills from JD text
│   ├── skills-taxonomy.ts    — 300+ skill taxonomy (the source of truth for JD extraction)
│   ├── ollama-resume-llm.ts  — Ollama client for resume parsing
│   ├── ollama-tailor-llm.ts  — Ollama client for resume tailoring (apex-resume-8b)
│   ├── resume-llm.ts         — Resume parse orchestration (Ollama → OpenAI fallback)
│   ├── semantic-search.ts    — pgvector-style cosine similarity search
│   ├── embeddings.ts         — Ollama nomic-embed-text integration
│   └── rbac.ts               — Role-based access control
└── prisma/
    └── schema.prisma         — Full database schema
```

---

## 4. Authentication & Multi-Tenancy

### Sign-In Flow
1. User visits `/sign-in` — custom styled Clerk component (logo at top, centered card)
2. Clerk authenticates (Google OAuth or email/password depending on instance)
3. After sign-in → redirect to `/orgs/demo`
4. `/api/orgs/my` auto-bootstraps: if no DB record exists, creates `User` + `Organization` + `Membership` in one transaction
5. Redirect resolves to `/orgs/[orgId]` (their workspace)

### Sign-Up Flow
1. `/sign-up` — same custom styled Clerk component
2. After signup → same bootstrap flow

### Multi-Tenancy
- Every user belongs to an `Organization` (their workspace)
- All data is org-scoped: candidates, jobs, skills, matches all have `orgId`
- Layout auth check: `src/app/orgs/[orgId]/layout.tsx` verifies Clerk session + DB membership before rendering any org page
- **Local dev:** Uses Clerk test instance (may use email/password)
- **Production/deployed:** Uses Clerk live instance (may use OTP/Google)

### Roles
`OWNER`, `ADMIN`, `MEMBER` — enforced via `src/lib/rbac.ts` on API routes

---

## 5. All Pages — Complete Reference

### 5.1 Landing Page (`/`)
**URL:** http://localhost:3000/  
**Access:** Public (no auth required)

**What it shows:**
- Hero section: "Hire Smarter, Not Harder" headline with a gradient title
- Three feature cards: AI Matching, Real-Time Analytics, Audit Ready
- Stats row: 95% Match Accuracy, 10x Faster Screening, 100% Audit Compliant
- CTA buttons: "Get Started Free" → `/sign-up`, "Sign In" → `/sign-in`
- If already signed in: "Go to workspace" → `/orgs/demo`

**Design:** Dark prestige theme with grid background, glossy cards (CSS classes: `prestige-bg`, `prestige-card`, `prestige-accent`). Mobile responsive.

---

### 5.2 Sign-In Page (`/sign-in`)
**URL:** http://localhost:3000/sign-in  
**Access:** Public

**What it shows:**
- Logo + "NextHire" title at top
- Tagline: "AI-powered recruitment intelligence"
- Clerk `<SignIn>` component (centered, full-width card)
- Link to sign-up page below

**After sign-in:** Redirects to `/orgs/demo` which resolves to the user's real org

---

### 5.3 Sign-Up Page (`/sign-up`)
**URL:** http://localhost:3000/sign-up  
**Access:** Public

**What it shows:**
- Same layout as sign-in but with Clerk `<SignUp>` component
- Link to sign-in below

---

### 5.4 Dashboard Home (`/orgs/[orgId]`)
**URL:** http://localhost:3000/orgs/[orgId]  
**Access:** Authenticated + org member only

**What it shows:**
- Hero block: "Recruitment Intelligence" heading with prestige styling
- Export/Audit panel (top right)
- **Neural Analytics section** — live charts from `AnalyticsDashboard` component:
  - Candidates added over time (line chart)
  - Skill frequency bar chart
  - Job pipeline status
  - Match score distribution
- Three stat cards:
  - **Talent Pool** — total candidate count + link to `/candidates`
  - **Active Jobs** — count of open positions + link to `/jobs`
  - **AI Matching** — average match score for newest job + link to `/matchboard`

---

### 5.5 Jobs Page (`/orgs/[orgId]/jobs`)
**URL:** http://localhost:3000/orgs/[orgId]/jobs  
**Access:** Authenticated

**What it shows:**
- Header with "Open Roles" title
- **"Re-run All Matchboards"** button — re-scores all candidates against all jobs
- **"New Job" / "Create Job"** button — opens a slide-out form
- Card with job list: each job card shows title, location, status badge (OPEN/CLOSED), work mode, description preview
- Each job card has **"View"** button → goes to `/orgs/[orgId]/jobs/[jobId]/skills`

**Create Job flow:**
1. Click "New Job" → form slides in
2. Enter title, description (paste the full JD here), location, work mode, min years of experience
3. Click "Create" → job is saved to DB
4. AI auto-generates skills from the JD description (taxonomy matching)

---

### 5.6 Job Detail / Skills Page (`/orgs/[orgId]/jobs/[jobId]/skills`)
**URL:** http://localhost:3000/orgs/[orgId]/jobs/[jobId]/skills  
**Access:** Authenticated

**This is the most feature-rich page in the app.**

**Left column — Job Details Card:**
- Read-only view of: title, description (selectable/copyable text), location, status, work mode, min years experience
- **"Edit"** button → all fields become editable inline
- Save changes → patches job via `PATCH /api/orgs/[orgId]/jobs/[jobId]`

**Center — Skills Editor:**
- List of all extracted skills for this job
- Each skill shows name + weight badge (1-5, displayed as: Critical W5, High W4, Standard W3, Low W2, Baseline W1)
- **Add skill** — type name + select weight → saves to DB
- **Delete skill** — trash icon → removes from job
- **"Generate from description"** button → opens preview dialog:
  - Shows: New skills to add, Weight updates for existing skills, Unchanged count
  - Click "Apply changes" to persist
- **"Re-run matching"** button → re-scores all candidates for this job

**Right column — Audit Timeline:**
- Chronological log of all changes: skills added/removed, matching runs, job detail updates
- Shows actor (user) and timestamp

**Bottom — Delete Job:**
- Red "Delete job" button with confirmation dialog
- Cascades: deletes all matches, skills, audit logs for that job

**How skill generation works:**
1. Scans the job description text
2. For each of 300+ skills in the taxonomy, counts word-boundary regex matches in the JD
3. Checks surrounding context for must-have hints ("required", "essential", "must") → weight 5
4. Checks for nice-to-have hints ("preferred", "bonus") → weight 2
5. Frequency ≥ 2 → weight 4, else weight 3
6. Sorts by weight then frequency, returns top 15
7. Generic skills like "AI", "API", "IT" are blocked by denylist

---

### 5.7 Candidates Page (`/orgs/[orgId]/candidates`)
**URL:** http://localhost:3000/orgs/[orgId]/candidates  
**Access:** Authenticated

**What it shows:**
- "Talent Pool" heading with total count
- Search bar (searches by name or email, debounced)
- **Candidates list** — each card shows: name, email, current title, location, tags, created date
- Click any candidate → goes to `/orgs/[orgId]/candidates/[candidateId]`

**Action buttons (top right):**
- **"Add Candidate"** — manual form: name, email, phone, title, location, notes, years experience
- **"Bulk Import (CSV)"** — upload CSV with candidate data
- **"Bulk Upload Resumes"** — upload ZIP file or multiple PDFs/DOCXs
- **"Compare"** — opens candidate comparison tool

---

### 5.8 Candidate Detail Page (`/orgs/[orgId]/candidates/[candidateId]`)
**URL:** http://localhost:3000/orgs/[orgId]/candidates/[candidateId]  
**Access:** Authenticated

**Sections on this page:**

**Profile Header:**
- Full name, email, phone, location, current title
- Years of experience (calculated from work history)
- Status badge (ACTIVE, etc.)
- Tags (colored labels, can add/remove)
- Quick action buttons

**Resume Upload Section:**
- Drag-and-drop or click to upload PDF/DOCX
- After upload → AI parses it automatically:
  1. Extracts raw text from PDF/DOCX
  2. Sends to Ollama `apex-resume-qwen-3b:latest` (local, free, ~90s timeout)
  3. If Ollama fails or unavailable → falls back to OpenAI `gpt-4o-mini`
  4. Extracted data: personal info, work experience, education, skills, projects, technologies
  5. All data saved to DB, candidate profile auto-filled

**Skills Section:**
- Grid of extracted skills categorized by type (Programming Languages, Frontend, Backend, etc.)
- Source: parsed from resume by AI

**Experience Section:**
- Work history with company, role, dates, bullet points

**Education Section:**
- Schools, degrees, years

**Projects Section:**
- Project name, tech stack, dates, description bullets

**Job Matches Panel (right sidebar):**
- All jobs this candidate has been matched to
- Each match shows: job title, match score %, matched skills, missing skills
- Status: NONE / SHORTLISTED / REJECTED — click to change
- Full decision history per job

**Notes Panel:**
- Add/edit/delete recruiter notes
- Mark as important (starred)

**Interview Panel:**
- Schedule interviews: title, round, date/time, duration, type (Video/Phone/Onsite), meeting link, interviewer name
- Status: SCHEDULED / COMPLETED / CANCELLED / NO_SHOW

**Activity Timeline:**
- Full chronological log of every action on this candidate (resume uploaded, skill added, status changed, note added, interview scheduled, etc.)

**Similar Candidates:**
- Uses semantic embedding similarity (cosine similarity on resume embeddings)
- Shows top-N similar candidates from the talent pool

**"Refresh Matches" button:**
- Re-runs AI matching for this specific candidate against all jobs

---

### 5.9 Matchboard (`/orgs/[orgId]/matchboard`)
**URL:** http://localhost:3000/orgs/[orgId]/matchboard  
**Access:** Authenticated

**This is the core AI intelligence feature.**

**What it shows:**
- Job selector dropdown (choose which job to view matches for)
- Ranked list of ALL candidates scored against the selected job:
  - Candidate name, score %, matched skills (green), missing skills (red)
  - Experience score component
  - Status badge (NONE / SHORTLISTED / REJECTED)
- **Shortlist / Reject buttons** for each candidate — updates status and logs decision
- **Bulk status update** — select multiple, update at once
- Match history per candidate (who changed status, when, from what to what)
- **"Re-run Matching"** button — re-scores all candidates

**How AI matching works (the algorithm):**
1. For each candidate × job combination:
   - Get job skill list with weights (1-5)
   - Get candidate skill list
   - Normalize both sides (aliases: "node.js" = "nodejs" = "node")
   - For each job skill: check if candidate has it (fuzzy match with aliases)
   - `matchedWeight` = sum of weights of matched skills
   - `totalWeight` = sum of all job skill weights
   - `skillScore` = matchedWeight / totalWeight × 100
2. **Experience score:**
   - If job has `requiredYearsOfExperience`:
     - candidate years ≥ required → `experienceScore` = 100
     - candidate years < required → linear penalty (0 if 0 years)
     - Candidate is "disqualified" (score floored) if severely under
   - Final score = 60% experience + 30% skill score + 10% project bonus
3. Results sorted by score descending
4. Stored in `MatchResult` table (upsert on re-run)

**Critical skills:** Weight 5 skills are "critical" — a candidate missing a critical skill gets a visual indicator and score penalty.

---

### 5.10 Intelligence / Analytics (`/orgs/[orgId]/intelligence`)
**URL:** http://localhost:3000/orgs/[orgId]/intelligence  
**Access:** Authenticated

**What it shows:**
- Full analytics dashboard (same `AnalyticsDashboard` component as dashboard home)
- Candidates over time (line chart)
- Skill frequency across all candidates (bar chart)
- Job status distribution
- Match score distribution
- Pipeline metrics

Data comes from `/api/orgs/[orgId]/analytics` which aggregates live from the DB.

---

### 5.11 Candidate Compare (`/orgs/[orgId]/candidates/compare`)
**URL:** http://localhost:3000/orgs/[orgId]/candidates/compare?ids=id1,id2  
**Access:** Authenticated

**What it shows:**
- Side-by-side comparison of 2 candidates
- Education, experience, skills, projects compared column-by-column
- Semantic similarity score between the two candidates
- Option to manually pick candidates from a search picker if no IDs in URL
- Export comparison as report

---

### 5.12 Upload History (`/orgs/[orgId]/uploads`)
**URL:** http://localhost:3000/orgs/[orgId]/uploads  
**Access:** Authenticated

**What it shows:**
- Full log of all resume upload batches
- Filters: date range, source type (CSV/ZIP/PDF), status (completed/failed)
- Each batch: source name, total files, created/updated/failed counts, status badge
- Expand batch → see individual file results (filename, candidate created/updated/failed, error if any)
- **Retry failed** — re-process failed items in a batch
- **Export batch report** — download results as CSV

---

### 5.13 Settings (`/orgs/[orgId]/settings`)
**URL:** http://localhost:3000/orgs/[orgId]/settings  
**Access:** Authenticated

**What it shows:**
- Organization name (editable)
- Stats: total jobs, candidates, skills, members
- **Resume parse timeout** — configurable (default 30s) — how long to wait for AI parsing before timing out
- Workspace creation date
- LLM usage analytics (token counts, costs — $0 for Ollama calls)

---

### 5.14 Demo Pages (`/orgs/demo/*`)
**URL:** http://localhost:3000/orgs/demo  
**Access:** Public fallback

These are read-only demo versions of the main pages with no real data. Users land here when:
- Not authenticated
- Auth succeeded but no DB user/org found yet (during first-sign-in bootstrap)

---

## 6. Data Model (Prisma Schema Summary)

```
Organization
  ├── Membership[] (User → Org, roles: OWNER/ADMIN/MEMBER)
  ├── Job[]
  │   ├── JobSkill[] (→ Skill, with weight 1-5)
  │   ├── MatchResult[] (→ Candidate, score, matched/missing skills)
  │   ├── MatchDecisionLog[] (audit: who shortlisted/rejected, when)
  │   ├── JobSkillGenerationAudit[] (before/after snapshot of AI skill generation)
  │   └── JobPageAuditEvent[] (all edits to job details)
  ├── Candidate[]
  │   ├── Resume[] (raw text, parsed JSON, parse status, embedding)
  │   ├── CandidateSkill[] (→ Skill, optional proficiency level)
  │   ├── CandidateExperience[] (company, role, dates, bullets)
  │   ├── CandidateEducation[] (school, degree, years)
  │   ├── CandidateProject[] (title, tech stack, bullets)
  │   ├── CandidateTechnology[] (category, items — from AI parsing)
  │   ├── CandidateNote[] (recruiter notes, importance flag)
  │   ├── CandidateTag[] (color-coded labels)
  │   ├── CandidateInterview[] (scheduled/completed interviews)
  │   ├── CandidateActivity[] (full event log — 25+ event types)
  │   └── MatchResult[] (back-ref)
  ├── Skill[] (org-scoped skill names, referenced by both jobs and candidates)
  ├── ResumeUploadBatch[] (bulk upload jobs with progress tracking)
  ├── Notification[] (in-app notifications per user)
  └── User[] (via Membership)
```

**Key design decisions:**
- Every `Skill` is org-scoped — so "React" for org A and "React" for org B are separate records linked to the same org
- `MatchResult` is an upsert — re-running matching overwrites the previous score
- `Resume.rawText` — full extracted text from PDF/DOCX, used by AI for parsing
- `Resume.embedding` — JSON array from Ollama nomic-embed-text, used for semantic candidate search

---

## 7. AI Pipeline — How It All Works

### 7.1 Resume Parsing Pipeline

**Trigger:** Recruiter uploads a PDF or DOCX file on the candidate detail page.

**Steps:**
1. File received at `POST /api/orgs/[orgId]/candidates/[candidateId]/resumes/upload`
2. File text extracted:
   - PDF → `pdf-parse` or `pdfjs-dist`
   - DOCX → `mammoth`
3. Text sent to `extractCandidateProfile()` in `src/lib/resume-llm.ts`:
   - **Step A:** Check if Ollama is available (`OLLAMA_BASE_URL` set)
   - **Step B:** Call `apex-resume-qwen-3b:latest` via Ollama `/api/chat` (JSON mode, temp 0.1, 8k context, 90s timeout)
   - **If Ollama fails:** Fall back to OpenAI `gpt-4o-mini` with structured output schema
   - **If OpenAI fails:** Retry once with validation error context
4. Parsed JSON mapped to app schema:
   - `personal` → update candidate profile fields
   - `experience[]` → create `CandidateExperience` records
   - `education[]` → create `CandidateEducation` records
   - `projects[]` → create `CandidateProject` records
   - `skills[]` → upsert `Skill` + `CandidateSkill` records
   - `technologies[]` → create `CandidateTechnology` records
5. `Resume.parseStatus` set to `SAVED` (or `FAILED` with error)
6. Candidate profile auto-updated with extracted info

**Fine-tuned model details (`apex-resume-qwen-3b:latest`):**
- QLoRA fine-tuned on Qwen2.5-3B base
- Training data: synthetic resumes in various formats
- Input: raw resume text
- Output: structured JSON with name, email, phone, location, skills (by category), experience, education, projects, certifications

### 7.2 Job Skill Extraction Pipeline

**Trigger:** Creating a job with a description, or clicking "Generate from description" on the job skills page.

**Steps:**
1. Job description text fetched from DB
2. `suggestJobSkillsFromDescription()` in `src/lib/job-skill-generation.ts`:
   - Normalizes text (lowercase, NFKD)
   - For each of 300+ skills in `SKILLS_TAXONOMY`:
     - Word-boundary regex match (`\bskillname\b`)
     - Count occurrences (frequency)
     - Check surrounding 80-char context for weight signals
     - Skip if in `GENERIC_SKILL_DENYLIST` (ai, ml, it, qa, hr, api, etc.)
   - Assign weights: must-have=5, nice-to-have=2, freq≥2=4, else=3
   - Sort: weight desc → score desc → frequency desc
   - Return top 15
3. Preview mode: shows diff (new skills / weight changes / unchanged)
4. Apply mode: upserts `Skill` + `JobSkill` records, creates audit entry

### 7.3 AI Matching Pipeline

**Trigger:** "Re-run matching" button on matchboard or job page, or auto-triggered after resume parse.

**Steps:**
1. `POST /api/jobs/[jobId]/match`
2. Fetches job skills (with weights) from DB
3. Fetches all candidates in org (up to 500)
4. For each candidate:
   - Gets their skill list
   - Normalizes both (aliases map: node.js → node, golang → go, etc.)
   - Intersects: matched skills, missing skills
   - Calculates `matchedWeight` and `totalWeight`
   - Calculates `skillScore = matchedWeight / totalWeight * 100`
   - Calculates `experienceScore` (if job has min years requirement):
     - candidate.yearsOfExperience vs job.requiredYearsOfExperience
     - Linear scale
   - Final `score = 0.6 * expScore + 0.3 * skillScore + 0.1 * projectBonus`
5. All results upserted to `MatchResult` table
6. Sorted by score for display

### 7.4 Resume Tailoring Pipeline (NEW — in progress)

**Model:** `apex-resume-8b` (8B fine-tuned model, locally on Ollama)

**How it works:**
- Input: master profile JSON + job description text
- Output: `{ tailoring_decisions, tailored_cv, tailored_cover_letter }`
- The model was fine-tuned to NEVER fabricate — it only uses info from the master profile
- Conservative editing: bullets keep 70%+ original words
- Generates structured cover letter with 6 specific paragraphs
- Honest about skill gaps rather than inventing them

Client: `src/lib/ollama-tailor-llm.ts`  
Env var: `OLLAMA_TAILOR_MODEL=apex-resume-8b`  
Timeout: 180 seconds (3 min — 8B model is slower)

### 7.5 Semantic Search

**How it works:**
- When a resume is parsed, `nomic-embed-text` (Ollama) generates a 384-dim embedding of the resume text
- Stored as `Resume.embedding` (JSON array in PostgreSQL)
- `searchCandidatesBySemantics()` in `src/lib/semantic-search.ts`:
  - Generates embedding for search query
  - Fetches all candidates with embeddings
  - Computes cosine similarity in-memory
  - Returns top-N above threshold (default 0.7)
- Used for: "Similar Candidates" panel on candidate detail page, semantic search in search bar

---

## 8. API Endpoints Reference

All endpoints are REST JSON. Org-scoped endpoints verify membership before any operation.

### Auth
- `GET /api/orgs/my` — bootstrap user+org+membership on first sign-in; returns `{orgId}`

### Jobs
- `GET /api/orgs/[orgId]/jobs` — list all jobs for org
- `POST /api/orgs/[orgId]/jobs` — create job
- `GET /api/orgs/[orgId]/jobs/[jobId]` — get job details
- `PATCH /api/orgs/[orgId]/jobs/[jobId]` — update job details
- `DELETE /api/orgs/[orgId]/jobs/[jobId]` — delete job (cascades)
- `GET /api/jobs/[jobId]/skills` — get job skills
- `POST /api/jobs/[jobId]/skills` — add skill to job
- `DELETE /api/jobs/[jobId]/skills` — remove skill
- `POST /api/jobs/[jobId]/skills/generate` — AI skill generation (body: `{preview, onlyWhenEmpty, maxSkills}`)
- `POST /api/jobs/[jobId]/match` — run AI matching for this job
- `GET /api/jobs/[jobId]/matches` — get match results ranked by score
- `PATCH /api/jobs/[jobId]/matches/[candidateId]/status` — shortlist/reject
- `POST /api/jobs/[jobId]/matches/bulk-status` — bulk status update
- `GET /api/jobs/[jobId]/matches/[candidateId]/history` — decision log for this pair
- `GET /api/jobs/[jobId]/audit` — job page audit timeline
- `GET /api/jobs/[jobId]/audit/export` — export audit as CSV
- `POST /api/jobs/[jobId]/workflow` — trigger workflow automations

### Candidates
- `GET /api/orgs/[orgId]/candidates` — list candidates (with search)
- `POST /api/orgs/[orgId]/candidates` — create candidate manually
- `GET /api/orgs/[orgId]/candidates/[candidateId]` — get candidate + all relations
- `PATCH /api/orgs/[orgId]/candidates/[candidateId]` — update candidate profile
- `DELETE /api/orgs/[orgId]/candidates/[candidateId]` — delete candidate
- `POST /api/orgs/[orgId]/candidates/[candidateId]/resumes/upload` — upload+parse resume
- `POST /api/orgs/[orgId]/candidates/[candidateId]/resumes/[resumeId]/parse` — re-parse
- `GET/POST /api/orgs/[orgId]/candidates/[candidateId]/skills` — skills CRUD
- `GET/POST /api/orgs/[orgId]/candidates/[candidateId]/experience` — experience CRUD
- `GET/POST /api/orgs/[orgId]/candidates/[candidateId]/education` — education CRUD
- `GET/POST /api/orgs/[orgId]/candidates/[candidateId]/projects` — projects CRUD
- `GET/POST/DELETE /api/orgs/[orgId]/candidates/[candidateId]/notes` — notes
- `GET/POST/PATCH/DELETE /api/orgs/[orgId]/candidates/[candidateId]/notes/[noteId]`
- `GET/POST /api/orgs/[orgId]/candidates/[candidateId]/tags` — tags
- `GET/POST /api/orgs/[orgId]/candidates/[candidateId]/interviews` — interviews
- `PATCH/DELETE /api/orgs/[orgId]/candidates/[candidateId]/interviews/[interviewId]`
- `GET /api/orgs/[orgId]/candidates/[candidateId]/matches` — all job matches for candidate
- `GET /api/orgs/[orgId]/candidates/[candidateId]/similar` — similar candidates (semantic)
- `GET /api/orgs/[orgId]/candidates/[candidateId]/timeline` — activity timeline
- `POST /api/orgs/[orgId]/candidates/[candidateId]/communications` — log email/call
- `POST /api/orgs/[orgId]/candidates/import` — CSV import
- `POST /api/orgs/[orgId]/candidates/resumes/upload` — bulk resume upload
- `GET /api/orgs/[orgId]/candidates/export` — export all candidates as CSV

### Analytics & Org
- `GET /api/orgs/[orgId]/analytics` — dashboard analytics data
- `GET /api/orgs/[orgId]/llm-analytics` — LLM usage/cost tracking
- `GET /api/orgs/[orgId]/audit` — org-level audit log
- `GET/PATCH /api/orgs/[orgId]/settings` — org settings
- `POST /api/orgs/[orgId]/auto-match` — re-run matching for all jobs in org
- `GET /api/orgs/[orgId]/search` — full-text search across candidates/jobs
- `GET /api/orgs/[orgId]/semantic-search` — semantic search with embeddings
- `GET /api/orgs/[orgId]/skills/suggestions` — skill autocomplete suggestions
- `GET /api/orgs/[orgId]/notifications` — in-app notifications
- `PATCH /api/orgs/[orgId]/notifications/[id]/read` — mark read
- `POST /api/orgs/[orgId]/notifications/read-all` — mark all read
- `POST /api/orgs/[orgId]/export` — full org data export

### Upload Batches
- `GET /api/orgs/[orgId]/candidates/uploads/history` — upload batch list
- `POST /api/orgs/[orgId]/candidates/uploads/[batchId]/retry` — retry failed items
- `GET /api/orgs/[orgId]/candidates/uploads/[batchId]/export` — export batch report

### Utilities
- `GET /api/health` — health check
- `GET /api/locations/suggestions?query=...` — city/country autocomplete
- `GET /api/jobs-status` — all jobs with match count status

---

## 9. User Flows — Step by Step

### Flow A: Create a Job and Auto-Generate Skills
1. Go to `/orgs/[orgId]/jobs`
2. Click **"New Job"**
3. Fill in Title: "Senior AI Engineer", paste full JD in Description, set work mode, min years
4. Click **"Create"** → job appears in list
5. Click **"View"** on the new job
6. On the skills page: click **"Generate from description"**
7. Preview dialog appears showing: new skills found, weight assignments
8. Click **"Apply changes"** → skills saved
9. Now click **"Re-run matching"** → all candidates scored
10. Click **"View Matchboard"** → see ranked candidates

### Flow B: Upload a Resume and Parse It
1. Go to `/orgs/[orgId]/candidates`
2. Click **"Add Candidate"** → fill name + email → save
3. Click on the candidate card → goes to candidate detail
4. In the resume section: drag and drop a PDF resume
5. Upload spinner appears, then: "Resume parsed successfully"
6. Candidate profile auto-fills: title, years, location
7. Skills section populates with extracted skills
8. Experience section shows all work history with bullets
9. Education section shows schools/degrees
10. Go to **"Job Matches"** panel → see match scores for all jobs

### Flow C: Bulk Upload Resumes
1. `/orgs/[orgId]/candidates` → click **"Bulk Upload Resumes"**
2. Drop a ZIP file containing multiple PDFs, or select multiple PDFs directly
3. Optionally: assign to a specific job
4. Processing begins: each file processed in sequence
5. Progress visible in real-time (uploaded/failed/processing counts)
6. After completion → notification appears
7. Go to `/orgs/[orgId]/uploads` to see full batch report
8. Re-run matching on the target job to score new candidates

### Flow D: Shortlist Candidates for a Job
1. Go to `/orgs/[orgId]/matchboard`
2. Select job from dropdown
3. Click **"Re-run Matching"** to ensure fresh scores
4. Review ranked list: top candidates shown first
5. For each candidate: click **"Shortlist"** or **"Reject"**
6. Decision is logged with timestamp and actor
7. Filter by SHORTLISTED to see finalists
8. Click candidate name → view full profile

### Flow E: Compare Two Candidates
1. From `/orgs/[orgId]/candidates` → click **"Compare"**
2. Pick two candidates from search picker
3. Or: from candidate detail → click **"Compare with..."** in quick actions
4. Side-by-side view: education, experience, skills, projects
5. Semantic similarity score shown
6. Export as PDF report

---

## 10. Environment Variables

```env
# Database
DATABASE_URL="postgresql://postgres:[password]@localhost:5432/ai_career"
DIRECT_URL="postgresql://postgres:[password]@localhost:5432/ai_career"
PRISMA_CLIENT_ENGINE_TYPE="library"
PRISMA_CLI_QUERY_ENGINE_TYPE="library"

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Ollama (local AI — free, zero cost)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_RESUME_MODEL=apex-resume-qwen-3b:latest   # resume parsing
OLLAMA_TAILOR_MODEL=apex-resume-8b                # resume tailoring

# OpenAI (fallback for resume parsing when Ollama is down)
OPENAI_API_KEY=sk-...
OPENAI_RESUME_MODEL=gpt-4o-mini

# Clerk (auth)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

Variables NOT committed to git: all `.env*` files are gitignored (except `.env.example`).

---

## 11. Design System

**Theme:** Premium/prestige aesthetic — dark slate, glassmorphism cards, clean typography.

**Key CSS classes (in `extraordinary.css`):**
- `prestige-bg` — dark diagonal gradient background
- `prestige-grid` — subtle dot grid overlay
- `prestige-card` — glass card with backdrop blur
- `prestige-accent` — primary CTA button (dark fill)
- `prestige-pill` — small info badge
- `premium-block` — elevated card with subtle shadow
- `prestige-title` — gradient text effect for headings

**Component library:** shadcn/ui (built on Radix UI primitives)
- Cards, Badges, Buttons, Inputs, Textareas, Dialogs, Separators, Tabs, Tooltips, Dropdowns, ScrollArea, Avatar

**Icons:** Lucide React  
**Animations:** Framer Motion (used sparingly for page transitions and skill cards)  
**Toast notifications:** Sonner (bottom-right corner, dark theme)

**Responsive:** Fully mobile-responsive. Sidebar collapses on mobile. Grid layouts use `md:` and `lg:` breakpoints.

---

## 12. Skills Taxonomy

**Location:** `src/lib/skills-taxonomy.ts`

**Categories and skill counts:**
- Programming Languages: 29 skills (JS, TS, Python, Java, C++, C#, Go, Rust, PHP, Swift, Kotlin, etc.)
- Frontend: 32 skills (React, Vue, Angular, Next.js, Tailwind CSS, Redux, Webpack, etc.)
- Backend: 22 skills (Node.js, Express, Django, FastAPI, Spring Boot, NestJS, REST API, GraphQL, etc.)
- Databases: 28 skills (SQL, PostgreSQL, MongoDB, Redis, Elasticsearch, DynamoDB, Prisma, etc.)
- Cloud & DevOps: 40 skills (AWS, Azure, GCP, Docker, Kubernetes, Terraform, GitHub Actions, etc.)
- Operating Systems: 12 skills
- Mobile: 19 skills (iOS, Android, React Native, Flutter, SwiftUI, etc.)
- Data & AI: 55 skills (ML, TensorFlow, PyTorch, LangChain, RAG, Foundation Models, pgvector, etc.)
- Testing & QA: 28 skills (Jest, Cypress, Playwright, Selenium, Unit Testing, TDD, etc.)
- Version Control: 11 skills
- Design & UX: 16 skills
- Project Management: 17 skills
- Soft Skills: 24 skills
- Business & Marketing: 28 skills
- Finance & Accounting: 17 skills
- Security: 27 skills (OAuth, JWT, IAM, RBAC, Zero Trust, etc.)
- Networking: 16 skills

**Generic denylist** (never extracted even if in text): ai, ml, it, qa, hr, bi, ui, ux, api, sdk, audit, compliance, monitoring, logging, sales, marketing

---

## 13. Challenges Faced & Solutions

### Auth Bootstrap Race Condition
**Problem:** After Clerk sign-in, redirect hit `/orgs/demo` which checked for a DB user that didn't exist yet. First-time users saw a loop: sign-in → no DB user → demo page → "Sign In" button again.  
**Solution:** `/api/orgs/my` now auto-creates User + Organization + Membership in one DB transaction on first authenticated hit. Any redirect target calls this endpoint first.

### Turbopack Cache Panics
**Problem:** Dev server showed "Failed to write app endpoint — Next.js package not found" and crashed randomly.  
**Solution:** Removed `onDemandEntries` from `next.config.ts` (it's webpack-only and causes Turbopack panics). Also deleted `.next` cache entirely to clear stale state.

### Skill Extraction False Positives
**Problem:** Taxonomy substring matching extracted "Chai" (a JS testing library) from unrelated JD text like "chai-lenging". Also extracted "AI" and "Authentication" as skills which are too generic.  
**Solution:** Replaced `indexOf` with word-boundary regex (`\bskillname\b`). Added a `GENERIC_SKILL_DENYLIST`. Removed overly broad taxonomy terms like "AI" and "Authentication".

### Module Constant Hot Reload
**Problem:** After updating the skills taxonomy, re-running skill generation still showed old results. The taxonomy array is a module-level constant and Turbopack caches it.  
**Solution:** Must restart dev server (`npm run dev`) after changing `skills-taxonomy.ts`. This is a known Turbopack behavior — module constants don't hot-reload.

### Ollama Schema Mismatch
**Problem:** Fine-tuned model `apex-resume-qwen-3b` was trained on a different JSON schema than the app's `CandidateProfileExtract` type. Direct parsing failed schema validation.  
**Solution:** Created `mapToAppSchema()` in `ollama-resume-llm.ts` that converts the training schema format → app schema format, including period string parsing ("Jun 2024 to Sep 2024" → `{year, month}`).

### Sign-In UI Alignment
**Problem:** Clerk's `<SignIn>` component rendered with left margin by default, making it appear off-center even when the parent was centered.  
**Solution:** Passed `appearance` props with `cardBox: "w-full shadow-none"` and `main: "w-full"`, plus CSS overrides in `extraordinary.css` targeting `.cl-rootBox`, `.cl-card`, `.cl-cardBox`, `.cl-main`, `.cl-form` with `width: 100% !important`.

### JD Text Not Selectable
**Problem:** The job description display in read-only mode had CSS classes `select-none` and `cursor-default`, making the text impossible to copy.  
**Solution:** Changed all read-only divs to use `select-text` and `cursor-text` classes.

### Deployed vs Local Auth Differences
**Problem:** Local dev uses Clerk test instance (email+password), deployed Vercel uses Clerk live instance (OTP/Google). They appear completely different.  
**Explanation:** Two separate Clerk application instances (test/live) with different auth strategies configured. This is intentional — test instance allows password auth for easy local testing; live instance uses more secure OTP/social login.

---

## 14. Database Commands

```bash
npm run db:push      # Push schema changes to DB (no migration file)
npm run db:migrate   # Run migrations
npm run db:studio    # Open Prisma Studio (visual DB browser at localhost:5555)
npm run db:seed      # Seed sample data
```

Local DB: PostgreSQL at `postgresql://postgres:Ahmad%40541@localhost:5432/ai_career`

---

## 15. Development Commands

```bash
npm run dev          # Start dev server (Turbopack) at http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint check
npm run type-check   # TypeScript type check (no emit)
```

**Important:** Always restart the dev server after changing:
- `src/lib/skills-taxonomy.ts` (module constants don't hot-reload)
- `src/lib/ollama-resume-llm.ts` (same reason)
- Any other file with module-level constants used in API routes

---

## 16. Video Walkthrough Script (For AI Agent)

If you are an AI agent creating a demonstration video of NextHire, follow this sequence:

**Opening (30 seconds):**
- Show the landing page at http://localhost:3000
- Point out the hero headline "Hire Smarter, Not Harder"
- Briefly show the three feature cards and stats row

**Sign-In Demo (30 seconds):**
- Navigate to `/sign-in`
- Show the custom styled Clerk form with logo
- Sign in with test credentials (or show the sign-in form without submitting)

**Dashboard Overview (1 minute):**
- Navigate to `/orgs/[orgId]` after sign-in
- Show the "Recruitment Intelligence" hero block
- Scroll down to show the Neural Analytics charts
- Point out the three stat cards: Talent Pool, Active Jobs, AI Matching score

**Creating a Job (2 minutes):**
- Navigate to `/orgs/[orgId]/jobs`
- Click "New Job"
- Fill in: Title = "Senior Full-Stack Engineer", paste a real job description
- Submit, navigate to the job's skills page
- Click "Generate from description" and show the preview dialog
- Click "Apply changes" — show skills appearing

**Job Skills Page Deep Dive (1 minute):**
- Show the read-only job description (demonstrate text selection)
- Show the skills list with weight badges
- Show the Edit button → fields become editable
- Show the audit timeline on the right

**Uploading a Resume (2 minutes):**
- Navigate to a candidate detail page
- Drag and drop a PDF resume
- Watch the parsing happen (show loading state)
- After completion: point out filled-in skills, experience, education sections

**Matchboard (2 minutes):**
- Navigate to `/orgs/[orgId]/matchboard`
- Select the job created earlier
- Click "Re-run Matching"
- Show the ranked candidate list with scores, matched skills (green), missing skills (red)
- Click Shortlist on a top candidate
- Show the status updating

**Analytics (30 seconds):**
- Navigate to `/orgs/[orgId]/intelligence`
- Show the charts: candidates over time, skill frequency, match distribution

**Candidate Detail (1 minute):**
- Click on a candidate from the candidates page
- Walk through: profile header, resume section, skills grid, experience list, job matches panel, notes, interview scheduler

**Closing:**
- Return to dashboard
- Summarize: jobs with weighted skills → AI skill extraction → bulk resume upload → AI parsing → weighted matching → ranked matchboard → shortlist/reject with audit trail

---

## 17. Project Metadata

| Field | Value |
|---|---|
| Project name | NextHire |
| Creator | Ahmad Khan |
| Started | January 2025 |
| Current status | Active development — MVP complete |
| GitHub | https://github.com/ahmadkhan46/Next-Hire |
| Local URL | http://localhost:3000 |
| Node version | 18+ |
| Package manager | npm |
| DB | PostgreSQL (local: ai_career) |
| Ollama models installed | apex-resume-qwen-3b:latest, apex-resume-qwen-3b-v2:latest |
| Ollama models planned | apex-resume-8b (tailoring) |

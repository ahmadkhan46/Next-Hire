# Next-Hire — AI-Powered Recruitment Intelligence Platform

## Overview

Next-Hire is a full-stack AI recruitment platform built to help hiring teams source, evaluate, and manage candidates efficiently. It uses large language models to parse resumes, automatically match candidates to job requirements, and generate actionable hiring intelligence — replacing manual CV screening with a structured, audit-ready workflow.

The platform was built from scratch as a university capstone project and is deployed in production on Vercel with a Neon PostgreSQL database.

---

## Technology Stack

### Frontend
| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | **Next.js 16 (App Router)** | Server Components + Client Components, Turbopack |
| Language | **TypeScript 5** | Strict mode throughout |
| Styling | **Tailwind CSS v4** | Utility-first, custom design tokens |
| UI Components | **shadcn/ui + Radix UI** | Accessible primitives (Dialog, Badge, Separator, etc.) |
| Animations | **Framer Motion** | Page transitions and micro-interactions |
| Charts | **Recharts** | Analytics dashboards |
| Notifications | **Sonner** | Toast notifications |
| Forms | **Zod** | Schema validation on both client and server |

### Backend
| Layer | Technology | Notes |
|-------|-----------|-------|
| Runtime | **Node.js** | All API routes set `export const runtime = "nodejs"` |
| API | **Next.js Route Handlers** | RESTful, all under `/src/app/api/` |
| ORM | **Prisma 6** | Type-safe queries, migrations, schema-first |
| Database | **PostgreSQL (Neon)** | Serverless Postgres, direct + pooled connections |
| Auth | **Clerk** | Multi-tenant org auth, middleware-based protection |
| AI/LLM | **OpenAI GPT-4o** | Resume parsing, candidate profile extraction |
| Background Jobs | **BullMQ + Redis (IORedis)** | Async resume processing queue |
| Rate Limiting | **Upstash Redis** | API-level rate limiting |
| File Storage | **In-memory / Vercel** | Resume text extracted client-side or server-side |
| Vector Search | **Pinecone + pgvector** | Semantic candidate search (infrastructure ready) |

### Infrastructure & DevOps
| Tool | Purpose |
|------|---------|
| **Vercel** | Deployment, serverless functions, CI/CD |
| **Neon** | Serverless PostgreSQL with branching |
| **GitHub** | Source control, branch protection |
| **Vitest** | Unit testing |
| **Playwright** | End-to-end testing |

---

## Core Features

### 1. Candidate Management
- Create, edit, and delete candidate profiles
- Rich profile: work experience, education, projects, skills, technologies, notes
- **Duplicate detection** via email, phone, name fingerprint, or external ID
- Candidate tags, status tracking (Active, Passive, Hired, etc.)
- Interview scheduling and communication logs
- Candidate activity timeline with full audit trail

### 2. Resume Processing
- **Bulk upload**: PDF, DOCX, or ZIP archives (up to 5MB per file)
- **Client-side PDF text extraction** (pdfjs-dist) to reduce server load
- **LLM parsing** via OpenAI GPT-4o — extracts structured data from free-text resumes
- Extracted fields: personal info, work history, education, projects, skills, tech stack
- Async processing queue via BullMQ with status tracking
- Duplicate mode: skip or update existing candidate on re-upload
- When updating: old resumes are replaced with the new one

### 3. Job Management
- Create and manage job postings with status (Open/Closed) and work mode
- Required years of experience as a mandatory field (0 = no minimum)
- Skills editor with weighted importance (1–5 scale)
- Skills with weight ≥ 4 treated as **critical** — missing them is flagged
- Job details fully locked until Edit mode is activated

### 4. AI Matching Engine
The core scoring algorithm ranks candidates against job requirements using three factors:

**When job has an experience requirement:**
- **Experience (60%)** — primary factor; candidates below minimum are hard-disqualified
- **Skills (30%)** — weighted skill overlap (matched weight / total weight)
- **Projects (10%)** — tech stack relevance: fraction of required skills found in project tech stacks

**When no experience requirement:**
- Skills 80% + Projects 20%

**Skill normalization** — "Node.js", "nodejs", and "node" are treated as equivalent via alias mapping. Prevents false mismatches from naming variations.

**Experience auto-calculation** — `yearsOfExperience` is automatically recalculated from work history entries whenever experience is added, updated, or removed.

**Score freshness** — each match result stores a `scoredAt` timestamp so users can see how recently scores were computed.

### 5. Matchboard
- Per-job candidate ranking table with live filters
- Filters: status (All / Unreviewed / Shortlisted / Rejected), experience range (0–2, 3–5, 6–10, 10+)
- Sort: most experience, best score, critical gaps, total missing, unreviewed first
- Score threshold filter (hide below X%)
- Bulk actions: shortlist 80%+, reject critical gaps, reset all
- Individual actions: Shortlist / Reject / Reset per candidate
- Decision history per candidate with resolved user names
- "Below min. exp" badge for disqualified candidates
- "Scored on [date]" indicator on each card

### 6. Intelligence & Analytics
- Organisation-level analytics: candidate count, active jobs, match success rate
- Pipeline flow: unreviewed / shortlisted / rejected breakdown
- Skills gap analysis across all matches
- Export audit trail (CSV/JSON)

### 7. Audit Trail
- **Job page events**: skill changes, detail edits, match re-runs — stored in `JobPageAuditEvent`
- **Candidate activity**: profile edits, resume uploads, experience changes — stored in `CandidateActivity`
- **Match decisions**: every shortlist/reject action logged in `MatchDecisionLog`
- **Upload batches**: full history of bulk uploads with per-file status
- All events show resolved user names (local DB → Clerk API fallback)

### 8. Settings & Organisation
- Organisation settings with member roles (Owner / Admin / Member)
- LLM timeout configuration per org
- Rate limiting per org on AI endpoints

---

## Project Structure

```
src/
├── app/
│   ├── api/                    # All REST API route handlers
│   │   ├── jobs/[jobId]/       # Job + skills + matches + audit
│   │   └── orgs/[orgId]/       # Org-scoped: candidates, jobs, uploads, audit
│   └── orgs/[orgId]/
│       ├── candidates/         # Candidate list + profile pages
│       ├── jobs/               # Job list + job detail/skills page
│       ├── matchboard/         # AI matching interface
│       ├── intelligence/       # Analytics dashboard
│       ├── uploads/            # Upload activity log
│       └── settings/           # Org settings
├── components/                 # Shared UI components
├── lib/
│   ├── auto-matching.ts        # Core scoring algorithm
│   ├── resume-llm.ts           # LLM resume parsing
│   ├── job-audit.ts            # Audit event helpers + name resolution
│   ├── duplicate-detection.ts  # Candidate deduplication
│   └── prisma.ts               # Prisma client singleton
├── workers/
│   └── bulk-import.worker.ts   # BullMQ background job processor
└── __tests__/                  # Vitest unit tests
prisma/
├── schema.prisma               # Full database schema
└── migrations/                 # All SQL migrations
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Next.js App Router | Server Components reduce client bundle; co-located API routes simplify deployment |
| Prisma over raw SQL | Type safety, migration management, readable query API |
| Clerk for auth | Multi-tenant org support out of the box; no custom auth infrastructure needed |
| BullMQ for resume processing | LLM calls take 10–60s; background queue prevents HTTP timeouts |
| Skill normalization | Prevents false mismatches (React.js ≠ React without it) |
| Hard experience disqualification | Reflects real hiring practice; no point ranking a 1yr candidate for a 5yr role |
| `scoredAt` timestamp | Lets users know if scores are stale after profile changes |
| Client-side PDF extraction | Reduces server processing time and Vercel function cold-start latency |
| `directUrl` for Prisma | Neon's pooled connection (PgBouncer) doesn't support advisory locks needed by migrations |

---

## Database Schema Summary

| Model | Purpose |
|-------|---------|
| `Organization` | Multi-tenant root; all data scoped to an org |
| `Candidate` | Core candidate profile with scoring-relevant fields |
| `CandidateExperience` | Work history entries (used to auto-calculate `yearsOfExperience`) |
| `CandidateProject` | Projects with `techStack` field (used in project relevance scoring) |
| `CandidateEducation` | Education entries |
| `CandidateTechnology` | Structured tech categories |
| `CandidateSkill` | Many-to-many: candidates ↔ skills |
| `Job` | Job posting with `requiredYearsOfExperience` |
| `JobSkill` | Many-to-many: jobs ↔ skills with weight |
| `MatchResult` | Computed match score with `scoredAt`, `experienceScore` |
| `MatchDecisionLog` | Immutable log of every shortlist/reject action |
| `Resume` | Parsed resume file with raw text and LLM output |
| `ResumeUploadBatch` | Batch upload tracking |
| `JobPageAuditEvent` | Job-level audit log |
| `CandidateActivity` | Candidate-level activity log |

---

## Deployment

- **Platform**: Vercel (Next.js optimised)
- **Database**: Neon PostgreSQL (serverless, auto-suspend on free tier)
- **Required env vars**: `DATABASE_URL`, `DIRECT_URL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `OPENAI_API_KEY`, `REDIS_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- **Build command**: `prisma generate && next build`
- **Schema changes**: Applied manually via Neon SQL Editor (advisory lock timeout prevents `prisma migrate deploy` on free tier)

---

## Scoring Formula Reference

```
No experience requirement:
  score = skills × 0.80 + projects × 0.20

With experience requirement:
  if (candidateYears < requiredYears) → score = 0  [disqualified]
  else:
    expBonus = min(candidateYears / (requiredYears + 5), 1.0)
    score = expBonus × 0.60 + skills × 0.30 + projects × 0.10

Projects score:
  relevance = (required skills found in any project techStack) / total required
  projects = relevance × 0.70 + min(projectCount / 5, 1.0) × 0.30
```

---

*Built March 2026 · Next-Hire v1.0*

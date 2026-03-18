# AI Career Platform - Complete Documentation

## Overview

A modern Applicant Tracking System (ATS) built with Next.js, featuring AI-powered resume parsing, intelligent candidate matching, and comprehensive recruitment management.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Clerk
- **AI/ML**: OpenAI GPT-4o-mini
- **Styling**: Tailwind CSS
- **Queue**: BullMQ with in-memory fallback

## Core Features

### 1. Candidate Management
- Multi-step candidate creation (Personal → Experience → Education → Skills → Projects)
- Bulk CSV import with duplicate detection
- AI-powered resume parsing
- Skills auto-categorization (16 categories, 400+ skills)
- 3-layer identity system (externalId → email → fingerprint)

### 2. Job Management
- Job posting creation with skill requirements
- Weighted skill matching (1-5 scale, 4-5 = critical)
- Auto-matching to candidates
- Match status tracking (NONE/SHORTLISTED/REJECTED)

### 3. Matching Engine
- Weighted skill-based matching algorithm
- Critical gap detection
- Automatic matching on candidate/job creation
- Manual match refresh capability
- 0% matches automatically filtered

### 4. Security
- Role-based access control (OWNER/ADMIN/MEMBER)
- 13 granular permissions
- Input sanitization (XSS prevention)
- Log injection prevention
- Rate limiting (4-tier system)
- Audit logging

### 5. Resume Processing
- PDF/DOCX upload support
- AI extraction of experience, education, projects, skills
- Name mismatch detection (prevents wrong resume uploads)
- Cost tracking (~$0.001-0.003 per resume)

## Installation

### Prerequisites
```bash
Node.js 18+
PostgreSQL 14+
OpenAI API key
Clerk account
```

### Setup
```bash
# Clone and install
git clone <repo-url>
cd ai-career-platform
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Setup database
npx prisma generate
npx prisma db push
node prisma/seed.js

# Run development server
npm run dev
```

### Environment Variables
```env
DATABASE_URL=postgresql://user:password@localhost:5432/ai_career
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
OPENAI_API_KEY=sk-proj-...
OPENAI_RESUME_MODEL=gpt-4o-mini
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Project Structure

```
src/
├── app/                    # Next.js pages and API routes
│   ├── api/               # API endpoints
│   │   └── orgs/[orgId]/
│   │       ├── candidates/
│   │       ├── jobs/
│   │       ├── auto-match/
│   │       └── audit/
│   └── orgs/[orgId]/      # Organization pages
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── add-candidate-multi-step.tsx
│   ├── edit-candidate-enhanced.tsx
│   └── refresh-all-matches.tsx
├── lib/                   # Core utilities
│   ├── api-middleware.ts  # Route wrapper with auth/RBAC
│   ├── rbac.ts           # Role-based access control
│   ├── auto-matching.ts  # Matching algorithm
│   ├── security.ts       # Input sanitization
│   ├── skills-taxonomy.ts # Skills categorization
│   └── resume-llm.ts     # AI resume parsing
├── workers/               # Background jobs
│   └── memory-worker.ts  # Bulk import processor
└── middleware.ts          # Clerk authentication

prisma/
├── schema.prisma         # Database schema
└── seed.js              # Sample data

documents/                # Documentation
templates/               # CSV import templates
```

## Database Schema

### Core Models

**User** - Clerk users synced to database
```prisma
id, clerkId, email, name, createdAt
```

**Organization** - Multi-tenant organizations
```prisma
id, name, createdAt
```

**Membership** - User-org relationships with roles
```prisma
id, userId, orgId, role (OWNER/ADMIN/MEMBER)
```

**Candidate** - Candidate profiles
```prisma
id, orgId, fullName, email, phone, dateOfBirth
location, currentTitle, yearsOfExperience
linkedinUrl, githubUrl, portfolioUrl
status, source, fingerprint, externalId
```

**Job** - Job postings
```prisma
id, orgId, title, description, location, status
```

**MatchResult** - Candidate-job matches
```prisma
id, jobId, candidateId, orgId, score
matched[], missing[], status
matchedWeight, totalWeight
```

**Skill** - Normalized skills
```prisma
id, orgId, name, category
```

### Supporting Models
- CandidateSkill - Candidate-skill relationships
- JobSkill - Job-skill requirements with weights
- CandidateExperience - Work history
- CandidateEducation - Education history
- CandidateProject - Projects portfolio
- CandidateTechnology - Technology categories
- Resume - Resume files and parsed data
- AuditLog - Audit trail

## API Endpoints

### Candidates
```
GET    /api/orgs/{orgId}/candidates
POST   /api/orgs/{orgId}/candidates
GET    /api/orgs/{orgId}/candidates/{id}
PATCH  /api/orgs/{orgId}/candidates/{id}
DELETE /api/orgs/{orgId}/candidates/{id}
POST   /api/orgs/{orgId}/candidates/import
POST   /api/orgs/{orgId}/candidates/{id}/experience
POST   /api/orgs/{orgId}/candidates/{id}/education
POST   /api/orgs/{orgId}/candidates/{id}/projects
POST   /api/orgs/{orgId}/candidates/{id}/skills
POST   /api/orgs/{orgId}/candidates/{id}/resumes
POST   /api/orgs/{orgId}/candidates/{id}/resumes/{resumeId}/parse
```

### Jobs
```
GET    /api/orgs/{orgId}/jobs
POST   /api/orgs/{orgId}/jobs
GET    /api/orgs/{orgId}/jobs/{id}
PATCH  /api/orgs/{orgId}/jobs/{id}
DELETE /api/orgs/{orgId}/jobs/{id}
GET    /api/orgs/{orgId}/jobs/{id}/matches
```

### Matching
```
POST   /api/orgs/{orgId}/auto-match
  Body: { candidateId?, jobId?, recalculateAll? }
```

## Permissions

| Permission | Description |
|-----------|-------------|
| candidates:read | View candidates |
| candidates:write | Create/edit candidates |
| candidates:delete | Delete candidates |
| jobs:read | View jobs |
| jobs:write | Create/edit jobs |
| jobs:delete | Delete jobs |
| matches:read | View matches |
| matches:write | Update match status |
| analytics:read | View analytics |
| settings:read | View settings |
| settings:write | Update settings |
| members:read | View members |
| members:write | Manage members |

## Matching Algorithm

### How It Works

1. **Skill Extraction**: Extract skills from candidate and job
2. **Weight Calculation**: Sum weights of matched vs total skills
3. **Score Computation**: `score = matchedWeight / totalWeight`
4. **Critical Gaps**: Flag missing skills with weight ≥ 4
5. **Filtering**: Skip matches with 0% score or no candidate skills

### Example
```
Job requires:
- React (weight: 5)
- Node.js (weight: 4)
- AWS (weight: 3)
Total weight: 12

Candidate has:
- React ✓
- Node.js ✓
Matched weight: 9

Score = 9/12 = 75%
```

## Skills Taxonomy

### Categories (16)
- Programming Languages (28 skills)
- Frontend (31 skills)
- Backend (23 skills)
- Databases (26 skills)
- Cloud & DevOps (35 skills)
- Mobile (17 skills)
- Data & AI (33 skills)
- Testing & QA (27 skills)
- Version Control (11 skills)
- Design & UX (16 skills)
- Project Management (26 skills)
- Soft Skills (24 skills)
- Business & Marketing (30 skills)
- Finance & Accounting (17 skills)
- Security (25 skills)
- Networking (16 skills)

### Auto-Categorization
- Direct match: "React" → Frontend
- Partial match: "React.js" → Frontend
- Unknown: → Other category

### Adding New Skills
Edit `src/lib/skills-taxonomy.ts`:
```typescript
export const SKILLS_TAXONOMY = {
  'Programming Languages': [
    'JavaScript', 'TypeScript', 'Python',
    'NewLanguage', // Add here
  ],
}
```

## Security

### Input Sanitization
```typescript
import { sanitizeHtml, sanitizeForLog } from '@/lib/security';

// Prevent XSS
const safe = sanitizeHtml(userInput);

// Prevent log injection
console.log(sanitizeForLog(userInput));
```

### Authentication Flow
1. User signs in via Clerk
2. Clerk session token validated
3. User synced to database
4. Organization access checked
5. Permission verified
6. Request processed

### Rate Limits
- API: 100 requests/minute
- LLM: 50 requests/hour
- Bulk Import: 5 requests/hour
- Auth: 10 requests/15 minutes

## CSV Import

### Templates
- **Basic**: fullName, email, phone, dateOfBirth, externalId, skills
- **Full**: All fields + linkedinUrl, githubUrl, portfolioUrl, status, source, notes, resumeText

### Process
1. Upload CSV or paste data
2. System validates format
3. Duplicate detection (externalId → email → fingerprint)
4. Optional AI resume parsing
5. Auto-matching to jobs
6. Progress tracking

### Duplicate Detection
```
Priority 1: externalId (user's system ID)
Priority 2: email (strong identifier)
Priority 3: fingerprint (SHA-256 of name+email/phone+DOB)
```

## Resume Parsing

### Supported Formats
- PDF
- DOCX
- Max size: 10MB

### Extraction
- Personal info (name, email, phone, location)
- Work experience (company, role, dates, responsibilities)
- Education (school, degree, years)
- Projects (title, description, tech stack)
- Skills (auto-categorized)

### Name Validation
- Compares extracted name with candidate name
- Blocks if similarity < 50%
- Sets status to NEEDS_REVIEW
- Prevents wrong resume uploads

## UI Components

### Design System
- **Colors**: Blue (primary), Green (success), Red (destructive)
- **Borders**: rounded-3xl (dialogs), rounded-2xl (inputs/buttons)
- **Spacing**: p-6 (dialogs), p-4 (cards), gap-4 (forms)

### Key Components
- **AddCandidateMultiStep**: 5-step creation wizard
- **EditCandidateEnhanced**: Tabbed edit interface
- **RefreshAllMatches**: Bulk match recalculation
- **ResumeUploader**: Drag & drop with parsing

## Deployment

### Build
```bash
npm run build
npm start
```

### Production Checklist
- [ ] Set production DATABASE_URL
- [ ] Use production Clerk keys
- [ ] Enable HTTPS
- [ ] Add security headers
- [ ] Setup Redis for rate limiting
- [ ] Configure monitoring
- [ ] Setup automated backups
- [ ] Enable audit logging
- [ ] Test disaster recovery

### Security Headers
```typescript
// next.config.ts
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
];
```

## Monitoring

### Logs
- API requests (Winston)
- LLM usage (Database)
- Errors (Console + File)
- Audit trail (Database)

### Metrics
- Request latency
- LLM costs
- Match accuracy
- Import success rate
- User activity

## Troubleshooting

### Common Issues

**Port in use**
```bash
lsof -ti:3000 | xargs kill -9
```

**Database connection error**
```bash
pg_isready
npx prisma migrate reset
```

**Clerk auth issues**
- Verify environment variables
- Check Clerk dashboard settings
- Clear browser cookies
- Restart dev server

**OpenAI API errors**
- Verify API key
- Check rate limits
- Monitor usage dashboard

## Support

### Documentation
- `/documents/API_DOCUMENTATION.md` - API reference
- `/documents/ARCHITECTURE.md` - System design
- `/documents/CANDIDATE_MANAGEMENT.md` - Feature guide
- `/documents/UI_COMPONENTS.md` - Component library
- `/documents/DEVELOPMENT_WORKFLOW.md` - Developer guide
- `/documents/SKILLS_TAXONOMY_MAINTENANCE.md` - Skills management

### Resources
- Next.js: https://nextjs.org/docs
- Prisma: https://www.prisma.io/docs
- Clerk: https://clerk.com/docs
- OpenAI: https://platform.openai.com/docs

## License

Proprietary - All rights reserved

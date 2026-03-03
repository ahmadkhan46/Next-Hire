# Platform Architecture

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with Lucide icons
- **Authentication**: Clerk

### Backend
- **Framework**: Next.js API Routes
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Queue**: BullMQ (with in-memory fallback)
- **Cache**: Redis (optional, falls back to in-memory)

### AI/ML
- **LLM**: OpenAI GPT-4o-mini
- **Embeddings**: OpenAI text-embedding-3-small
- **Use Cases**: Resume parsing, semantic search, skill extraction

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Dashboard │  │Candidates│  │   Jobs   │  │ Analytics│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Middleware)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Auth   │  │   RBAC   │  │Rate Limit│  │Validation│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Business Logic                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Matching │  │  Resume  │  │ Semantic │  │  Audit   │   │
│  │  Engine  │  │  Parser  │  │  Search  │  │   Log    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Background Workers                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  Bulk    │  │  Resume  │  │   Auto   │                  │
│  │ Import   │  │ Parsing  │  │ Matching │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │PostgreSQL│  │  Redis   │  │  OpenAI  │                  │
│  │ (Prisma) │  │(Optional)│  │   API    │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

## Core Features

### 1. Candidate Management
- Manual entry via UI
- Bulk CSV import
- Resume parsing with AI
- Duplicate detection (3-layer identity system)
- Skills extraction and normalization
- Profile enrichment

### 2. Job Management
- Job posting creation
- Skill requirements with weights
- Status tracking (OPEN/CLOSED)
- Auto-matching to candidates

### 3. Matching Engine
- Weighted skill matching
- Critical gap detection
- Semantic search with embeddings
- Auto-matching on import/creation
- Match status tracking (NONE/SHORTLISTED/REJECTED)

### 4. Analytics
- Recruitment funnel metrics
- Time-to-hire analysis
- Source tracking
- Hiring velocity
- Skills gap analysis

### 5. Security & Compliance
- Role-based access control (OWNER/ADMIN/MEMBER)
- Audit logging (SOC2-compliant)
- Rate limiting (4-tier system)
- PII redaction in logs
- Error tracking

## Database Schema

### Core Models
- **User**: Clerk users synced to database
- **Organization**: Multi-tenant organizations
- **Membership**: User-org relationships with roles
- **Candidate**: Candidate profiles with identity system
- **Job**: Job postings with requirements
- **MatchResult**: Candidate-job matches with scores
- **Resume**: Resume files and parsed data
- **Skill**: Normalized skills with taxonomy

### Supporting Models
- **CandidateSkill**: Candidate-skill relationships
- **JobSkill**: Job-skill requirements with weights
- **CandidateExperience**: Work history
- **CandidateEducation**: Education history
- **CandidateProject**: Projects portfolio
- **CandidateTechnology**: Technology categories
- **MatchDecisionLog**: Audit trail for match decisions

## API Structure

```
/api
├── /bootstrap              # Initial setup
├── /orgs
│   ├── /[orgId]
│   │   ├── /candidates
│   │   │   ├── GET/POST   # List/create candidates
│   │   │   ├── /import    # Bulk import
│   │   │   └── /[candidateId]
│   │   │       ├── GET/PATCH/DELETE
│   │   │       └── /resumes
│   │   ├── /jobs
│   │   │   ├── GET/POST   # List/create jobs
│   │   │   └── /[jobId]
│   │   │       ├── GET/PATCH/DELETE
│   │   │       ├── /match # Manual matching
│   │   │       └── /matches # Match results
│   │   ├── /auto-match    # Refresh matches
│   │   ├── /analytics     # Metrics
│   │   ├── /audit         # Audit logs
│   │   └── /semantic-search # Vector search
│   └── /my                # Current user's orgs
└── /debug                 # Debug endpoints
```

## Middleware Pipeline

Every protected API route goes through:

1. **Authentication** (Clerk)
2. **Organization Access** (RBAC)
3. **Rate Limiting** (Upstash Redis or in-memory)
4. **Permission Check** (13 permissions)
5. **Input Validation** (Zod schemas)
6. **Handler Execution**
7. **Error Handling** (Structured errors)
8. **Request Logging** (Winston)

## Background Jobs

### Bulk Import Worker
- Processes CSV imports
- Parses resumes with LLM
- Extracts skills and experience
- Generates fingerprints
- Auto-matches to jobs
- Updates progress in real-time

### Auto-Matching Worker
- Triggers on candidate/job creation
- Calculates match scores
- Identifies critical gaps
- Stores match results
- Updates match status

## Rate Limiting

4-tier system:
- **API**: 100 requests/minute
- **LLM**: 50 requests/hour
- **Bulk Import**: 5 requests/hour
- **Auth**: 10 requests/15 minutes

## Cost Tracking

### LLM Usage
- Resume parsing: ~$0.001-0.003 per resume
- Embeddings: ~$0.00001 per resume
- Logged in `llm_usage_logs` table

### Database
- PostgreSQL: Self-hosted or managed
- Redis: Optional (Upstash free tier or self-hosted)

## Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Environment Variables
```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
OPENAI_API_KEY=sk-proj-...
OPENAI_RESUME_MODEL=gpt-4o-mini
```

## Scalability

### Current Limits
- 100 candidates per CSV import
- 50 skills per candidate
- 50,000 characters per resume
- 100 API requests/minute

### Future Optimizations
- Horizontal scaling with load balancer
- Database read replicas
- Redis cluster for caching
- CDN for static assets
- Background job workers on separate servers

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

## Security

### Authentication
- Clerk (OAuth, Magic Links, Email/Password)
- Session management
- User sync to database

### Authorization
- 3 roles: OWNER, ADMIN, MEMBER
- 13 permissions
- Organization-level isolation

### Data Protection
- PII redaction in logs
- Encrypted connections (SSL)
- Environment variable secrets
- No credentials in code

## Recent Updates

✅ **Multi-step candidate form** - 5-step creation flow with progress tracking  
✅ **Enhanced edit mode** - Tabbed interface for all candidate blocks  
✅ **Delete functionality** - Candidate deletion with confirmation  
✅ **Resume validation** - Name mismatch detection prevents data corruption  
✅ **Advanced CSV import** - Full template with social links, status, source  
✅ **Identity system** - 3-layer duplicate detection (externalId → email → fingerprint)

## Future Enhancements

🔜 **Application system** (Candidate → Job applications with workflow)  
🔜 **Search & filters** (Advanced candidate/job search)  
🔜 **Dashboard analytics** (Pipeline metrics, funnel visualization)  
🔜 **Email integration** (Send emails, templates, tracking)  
🔜 **Interview scheduling** (Calendar integration)  
🔜 **Custom reports** (Export, saved queries)  

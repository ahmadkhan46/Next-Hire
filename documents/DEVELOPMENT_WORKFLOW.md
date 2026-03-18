# Development Workflow

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- Redis (optional, for production)
- OpenAI API key

### Installation

```bash
# Clone repository
git clone <repo-url>
cd ai-career-platform

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Setup database
npx prisma generate
npx prisma db push

# Seed database (optional)
node prisma/seed.js

# Run development server
npm run dev
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ai_career

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# OpenAI
OPENAI_API_KEY=sk-proj-...
OPENAI_RESUME_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Redis (optional)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Project Structure

```
ai-career-platform/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   ├── orgs/              # Organization pages
│   │   ├── sign-in/           # Auth pages
│   │   └── page.tsx           # Home page
│   ├── components/            # React components
│   ├── lib/                   # Utilities
│   │   ├── rbac.ts           # RBAC system
│   │   ├── api-middleware.ts # Route wrapper
│   │   ├── fingerprint.ts    # Identity system
│   │   └── user-sync.ts      # User sync
│   └── workers/               # Background jobs
├── prisma/
│   ├── schema.prisma         # Database schema
│   ├── seed.js               # Seed script
│   └── migrations/           # Database migrations
├── documents/                 # Documentation
├── templates/                 # CSV templates
└── public/                    # Static files
```

## Development Workflow

### 1. Feature Development

**Branch Strategy**:
```bash
# Create feature branch
git checkout -b feature/application-system

# Make changes
# Commit frequently with clear messages
git commit -m "Add Application model to schema"

# Push to remote
git push origin feature/application-system
```

**Commit Message Format**:
```
<type>: <description>

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code restructuring
- test: Tests
- chore: Maintenance
```

### 2. Database Changes

**Schema Updates**:
```bash
# Edit prisma/schema.prisma
# Generate migration
npx prisma migrate dev --name add_application_model

# Apply to production
npx prisma migrate deploy
```

**Seed Data**:
```bash
# Run seed script
node prisma/seed.js

# Or via npm
npm run seed
```

### 3. API Development

**Create Protected Route**:
```typescript
// src/app/api/orgs/[orgId]/applications/route.ts
import { createProtectedRoute } from '@/lib/api-middleware'
import { z } from 'zod'

const schema = z.object({
  candidateId: z.string(),
  jobId: z.string()
})

export const POST = createProtectedRoute({
  requiredPermission: 'applications:write',
  schema,
  handler: async ({ body, params, user, orgId }) => {
    // Implementation
    return { success: true }
  }
})
```

**Test Route**:
```bash
# Using curl
curl -X POST http://localhost:3000/api/orgs/{orgId}/applications \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"candidateId":"123","jobId":"456"}'
```

### 4. Component Development

**Create Component**:
```typescript
// src/components/application-form.tsx
'use client'

import { useState } from 'react'

export function ApplicationForm({ candidateId, jobId }) {
  const [loading, setLoading] = useState(false)
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    // Implementation
    setLoading(false)
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  )
}
```

**Use Component**:
```typescript
// src/app/orgs/[orgId]/applications/page.tsx
import { ApplicationForm } from '@/components/application-form'

export default function ApplicationsPage({ params }) {
  return (
    <div>
      <ApplicationForm 
        candidateId={params.candidateId}
        jobId={params.jobId}
      />
    </div>
  )
}
```

### 5. Testing

**Manual Testing**:
1. Start dev server: `npm run dev`
2. Open browser: `http://localhost:3000`
3. Test feature thoroughly
4. Check console for errors
5. Verify database changes

**API Testing**:
- Use Postman or curl
- Test all endpoints
- Verify permissions
- Check error handling

### 6. Documentation

**Update Docs**:
```bash
# Add to relevant documentation
documents/
├── API_DOCUMENTATION.md      # API endpoints
├── ARCHITECTURE.md           # System design
├── CANDIDATE_MANAGEMENT.md   # Feature guides
└── UI_COMPONENTS.md          # Component usage
```

## Code Style

### TypeScript

```typescript
// Use explicit types
interface Candidate {
  id: string
  fullName: string
  email: string
}

// Use async/await
async function fetchCandidate(id: string): Promise<Candidate> {
  const response = await fetch(`/api/candidates/${id}`)
  return response.json()
}

// Use optional chaining
const email = candidate?.email ?? 'N/A'
```

### React

```typescript
// Use functional components
export function Component({ prop }: Props) {
  return <div>{prop}</div>
}

// Use hooks
const [state, setState] = useState(initial)
useEffect(() => {
  // Side effects
}, [dependencies])

// Use client directive when needed
'use client'
```

### Tailwind CSS

```typescript
// Use utility classes
<div className="flex items-center gap-4 p-6 bg-white rounded-xl">
  <button className="px-4 py-2 bg-blue-600 text-white rounded-2xl hover:bg-blue-700">
    Click
  </button>
</div>

// Group related classes
<input className="
  w-full px-4 py-2 
  border border-gray-300 rounded-2xl
  focus:ring-2 focus:ring-blue-500 focus:border-transparent
" />
```

## Common Tasks

### Add New Permission

1. Update `src/lib/rbac.ts`:
```typescript
export const PERMISSIONS = {
  // ...existing
  'applications:read': ['OWNER', 'ADMIN', 'MEMBER'],
  'applications:write': ['OWNER', 'ADMIN'],
}
```

2. Use in route:
```typescript
export const POST = createProtectedRoute({
  requiredPermission: 'applications:write',
  // ...
})
```

### Add New Model

1. Update `prisma/schema.prisma`:
```prisma
model Application {
  id          String   @id @default(cuid())
  candidateId String
  jobId       String
  status      String   @default("APPLIED")
  createdAt   DateTime @default(now())
  
  candidate   Candidate @relation(fields: [candidateId], references: [id])
  job         Job       @relation(fields: [jobId], references: [id])
  
  @@unique([candidateId, jobId])
}
```

2. Generate migration:
```bash
npx prisma migrate dev --name add_application
```

3. Update seed script if needed

### Add New Page

1. Create page file:
```typescript
// src/app/orgs/[orgId]/applications/page.tsx
export default function ApplicationsPage({ params }) {
  return <div>Applications</div>
}
```

2. Add navigation link:
```typescript
<Link href={`/orgs/${orgId}/applications`}>
  Applications
</Link>
```

### Add Background Job

1. Create worker function:
```typescript
// src/workers/application-worker.ts
export async function processApplication(data) {
  // Implementation
}
```

2. Queue job:
```typescript
import { getQueue } from '@/lib/queue'

const queue = getQueue('applications')
await queue.add('process', { applicationId })
```

## Debugging

### Server Logs

```bash
# View logs in terminal
npm run dev

# Check specific logs
tail -f logs/error.log
tail -f logs/combined.log
```

### Database Queries

```bash
# Open Prisma Studio
npx prisma studio

# Run SQL directly
psql -d ai_career -c "SELECT * FROM candidates LIMIT 10"
```

### API Debugging

```typescript
// Add console.log
console.log('Request body:', body)

// Use debugger
debugger

// Check response
console.log('Response:', await response.json())
```

## Deployment

### Build

```bash
# Build for production
npm run build

# Test production build
npm start
```

### Environment

Ensure production environment variables are set:
- DATABASE_URL (production database)
- CLERK_SECRET_KEY (production key)
- OPENAI_API_KEY
- UPSTASH_REDIS_REST_URL (if using Redis)

### Database

```bash
# Run migrations
npx prisma migrate deploy

# Generate client
npx prisma generate
```

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Database Connection Error

```bash
# Check PostgreSQL is running
pg_isready

# Verify DATABASE_URL
echo $DATABASE_URL

# Reset database
npx prisma migrate reset
```

### Clerk Auth Issues

1. Verify environment variables
2. Check Clerk dashboard settings
3. Clear browser cookies
4. Restart dev server

### OpenAI API Errors

1. Verify API key is valid
2. Check rate limits
3. Monitor usage in OpenAI dashboard
4. Review error logs

## Best Practices

1. **Commit Often** - Small, focused commits
2. **Test Thoroughly** - Manual and automated testing
3. **Document Changes** - Update docs with features
4. **Code Review** - Review before merging
5. **Error Handling** - Always handle errors gracefully
6. **Logging** - Log important events and errors
7. **Security** - Never commit secrets
8. **Performance** - Monitor query performance
9. **Accessibility** - Test with screen readers
10. **Mobile** - Test on mobile devices

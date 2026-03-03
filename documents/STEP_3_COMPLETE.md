# ✅ STEP 3 COMPLETE: Queue System & Background Jobs

## What We Built

### 1. **Queue Infrastructure** (`src/lib/queue.ts`)
- BullMQ with Redis backend
- 4 queue types:
  - `resume-parse` - Parse individual resumes
  - `bulk-import` - Import multiple candidates
  - `match-calculation` - Calculate job matches
  - `email-send` - Send emails
- Automatic retry with exponential backoff (2s → 4s → 8s)
- Job retention: 24h for completed, 7 days for failed
- Queue stats and monitoring

### 2. **Workers**
- **Resume Parse Worker** (`src/workers/resume-parse.worker.ts`)
  - Concurrency: 5 (process 5 resumes simultaneously)
  - Rate limit: 10 jobs/minute
  - Progress tracking: 10% → 100%
  - Automatic LLM extraction
  - Database updates in transaction
  
- **Bulk Import Worker** (`src/workers/bulk-import.worker.ts`)
  - Concurrency: 2 (process 2 imports simultaneously)
  - Per-candidate progress tracking
  - Handles skills, experiences, projects, technologies
  - Graceful error handling per candidate

### 3. **Job Status API** (`/api/jobs-status`)
- GET endpoint to check job progress
- Returns: state, progress %, result, errors
- Real-time polling support

### 4. **UI Components**
- **JobProgress** (`src/components/job-progress.tsx`)
  - Real-time progress bar
  - Auto-polling every 2 seconds
  - State icons (loading, success, error)
  - Completion/error callbacks
  
### 5. **Updated Import Flow**
- Import route now queues jobs instead of blocking
- Returns jobId immediately
- Client polls for progress
- Background processing with retry

## Architecture

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ POST /api/orgs/{orgId}/candidates/import
       ▼
┌─────────────┐
│  API Route  │ ──► Add job to queue
└──────┬──────┘     Return jobId
       │
       ▼
┌─────────────┐
│    Redis    │ ◄──► BullMQ Queue
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Workers   │ ──► Process jobs
│  (Separate  │     Update progress
│   Process)  │     Retry on failure
└─────────────┘
```

## Job Lifecycle

1. **Queued** - Job added to queue
2. **Waiting** - In queue, not started
3. **Active** - Worker processing (0-100% progress)
4. **Completed** - Success, result available
5. **Failed** - Error after 3 retries

## Retry Strategy

- **Attempts**: 3 max
- **Backoff**: Exponential
  - 1st retry: 2 seconds
  - 2nd retry: 4 seconds
  - 3rd retry: 8 seconds
- **Dead Letter Queue**: Failed jobs kept for 7 days

## How to Use

### 1. Start Redis (Development)
```bash
# Install Redis (Windows)
# Download from https://github.com/microsoftarchive/redis/releases
# Or use Docker:
docker run -d -p 6379:6379 redis:alpine
```

### 2. Start Workers
```bash
npm run workers
```

### 3. Start Next.js
```bash
npm run dev
```

### 4. Import Candidates
- Upload CSV in UI
- Get jobId immediately
- Watch real-time progress
- See completion status

### 5. Check Job Status Manually
```bash
curl "http://localhost:3000/api/jobs-status?jobId=123&queue=bulkImport"
```

## Production Setup

### Option 1: Upstash Redis (Serverless)
```bash
# .env.local
REDIS_URL=https://your-redis.upstash.io
```

### Option 2: AWS ElastiCache
```bash
# .env.local
REDIS_HOST=your-redis.cache.amazonaws.com
REDIS_PORT=6379
```

### Option 3: Railway/Render
```bash
# .env.local
REDIS_URL=redis://user:pass@host:port
```

### Deploy Workers
- **Separate process**: `npm run workers`
- **Docker**: Create worker container
- **PM2**: Process manager for Node.js
- **Kubernetes**: Deploy as separate pod

## Benefits

### Before
❌ Bulk import blocks HTTP request (30s timeout)
❌ No progress feedback
❌ No retry on failure
❌ Single-threaded processing
❌ Poor UX for large imports

### After
✅ Instant response with jobId
✅ Real-time progress tracking
✅ Automatic retry (3 attempts)
✅ Parallel processing (5 resumes at once)
✅ Background processing
✅ Job monitoring and analytics
✅ Graceful failure handling

## Queue Stats

Access queue statistics:
```typescript
import { getQueueStats, queues } from '@/lib/queue';

const stats = await getQueueStats(queues.bulkImport);
// { waiting: 5, active: 2, completed: 100, failed: 3, delayed: 0 }
```

## Worker Events

Workers emit events for monitoring:
```typescript
resumeParseWorker.on('completed', (job) => {
  console.log('Job completed:', job.id);
});

resumeParseWorker.on('failed', (job, err) => {
  console.error('Job failed:', job?.id, err.message);
});

resumeParseWorker.on('progress', (job, progress) => {
  console.log('Progress:', job.id, progress);
});
```

## Testing

### Test Queue System
```bash
# 1. Start Redis
docker run -d -p 6379:6379 redis:alpine

# 2. Start workers
npm run workers

# 3. Import candidates via UI
# Watch console for worker logs

# 4. Check Redis
redis-cli
> KEYS bull:*
> LLEN bull:bulk-import:waiting
```

### Test Retry Logic
```typescript
// Simulate failure in worker
throw new Error('Test failure');
// Job will retry 3 times with exponential backoff
```

## Monitoring

### BullBoard (Optional)
Install BullBoard for web UI:
```bash
npm install @bull-board/api @bull-board/express
```

Access at: `http://localhost:3000/admin/queues`

## What's Next

Ready for **Step 4: Vector Search & Semantic Matching**

This will add:
- OpenAI embeddings for resumes
- Pinecone/pgvector for vector storage
- Semantic search ("React developer" = "Frontend engineer")
- "Find similar candidates" feature
- Skill taxonomy with synonyms

---

**Status**: ✅ COMPLETE - Background jobs working

## Files Created/Modified

**Created:**
- `src/lib/queue.ts`
- `src/workers/resume-parse.worker.ts`
- `src/workers/bulk-import.worker.ts`
- `src/workers/start.ts`
- `src/app/api/jobs-status/route.ts`
- `src/components/job-progress.tsx`

**Modified:**
- `src/app/api/orgs/[orgId]/candidates/import/route.ts`
- `src/app/orgs/[orgId]/candidates/bulk-import.tsx`
- `package.json`
- `.env.example`

**Dependencies Added:**
- `bullmq`
- `ioredis`

## Commands

```bash
# Start workers
npm run workers

# Start dev server
npm run dev

# Both together (use separate terminals)
npm run workers & npm run dev
```

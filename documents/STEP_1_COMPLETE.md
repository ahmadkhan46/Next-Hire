# ✅ STEP 1 COMPLETE: Error Tracking & Monitoring

## What We Built

### 1. **Structured Logging System** (`src/lib/logger.ts`)
- Winston-based logger with PII redaction
- Automatic email/phone/SSN masking in logs
- Separate loggers for LLM and API operations
- File logging in production (error.log, combined.log)
- Helper functions: `logLLMUsage()`, `logAPIRequest()`

### 2. **Error Handling Framework** (`src/lib/errors.ts`)
- Custom error classes:
  - `AppError` - Base application error
  - `ValidationError` - Input validation failures
  - `AuthenticationError` - Auth failures
  - `RateLimitError` - Rate limit exceeded
  - `LLMError` - LLM provider failures
- `handleAPIError()` - Centralized error handler
- `withErrorHandling()` - Async wrapper for routes

### 3. **LLM Cost Tracking** (`src/lib/llm-tracking.ts`)
- Database-backed usage tracking
- Per-org cost analytics
- Functions:
  - `trackLLMUsage()` - Log usage to DB
  - `getOrgLLMStats()` - Get 30-day stats
  - `getOrgLLMStatsByModel()` - Breakdown by model

### 4. **Database Schema**
- New table: `llm_usage_logs`
- Tracks: tokens, cost, duration, success rate
- Indexed by: org_id, created_at, model
- Migration: `20260208_add_llm_usage_logs`

### 5. **Updated LLM Pipeline** (`src/lib/resume-llm.ts`)
- Automatic usage tracking on every parse
- Tracks both success and failures
- Records retry attempts separately
- Passes orgId for per-tenant tracking

### 6. **Analytics API** (`/api/orgs/[orgId]/llm-analytics`)
- GET endpoint for usage stats
- Query param: `?days=30` (default)
- Returns: total cost, requests, success rate, avg duration
- Breakdown by model

### 7. **Analytics Dashboard** (`src/components/llm-analytics-dashboard.tsx`)
- Visual cards for key metrics
- Cost, requests, success rate, avg duration
- Model-by-model breakdown
- Auto-refreshes on mount

## How to Use

### View LLM Analytics
```typescript
// In any page component
import { LLMAnalyticsDashboard } from '@/components/llm-analytics-dashboard';

<LLMAnalyticsDashboard orgId={orgId} />
```

### Track Custom LLM Operations
```typescript
import { trackLLMUsage } from '@/lib/llm-tracking';

await trackLLMUsage({
  orgId: 'org_123',
  model: 'gpt-4o',
  operation: 'job_description_generation',
  inputTokens: 500,
  outputTokens: 1000,
  totalTokens: 1500,
  cost: 0.025,
  success: true,
  duration: 2500,
  metadata: { jobId: 'job_456' }
});
```

### Use Custom Errors
```typescript
import { ValidationError, LLMError } from '@/lib/errors';

// Validation error
if (!email) {
  throw new ValidationError('Email is required', { field: 'email' });
}

// LLM error
if (openaiError) {
  throw new LLMError('OpenAI timeout', 'openai', 'gpt-4o-mini', { 
    originalError: openaiError.message 
  });
}
```

### Log API Requests
```typescript
import { logAPIRequest } from '@/lib/logger';

const startTime = Date.now();
// ... handle request ...
logAPIRequest({
  method: 'POST',
  path: '/api/candidates/import',
  orgId: 'org_123',
  userId: 'user_456',
  duration: Date.now() - startTime,
  status: 200,
});
```

## Database Migration

Already applied! Table `llm_usage_logs` is live.

To verify:
```sql
SELECT * FROM llm_usage_logs LIMIT 10;
```

## What's Next

### Immediate Benefits
✅ Track LLM costs per organization
✅ Monitor success rates and failures
✅ Identify slow operations
✅ PII-safe logging
✅ Structured error handling

### Ready for Next Step
Now we can move to **Step 2: Rate Limiting & Security**

This will add:
- API rate limiting per org
- Input validation with Zod
- RBAC enforcement
- Request throttling

---

## Testing

1. **Import candidates** - Check `llm_usage_logs` table
2. **View analytics** - Add `<LLMAnalyticsDashboard orgId={orgId} />` to dashboard
3. **Check logs** - Look for `logs/error.log` and `logs/combined.log` in production

## Files Created/Modified

**Created:**
- `src/lib/logger.ts`
- `src/lib/errors.ts`
- `src/lib/llm-tracking.ts`
- `src/components/llm-analytics-dashboard.tsx`
- `src/app/api/orgs/[orgId]/llm-analytics/route.ts`
- `prisma/migrations/20260208_add_llm_usage_logs/migration.sql`

**Modified:**
- `src/lib/resume-llm.ts` - Added tracking
- `src/app/api/orgs/[orgId]/candidates/import/route.ts` - Pass orgId
- `.env.example` - Added Sentry config

**Dependencies Added:**
- `@sentry/nextjs`
- `winston`

---

**Status**: ✅ COMPLETE - Ready for Step 2

# Phase 2.1: Global Auth Middleware - Detailed Execution Plan

**Status**: Ready to implement  
**Timeline**: 4 hours implementation + 8 hours testing = 1 day  
**Risk Level**: LOW (defense-in-depth layer, existing routes already auth'd)  
**Enterprise Value**: HIGH (prevents new routes bypassing auth, reduces human error)

---

## Executive Summary

### What We're Doing
Moving from **per-route auth checks** → **centralized middleware** that validates every `/api/` request before it reaches route handlers.

### Why It Matters
- ✅ Catches new routes we accidentally forget to protect
- ✅ Single source of truth for org membership validation
- ✅ Shows "defense in depth" to enterprise auditors
- ✅ Easier to enforce compliance rules globally (rate limits, logging)

### Zero Risk Because
- All existing routes ALREADY have auth checks
- Middleware is a SECOND layer (doesn't replace per-route auth)
- If middleware breaks, remove it → routes still work
- No data model changes
- No API contract changes

### Success Criteria
```
✅ /api/orgs/correct-orgId/* returns 200
✅ /api/orgs/wrong-orgId/* returns 403 Forbidden
✅ /api/* without token returns 401 Unauthorized
✅ All existing integration tests pass
✅ Zero performance regression
```

---

## Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `src/middleware.ts` | CREATE | Centralized auth + org scope validation |
| `next.config.ts` | MODIFY | Add middleware matcher pattern |
| `src/lib/api-middleware.ts` | MODIFY | Add helper to extract orgId from request |
| `src/lib/errors.ts` | VERIFY | Ensure error handler works with middleware |

---

## Step-by-Step Implementation

### STEP 1: Create `src/middleware.ts` (NEW FILE)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * Global middleware for API authentication and org scope validation
 * 
 * Rules:
 * 1. All /api/* routes require authentication
 * 2. Org-scoped routes (/api/orgs/[orgId]/*) verify membership
 * 3. Public routes bypass this (configured below)
 * 4. Development endpoints (bootstrap) disabled in production
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // WHITELIST: Routes that bypass auth
  // Only add truly public endpoints here
  const publicPaths = [
    '/api/health',           // Health check for load balancers
    '/health',               // Alternative health check path
  ];

  // Development-only endpoints (disabled in production)
  const devOnlyPaths = [
    '/api/bootstrap',        // Initial setup (ONLY dev)
    '/api/debug',            // Debug endpoints (ONLY dev)
  ];

  // Check if path is public
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check if path is dev-only and reject in production
  if (devOnlyPaths.some(p => pathname.startsWith(p))) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Not available in production' },
        { status: 403 }
      );
    }
    // Allow in development
    return NextResponse.next();
  }

  // For all other /api/* routes, require authentication
  if (pathname.startsWith('/api/')) {
    const authResult = await auth();
    const userId = authResult.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: No valid session' },
        { status: 401 }
      );
    }

    // Extract orgId from path: /api/orgs/[orgId]/*
    const orgIdMatch = pathname.match(/^\/api\/orgs\/([^\/]+)/);
    
    if (orgIdMatch) {
      const orgId = orgIdMatch[1];

      // Validate org membership
      try {
        const membership = await prisma.membership.findUnique({
          where: { userId_orgId: { userId, orgId } },
          select: { id: true },
        });

        if (!membership) {
          return NextResponse.json(
            { error: `Forbidden: No access to organization ${orgId}` },
            { status: 403 }
          );
        }
        
        // ✅ User is authenticated and has org access
        // Continue to route handler
        return NextResponse.next();
      } catch (error) {
        console.error('[Middleware] Database error checking membership:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    }

    // For /api/* routes NOT under /api/orgs/[orgId]/, just require auth
    // (e.g., /api/my/profile)
    return NextResponse.next();
  }

  // For all other routes (pages, etc.), pass through
  return NextResponse.next();
}

/**
 * Matcher config: Which routes should run through middleware
 * 
 * Includes:
 * - /api/* (all API routes)
 * - /orgs/* (all org pages, if needed in future)
 * 
 * Excludes (via negative lookahead):
 * - /_next/* (Next.js internals)
 * - /static/* (static assets)
 * - /public/* (public files)
 * - *.favicon.ico
 */
export const config = {
  matcher: [
    // Match /api routes
    '/api/:path*',
    // Match org-scoped UI routes (in case we add org admin pages)
    '/orgs/:path*',
    // Exclude Next internals, static files, etc
    '/((?!_next|static|public|favicon.ico).*)',
  ],
};
```

**Checklist:**
- [ ] File created at `src/middleware.ts`
- [ ] All imports valid (Clerk, Prisma available)
- [ ] Matches public paths correctly
- [ ] Extracts orgId from /api/orgs/[orgId] pattern
- [ ] Returns 401 (no auth), 403 (no access), or 200 (allowed)

**What this does:**
```
Request: GET /api/orgs/org_123/candidates
├─ Auth check: ✅ Token valid, userId = user_abc
├─ Org check: ✅ user_abc has membership in org_123
└─ Result: NextResponse.next() → route handler processes request

Request: GET /api/orgs/org_999/candidates
├─ Auth check: ✅ Token valid, userId = user_abc
├─ Org check: ❌ user_abc NOT in org_999
└─ Result: 403 Forbidden
```

---

### STEP 2: Update `next.config.ts` to Enable Middleware

**Current file location**: `c:\University\New folder\ai-career-platform\next.config.ts`

Find this section:
```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // existing config...
}
```

No changes needed! Next.js 14+ automatically loads `src/middleware.ts` if it exists.

**Verify by checking:**
```bash
# In your IDE, middleware should auto-highlight and show:
# "Middleware detected. This will run on every request matching the config.matcher"
```

**Checklist:**
- [ ] Confirmed next.config.ts exists at project root
- [ ] No `middleware` config field exists (not needed in 14+)
- [ ] Matcher in middleware.ts is correct

---

### STEP 3: Update `src/lib/api-middleware.ts` - Add Helper

**File**: `c:\University\New folder\ai-career-platform\src\lib\api-middleware.ts`

Find the section with imports (around line 1-10):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { z } from 'zod';
import { enforceRateLimit } from './rate-limit';
import { enforcePermission, enforceOrgAccess, type Permission } from './rbac';
```

Add this helper function at the END of the file (after the existing functions):

```typescript
/**
 * Helper to extract orgId from request path
 * Used by middleware and route handlers to get consistent org context
 * 
 * Example:
 * extractOrgIdFromPath('/api/orgs/org_123/candidates') → 'org_123'
 * extractOrgIdFromPath('/api/health') → null
 */
export function extractOrgIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/api\/orgs\/([^\/]+)/);
  return match ? match[1] : null;
}

/**
 * Helper to check if path requires org scope
 * Some routes are global (e.g., /api/health), others are org-scoped
 */
export function isOrgScopedPath(pathname: string): boolean {
  return pathname.startsWith('/api/orgs/');
}
```

**Checklist:**
- [ ] Added `extractOrgIdFromPath()` function
- [ ] Added `isOrgScopedPath()` function
- [ ] Both are exported
- [ ] No syntax errors

**Why:** Centralizes org extraction logic. If we need to change how orgId is extracted, update one place instead of middleware + all routes.

---

### STEP 4: Verify Error Handler Works

**File**: `src/lib/errors.ts`

Find the `handleAPIError()` function. It should handle middleware errors (401, 403) correctly.

Check that it has responses for:
```typescript
export function handleAPIError(error: any) {
  // Should handle 401, 403, 400, 429, 500 gracefully
  if (error.message.includes('No access')) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }
  // ... etc
}
```

**Checklist:**
- [ ] `handleAPIError()` exists
- [ ] Handles 403 Forbidden case
- [ ] Handles 401 Unauthorized case
- [ ] Returns proper JSON format

---

## Testing Plan

### Test 1: Valid Token + Correct Org → 200 OK

```bash
# Assume you have a token for user_abc in org_123

curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://localhost:3000/api/orgs/org_123/candidates

# Expected: 200 OK
# Response: { candidates: [...] }
```

**What to verify:**
- ✅ Status is 200
- ✅ Response is normal candidate list
- ✅ No "Forbidden" error

---

### Test 2: Valid Token + Wrong Org → 403 Forbidden

```bash
# Same token, but request a different org's data

curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://localhost:3000/api/orgs/org_999/candidates

# Expected: 403 Forbidden
# Response: { error: "Forbidden: No access to organization org_999" }
```

**What to verify:**
- ✅ Status is 403
- ✅ Error message says "Forbidden"
- ✅ No data is returned

---

### Test 3: No Token → 401 Unauthorized

```bash
# No Authorization header

curl https://localhost:3000/api/orgs/org_123/candidates

# Expected: 401 Unauthorized
# Response: { error: "Unauthorized: No valid session" }
```

**What to verify:**
- ✅ Status is 401
- ✅ Error says "Unauthorized"
- ✅ No data returned

---

### Test 4: Public Route (Health) → No Auth Required

```bash
curl https://localhost:3000/api/health

# Expected: 200 OK
# Response: { status: "ok" }
```

**What to verify:**
- ✅ Works without token
- ✅ No auth error

---

### Test 5: New Route Without Per-Route Auth

Create temporary test route at `/api/test-middleware/route.ts`:

```typescript
// Intentionally NO auth checks in handler
export async function GET(req: Request) {
  return Response.json({ message: 'test' });
}
```

Then request it without token:
```bash
curl https://localhost:3000/api/test-middleware

# Expected: 401 Unauthorized (caught by middleware!)
# NOT: 200 OK with test message
```

This proves middleware catches forgot-to-auth bugs.

**What to verify:**
- ✅ Middleware rejects request before handler runs
- ✅ Handler never executes without auth

---

### Test 6: Run Existing Integration Tests

```bash
# If you have tests:
npm run test

# Or manually verify key flows:
# - Create candidate (should work)
# - Import CSV (should work)
# - Create job (should work)
# - Run matching (should work)
```

**What to verify:**
- ✅ All existing tests pass
- ✅ No 403/401 errors for valid requests
- ✅ Database operations work normally

---

### Test 7: Performance Check

Before:
```
GET /api/orgs/org_123/candidates?limit=100
Time: 145ms (api-middleware.ts auth check + handler)
```

After (with middleware):
```
GET /api/orgs/org_123/candidates?limit=100
Time: 146ms (middleware auth check + api-middleware.ts + handler)
```

**Target**: <5ms overhead from middleware (should be imperceptible)

**What to verify:**
- ✅ Response time same or faster (cached membership lookups)
- ✅ No N+1 queries (middleware queries once)

---

## Deployment Strategy

### Option A: Feature Flag (Safest for Enterprise)

```typescript
// In src/middleware.ts
export async function middleware(request: NextRequest) {
  // Check feature flag
  const middlewareEnabled = process.env.ENABLE_AUTH_MIDDLEWARE === 'true';
  
  if (!middlewareEnabled) {
    return NextResponse.next();  // Bypass, use old per-route auth
  }

  // ... rest of middleware ...
}
```

**Deploy steps:**
1. Merge middleware code to main (feature flag OFF by default)
2. Deploy to staging
3. Test for 1 week with flag OFF
4. Enable flag: `ENABLE_AUTH_MIDDLEWARE=true`
5. Monitor for 1 week
6. Remove flag code entirely

**Rollback**: Set `ENABLE_AUTH_MIDDLEWARE=false` → instant rollback

---

### Option B: Direct Merge (Fast, Lower Risk Since Routes Already Auth'd)

Since all routes ALREADY have per-route auth:
1. Merge middleware.ts
2. Deploy to prod
3. Monitor error rate for 1 hour
4. If issues: Remove `src/middleware.ts` → restart app

**Why low risk:**
- Middleware is additive (second layer)
- Routes still have first layer (per-route auth)
- If middleware breaks, routes catch it anyway

---

## Verification Checklist

### Before Deployment

- [ ] `src/middleware.ts` created with full logic
- [ ] All 7 tests above pass
- [ ] Existing integration tests pass
- [ ] No syntax errors
- [ ] Import paths correct (Clerk, Prisma)
- [ ] Error messages are user-friendly
- [ ] Development endpoints only in dev mode
- [ ] Performance overhead <5ms

### After Deployment

- [ ] Monitor error logs for next 2 hours
- [ ] Check error rate (should be same as before)
- [ ] Test on staging with real Clerk tokens
- [ ] Verify /api/health works without token
- [ ] Verify org-scoped routes require correct org
- [ ] No 403/401 errors for legitimate requests
- [ ] No increase in latency

---

## Rollback Procedure (If Needed)

### Immediate Rollback (30 seconds)

Option 1: Remove middleware file
```bash
# Delete the middleware
rm src/middleware.ts

# Redeploy app → middleware disabled, routes use per-route auth
npm run build && npm start
```

Option 2: Flip feature flag
```bash
# Set env var in hosting dashboard:
ENABLE_AUTH_MIDDLEWARE=false

# Restart app
```

### Result
- All requests still get authenticated (per-route checks still active)
- Zero data corruption
- Zero downtime

---

## Code Review Checklist

When reviewing this implementation:

- [ ] Org extraction regex correct: `/^\/api\/orgs\/([^\/]+)/`
- [ ] Whitelist paths intentionally minimal
- [ ] Dev-only paths blocked in production
- [ ] Error responses include user-friendly messages
- [ ] No sensitive data in error messages
- [ ] Prisma queries use `.select()` to avoid N+1
- [ ] Middleware doesn't modify request (just validates)
- [ ] Config.matcher pattern correct

---

## Success Metrics

After implementation:

| Metric | Target | How to Measure |
|--------|--------|-----------------|
| **Auth coverage** | 100% of /api/ routes | Middleware + per-route checks |
| **Org isolation** | 0 cross-org data access | Test suite + manual verification |
| **Performance** | <5ms overhead | Load test before/after |
| **Uptime** | 100% (same as before) | Datadog/monitoring dashboard |
| **Coverage** | New routes auto-protected | Add test route without auth, verify rejection |

---

## Timeline

```
Hour 1: Create src/middleware.ts + update api-middleware.ts
Hour 2: Write tests (7 scenarios above)
Hour 3: Run tests, fix issues
Hour 4: Performance testing, documentation

Hour 5-8: Code review, staging deployment, manual testing
Hour 9-16: Live monitoring (1 day), gather metrics
```

**Deliverable**: Middleware that reduces enterprise security audit findings by:
- ✅ "All routes have consistent auth validation"
- ✅ "Defense-in-depth: new routes auto-protected"
- ✅ "Centralized org access control"

---

## Enterprise Talking Points

When you mention this to HR buyers:

> "Every API route goes through two auth checks:
> 1. **Middleware**: Validates token + org membership globally
> 2. **Route handler**: Validates specific permissions for that action
> 
> If we add a new feature and forget check #2, check #1 still blocks cross-org access. This is defense-in-depth."

**Translation for non-technical buyers:**
> "Two independent security guards checking everyone. Even if one makes a mistake, the other catches it."

---

## Questions to Answer Before Starting

1. **Do you have Clerk set up and working?** (Yes, already done)
2. **Is Prisma seeded with test users/orgs?** (Needed for testing)
3. **Can you hit your API with a real Clerk token?** (Needed for Step 1)
4. **Do you want feature flag safety or direct merge?** (Recommend direct merge - already low risk)

---

## Files Changed Summary

```
CREATED:
  src/middleware.ts (100 lines)

MODIFIED:
  src/lib/api-middleware.ts (add 20 lines)

NO CHANGES:
  next.config.ts (auto-detected)
  Database schema (no changes)
  API routes (no changes)
  Frontend code (no changes)
```

---

**Ready to execute?** Start with STEP 1 and let me know if you hit any issues.

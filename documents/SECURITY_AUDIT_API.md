# Security Audit - API Routes

## Critical Issues Fixed

### 1. Bootstrap Endpoint (CRITICAL) ✅ FIXED
**File**: `src/app/api/bootstrap/route.ts`
**Issue**: Allows anyone to create orgs without auth
**Fix**: Added `NODE_ENV === 'production'` check - only works in development

### 2. Debug Endpoint (HIGH) ✅ FIXED
**File**: `src/app/api/debug/user/route.ts`
**Issue**: Exposes all users data
**Fix**: Added `NODE_ENV === 'production'` check - only works in development

### 3. Jobs Status Endpoint (MEDIUM) ✅ FIXED
**File**: `src/app/api/jobs-status/route.ts`
**Issue**: No org membership verification
**Fix**: Added org membership check before returning job data

---

## Routes That Need Migration

### Unprotected Routes Under /api/candidates/
These routes are NOT under `/api/orgs/[orgId]/` and lack proper auth:

**Files**:
- `src/app/api/candidates/[candidateId]/skills/route.ts` - NO AUTH
- `src/app/api/candidates/[candidateId]/resumes/route.ts` - NO AUTH  
- `src/app/api/candidates/[candidateId]/extract-skills/route.ts` - NO AUTH

**Recommendation**: 
- These should be moved under `/api/orgs/[orgId]/candidates/[candidateId]/`
- OR add manual org membership checks

---

### Unprotected Routes Under /api/jobs/
These routes are NOT under `/api/orgs/[orgId]/` and lack proper auth:

**Files**:
- `src/app/api/jobs/[jobId]/match/route.ts`
- `src/app/api/jobs/[jobId]/matches/route.ts`
- `src/app/api/jobs/[jobId]/skills/route.ts`
- `src/app/api/jobs/[jobId]/workflow/route.ts`

**Recommendation**:
- These should be moved under `/api/orgs/[orgId]/jobs/[jobId]/`
- OR add manual org membership checks

---

## Current API Structure

### ✅ PROTECTED (Under /api/orgs/[orgId]/)
```
/api/orgs/[orgId]/candidates/*
/api/orgs/[orgId]/jobs/*
/api/orgs/[orgId]/auto-match
/api/orgs/[orgId]/analytics
/api/orgs/[orgId]/audit
```
These use `createRoute` or `createProtectedRoute` with proper auth + org checks.

### ⚠️ UNPROTECTED (Not under org scope)
```
/api/candidates/[candidateId]/*
/api/jobs/[jobId]/*
/api/bootstrap
/api/debug/*
/api/jobs-status
```

---

## Recommended Actions

### Immediate (Production Blockers)
1. ✅ **Bootstrap** - Disabled in production
2. ✅ **Debug** - Disabled in production
3. ✅ **Jobs Status** - Added org check

### High Priority (Data Leak Risk)
4. **Migrate or protect** `/api/candidates/[candidateId]/*` routes
5. **Migrate or protect** `/api/jobs/[jobId]/*` routes

### Implementation Options

**Option A: Migrate to org-scoped routes** (Recommended)
- Move all routes under `/api/orgs/[orgId]/`
- Update all client-side fetch calls
- Ensures consistent auth/org checks

**Option B: Add manual checks** (Quick fix)
```typescript
// Add to each route
const { userId } = await auth();
if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

// Verify candidate/job belongs to user's org
const candidate = await prisma.candidate.findUnique({
  where: { id: candidateId },
  select: { orgId: true },
});

const membership = await prisma.membership.findUnique({
  where: { userId_orgId: { userId, orgId: candidate.orgId } },
});

if (!membership) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

## Security Checklist

- [x] Bootstrap endpoint protected
- [x] Debug endpoint protected
- [x] Jobs status endpoint has org check
- [ ] Migrate `/api/candidates/[candidateId]/*` routes
- [ ] Migrate `/api/jobs/[jobId]/*` routes
- [ ] Update client-side fetch calls
- [ ] Test all auth flows
- [ ] Audit all API routes for permissions

---

## Notes

**Why org-scoped routes are better**:
1. Consistent auth/org checks via middleware
2. Clear URL structure shows ownership
3. Easier to audit and maintain
4. Prevents accidental data leaks
5. Follows REST best practices

**Current risk level**:
- Development: LOW (bootstrap/debug disabled in prod)
- Production: MEDIUM (unscoped routes still accessible if IDs are known)

**Recommendation**: Complete migration before production deployment.

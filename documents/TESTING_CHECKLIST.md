# 🧪 COMPREHENSIVE TESTING CHECKLIST

## 🚀 SETUP (Do This First)

### 1. Start the Application
```bash
npm run dev
```

### 2. Check Console
- ✅ No errors on startup
- ✅ "Memory workers started" message appears
- ✅ Server running on http://localhost:3000

### 3. Sign In
- Go to http://localhost:3000
- Sign in with Clerk
- Verify you're redirected to dashboard

---

## 📋 FEATURE TESTING

### ✅ 1. AUTHENTICATION & AUTHORIZATION

**Test Cases:**
- [ ] Sign up with new account
- [ ] Sign in with existing account
- [ ] Access protected routes (should redirect to sign-in if not logged in)
- [ ] Try accessing `/orgs/[orgId]` routes
- [ ] Check UserButton appears in navigation

**Expected Results:**
- ✅ Can create account
- ✅ Can sign in
- ✅ Protected routes require auth
- ✅ User profile shows in header

---

### ✅ 2. BULK IMPORT WITH AI PARSING

**Test Cases:**

#### A. Basic Import (No Resume Text)
1. Go to Candidates page
2. Click "Bulk Import"
3. Paste this CSV:
```csv
Name,Email,Phone,Skills,Resume
John Doe,john@example.com,555-0101,React;TypeScript,
Jane Smith,jane@example.com,555-0102,Python;Django,
```
4. Click "Import Candidates"

**Expected Results:**
- ✅ Job queued immediately (jobId returned)
- ✅ Progress bar appears
- ✅ Shows "Processing candidates..."
- ✅ Completes within 5 seconds
- ✅ Shows "2 imported, 0 failed"
- ✅ Candidates appear in list

#### B. Import with Resume Text (AI Parsing)
1. Click "Bulk Import" again
2. Paste this CSV:
```csv
Name,Email,Phone,Skills,Resume
Bob Johnson,bob@example.com,555-0103,,"Experienced software engineer with 5 years in React and Node.js. Built scalable web applications at TechCorp. Expert in TypeScript, AWS, and Docker. Bachelor's degree in Computer Science from MIT."
```
3. Click "Import Candidates"

**Expected Results:**
- ✅ Job queued
- ✅ Progress updates (0% → 100%)
- ✅ Takes 5-10 seconds (LLM processing)
- ✅ Candidate imported with:
  - ✅ Skills extracted (React, Node.js, TypeScript, AWS, Docker)
  - ✅ Experience: 5 years
  - ✅ Education: MIT, Computer Science
  - ✅ Current title extracted
- ✅ Check console for LLM cost logs

#### C. Test Duplicate Detection
1. Try importing Bob Johnson again (same email)
2. Should detect duplicate

**Expected Results:**
- ✅ Import succeeds but flags as potential duplicate
- ✅ Check database for duplicate entry

---

### ✅ 3. SEMANTIC SEARCH

**Test Cases:**

#### A. Add Semantic Search Component
1. Go to `src/app/orgs/[orgId]/candidates/page.tsx`
2. Add this import:
```typescript
import { SemanticSearch } from '@/components/semantic-search';
```
3. Add component before candidate list:
```tsx
<SemanticSearch orgId={orgId} />
```

#### B. Test Semantic Search
1. Refresh candidates page
2. In semantic search box, type: "React developer"
3. Click Search

**Expected Results:**
- ✅ Finds candidates with React skills
- ✅ Shows similarity scores (70-100%)
- ✅ Matches "React.js", "ReactJS" variations
- ✅ Takes 1-2 seconds

#### C. Test Natural Language
1. Search: "senior backend engineer with cloud experience"
2. Should find candidates with:
   - Backend skills (Node.js, Python, Django)
   - Cloud skills (AWS, Azure, GCP)

**Expected Results:**
- ✅ Semantic understanding works
- ✅ Not just keyword matching

---

### ✅ 4. LLM COST TRACKING

**Test Cases:**

#### A. Add Analytics Dashboard
1. Go to `src/app/orgs/[orgId]/page.tsx` (dashboard)
2. Add this import:
```typescript
import { LLMAnalyticsDashboard } from '@/components/llm-analytics-dashboard';
```
3. Add component:
```tsx
<LLMAnalyticsDashboard orgId={orgId} />
```

#### B. Check Analytics
1. Refresh dashboard
2. View LLM analytics

**Expected Results:**
- ✅ Shows total cost
- ✅ Shows total requests
- ✅ Shows success rate
- ✅ Shows average duration
- ✅ Breakdown by model (gpt-4o-mini)

#### C. Verify Database
```sql
SELECT * FROM llm_usage_logs ORDER BY created_at DESC LIMIT 10;
```

**Expected Results:**
- ✅ Logs exist for each import
- ✅ Shows tokens, cost, duration
- ✅ Success = true

---

### ✅ 5. RATE LIMITING

**Test Cases:**

#### A. Test Bulk Import Rate Limit
1. Try importing 6 times in 1 hour
2. 6th attempt should be rate limited

**Expected Results:**
- ✅ First 5 succeed
- ✅ 6th returns 429 error
- ✅ Error message: "Rate limit exceeded"

#### B. Check Rate Limit Headers
1. Open browser DevTools → Network
2. Import candidates
3. Check response headers

**Expected Results:**
- ✅ `X-RateLimit-Limit: 5`
- ✅ `X-RateLimit-Remaining: 4` (decreases)
- ✅ `X-RateLimit-Reset: [timestamp]`

---

### ✅ 6. BACKGROUND JOBS & PROGRESS

**Test Cases:**

#### A. Test Progress Tracking
1. Import 5 candidates with resume text
2. Watch progress bar

**Expected Results:**
- ✅ Progress updates every 2 seconds
- ✅ Shows 0% → 20% → 40% → 60% → 80% → 100%
- ✅ Takes ~30 seconds for 5 candidates
- ✅ Shows completion message

#### B. Test Job Status API
```bash
# Get jobId from import response
curl "http://localhost:3000/api/jobs-status?jobId=YOUR_JOB_ID&queue=bulkImport"
```

**Expected Results:**
- ✅ Returns job state (waiting/active/completed)
- ✅ Shows progress percentage
- ✅ Shows result when completed

---

### ✅ 7. DATA VALIDATION

**Test Cases:**

#### A. Test Invalid Email
```csv
Name,Email,Phone,Skills,Resume
Test User,invalid-email,555-0104,,
```

**Expected Results:**
- ✅ Import succeeds (validation is warning, not error)
- ✅ Email marked as invalid in enrichment

#### B. Test Invalid Phone
```csv
Name,Email,Phone,Skills,Resume
Test User,test@example.com,abc-def-ghij,,
```

**Expected Results:**
- ✅ Phone normalized to digits only
- ✅ Marked as invalid format

---

### ✅ 8. SKILL NORMALIZATION

**Test Cases:**

#### A. Test Synonyms
Import candidates with these skills:
- "React.js"
- "ReactJS"
- "React"

**Expected Results:**
- ✅ All normalize to "React"
- ✅ Skill count shows 1 skill, not 3

#### B. Test Fuzzy Matching
```typescript
// In browser console
import { fuzzyMatchSkill } from '@/lib/skill-taxonomy';
fuzzyMatchSkill("Reactjs");  // Should return "React"
fuzzyMatchSkill("Postgress"); // Should return "PostgreSQL"
```

---

### ✅ 9. AUDIT LOGGING

**Test Cases:**

#### A. Check Audit Logs
```sql
SELECT * FROM "AuditLog" ORDER BY created_at DESC LIMIT 10;
```

**Expected Results:**
- ✅ Logs exist for imports
- ✅ Shows user_id, action, resource_type
- ✅ Includes IP address and user agent
- ✅ Tracks changes in JSONB

#### B. Test Audit Log API
```bash
curl "http://localhost:3000/api/orgs/YOUR_ORG_ID/audit?limit=10"
```

**Expected Results:**
- ✅ Returns recent audit logs
- ✅ Filterable by user, resource, action

---

### ✅ 10. DUPLICATE DETECTION

**Test Cases:**

#### A. Test Exact Email Match
1. Import: "John Doe, john@example.com"
2. Import again: "Johnny Doe, john@example.com"

**Expected Results:**
- ✅ Detects duplicate (100% match)
- ✅ Shows "Exact email match"

#### B. Test Fuzzy Name Match
1. Import: "John Smith, john1@example.com"
2. Import: "Jon Smith, john2@example.com"

**Expected Results:**
- ✅ Detects as potential duplicate (>85% similarity)
- ✅ Shows name similarity score

---

### ✅ 11. ADVANCED ANALYTICS

**Test Cases:**

#### A. Test Funnel Metrics
```typescript
import { getRecruitmentFunnel } from '@/lib/advanced-analytics';
const funnel = await getRecruitmentFunnel('YOUR_ORG_ID');
console.log(funnel);
```

**Expected Results:**
- ✅ Shows total candidates
- ✅ Shows shortlisted count
- ✅ Shows rejected count
- ✅ Calculates conversion rate

#### B. Test Time-to-Hire
```typescript
import { getTimeToHireMetrics } from '@/lib/advanced-analytics';
const metrics = await getTimeToHireMetrics('YOUR_ORG_ID');
console.log(metrics);
```

**Expected Results:**
- ✅ Shows average days
- ✅ Shows median days
- ✅ Shows fastest/slowest

---

### ✅ 12. ERROR HANDLING

**Test Cases:**

#### A. Test Invalid CSV
```csv
Invalid CSV with no header
Just random text
```

**Expected Results:**
- ✅ Shows error message
- ✅ Doesn't crash
- ✅ Error logged

#### B. Test Network Error
1. Disconnect internet
2. Try importing

**Expected Results:**
- ✅ Shows error message
- ✅ Retry button appears
- ✅ Error logged in console

---

## 🎯 PERFORMANCE TESTING

### Test Cases:

#### A. Import Speed
- [ ] 10 candidates: < 10 seconds
- [ ] 50 candidates: < 60 seconds
- [ ] 100 candidates: < 120 seconds

#### B. Search Speed
- [ ] Semantic search: < 2 seconds
- [ ] Keyword search: < 500ms
- [ ] Database queries: < 100ms

#### C. Memory Usage
- [ ] Check browser memory (DevTools → Memory)
- [ ] Should not exceed 200MB
- [ ] No memory leaks after 10 imports

---

## 🔍 DATABASE VERIFICATION

### Check These Tables:

```sql
-- Candidates
SELECT COUNT(*) FROM "Candidate";

-- Resumes with embeddings
SELECT COUNT(*) FROM "Resume" WHERE embedding IS NOT NULL;

-- LLM usage logs
SELECT COUNT(*), SUM(cost) FROM llm_usage_logs;

-- Audit logs
SELECT COUNT(*) FROM "AuditLog";

-- Skills
SELECT name, COUNT(*) as candidate_count 
FROM "Skill" s
JOIN "CandidateSkill" cs ON cs.skill_id = s.id
GROUP BY s.id, s.name
ORDER BY candidate_count DESC
LIMIT 10;
```

---

## 📊 EXPECTED RESULTS SUMMARY

After all tests, you should have:

- ✅ **10+ candidates** imported
- ✅ **5+ with AI-parsed resumes**
- ✅ **Embeddings generated** for all resumes
- ✅ **LLM cost logs** showing ~$0.01-0.03 total
- ✅ **Audit logs** for all actions
- ✅ **No errors** in console
- ✅ **Semantic search** working
- ✅ **Rate limits** enforced
- ✅ **Background jobs** completing

---

## 🐛 COMMON ISSUES & FIXES

### Issue: "OPENAI_API_KEY not configured"
**Fix:** Add to `.env.local`:
```bash
OPENAI_API_KEY=sk-proj-your-key-here
```

### Issue: "Database connection failed"
**Fix:** Check PostgreSQL is running:
```bash
# Check status
pg_ctl status

# Start if needed
pg_ctl start
```

### Issue: "Workers not starting"
**Fix:** Workers auto-start in dev mode. Check console for "Memory workers started" message.

### Issue: "Embeddings not generating"
**Fix:** Check OpenAI API key is valid and has credits.

### Issue: "Rate limit not working"
**Fix:** Rate limiting uses in-memory store in dev. Works automatically.

---

## ✅ FINAL CHECKLIST

Before considering testing complete:

- [ ] All 12 feature tests passed
- [ ] Performance tests passed
- [ ] Database has data
- [ ] No console errors
- [ ] LLM costs tracked
- [ ] Audit logs created
- [ ] Semantic search works
- [ ] Background jobs complete
- [ ] Rate limiting enforced
- [ ] Duplicate detection works

---

## 🎉 SUCCESS CRITERIA

Your platform is working correctly if:

1. ✅ Can import candidates with AI parsing
2. ✅ Semantic search finds relevant candidates
3. ✅ LLM costs are tracked (<$0.01 per candidate)
4. ✅ Background jobs complete successfully
5. ✅ Rate limits prevent abuse
6. ✅ Audit logs track all actions
7. ✅ No errors in console
8. ✅ Performance is acceptable (<2s for most operations)

---

**Ready to test? Start with Setup, then go through each feature test!**

Need help with any specific test? Let me know!

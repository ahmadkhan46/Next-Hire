# Phase 2 Integration - Manual Steps

## ✅ Components Fixed
1. ✅ Quick Actions - Removed placeholder buttons
2. ✅ Job Recommendations - Removed Apply button
3. ✅ Database - Schema updated and migrated

## 📝 Manual Integration Required

### Step 1: Add Imports
Add these lines after line 10 in `page.tsx`:

```typescript
import { QuickActions } from "@/components/quick-actions";
import { JobRecommendations } from "@/components/job-recommendations";
import { CandidateComparison } from "@/components/candidate-comparison";
```

### Step 2: Update Candidate Query
Find line 38 (`notes: true,`) and add after it:

```typescript
status: true,
```

Find line 41 (`createdAt: true,`) and replace with:

```typescript
createdAt: true,
tags: {
  select: {
    id: true,
    name: true,
    color: true,
  },
},
```

### Step 3: Update Matches Query
Find line 103 (`statusUpdatedAt: true,`) and replace with:

```typescript
statusUpdatedAt: true,
matched: true,
missing: true,
```

### Step 4: Add Quick Actions Section
Find line 520 (after `</ResumeUploader>`) and add:

```typescript
<Card className="premium-block rounded-3xl border border-slate-300 bg-gradient-to-br from-white via-white/90 to-slate-50 p-6 shadow-[0_26px_60px_-32px_rgba(15,23,42,0.4)]">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-lg font-semibold">Quick Actions</h3>
    <CandidateComparison
      orgId={orgId}
      currentCandidate={{
        id: candidate.id,
        fullName: candidate.fullName,
        email: candidate.email,
        currentTitle: candidate.currentTitle,
        yearsOfExperience: candidate.yearsOfExperience,
        location: candidate.location,
        skills: skills.map(s => s.name),
        avgMatchScore: matchAggregate._max.score ?? 0,
      }}
    />
  </div>
  <QuickActions
    candidateId={candidateId}
    orgId={orgId}
    candidateName={candidate.fullName}
    tags={candidate.tags || []}
    status={candidate.status}
  />
</Card>
```

### Step 5: Add Job Recommendations
Find line 750 (before `<CandidateMatchesPanel`) and add:

```typescript
<JobRecommendations
  orgId={orgId}
  candidateId={candidateId}
  jobs={candidate.matches.map((m) => ({
    id: m.job?.id || '',
    title: m.job?.title || 'Untitled',
    location: m.job?.location || null,
    status: m.job?.status || 'CLOSED',
    score: m.score,
    matchedSkills: Array.isArray(m.matched) ? m.matched as string[] : [],
    missingSkills: Array.isArray(m.missing) ? m.missing as string[] : [],
    criticalGaps: [],
    matchStatus: m.status,
  })).filter(j => j.id)}
/>
```

## ✅ Testing Checklist

After integration:
- [ ] Page loads without errors
- [ ] Quick Actions section appears
- [ ] Status badge shows current status
- [ ] Tags can be added/removed
- [ ] Share button copies link
- [ ] Comparison dialog opens
- [ ] Job Recommendations section appears
- [ ] Match scores display correctly
- [ ] "View Match" buttons work

## 🚀 Ready to Deploy

All Phase 2 components are production-ready after this integration!

# Auto-Matching Algorithm

## Overview

The matching engine scores every candidate against each job's requirements and stores the result in `MatchResult`. Scores are recalculated when:
- "Re-run" is triggered from the Matchboard
- A new candidate is created or their profile is updated

---

## Scoring Formula

### No experience requirement (`requiredYearsOfExperience = null`)
```
score = skillScore × 0.80 + projectScore × 0.20
```

### With experience requirement
```
Step 1 — Hard disqualification:
  if (candidateYears < requiredYears) → score = 0

Step 2 — Qualified candidates:
  expBonus = min(candidateYears / (requiredYears + 5), 1.0)
  score    = expBonus × 0.60 + skillScore × 0.30 + projectScore × 0.10
```

The +5 means full experience bonus is earned at requiredYears + 5 — rewards extra experience without over-penalising candidates just above the minimum.

---

## Component Scores

### Skills (30–80%)
```
skillScore = matchedWeight / totalWeight
```
Skills with weight ≥ 4 are critical. Skill names are normalised before comparison — "Node.js", "nodejs", "node" all match each other.

### Projects (10–20%)
```
relevance    = required skills found in any project techStack / total required
countBonus   = min(projectCount / 5, 1.0)
projectScore = relevance × 0.70 + countBonus × 0.30
```
Tech stacks are parsed from the free-text `techStack` field, normalised, then checked against job requirements.

### Experience (60% when required)
```
expBonus = min(candidateYears / (requiredYears + 5), 1.0)
```
`yearsOfExperience` is automatically recalculated from work history entries whenever experience records are changed.

---

## Skill Normalisation Aliases

| Input | Normalised |
|-------|-----------|
| node.js, nodejs | node |
| react.js | react |
| vue.js, vuejs | vue |
| golang | go |
| postgresql, psql | postgres |
| mongo | mongodb |
| k8s | kubernetes |
| js | javascript |
| ts | typescript |

---

## Score Freshness

Each `MatchResult` stores `scoredAt` — updated on every recalculation. Shown on matchboard cards so users can judge if scores are stale.

---

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/jobs/:jobId/match` | Re-run matching for a job |
| `GET` | `/api/jobs/:jobId/matches` | Paginated match results |
| `PATCH` | `/api/jobs/:jobId/matches/:candidateId/status` | Update status |
| `GET` | `/api/jobs/:jobId/matches/:candidateId/history` | Decision history |
| `POST` | `/api/orgs/:orgId/auto-match` | Re-match a candidate against all jobs |

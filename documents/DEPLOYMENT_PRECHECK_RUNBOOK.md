# Deployment Precheck Runbook

## 1) One-command local precheck

```bash
npm run predeploy:check
```

This runs:

1. Environment validation
2. Lint
3. Tests
4. Production build
5. Migration health
6. Prisma validation
7. Prisma client generation

## 2) Start app smoke test (local)

```bash
npm run build
npm run start -- -p 3010
```

In another terminal:

```bash
set SMOKE_BASE_URL=http://127.0.0.1:3010
npm run smoke:test
```

## 3) Staging / production deployment sequence

1. Set env vars in hosting platform:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `NEXT_PUBLIC_APP_URL`
   - `QUEUE_MODE=redis`
   - `REDIS_URL`
   - `OPENAI_API_KEY` (required for AI generation/extraction features)
2. Deploy application.
3. Run migrations:
   - `npx prisma migrate deploy`
   - `npx prisma generate`
4. Start worker process:
   - `npm run workers`
5. Verify health:
   - `GET /api/health`
   - `GET /api/orgs/{orgId}/ops/metrics`
6. Run key workflow checks:
   - Candidate CSV import
   - Failed upload retry
   - Resume parsing
   - Job skill generation
   - Matchboard refresh

## 4) Go/No-Go criteria

Deploy only if all are true:

1. `npm run predeploy:check` passes.
2. Smoke test passes.
3. Migrations applied in target environment.
4. Workers are running and queue mode is `redis`.
5. Health endpoints return expected status.

# Platform Deploy Commands

## Shared prerequisites (all platforms)

1. Run local precheck:

```bash
npm run predeploy:check
```

2. Required env vars:

- `DATABASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_APP_URL`
- `QUEUE_MODE=redis`
- `REDIS_URL`
- `OPENAI_API_KEY` (for AI features)

3. Required runtime processes:

- Web app: `npm run start`
- Worker: `npm run workers`

---

## Railway (recommended for this stack)

### CLI

```bash
npm i -g @railway/cli
railway login
railway link
```

### Set variables

```bash
railway variables set QUEUE_MODE=redis
railway variables set NEXT_PUBLIC_APP_URL=https://<your-domain>
railway variables set DATABASE_URL=<your-postgres-url>
railway variables set REDIS_URL=<your-redis-url>
railway variables set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-pk>
railway variables set CLERK_SECRET_KEY=<your-clerk-sk>
railway variables set OPENAI_API_KEY=<your-openai-key>
```

### Deploy web service

- Build command: `npm ci && npm run build`
- Start command: `npm run start`

```bash
railway up
```

### Deploy worker service (same repo, second service)

- Build command: `npm ci && npm run build`
- Start command: `npm run workers`

```bash
railway up
```

### Post-deploy (one-off)

```bash
npx prisma migrate deploy
npx prisma generate
```

---

## Vercel (web) + external worker host

Vercel is great for Next.js web/API, but run workers on Railway/Render/Fly.

### Web deploy

```bash
npm i -g vercel
vercel login
vercel link
vercel --prod
```

In Vercel project settings:

- Build command: `npm run build`
- Install command: `npm ci`
- Output: default Next.js
- Set all required env vars above.

### Worker deploy

Deploy same repo as a background worker on Railway/Render with:

- Build: `npm ci && npm run build`
- Start: `npm run workers`

---

## Render

Create two services from same repo:

1. Web Service
- Build command: `npm ci && npm run build`
- Start command: `npm run start`

2. Worker Service
- Build command: `npm ci && npm run build`
- Start command: `npm run workers`

Set all required env vars on both services.

### Post-deploy (shell)

```bash
npx prisma migrate deploy
npx prisma generate
```

---

## Verification after deploy

1. `GET /api/health`
2. `GET /api/orgs/{orgId}/ops/metrics`
3. Import CSV and verify job progress in `/api/jobs-status`
4. Retry failed upload batch
5. Run job skill generation from description

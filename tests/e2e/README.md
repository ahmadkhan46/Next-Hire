# E2E Setup

This Playwright spec requires an authenticated session.

## Required env vars

- `E2E_BASE_URL` (optional, defaults to `http://127.0.0.1:3000`)
- `E2E_ORG_ID` (organization id to test against)
- `E2E_STORAGE_STATE` (path to Playwright storage state JSON for a signed-in user)

## Example run

```powershell
$env:E2E_BASE_URL="http://127.0.0.1:3000"
$env:E2E_ORG_ID="your_org_id"
$env:E2E_STORAGE_STATE="tests/e2e/.auth/user.json"
npm run test:e2e
```

## Generate storage state (one-time)

1. Open Playwright inspector and log in manually:

```powershell
npx playwright codegen http://127.0.0.1:3000/sign-in
```

2. Save storage state from a quick script or runner and point `E2E_STORAGE_STATE` to that file.

## GitHub Actions manual E2E

Workflow: `.github/workflows/e2e-manual.yml`

Required repository secret:
- `E2E_STORAGE_STATE_JSON`: raw JSON content of Playwright storage state (authenticated user)

Required workflow inputs:
- `base_url`
- `org_id`

# Branch Protection Setup

Use this on your default branch (`main` or `master`) to enforce enterprise-grade merge gates.

## Required Settings

1. Go to `Settings -> Branches -> Add branch protection rule`.
2. Branch name pattern: `main` (repeat for `master` if needed).
3. Enable:
   - `Require a pull request before merging`
   - `Require approvals` (recommended: 1 minimum, 2 for critical repos)
   - `Dismiss stale pull request approvals when new commits are pushed`
   - `Require review from Code Owners` (if CODEOWNERS is added)
   - `Require status checks to pass before merging`
   - `Require branches to be up to date before merging`
   - `Require conversation resolution before merging`
   - `Require signed commits` (recommended)
   - `Do not allow bypassing the above settings`
   - `Restrict who can push to matching branches` (admins/release bots only)

## Required Status Checks

Select these checks from workflow `CI`:

- `lint`
- `test`
- `build`

Optional (manual/staging gate):

- `Playwright E2E` from workflow `E2E Manual`

## CODEOWNERS

This repository now includes `.github/CODEOWNERS` with `@AhmadKhan46` as the default owner.
If your GitHub handle/team differs, update that file before enabling `Require review from Code Owners`.

## Recommended Merge Strategy

1. Allow only `Squash merge`.
2. Disable direct pushes to protected branches.
3. Delete head branches automatically after merge.

# Migration Repair Plan (No Data Loss)

## Current issue
- `prisma migrate dev` is blocked because an already-applied migration file was changed.
- Symptom: Prisma asks to reset schema and drop data.

## Immediate recovery (already safe in dev)
1. Keep app running with:
   - `npx prisma db push`
   - `npx prisma generate`
2. Use this only as a temporary unblock for development.

## Durable fix (without wiping production data)
1. Freeze current migration files:
   - Do not edit any file inside `prisma/migrations/*` that has already been applied.
2. Restore modified migration content:
   - Recover the original version from git history for the changed migration.
   - If original content is unknown, use a clean branch or backup where it was last valid.
3. Validate migration chain:
   - `npx prisma migrate status`
   - Ensure no “modified after applied” warning.
4. Create forward-only migration for new schema changes:
   - `npx prisma migrate dev --name <change_name>`
5. Apply in higher environments with:
   - `npx prisma migrate deploy`

## If original migration cannot be restored
1. Treat current DB schema as baseline.
2. Generate SQL diff from current DB to schema for a one-time repair migration:
   - `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<timestamp>_repair/migration.sql`
3. Review SQL manually, then apply with change control.
4. From that point forward, never edit applied migrations.

## Team guardrails
- Add PR rule: reject changes in old migration folders.
- Add CI check: run `npx prisma migrate status` on every PR.
- Keep all schema changes forward-only via new migrations.

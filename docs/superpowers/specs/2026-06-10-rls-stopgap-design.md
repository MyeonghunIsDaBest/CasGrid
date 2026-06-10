# RLS Stopgap — Clear Security Advisor Errors

Date: 2026-06-10 · Approved by: Jordan

## Problem

Supabase Security Advisor reports 6 ERROR-level findings — "RLS Disabled in Public" — on
`staff`, `jobs`, `schedule_entries`, `staff_events`, `app_settings`, `simpro_config`.

`001_initial_schema.sql` intentionally disabled RLS (shared-access app, no auth) and granted
the `anon` role full CRUD. The anon key ships in the public Vercel JS bundle, so the database
is effectively world-readable/writable — including client contact details (`jobs`) and the
SimPRO API token stored in plaintext (`simpro_config.api_token`).

## Decision

**Quick stopgap only** (Jordan, 2026-06-10): enable RLS with allow-all policies. This clears
the advisor errors with zero app changes and zero behaviour change. It does **not** add real
security — anyone with the URL can still read/write all data via the API. The real lock-down
(login + authenticated-only policies) is explicitly deferred; see Follow-up.

## Design

### Migration `backend/supabase/migrations/008_enable_rls.sql`

- `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;` for all 6 tables.
- Per table: `DROP POLICY IF EXISTS casgrid_open_access ON <t>;` then
  `CREATE POLICY casgrid_open_access ON <t> FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);`
- Idempotent (safe to re-run). Header comment in house style stating this is an
  advisor-clearing stopgap, not real security. Verification query at the end.

### Guard rails

- One-line note added to the headers of `001_initial_schema.sql` and
  `002_enable_realtime.sql`: re-run 008 afterwards (both scripts disable RLS when run,
  which would silently re-trigger the advisor errors).

### Rollout

- Apply via Dockerized `psql` over the Supabase session pooler (db password in `dbpwd.md`;
  local psql not installed). Pooler region to be probed (likely ap-southeast-2).
- **Never `supabase db push`** — it would replay `001`, which drops every table.
- Fallback if connection fails: Jordan pastes 008 into the dashboard SQL editor.

### Verification

1. `pg_class.relrowsecurity = true` for all 6 tables; `pg_policies` lists the 6 policies.
2. PostgREST smoke test with the anon key: `GET /rest/v1/staff` succeeds; no-op
   `PATCH app_settings` succeeds (write path).
3. Code check: with RLS enabled, realtime DELETE events carry only the primary key in
   `payload.old` — confirm `AppContext.tsx` DELETE handlers use only `payload.old.id`.
4. Run the app locally against the live DB: data loads, realtime sync works.
5. Jordan hits Refresh in Security Advisor → 0 errors.

## Behaviour change

None intended — the policies grant exactly the access the existing grants already gave.
Known exception: realtime DELETE `old` records shrink to PK-only (step 3 confirms the app
only needs `id`).

## Out of scope / follow-up

- **Real fix:** Supabase Auth login + authenticated-only policies + revoke `anon` grants.
- Move the SimPRO API token server-side (edge-function/proxy — SimPRO's CORS policy forces
  a proxy for live calls anyway, see `SimproPanel.tsx`).

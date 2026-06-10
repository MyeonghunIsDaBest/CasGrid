# RLS Stopgap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear the 6 ERROR-level "RLS Disabled in Public" Supabase Security Advisor findings by enabling RLS with allow-all policies, with zero behaviour change for the live CasGrid app.

**Architecture:** A new idempotent migration (`008_enable_rls.sql`) enables RLS and creates one `casgrid_open_access` allow-all policy per table for `anon, authenticated`. Because enabling RLS makes Supabase Realtime strip DELETE payloads down to the primary key, the one handler that reads more than `old.id` (`schedule_entries` DELETE in `AppContext.tsx`) gets a guard helper that falls back to the local copy of the row. The migration is applied to the live DB with Dockerized `psql` (no local psql installed).

**Tech Stack:** Postgres/Supabase (RLS, PostgREST, Realtime), React 19 + TypeScript, Vitest, Docker `postgres:17-alpine` image, PowerShell.

**Spec:** `docs/superpowers/specs/2026-06-10-rls-stopgap-design.md`

**Critical safety rules:**
- ⚠️ **NEVER run `supabase db push`** against this project — the migrations were applied by hand historically, so push would replay `001_initial_schema.sql`, which **drops every table**. Apply `008` alone, directly.
- The live DB has real data. `008` is non-destructive (DDL + policies only) and idempotent.
- DB password is in `dbpwd.md` at repo root (value: `@CasGrid123`, project ref `bchbvptkrjgjqbgxwuqx`).
- All npm commands run **from `frontend/`** using local bins (`npx` is broken on this machine; `npm run …` is fine).

---

### Task 1: Pure guard helper for realtime schedule-entry deletes (TDD)

With RLS enabled, Supabase Realtime DELETE events deliver only the primary key in `payload.old` (REPLICA IDENTITY FULL no longer helps — this is a documented walrus/RLS security measure). `AppContext.tsx:389-400` currently reads `old.date` and `old.is_manual_override` to ignore stale DELETE echoes for past auto-entries. Extract that decision into a pure function that falls back to the local copy of the entry when the payload is PK-only.

**Files:**
- Create: `frontend/src/lib/realtimeGuards.ts`
- Test: `frontend/src/lib/realtimeGuards.test.ts` (colocated, same pattern as `db.normalise.test.ts`)

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/realtimeGuards.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { shouldIgnoreRemoteEntryDelete } from './realtimeGuards';

const TODAY = '2026-06-10';

describe('shouldIgnoreRemoteEntryDelete', () => {
  // Full payloads (RLS off / legacy behaviour) — must match the old inline guard exactly.
  it('ignores a past auto-entry delete (full payload)', () => {
    expect(shouldIgnoreRemoteEntryDelete(
      { id: 'e1', date: '2026-06-09', is_manual_override: false }, undefined, TODAY,
    )).toBe(true);
  });

  it('applies a past MANUAL entry delete (full payload)', () => {
    expect(shouldIgnoreRemoteEntryDelete(
      { id: 'e1', date: '2026-06-09', is_manual_override: true }, undefined, TODAY,
    )).toBe(false);
  });

  it('applies a today/future auto-entry delete (full payload)', () => {
    expect(shouldIgnoreRemoteEntryDelete(
      { id: 'e1', date: '2026-06-10', is_manual_override: false }, undefined, TODAY,
    )).toBe(false);
    expect(shouldIgnoreRemoteEntryDelete(
      { id: 'e1', date: '2026-06-11', is_manual_override: false }, undefined, TODAY,
    )).toBe(false);
  });

  // PK-only payloads (RLS on) — fall back to the local copy of the row.
  it('ignores a past auto-entry delete using the local copy (PK-only payload)', () => {
    expect(shouldIgnoreRemoteEntryDelete(
      { id: 'e1' }, { date: '2026-06-09', isManualOverride: false }, TODAY,
    )).toBe(true);
  });

  it('applies a delete when the local copy is manual or not past (PK-only payload)', () => {
    expect(shouldIgnoreRemoteEntryDelete(
      { id: 'e1' }, { date: '2026-06-09', isManualOverride: true }, TODAY,
    )).toBe(false);
    expect(shouldIgnoreRemoteEntryDelete(
      { id: 'e1' }, { date: '2026-06-12', isManualOverride: false }, TODAY,
    )).toBe(false);
  });

  it('applies a delete when the row is unknown locally (PK-only payload)', () => {
    expect(shouldIgnoreRemoteEntryDelete({ id: 'e1' }, undefined, TODAY)).toBe(false);
  });

  it('prefers payload fields over the local copy when both exist', () => {
    // Payload says manual → apply, even though local copy says auto.
    expect(shouldIgnoreRemoteEntryDelete(
      { id: 'e1', date: '2026-06-09', is_manual_override: true },
      { date: '2026-06-09', isManualOverride: false },
      TODAY,
    )).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
# from frontend/
npm run test -- realtimeGuards
```

Expected: FAIL — `Cannot find module './realtimeGuards'` (or "Failed to resolve import").

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/realtimeGuards.ts`:

```ts
/**
 * Decision helpers for Supabase Realtime payloads.
 *
 * With Row-Level Security enabled (008_enable_rls.sql), Realtime DELETE
 * events carry ONLY the primary key in `payload.old` — REPLICA IDENTITY FULL
 * no longer yields the full old row. Handlers that need more than `id` must
 * fall back to the local copy of the row.
 */

export interface RemoteEntryDeleteRow {
  id: string;
  date?: string;
  is_manual_override?: boolean;
}

export interface LocalEntrySnapshot {
  date: string;
  isManualOverride: boolean;
}

/**
 * Past auto-scheduled entries represent work already done and must not be
 * wiped locally by a stale DELETE echo from another client (e.g. a client
 * whose clock is still on yesterday re-running auto-schedule).
 *
 * Returns true when the delete should be IGNORED locally.
 */
export function shouldIgnoreRemoteEntryDelete(
  oldRow: RemoteEntryDeleteRow,
  localEntry: LocalEntrySnapshot | undefined,
  todayStr: string,
): boolean {
  const date = oldRow.date ?? localEntry?.date;
  const isManualOverride = oldRow.is_manual_override ?? localEntry?.isManualOverride;
  return !!date && date < todayStr && isManualOverride === false;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```powershell
# from frontend/
npm run test -- realtimeGuards
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/lib/realtimeGuards.ts frontend/src/lib/realtimeGuards.test.ts
git commit -m "Add RLS-proof guard helper for realtime schedule-entry deletes"
```

---

### Task 2: Wire the guard into the realtime DELETE handler

**Files:**
- Modify: `frontend/src/context/AppContext.tsx` (import block at :1-11, refs at :257-261, handler at :389-400)

- [ ] **Step 1: Add the import**

In the import block at the top, after `import * as db from '../lib/db';` add:

```ts
import { shouldIgnoreRemoteEntryDelete } from '../lib/realtimeGuards';
```

- [ ] **Step 2: Add a ref that tracks current schedule entries**

After the `resyncTimerRef` declaration (old string, `AppContext.tsx:260-261`):

```ts
  // Debounce timer so online + visibility + reconnect don't stack re-syncs.
  const resyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

becomes:

```ts
  // Debounce timer so online + visibility + reconnect don't stack re-syncs.
  const resyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Current schedule entries for the realtime DELETE guard — with RLS enabled
  // the DELETE payload carries only the primary key, so the handler looks up
  // date/isManualOverride here (the channel effect's closure is stale).
  const scheduleEntriesRef = useRef<ScheduleEntry[]>(state.scheduleEntries);
  useEffect(() => { scheduleEntriesRef.current = state.scheduleEntries; }, [state.scheduleEntries]);
```

(`ScheduleEntry` is already imported from `'../types'` at the top of the file.)

- [ ] **Step 3: Replace the inline guard in the DELETE handler**

Old string (`AppContext.tsx:389-400`):

```ts
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'schedule_entries' },
        ({ old: r }) => {
          // Past auto-entries represent work already done and must not be wiped
          // locally by a stale DELETE echo from another client. REPLICA IDENTITY
          // FULL (002_enable_realtime.sql) guarantees old.date and
          // old.is_manual_override are present.
          const row = r as { id: string; date?: string; is_manual_override?: boolean };
          const todayStr = toDateString(new Date());
          if (row.date && row.date < todayStr && row.is_manual_override === false) return;
          withSkip(() => dispatch({ type: 'DELETE_SCHEDULE_ENTRY', payload: row.id }));
          note('schedule_entries', 'delete', 'Schedule entry removed');
        })
```

New string:

```ts
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'schedule_entries' },
        ({ old: r }) => {
          // Past auto-entries represent work already done and must not be wiped
          // locally by a stale DELETE echo from another client. With RLS enabled
          // (008_enable_rls.sql) the DELETE payload carries only the primary key,
          // so the guard falls back to the local copy of the row.
          const row = r as { id: string; date?: string; is_manual_override?: boolean };
          const local = scheduleEntriesRef.current.find(e => e.id === row.id);
          if (shouldIgnoreRemoteEntryDelete(row, local, toDateString(new Date()))) return;
          withSkip(() => dispatch({ type: 'DELETE_SCHEDULE_ENTRY', payload: row.id }));
          note('schedule_entries', 'delete', 'Schedule entry removed');
        })
```

- [ ] **Step 4: Run the full test suite and typecheck**

```powershell
# from frontend/
npm run test
```

Expected: all suites pass (JobDetailModal, db.normalise, realtimeGuards).

```powershell
# from frontend/ — typecheck only; if this OOMs (known machine issue), note it and rely on vitest + eslint
node_modules\.bin\tsc -b
```

Expected: no output, exit 0.

```powershell
# from frontend/
npm run lint
```

Expected: exit 0. If there are pre-existing lint errors in files this plan does not touch, note them and proceed; only new issues in touched files block.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/context/AppContext.tsx
git commit -m "Make realtime schedule-entry delete guard survive RLS PK-only payloads"
```

---

### Task 3: Migration 008 — enable RLS with allow-all policies

**Files:**
- Create: `backend/supabase/migrations/008_enable_rls.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- ============================================================
-- CasGrid — Migration 008: enable RLS (Security Advisor stopgap)
-- ============================================================
-- Clears the 6 ERROR-level "RLS Disabled in Public" findings by
-- enabling Row Level Security on every CasGrid table with an explicit
-- allow-all policy for the API roles (anon, authenticated).
--
-- ⚠️ This is NOT real security. CasGrid has no login: the browser
--    talks to PostgREST as `anon`, and these policies grant anon the
--    same full read/write it already had via grants. This silences
--    the advisor without changing behaviour. The real fix is Supabase
--    Auth + authenticated-only policies — see
--    docs/superpowers/specs/2026-06-10-rls-stopgap-design.md.
--
-- Side effect to know about: with RLS enabled, Realtime DELETE events
-- carry only the primary key in `old` (REPLICA IDENTITY FULL no longer
-- yields full old rows). The frontend handles this (realtimeGuards.ts).
--
-- HOW TO RUN:
--   Supabase dashboard → SQL Editor → New query → paste this → Run.
--   Idempotent — safe to re-run. No row data is touched.
--
-- NOTE: 001_initial_schema.sql and 002_enable_realtime.sql both
--   DISABLE RLS when run. If you ever re-run either of them, re-run
--   this file afterwards.
-- ============================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'staff','jobs','schedule_entries','staff_events','app_settings','simpro_config'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      EXECUTE format('DROP POLICY IF EXISTS casgrid_open_access ON public.%I;', t);
      EXECUTE format('CREATE POLICY casgrid_open_access ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);', t);
    END IF;
  END LOOP;
END $$;

-- ── Verify ───────────────────────────────────────────────────
-- rls_on must be TRUE and policy_count 1 for all 6 rows:
SELECT c.relname          AS table_name,
       c.relrowsecurity   AS rls_on,
       COUNT(p.polname)   AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE c.relname IN ('staff','jobs','schedule_entries','staff_events',
                    'app_settings','simpro_config')
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;
```

- [ ] **Step 2: Sanity-read the file**

Confirm the 6 table names match `001_initial_schema.sql` exactly: `staff`, `jobs`, `schedule_entries`, `staff_events`, `app_settings`, `simpro_config`.

---

### Task 4: Guard-rail notes in 001 and 002 + commit migrations

**Files:**
- Modify: `backend/supabase/migrations/001_initial_schema.sql:15-19`
- Modify: `backend/supabase/migrations/002_enable_realtime.sql:17-19`

- [ ] **Step 1: Add the note to 001**

Old string:

```sql
-- ⚠️ Running this ERASES all staff, jobs, schedule, and settings data.
--    There is no undo. Do not run against a database with real data
--    you need to keep. To re-enable / repair Realtime + grants WITHOUT
--    erasing data, run supabase/migrations/002_enable_realtime.sql instead.
-- ============================================================
```

New string:

```sql
-- ⚠️ Running this ERASES all staff, jobs, schedule, and settings data.
--    There is no undo. Do not run against a database with real data
--    you need to keep. To re-enable / repair Realtime + grants WITHOUT
--    erasing data, run supabase/migrations/002_enable_realtime.sql instead.
--
-- ⚠️ This script leaves RLS DISABLED, which re-triggers the Security
--    Advisor errors. After running it, also run 008_enable_rls.sql.
-- ============================================================
```

- [ ] **Step 2: Add the note to 002**

Old string:

```sql
-- HOW TO RUN:
--   Supabase dashboard → SQL Editor → New query → paste this → Run.
-- ============================================================
```

New string:

```sql
-- HOW TO RUN:
--   Supabase dashboard → SQL Editor → New query → paste this → Run.
--
-- ⚠️ Step 2 DISABLES RLS, which re-triggers the Security Advisor
--    errors. After running this file, also run 008_enable_rls.sql.
-- ============================================================
```

- [ ] **Step 3: Commit**

```powershell
git add backend/supabase/migrations/008_enable_rls.sql backend/supabase/migrations/001_initial_schema.sql backend/supabase/migrations/002_enable_realtime.sql
git commit -m "Migration 008: enable RLS with allow-all policies (advisor stopgap)"
```

---

### Task 5: Apply migration 008 to the live database

No local `psql`; use the Docker `postgres:17-alpine` image. Project ref `bchbvptkrjgjqbgxwuqx`, password `@CasGrid123` (from `dbpwd.md`).

⚠️ **Do NOT use `supabase db push`** — it would replay `001`, which drops every table.

- [ ] **Step 1: Confirm Docker is running**

```powershell
docker info --format "{{.ServerVersion}}"
```

Expected: a version string. If it errors ("cannot connect to the Docker daemon"), start Docker Desktop and wait for it:

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
# then poll: docker info --format "{{.ServerVersion}}" until it succeeds (~30-60s)
```

- [ ] **Step 2: Probe for a working connection**

Try candidates in order until one prints `1`. Direct host first (works only with IPv6), then session pooler (IPv4, user gets the `postgres.<ref>` suffix; region unknown — Casone is Australian, so Sydney first; newer projects may be on the `aws-1-` prefix):

```powershell
# Candidate A — direct (IPv6 only)
docker run --rm -e PGPASSWORD='@CasGrid123' postgres:17-alpine psql -h db.bchbvptkrjgjqbgxwuqx.supabase.co -p 5432 -U postgres -d postgres -tAc "select 1"

# Candidate B — session pooler, Sydney
docker run --rm -e PGPASSWORD='@CasGrid123' postgres:17-alpine psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U postgres.bchbvptkrjgjqbgxwuqx -d postgres -tAc "select 1"

# Candidate C — session pooler, Sydney, aws-1 prefix
docker run --rm -e PGPASSWORD='@CasGrid123' postgres:17-alpine psql -h aws-1-ap-southeast-2.pooler.supabase.com -p 5432 -U postgres.bchbvptkrjgjqbgxwuqx -d postgres -tAc "select 1"
```

Expected for the winner: `1`. Wrong region fails fast with "Tenant or user not found"; no-IPv6 fails with a network/DNS error. If Sydney fails on both prefixes, try regions in this order with both prefixes: `ap-southeast-1`, `us-east-1`, `us-west-1`, `eu-central-1`, `ap-south-1`, `sa-east-1`, `eu-west-1`, `eu-west-2`, `us-east-2`, `ca-central-1`.

**Fallback if nothing connects:** stop, and hand Jordan `backend/supabase/migrations/008_enable_rls.sql` to paste into Supabase dashboard → SQL Editor → Run. Then resume at Task 6.

- [ ] **Step 3: Apply the migration (atomic)**

Using the winning host/user from Step 2:

```powershell
docker run --rm -e PGPASSWORD='@CasGrid123' -v "C:\Users\footlong\Downloads\gridflow-app\backend\supabase\migrations:/m:ro" postgres:17-alpine psql -h <WINNING_HOST> -p 5432 -U <WINNING_USER> -d postgres -v ON_ERROR_STOP=1 --single-transaction -f /m/008_enable_rls.sql
```

Expected output: `DO`, then the verification table — 6 rows, every `rls_on = t`, every `policy_count = 1`:

```
   table_name    | rls_on | policy_count
-----------------+--------+--------------
 app_settings    | t      |            1
 jobs            | t      |            1
 schedule_entries| t      |            1
 simpro_config   | t      |            1
 staff           | t      |            1
 staff_events    | t      |            1
```

Any error → the transaction rolled back; nothing changed. Diagnose before retrying.

---

### Task 6: Smoke-test the live API under RLS (read + write as anon)

Proves PostgREST access still works exactly as before. Run from the repo root.

- [ ] **Step 1: Read test**

```powershell
$key = ((Get-Content frontend\.env) | Where-Object { $_ -match '^VITE_SUPABASE_ANON_KEY=' }) -replace '^VITE_SUPABASE_ANON_KEY=',''
$h = @{ apikey = $key; Authorization = "Bearer $key" }
Invoke-RestMethod -Uri "https://bchbvptkrjgjqbgxwuqx.supabase.co/rest/v1/staff?select=id&limit=1" -Headers $h | ConvertTo-Json -Compress
```

Expected: JSON like `[{"id":"..."}]` (or `[]` if the table is empty) — NOT a 401/permission error.

- [ ] **Step 2: Write test (no-op PATCH: write the current value back)**

```powershell
$cur = (Invoke-RestMethod -Uri "https://bchbvptkrjgjqbgxwuqx.supabase.co/rest/v1/app_settings?id=eq.1&select=override_overbooking" -Headers $h) | Select-Object -First 1 -ExpandProperty override_overbooking
Invoke-RestMethod -Method Patch -Uri "https://bchbvptkrjgjqbgxwuqx.supabase.co/rest/v1/app_settings?id=eq.1" -Headers ($h + @{ Prefer = 'return=representation' }) -ContentType 'application/json' -Body (@{ override_overbooking = $cur } | ConvertTo-Json) | ConvertTo-Json -Compress
```

Expected: the `app_settings` row echoed back (HTTP 200). A `42501` / "violates row-level security policy" error means the policy is wrong — stop and investigate.

(This PATCH writes the value that's already there; live clients receive a harmless no-op settings event.)

---

### Task 7: Local app sanity check

- [ ] **Step 1: Start the dev server and confirm it serves**

```powershell
# from frontend/ (background)
npm run dev
# then:
(Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing).StatusCode
```

Expected: `200`. Stop the dev server afterwards.

- [ ] **Step 2: Manual confirmation for Jordan (cannot be fully automated here)**

Ask Jordan to: (1) open the deployed app — data loads; (2) open it in two tabs/devices, make a change in one, see it appear in the other (live-sync under RLS); (3) Supabase dashboard → Advisors → Security Advisor → **Refresh** → 0 errors.

---

### Task 8: Final verification and wrap-up

- [ ] **Step 1: Full test suite one last time**

```powershell
# from frontend/
npm run test
```

Expected: all pass.

- [ ] **Step 2: Confirm clean working tree and report**

```powershell
git status
git log --oneline -4
```

Expected: only intended commits; no stray changes. Report to Jordan: what was applied, verification evidence, the advisor-refresh step, and the standing follow-up (real lock-down = login + authenticated-only policies; `dbpwd.md` holds the DB password in git — consider rotating/removing if the repo is ever shared).

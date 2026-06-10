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

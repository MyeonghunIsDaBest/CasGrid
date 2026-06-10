-- ============================================================
-- CasGrid — REPAIR BACKEND (idempotent, NON-destructive)
-- ============================================================
-- Safe to run repeatedly. Does NOT drop, truncate, or alter any row
-- data. It (re)applies the open-access + Realtime configuration that
-- live cross-device sync depends on:
--   • grants for the browser (anon) role
--   • Row-Level Security OFF  (CasGrid has no login — shared access)
--   • Realtime publication + replica identity
--
-- WHEN TO USE:
--   • "new row violates row-level security policy" when saving.
--   • Changes save but don't appear live on other devices.
--   • Any time the backend was set up via the Table Editor (which
--     turns RLS on by default) instead of 001_initial_schema.sql.
--
-- HOW TO RUN:
--   Supabase dashboard → SQL Editor → New query → paste this → Run.
--
-- ⚠️ Step 2 DISABLES RLS, which re-triggers the Security Advisor
--    errors. After running this file, also run 008_enable_rls.sql.
-- ============================================================

-- ── 1. Grants (anon = the browser role; idempotent) ──────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;

-- ── 2. Row-Level Security OFF + Realtime wiring ──────────────
-- CasGrid uses open shared access (no login). With RLS enabled and no
-- policy, the anon role can read but every INSERT/UPDATE/DELETE fails
-- with "violates row-level security policy". Turning RLS off restores
-- the intended shared-access model. REPLICA IDENTITY FULL gives full
-- old/new rows in realtime events. to_regclass guards skip a missing
-- table; the publication check avoids "already member" errors.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'staff','jobs','schedule_entries','staff_events','app_settings','simpro_config'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', t);
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', t);

      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = t
      ) THEN
        EXECUTE format(
          'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
      END IF;
    END IF;
  END LOOP;
END $$;

-- ── 3. Verify ────────────────────────────────────────────────
-- rls_on should be FALSE for all 6 rows:
SELECT relname AS table_name, relrowsecurity AS rls_on
FROM pg_class
WHERE relname IN ('staff','jobs','schedule_entries','staff_events','app_settings','simpro_config')
ORDER BY relname;

-- and all 6 tables should be listed here (realtime):
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
ORDER BY tablename;

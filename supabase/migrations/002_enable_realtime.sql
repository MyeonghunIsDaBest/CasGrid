-- ============================================================
-- CasGrid — ENABLE / REPAIR REALTIME   (idempotent, NON-destructive)
-- ============================================================
-- Safe to run repeatedly. Does NOT drop, truncate, or alter any row
-- data. It only (re)applies the grants and Realtime wiring that live
-- cross-device sync depends on.
--
-- WHEN TO USE:
--   • Changes save and survive a refresh, but do NOT appear live on
--     other devices (the Realtime publication / replica identity was
--     never applied, or was lost by an earlier DROP ... CASCADE).
--
-- HOW TO RUN:
--   Supabase dashboard → SQL Editor → New query → paste this → Run.
--   Then: Database → Replication → confirm the supabase_realtime
--   publication lists all 6 tables, and Project Settings → confirm
--   Realtime is enabled for the project.
-- ============================================================

-- ── 1. Grants (anon = the browser role; idempotent) ──────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;

-- ── 2. Replica identity + publication membership ─────────────
-- Postgres has no "ADD TABLE IF NOT EXISTS" for publications, and
-- ALTER PUBLICATION ... ADD TABLE errors if the table is already a
-- member — so guard each add with pg_publication_tables. The
-- to_regclass() check skips a missing table instead of failing.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'staff','jobs','schedule_entries','staff_events','app_settings','simpro_config'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
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

-- ── 3. Verify — should return all 6 table names ──────────────
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
ORDER BY tablename;

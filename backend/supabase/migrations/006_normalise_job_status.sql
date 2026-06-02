-- ============================================================
-- CasGrid — Migration 006: normalise non-standard job status / priority
-- ============================================================
-- Some `jobs` rows were loaded into the DB from outside the app (e.g. Simpro
-- statuses like "Programmed") with `status` / `priority` values that fall
-- OUTSIDE the CHECK constraints defined in 001_initial_schema.sql:
--
--   status   IN ('unscheduled','scheduled','inProgress','completed','onHold')
--   priority IN ('low','medium','high','urgent')
--
-- Postgres lets such a row be SELECTed but re-validates the whole row on any
-- UPDATE — so editing the job (e.g. drag-to-reschedule on the Timeline) failed
-- with "violates check constraint" and the change never saved.
--
-- The app now coerces these values on read AND write (see db.ts
-- normaliseStatus / normalisePriority), so rows heal themselves the first time
-- they are saved. This migration cleans up rows that haven't been touched yet
-- so the stored data is fully conformant immediately.
--
-- HOW TO RUN:
--   Supabase dashboard -> SQL Editor -> New query -> paste this -> Run.
--   Idempotent: only rows currently outside the allowed set are changed, so
--   re-running has no further effect.
-- ============================================================

-- ── Status ───────────────────────────────────────────────────
UPDATE jobs SET status = CASE
  WHEN lower(status) IN ('programmed','booked')                            THEN 'scheduled'
  WHEN lower(status) IN ('pending','quote','new','')                       THEN 'unscheduled'
  WHEN lower(status) IN ('progress','in progress','active','started')      THEN 'inProgress'
  WHEN lower(status) IN ('complete','completed','done','closed','archived') THEN 'completed'
  WHEN lower(status) IN ('hold','on hold','paused')                        THEN 'onHold'
  ELSE 'scheduled'  -- safe neutral: these jobs carry dates and live on the timeline
END
WHERE status NOT IN ('unscheduled','scheduled','inProgress','completed','onHold');

-- ── Priority ─────────────────────────────────────────────────
UPDATE jobs SET priority = CASE
  WHEN lower(priority) = 'critical'              THEN 'urgent'
  WHEN lower(priority) IN ('normal','standard')  THEN 'medium'
  ELSE 'medium'
END
WHERE priority NOT IN ('low','medium','high','urgent');

-- ── Verify (should both return 0) ────────────────────────────
SELECT
  COUNT(*) FILTER (WHERE status   NOT IN ('unscheduled','scheduled','inProgress','completed','onHold')) AS bad_status,
  COUNT(*) FILTER (WHERE priority NOT IN ('low','medium','high','urgent'))                              AS bad_priority
FROM jobs;

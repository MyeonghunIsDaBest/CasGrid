-- ============================================================
-- CasGrid — Migration 007: re-date stranded past jobs into view
-- ============================================================
-- Some active (non-completed) jobs are dated entirely BEFORE the Timeline's
-- visible window (which starts the Monday of *last* week), so they sit stranded
-- as un-draggable slivers at the left edge and can't be rescheduled there.
--
-- This shifts each such job to START TODAY while PRESERVING its original
-- duration (deadline − start), bringing it into the current window so it can be
-- scheduled / dragged again.
--
-- Targets: status <> 'completed' AND deadline before the window start, where the
--          window start = the Monday of (today − 7 days), matching the app's
--          startOfWeek(today−7, weekStartsOn: Monday).
-- At time of writing this matched 8 jobs (7 unscheduled, 1 scheduled).
--
-- HOW TO RUN:
--   Supabase dashboard → SQL Editor → New query → paste this → Run.
--   Idempotent: once re-dated, those rows no longer match the WHERE clause.
-- ============================================================

UPDATE jobs
SET
  start_date = CURRENT_DATE::text,
  deadline   = (CURRENT_DATE + (deadline::date - start_date::date))::text,
  updated_at = NOW()
WHERE status <> 'completed'
  AND deadline::date < (date_trunc('week', CURRENT_DATE - INTERVAL '7 days'))::date;

-- ── Verify (should return 0 after running) ───────────────────
SELECT COUNT(*) AS still_stranded
FROM jobs
WHERE status <> 'completed'
  AND deadline::date < (date_trunc('week', CURRENT_DATE - INTERVAL '7 days'))::date;

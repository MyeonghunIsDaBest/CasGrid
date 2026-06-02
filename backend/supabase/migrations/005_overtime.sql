-- ============================================================
-- CasGrid — Migration 005: per-day overtime
-- ============================================================
-- Adds a boolean column to `schedule_entries` marking a day that was
-- intentionally approved for overtime (allocated hours > the staff member's
-- daily capacity) in the Weekly Planner cell editor.
--
--   is_overtime BOOLEAN NOT NULL DEFAULT false
--
-- Approved-overtime days render as a calm amber "OT" instead of a red "OVER"
-- across the Weekly Planner and the Timeline staff-capacity strip, and the
-- cell editor no longer blocks saving over capacity.
--
-- `schedule_entries` is already REPLICA IDENTITY FULL (migration 001), so the
-- new column is included in realtime payloads automatically — no extra step.
--
-- HOW TO RUN:
--   Supabase dashboard → SQL Editor → New query → paste this → Run.
--   Idempotent: re-running has no effect.
-- ============================================================

ALTER TABLE schedule_entries
  ADD COLUMN IF NOT EXISTS is_overtime BOOLEAN NOT NULL DEFAULT false;

-- ── Verify ──────────────────────────────────────────────────
SELECT id, staff_id, date, hours, is_manual_override, is_overtime
FROM schedule_entries
LIMIT 5;

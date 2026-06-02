-- ============================================================
-- CasGrid — Migration 003: per-job running-time tracker
-- ============================================================
-- Adds two columns to `jobs` so the app can show how long each job
-- has been actively running:
--
--   running_started_at  TIMESTAMPTZ NULL  -- when the current run started
--   running_time_ms     BIGINT NOT NULL DEFAULT 0  -- accumulated ms from
--                                                   previous runs
--
-- A job is "running" while its status is NOT in ('completed','onHold').
-- Live total = running_time_ms + (NOW() - running_started_at).
--
-- BACKFILL: every existing job in an active status gets running_started_at
-- set to NOW() so its timer starts ticking from migration time. Jobs that
-- were already completed/onHold stay paused (running_started_at = NULL).
--
-- HOW TO RUN:
--   Supabase dashboard → SQL Editor → New query → paste this → Run.
--   Idempotent: re-running has no effect.
-- ============================================================

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS running_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS running_time_ms    BIGINT NOT NULL DEFAULT 0;

-- Backfill: start the timer NOW for any job currently in an active status
-- whose running_started_at is still NULL.
UPDATE jobs
SET running_started_at = NOW()
WHERE running_started_at IS NULL
  AND status NOT IN ('completed', 'onHold');

-- ── Verify ──────────────────────────────────────────────────
SELECT
  COUNT(*) FILTER (WHERE running_started_at IS NOT NULL) AS running,
  COUNT(*) FILTER (WHERE running_started_at IS NULL)     AS paused,
  COUNT(*) AS total
FROM jobs;

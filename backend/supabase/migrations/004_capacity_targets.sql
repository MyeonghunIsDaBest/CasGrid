-- ============================================================
-- CasGrid — Migration 004: per-week capacity targets
-- ============================================================
-- Adds a JSONB column to `app_settings` for the planning targets surfaced
-- above the Timeline:
--
--   capacity_targets JSONB NOT NULL DEFAULT
--     '{"weeklyBaseline":240,"weeklyStretch":350}'
--
-- `weeklyBaseline` is what we currently expect to schedule each week (the
-- starting team-hours number, e.g. 240h). `weeklyStretch` is the target we're
-- pushing toward (e.g. 350h). Both live on the singleton `app_settings` row.
--
-- HOW TO RUN:
--   Supabase dashboard → SQL Editor → New query → paste this → Run.
--   Idempotent: re-running has no effect.
-- ============================================================

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS capacity_targets JSONB NOT NULL
    DEFAULT '{"weeklyBaseline":240,"weeklyStretch":350}';

-- ── Verify ──────────────────────────────────────────────────
SELECT id, capacity_targets FROM app_settings;

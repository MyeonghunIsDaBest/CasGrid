-- ============================================================
-- CasGrid — FULL DATABASE RESET  ⚠️ DESTRUCTIVE ⚠️
-- ============================================================
-- This DROPS every Casone table (and ALL data in them) and rebuilds
-- the schema from scratch with the correct grants and realtime setup.
--
-- WHEN TO USE:
--   • First-time setup that ended up half-applied / inconsistent.
--   • You want a guaranteed clean, correctly-permissioned database.
--
-- HOW TO RUN:
--   Supabase dashboard → SQL Editor → New query → paste this whole
--   file → Run. Then reload the app and click "Reset to Demo" to seed.
--
-- ⚠️ Running this ERASES all staff, jobs, schedule, and settings data.
--    There is no undo. Do not run against a database with real data
--    you need to keep. To re-enable / repair Realtime + grants WITHOUT
--    erasing data, run supabase/migrations/002_enable_realtime.sql instead.
-- ============================================================

-- ── 1. Drop everything (CASCADE clears FKs + publication membership) ──
DROP TABLE IF EXISTS schedule_entries CASCADE;
DROP TABLE IF EXISTS staff_events     CASCADE;
DROP TABLE IF EXISTS jobs             CASCADE;
DROP TABLE IF EXISTS staff            CASCADE;
DROP TABLE IF EXISTS app_settings     CASCADE;
DROP TABLE IF EXISTS simpro_config    CASCADE;

-- ── 2. Recreate schema ───────────────────────────────────────
CREATE TABLE staff (
  id                    TEXT PRIMARY KEY,
  name                  TEXT        NOT NULL,
  role                  TEXT        NOT NULL,
  type                  TEXT        NOT NULL CHECK (type IN ('field', 'office')),
  daily_available_hours NUMERIC     NOT NULL DEFAULT 8,
  skills                TEXT[]      NOT NULL DEFAULT '{}',
  is_billable           BOOLEAN     NOT NULL DEFAULT true,
  can_assist_field_work BOOLEAN     NOT NULL DEFAULT true,
  active                BOOLEAN     NOT NULL DEFAULT true,
  colour                TEXT        NOT NULL DEFAULT '#3b82f6',
  is_apprentice         BOOLEAN     NOT NULL DEFAULT false,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE jobs (
  id                    TEXT        PRIMARY KEY,
  job_name              TEXT        NOT NULL,
  client_name           TEXT        NOT NULL,
  client_email          TEXT        NOT NULL DEFAULT '',
  client_phone          TEXT        NOT NULL DEFAULT '',
  simpro_job_id         TEXT        NOT NULL DEFAULT '',
  estimated_hours       NUMERIC     NOT NULL DEFAULT 8,
  remaining_hours       NUMERIC     NOT NULL DEFAULT 8,
  priority              TEXT        NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('low','medium','high','urgent')),
  start_date            TEXT        NOT NULL,
  deadline              TEXT        NOT NULL,
  assigned_staff_ids    TEXT[]      NOT NULL DEFAULT '{}',
  daily_staff_overrides JSONB       NOT NULL DEFAULT '{}',
  status                TEXT        NOT NULL DEFAULT 'unscheduled'
                          CHECK (status IN ('unscheduled','scheduled','inProgress','completed','onHold')),
  notes                 TEXT        NOT NULL DEFAULT '',
  colour                TEXT        NOT NULL DEFAULT '#3b82f6',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE schedule_entries (
  id                  TEXT        PRIMARY KEY,
  job_id              TEXT        NOT NULL REFERENCES jobs(id)  ON DELETE CASCADE,
  staff_id            TEXT        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date                TEXT        NOT NULL,
  hours               NUMERIC     NOT NULL,
  is_manual_override  BOOLEAN     NOT NULL DEFAULT false,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE staff_events (
  id         TEXT        PRIMARY KEY,
  staff_id   TEXT        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date       TEXT        NOT NULL,
  type       TEXT        NOT NULL,
  label      TEXT        NOT NULL,
  hours      NUMERIC     NOT NULL DEFAULT 8,
  colour     TEXT        NOT NULL DEFAULT '#6366f1',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE app_settings (
  id                     INTEGER PRIMARY KEY DEFAULT 1,
  override_overbooking   BOOLEAN   NOT NULL DEFAULT false,
  working_days_per_week  INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  CONSTRAINT single_settings_row CHECK (id = 1)
);
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE simpro_config (
  id                    INTEGER PRIMARY KEY DEFAULT 1,
  enabled               BOOLEAN     NOT NULL DEFAULT false,
  subdomain             TEXT        NOT NULL DEFAULT '',
  company_id            TEXT        NOT NULL DEFAULT '0',
  api_token             TEXT        NOT NULL DEFAULT '',
  auto_sync_on_save     BOOLEAN     NOT NULL DEFAULT false,
  send_client_messages  BOOLEAN     NOT NULL DEFAULT false,
  last_sync_at          TIMESTAMPTZ,
  field_mapping         JSONB       NOT NULL DEFAULT '{
    "jobNameField":         "Name",
    "clientNameField":      "Customer.CompanyName",
    "startDateField":       "DateIssued",
    "dueDateField":         "DateRequired",
    "estimatedHoursField":  "TotalLabourHours",
    "statusField":          "Status"
  }',
  CONSTRAINT single_simpro_row CHECK (id = 1)
);
INSERT INTO simpro_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── 3. Indexes ───────────────────────────────────────────────
CREATE INDEX idx_schedule_entries_job_id   ON schedule_entries(job_id);
CREATE INDEX idx_schedule_entries_staff_id ON schedule_entries(staff_id);
CREATE INDEX idx_schedule_entries_date     ON schedule_entries(date);
CREATE INDEX idx_staff_events_staff_id     ON staff_events(staff_id);
CREATE INDEX idx_staff_events_date         ON staff_events(date);
CREATE INDEX idx_jobs_status               ON jobs(status);
CREATE INDEX idx_jobs_deadline             ON jobs(deadline);

-- ── 4. Row Level Security (off — shared internal access, no auth yet) ──
ALTER TABLE staff            DISABLE ROW LEVEL SECURITY;
ALTER TABLE jobs             DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_events     DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings     DISABLE ROW LEVEL SECURITY;
ALTER TABLE simpro_config    DISABLE ROW LEVEL SECURITY;

-- ── 5. Grants (THE FIX) ──────────────────────────────────────
-- The browser uses the `anon` role. Without these grants every query
-- fails with "permission denied for table X" — disabling RLS is NOT enough.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;

-- ── 6. Realtime ──────────────────────────────────────────────
-- REPLICA IDENTITY FULL makes UPDATE/DELETE realtime payloads carry the
-- whole row (not just the primary key) — safer for cross-device sync.
ALTER TABLE staff            REPLICA IDENTITY FULL;
ALTER TABLE jobs             REPLICA IDENTITY FULL;
ALTER TABLE schedule_entries REPLICA IDENTITY FULL;
ALTER TABLE staff_events     REPLICA IDENTITY FULL;
ALTER TABLE app_settings     REPLICA IDENTITY FULL;
ALTER TABLE simpro_config    REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime
  ADD TABLE staff, jobs, schedule_entries, staff_events, app_settings, simpro_config;
/**
 * db.ts — Data access layer
 *
 * Single responsibility: convert between TypeScript (camelCase) and
 * Postgres (snake_case) and execute every Supabase query in one place.
 *
 * No business logic lives here — just reads and writes.
 */

import { supabase } from './supabase';
import type {
  Staff, Job, ScheduleEntry, StaffEvent, AppSettings, SimproConfig,
} from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function raise(context: string, error: { message: string }): never {
  throw new Error(`[db:${context}] ${error.message}`);
}

// ─── STAFF ───────────────────────────────────────────────────────────────────

function fromDbStaff(r: Record<string, unknown>): Staff {
  return {
    id:                   r.id                    as string,
    name:                 r.name                  as string,
    role:                 r.role                  as string,
    type:                 r.type                  as Staff['type'],
    dailyAvailableHours:  Number(r.daily_available_hours),
    skills:               (r.skills               as string[]) ?? [],
    isBillable:           r.is_billable            as boolean,
    canAssistFieldWork:   r.can_assist_field_work  as boolean,
    active:               r.active                 as boolean,
    colour:               r.colour                 as string,
    isApprentice:         (r.is_apprentice         as boolean) ?? false,
  };
}

function toDbStaff(s: Staff) {
  return {
    id:                    s.id,
    name:                  s.name,
    role:                  s.role,
    type:                  s.type,
    daily_available_hours: s.dailyAvailableHours,
    skills:                s.skills,
    is_billable:           s.isBillable,
    can_assist_field_work: s.canAssistFieldWork,
    active:                s.active,
    colour:                s.colour,
    is_apprentice:         s.isApprentice,
    updated_at:            new Date().toISOString(),
  };
}

export async function fetchStaff(): Promise<Staff[]> {
  const { data, error } = await supabase.from('staff').select('*').order('name');
  if (error) raise('fetchStaff', error);
  return (data ?? []).map(fromDbStaff);
}

export async function upsertStaff(s: Staff): Promise<void> {
  const { error } = await supabase.from('staff').upsert(toDbStaff(s));
  if (error) raise('upsertStaff', error);
}

export async function deleteStaff(id: string): Promise<void> {
  const { error } = await supabase.from('staff').delete().eq('id', id);
  if (error) raise('deleteStaff', error);
}

// ─── JOBS ────────────────────────────────────────────────────────────────────

function fromDbJob(r: Record<string, unknown>): Job {
  return {
    id:                   r.id                      as string,
    jobName:              r.job_name                as string,
    clientName:           r.client_name             as string,
    clientEmail:          (r.client_email           as string) ?? '',
    clientPhone:          (r.client_phone           as string) ?? '',
    simproJobId:          (r.simpro_job_id          as string) ?? '',
    estimatedHours:       Number(r.estimated_hours),
    remainingHours:       Number(r.remaining_hours),
    priority:             r.priority                as Job['priority'],
    startDate:            r.start_date              as string,
    deadline:             r.deadline                as string,
    assignedStaffIds:     (r.assigned_staff_ids     as string[]) ?? [],
    dailyStaffOverrides:  (r.daily_staff_overrides  as Record<string, string[]>) ?? {},
    status:               r.status                  as Job['status'],
    notes:                (r.notes                  as string) ?? '',
    colour:               r.colour                  as string,
  };
}

function toDbJob(j: Job) {
  return {
    id:                    j.id,
    job_name:              j.jobName,
    client_name:           j.clientName,
    client_email:          j.clientEmail,
    client_phone:          j.clientPhone,
    simpro_job_id:         j.simproJobId,
    estimated_hours:       j.estimatedHours,
    remaining_hours:       j.remainingHours,
    priority:              j.priority,
    start_date:            j.startDate,
    deadline:              j.deadline,
    assigned_staff_ids:    j.assignedStaffIds,
    daily_staff_overrides: j.dailyStaffOverrides,
    status:                j.status,
    notes:                 j.notes,
    colour:                j.colour,
    updated_at:            new Date().toISOString(),
  };
}

export async function fetchJobs(): Promise<Job[]> {
  const { data, error } = await supabase.from('jobs').select('*').order('deadline');
  if (error) raise('fetchJobs', error);
  return (data ?? []).map(fromDbJob);
}

export async function upsertJob(j: Job): Promise<void> {
  const { error } = await supabase.from('jobs').upsert(toDbJob(j));
  if (error) raise('upsertJob', error);
}

export async function deleteJob(id: string): Promise<void> {
  const { error } = await supabase.from('jobs').delete().eq('id', id);
  if (error) raise('deleteJob', error);
}

// ─── SCHEDULE ENTRIES ────────────────────────────────────────────────────────

function fromDbEntry(r: Record<string, unknown>): ScheduleEntry {
  return {
    id:               r.id               as string,
    jobId:            r.job_id           as string,
    staffId:          r.staff_id         as string,
    date:             r.date             as string,
    hours:            Number(r.hours),
    isManualOverride: (r.is_manual_override as boolean) ?? false,
  };
}

function toDbEntry(e: ScheduleEntry) {
  return {
    id:                 e.id,
    job_id:             e.jobId,
    staff_id:           e.staffId,
    date:               e.date,
    hours:              e.hours,
    is_manual_override: e.isManualOverride,
    updated_at:         new Date().toISOString(),
  };
}

export async function fetchScheduleEntries(): Promise<ScheduleEntry[]> {
  const { data, error } = await supabase.from('schedule_entries').select('*');
  if (error) raise('fetchScheduleEntries', error);
  return (data ?? []).map(fromDbEntry);
}

export async function upsertScheduleEntry(e: ScheduleEntry): Promise<void> {
  const { error } = await supabase.from('schedule_entries').upsert(toDbEntry(e));
  if (error) raise('upsertScheduleEntry', error);
}

export async function deleteScheduleEntry(id: string): Promise<void> {
  const { error } = await supabase.from('schedule_entries').delete().eq('id', id);
  if (error) raise('deleteScheduleEntry', error);
}

/**
 * Called after auto-schedule runs.
 * Atomically replaces all non-manual entries so the schedule stays consistent.
 * Manual overrides are left untouched (they already exist in the DB).
 */
export async function replaceAutoScheduleEntries(entries: ScheduleEntry[]): Promise<void> {
  // 1. Delete every non-manual entry (safe — manual ones are preserved)
  const { error: delErr } = await supabase
    .from('schedule_entries')
    .delete()
    .eq('is_manual_override', false);
  if (delErr) raise('replaceAutoScheduleEntries:delete', delErr);

  // 2. Insert new auto-schedule entries in batches of 500
  const autoEntries = entries.filter(e => !e.isManualOverride);
  if (autoEntries.length === 0) return;

  for (let i = 0; i < autoEntries.length; i += 500) {
    const batch = autoEntries.slice(i, i + 500).map(toDbEntry);
    const { error: insErr } = await supabase.from('schedule_entries').insert(batch);
    if (insErr) raise('replaceAutoScheduleEntries:insert', insErr);
  }
}

// ─── STAFF EVENTS ────────────────────────────────────────────────────────────

function fromDbEvent(r: Record<string, unknown>): StaffEvent {
  return {
    id:       r.id       as string,
    staffId:  r.staff_id as string,
    date:     r.date     as string,
    type:     r.type     as StaffEvent['type'],
    label:    r.label    as string,
    hours:    Number(r.hours),
    colour:   r.colour   as string,
  };
}

function toDbEvent(e: StaffEvent) {
  return {
    id:         e.id,
    staff_id:   e.staffId,
    date:       e.date,
    type:       e.type,
    label:      e.label,
    hours:      e.hours,
    colour:     e.colour,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchStaffEvents(): Promise<StaffEvent[]> {
  const { data, error } = await supabase.from('staff_events').select('*').order('date');
  if (error) raise('fetchStaffEvents', error);
  return (data ?? []).map(fromDbEvent);
}

export async function upsertStaffEvent(e: StaffEvent): Promise<void> {
  const { error } = await supabase.from('staff_events').upsert(toDbEvent(e));
  if (error) raise('upsertStaffEvent', error);
}

export async function deleteStaffEvent(id: string): Promise<void> {
  const { error } = await supabase.from('staff_events').delete().eq('id', id);
  if (error) raise('deleteStaffEvent', error);
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
// currentWeekOffset is NOT stored here — it is per-device local UI state.

type SharedSettings = Omit<AppSettings, 'currentWeekOffset'>;

export async function fetchSettings(): Promise<SharedSettings | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) return null;
  return {
    overrideOverbooking:  data.override_overbooking,
    workingDaysPerWeek:   data.working_days_per_week,
  };
}

export async function upsertSettings(s: SharedSettings): Promise<void> {
  const { error } = await supabase.from('app_settings').upsert({
    id:                     1,
    override_overbooking:   s.overrideOverbooking,
    working_days_per_week:  s.workingDaysPerWeek,
  });
  if (error) raise('upsertSettings', error);
}

// ─── SIMPRO CONFIG ───────────────────────────────────────────────────────────

export async function fetchSimproConfig(): Promise<SimproConfig | null> {
  const { data, error } = await supabase
    .from('simpro_config')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) return null;
  return {
    enabled:             data.enabled,
    subdomain:           data.subdomain,
    companyId:           data.company_id,
    apiToken:            data.api_token,
    autoSyncOnSave:      data.auto_sync_on_save,
    sendClientMessages:  data.send_client_messages,
    lastSyncAt:          data.last_sync_at,
    fieldMapping:        data.field_mapping,
  };
}

export async function upsertSimproConfig(c: SimproConfig): Promise<void> {
  const { error } = await supabase.from('simpro_config').upsert({
    id:                   1,
    enabled:              c.enabled,
    subdomain:            c.subdomain,
    company_id:           c.companyId,
    api_token:            c.apiToken,
    auto_sync_on_save:    c.autoSyncOnSave,
    send_client_messages: c.sendClientMessages,
    last_sync_at:         c.lastSyncAt,
    field_mapping:        c.fieldMapping,
  });
  if (error) raise('upsertSimproConfig', error);
}

// ─── SEED ────────────────────────────────────────────────────────────────────

/**
 * Wipes and re-seeds all tables with demo data.
 * Called by the "Reset to Demo" button.
 */
export async function seedDatabase(
  staff: Staff[],
  jobs: Job[],
  scheduleEntries: ScheduleEntry[],
  staffEvents: StaffEvent[],
): Promise<void> {
  // Clear in dependency order
  await supabase.from('schedule_entries').delete().neq('id', '');
  await supabase.from('staff_events').delete().neq('id', '');
  await supabase.from('jobs').delete().neq('id', '');
  await supabase.from('staff').delete().neq('id', '');
  await supabase.from('app_settings').upsert({ id: 1, override_overbooking: false, working_days_per_week: [1,2,3,4,5] });
  await supabase.from('simpro_config').upsert({ id: 1, enabled: false, subdomain: '', company_id: '0', api_token: '', auto_sync_on_save: false, send_client_messages: false, last_sync_at: null, field_mapping: { jobNameField:'Name', clientNameField:'Customer.CompanyName', startDateField:'DateIssued', dueDateField:'DateRequired', estimatedHoursField:'TotalLabourHours', statusField:'Status' } });

  // Insert fresh demo data
  if (staff.length)         await supabase.from('staff').insert(staff.map(toDbStaff));
  if (jobs.length)          await supabase.from('jobs').insert(jobs.map(toDbJob));
  if (staffEvents.length)   await supabase.from('staff_events').insert(staffEvents.map(toDbEvent));
  if (scheduleEntries.length) await supabase.from('schedule_entries').insert(scheduleEntries.map(toDbEntry));
}

// ─── RAW ROW MAPPERS (exported for Realtime handlers) ────────────────────────
export { fromDbStaff, fromDbJob, fromDbEntry, fromDbEvent };

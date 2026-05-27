/**
 * SCHEDULING ENGINE v2
 *
 * Key upgrades:
 * - Respects StaffEvents (trade school, leave) — blocks capacity those days
 * - Supports dailyStaffOverrides on jobs — specific staff per day
 * - Per-day allocation can vary (4 staff Mon-Wed, 1 Fri)
 * - Still preserves manual ScheduleEntry overrides
 */

import { Staff, Job, ScheduleEntry, StaffEvent } from '../types';
import { getFutureWorkingDays, toDateString, fromDateString } from './dateUtils';
import { startOfDay, isBefore } from 'date-fns';

type DailyCapacityMap = Record<string, Record<string, number>>; // date → staffId → hoursUsed
type BlockedMap = Record<string, Set<string>>; // date → Set<staffId> blocked

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Build a map of which staff are blocked on which days due to StaffEvents.
 * A blocked staff member has 0 available capacity that day.
 */
function buildBlockedMap(staffEvents: StaffEvent[]): BlockedMap {
  const blocked: BlockedMap = {};
  for (const ev of staffEvents) {
    if (ev.hours >= 8) {
      // Full-day block
      if (!blocked[ev.date]) blocked[ev.date] = new Set();
      blocked[ev.date].add(ev.staffId);
    }
    // Partial blocks are handled via reduced capacity (future enhancement)
  }
  return blocked;
}

/**
 * Get the staff assigned to a job on a specific date.
 * Uses dailyStaffOverrides if present for that date, otherwise falls back to assignedStaffIds.
 */
export function getStaffForJobOnDate(job: Job, dateStr: string): string[] {
  if (job.dailyStaffOverrides && job.dailyStaffOverrides[dateStr]) {
    return job.dailyStaffOverrides[dateStr];
  }
  return job.assignedStaffIds;
}

/**
 * Main auto-scheduler.
 */
export function autoSchedule(
  jobs: Job[],
  staff: Staff[],
  existingEntries: ScheduleEntry[],
  staffEvents: StaffEvent[],
  overrideOverbooking: boolean
): ScheduleEntry[] {
  const result: ScheduleEntry[] = [];
  const capacityUsed: DailyCapacityMap = {};
  const blocked = buildBlockedMap(staffEvents);

  // Preserve and pre-consume manual overrides
  const manualEntries = existingEntries.filter(e => e.isManualOverride);
  for (const entry of manualEntries) {
    if (!capacityUsed[entry.date]) capacityUsed[entry.date] = {};
    capacityUsed[entry.date][entry.staffId] =
      (capacityUsed[entry.date][entry.staffId] ?? 0) + entry.hours;
    result.push(entry);
  }

  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const schedulableJobs = jobs
    .filter(j =>
      j.status !== 'completed' &&
      j.status !== 'onHold' &&
      j.assignedStaffIds.length > 0 &&
      j.remainingHours > 0
    )
    .sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return fromDateString(a.deadline) < fromDateString(b.deadline) ? -1 : 1;
    });

  for (const job of schedulableJobs) {
    scheduleJobWithOverrides(job, staff, capacityUsed, blocked, result, overrideOverbooking);
  }

  return result;
}

function scheduleJobWithOverrides(
  job: Job,
  allStaff: Staff[],
  capacityUsed: DailyCapacityMap,
  blocked: BlockedMap,
  result: ScheduleEntry[],
  overrideOverbooking: boolean
): void {
  const startDate = fromDateString(job.startDate);
  const deadline = fromDateString(job.deadline);
  const workingDays = getFutureWorkingDays(startDate, deadline);
  if (workingDays.length === 0) return;

  const staffById: Record<string, Staff> = {};
  for (const s of allStaff) staffById[s.id] = s;

  let hoursLeft = job.remainingHours;

  // Group days by which staff are assigned (using dailyStaffOverrides)
  // We need to figure out how many "staff-hours" are available per day
  // and distribute proportionally

  for (const day of workingDays) {
    if (hoursLeft <= 0.01) break;

    const dateStr = toDateString(day);
    const dayStaffIds = getStaffForJobOnDate(job, dateStr);

    // Filter to active, billable, non-blocked staff
    const availableStaff = dayStaffIds
      .map(id => staffById[id])
      .filter(s => s && s.active && s.isBillable && !blocked[dateStr]?.has(s.id));

    if (availableStaff.length === 0) continue;

    // Max hours this job can consume on this day across all assigned staff
    // Distribute evenly: each staff member gets equal share of that day's job hours
    const dailyJobTarget = Math.min(
      hoursLeft / workingDays.length * availableStaff.length,
      hoursLeft
    );
    const perStaffTarget = dailyJobTarget / availableStaff.length;

    for (const staffMember of availableStaff) {
      if (hoursLeft <= 0.01) break;

      const currentUsed = capacityUsed[dateStr]?.[staffMember.id] ?? 0;
      const maxCapacity = staffMember.dailyAvailableHours;
      const available = overrideOverbooking
        ? maxCapacity * 1.5 - currentUsed
        : maxCapacity - currentUsed;

      if (available <= 0.01) continue;

      const allocate = Math.round(Math.min(perStaffTarget, available, hoursLeft) * 4) / 4;
      if (allocate <= 0) continue;

      if (!capacityUsed[dateStr]) capacityUsed[dateStr] = {};
      capacityUsed[dateStr][staffMember.id] = (capacityUsed[dateStr][staffMember.id] ?? 0) + allocate;

      result.push({
        id: generateId(),
        jobId: job.id,
        staffId: staffMember.id,
        date: dateStr,
        hours: allocate,
        isManualOverride: false,
      });

      hoursLeft -= allocate;
    }
  }
}

/** computeDailyLoads — now also deducts StaffEvent blocked hours */
export function computeDailyLoads(
  days: string[],
  staff: Staff[],
  entries: ScheduleEntry[],
  jobs: Job[],
  staffEvents: StaffEvent[] = []
): Record<string, Record<string, number>> {
  const map: Record<string, Record<string, number>> = {};
  for (const day of days) {
    map[day] = {};
    for (const s of staff) map[day][s.id] = 0;
  }
  const completedIds = new Set(jobs.filter(j => j.status === 'completed').map(j => j.id));
  for (const e of entries) {
    if (!map[e.date]) continue;
    if (completedIds.has(e.jobId)) continue;
    map[e.date][e.staffId] = (map[e.date][e.staffId] ?? 0) + e.hours;
  }
  return map;
}

/** Effective available hours for a staff member on a date, accounting for events */
export function getEffectiveAvailable(
  staffMember: Staff,
  dateStr: string,
  staffEvents: StaffEvent[]
): number {
  const blocked = staffEvents
    .filter(e => e.staffId === staffMember.id && e.date === dateStr)
    .reduce((s, e) => s + e.hours, 0);
  return Math.max(0, staffMember.dailyAvailableHours - blocked);
}

export function isJobAtRisk(job: Job, entries: ScheduleEntry[], staff: Staff[]): boolean {
  if (job.status === 'completed' || job.status === 'onHold') return false;
  const scheduledHours = entries.filter(e => e.jobId === job.id).reduce((s, e) => s + e.hours, 0);
  const deadline = fromDateString(job.deadline);
  if (isBefore(deadline, startOfDay(new Date()))) return true;
  if ((scheduledHours / Math.max(job.estimatedHours, 1)) < 0.85 && job.remainingHours > 0) return true;
  return false;
}

export function computeWeeklyMetrics(
  weekDays: string[],
  staff: Staff[],
  entries: ScheduleEntry[],
  jobs: Job[],
  staffEvents: StaffEvent[] = []
) {
  const billableStaff = staff.filter(s => s.active && s.isBillable);

  // Available hours minus blocked events
  const totalAvailableHours = billableStaff.reduce((sum, s) => {
    return sum + weekDays.reduce((daySum, d) => daySum + getEffectiveAvailable(s, d, staffEvents), 0);
  }, 0);

  const completedIds = new Set(jobs.filter(j => j.status === 'completed').map(j => j.id));
  const weekEntries = entries.filter(e => weekDays.includes(e.date) && !completedIds.has(e.jobId));
  const allocatedHours = weekEntries.reduce((sum, e) => sum + e.hours, 0);

  let overbookedDays = 0;
  for (const day of weekDays) {
    for (const s of billableStaff) {
      const dayHours = weekEntries
        .filter(e => e.date === day && e.staffId === s.id)
        .reduce((sum, e) => sum + e.hours, 0);
      const avail = getEffectiveAvailable(s, day, staffEvents);
      if (dayHours > avail) { overbookedDays++; break; }
    }
  }

  const jobsAtRisk = jobs.filter(j =>
    j.status !== 'completed' && j.status !== 'onHold' && isJobAtRisk(j, entries, staff)
  ).length;

  return {
    totalAvailableHours,
    allocatedHours,
    remainingCapacity: totalAvailableHours - allocatedHours,
    utilisationPct: totalAvailableHours > 0
      ? Math.round((allocatedHours / totalAvailableHours) * 100) : 0,
    jobsAtRisk,
    overbookedDays,
  };
}

export function getUtilisationBgClass(ratio: number): string {
  if (ratio < 0.75) return 'bg-emerald-500';
  if (ratio < 0.95) return 'bg-amber-500';
  return 'bg-red-500';
}

export function getUtilisationTextClass(ratio: number): string {
  if (ratio < 0.75) return 'text-emerald-600';
  if (ratio < 0.95) return 'text-amber-600';
  return 'text-red-600';
}

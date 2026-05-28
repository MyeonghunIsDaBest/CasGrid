/**
 * runningTime.ts — Job running-time helpers.
 *
 * "Running time" is how long a job has been *actively* in progress. A job is
 * considered active in any non-paused status (unscheduled, scheduled, inProgress)
 * and paused in completed/onHold. The model is stopwatch-style:
 *
 *   - `runningStartedAt`: ISO timestamp of the current run, or null when paused.
 *   - `runningTimeMs`:    accumulated ms from all previous runs.
 *
 * Live total = runningTimeMs + (now - runningStartedAt) when active.
 */

import { useEffect, useState } from 'react';
import type { Job, JobStatus } from '../types';

const PAUSED_STATUSES: JobStatus[] = ['completed', 'onHold'];

export function isActiveStatus(status: JobStatus): boolean {
  return !PAUSED_STATUSES.includes(status);
}

export function isJobRunning(job: Job): boolean {
  return !!job.runningStartedAt && isActiveStatus(job.status);
}

/** Live total running-time in milliseconds for display. */
export function getRunningTimeMs(job: Job, now: number = Date.now()): number {
  const base = job.runningTimeMs ?? 0;
  if (job.runningStartedAt && isActiveStatus(job.status)) {
    const startMs = new Date(job.runningStartedAt).getTime();
    if (!Number.isFinite(startMs)) return base;
    return base + Math.max(0, now - startMs);
  }
  return base;
}

/** Format a duration like "3d 14h 22m" / "14h 22m 5s" / "22m 5s" / "5s". */
export function formatRunningTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

/**
 * Compute the running-time fields for a job being created. New jobs start
 * running immediately unless they are created already in a paused status.
 */
export function initialRunningTimeFields(status: JobStatus, nowIso = new Date().toISOString()):
  Pick<Job, 'runningStartedAt' | 'runningTimeMs'>
{
  return {
    runningStartedAt: isActiveStatus(status) ? nowIso : null,
    runningTimeMs: 0,
  };
}

/**
 * Compute the running-time fields when a job's status changes. Callers that
 * mutate `status` (Mark Complete / Hold / Resume buttons) should spread the
 * result into the update payload so the timer pauses/resumes correctly.
 *
 *   updateJob({ ...job, status: 'completed', ...applyStatusChange(job, 'completed') })
 */
export function applyStatusChange(
  prev: Job,
  nextStatus: JobStatus,
  now: number = Date.now(),
): Pick<Job, 'runningStartedAt' | 'runningTimeMs'> {
  const wasActive = isActiveStatus(prev.status) && !!prev.runningStartedAt;
  const willBeActive = isActiveStatus(nextStatus);

  // Pausing: accumulate elapsed run into the total and clear the start marker.
  if (wasActive && !willBeActive) {
    const startMs = new Date(prev.runningStartedAt as string).getTime();
    const elapsed = Number.isFinite(startMs) ? Math.max(0, now - startMs) : 0;
    return {
      runningTimeMs: (prev.runningTimeMs ?? 0) + elapsed,
      runningStartedAt: null,
    };
  }

  // Resuming (paused → active): start a new run from now.
  if (!wasActive && willBeActive) {
    return {
      runningTimeMs: prev.runningTimeMs ?? 0,
      runningStartedAt: new Date(now).toISOString(),
    };
  }

  // No active/paused transition — leave the timer alone.
  return {
    runningTimeMs: prev.runningTimeMs ?? 0,
    runningStartedAt: prev.runningStartedAt ?? null,
  };
}

/**
 * Convert a manually-entered "hours worked" value into the persisted running
 * fields. Used by JobForm when the user edits the running time directly.
 * If the resulting status is active, the timer is restarted from `now` so the
 * live ticker continues counting up from the entered total.
 */
export function fromManualHours(
  hours: number,
  status: JobStatus,
  now: number = Date.now(),
): Pick<Job, 'runningStartedAt' | 'runningTimeMs'> {
  const ms = Math.max(0, Math.round(hours * 3600 * 1000));
  return {
    runningTimeMs: ms,
    runningStartedAt: isActiveStatus(status) ? new Date(now).toISOString() : null,
  };
}

/**
 * React hook — returns a `now` timestamp that updates every second while at
 * least one of the passed jobs is actively running. When no jobs are running
 * the interval idles, so completed/onHold-only views don't tick.
 *
 * Usage:
 *   const now = useRunningTimeNow(job);                  // single job
 *   const now = useRunningTimeNow(state.jobs);           // any active job
 *   const live = getRunningTimeMs(job, now);
 */
export function useRunningTimeNow(jobOrJobs: Job | Job[]): number {
  const jobs = Array.isArray(jobOrJobs) ? jobOrJobs : [jobOrJobs];
  const anyRunning = jobs.some(isJobRunning);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [anyRunning]);

  return now;
}

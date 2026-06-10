/**
 * Decision helpers for Supabase Realtime payloads.
 *
 * With Row-Level Security enabled (008_enable_rls.sql), Realtime DELETE
 * events carry ONLY the primary key in `payload.old` — REPLICA IDENTITY FULL
 * no longer yields the full old row. Handlers that need more than `id` must
 * fall back to the local copy of the row.
 */

export interface RemoteEntryDeleteRow {
  id: string;
  date?: string;
  is_manual_override?: boolean;
}

export interface LocalEntrySnapshot {
  date: string;
  isManualOverride: boolean;
}

/**
 * Past auto-scheduled entries represent work already done and must not be
 * wiped locally by a stale DELETE echo from another client (e.g. a client
 * whose clock is still on yesterday re-running auto-schedule).
 *
 * Returns true when the delete should be IGNORED locally.
 */
export function shouldIgnoreRemoteEntryDelete(
  oldRow: RemoteEntryDeleteRow,
  localEntry: LocalEntrySnapshot | undefined,
  todayStr: string,
): boolean {
  const date = oldRow.date ?? localEntry?.date;
  const isManualOverride = oldRow.is_manual_override ?? localEntry?.isManualOverride;
  return !!date && date < todayStr && isManualOverride === false;
}

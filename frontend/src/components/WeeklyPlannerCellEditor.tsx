// @ts-nocheck
/**
 * WeeklyPlannerCellEditor — popover anchored to a clicked planner cell.
 *
 * Surfaces a real time-management editor: pick a job (filtered to those the
 * staff member is assigned to and that are still active), set the hours, add
 * more rows for multi-job days, delete rows, all under a capacity guard.
 *
 * Parent gives us the initial rows and a `onCommit({ jobId, hours }[])` —
 * we don't touch state directly; WeeklyPlanner does the replace-all-in-cell
 * write. That keeps the bug surface small and the data flow obvious.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, AlertTriangle } from 'lucide-react';
import type { Job, Staff } from '../types';
import { format } from 'date-fns';
import { fromDateString } from '../utils/dateUtils';
import { getEffectiveAvailable } from '../utils/schedulingEngine';

interface EditorRow {
  /** Original entry id when this row was hydrated from an existing entry.
   *  New rows added in-editor have no id. */
  originalId?: string;
  jobId: string;
  hours: number;
}

interface Props {
  date: string;
  staff: Staff;
  initialRows: EditorRow[];
  jobs: Job[];
  staffEvents: import('../types').StaffEvent[];
  overrideOverbooking: boolean;
  anchor: { top: number; left: number } | null;
  onCommit: (rows: { jobId: string; hours: number }[]) => void;
  onClose: () => void;
}

export function WeeklyPlannerCellEditor({
  date,
  staff,
  initialRows,
  jobs,
  staffEvents,
  overrideOverbooking,
  anchor,
  onCommit,
  onClose,
}: Props) {
  const [rows, setRows] = useState<EditorRow[]>(initialRows);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Outside click + Escape closes (without committing).
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Lock background scroll while the editor is open — the popover is
  // position:fixed and would detach from its anchor if the page kept
  // scrolling. Restore the prior overflow value on close.
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  // Eligible jobs for this staff member — they must be assigned to it and
  // the job must still be active.
  const eligibleJobs = useMemo(
    () => jobs.filter(
      j => j.assignedStaffIds.includes(staff.id) &&
           j.status !== 'completed' && j.status !== 'onHold',
    ),
    [jobs, staff.id],
  );

  // Jobs not yet in the editor — what the "+ Add job" dropdown shows.
  const usedJobIds = new Set(rows.map(r => r.jobId));
  const addableJobs = eligibleJobs.filter(j => !usedJobIds.has(j.id));

  const total = rows.reduce((s, r) => s + (Number.isFinite(r.hours) ? r.hours : 0), 0);
  const available = getEffectiveAvailable(staff, date, staffEvents);
  const overBudget = total > available + 0.01;
  const blockedByOverbook = overBudget && !overrideOverbooking;

  function updateRow(idx: number, patch: Partial<EditorRow>) {
    setRows(rs => rs.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }
  function removeRow(idx: number) {
    setRows(rs => rs.filter((_, i) => i !== idx));
  }
  function addRow(jobId: string) {
    setRows(rs => [...rs, { jobId, hours: Math.max(0, available - total) || 1 }]);
  }

  function handleSave() {
    if (blockedByOverbook) return;
    onCommit(
      rows
        .filter(r => r.jobId && Number.isFinite(r.hours) && r.hours > 0)
        .map(r => ({ jobId: r.jobId, hours: r.hours })),
    );
  }

  const dayLabel = format(fromDateString(date), 'EEE d MMM');

  // Popover positioning — fixed to the anchor, clamped to the viewport on
  // every side with an 8px gutter so the popover can't get cut off when the
  // table is scrolled horizontally or the cell is near a screen edge.
  const POP_W = 280;
  const POP_H_MAX = 360;
  const GUTTER = 8;
  const style: React.CSSProperties = anchor
    ? {
        position: 'fixed',
        top:  Math.max(GUTTER, Math.min(anchor.top,  window.innerHeight - POP_H_MAX - GUTTER)),
        left: Math.max(GUTTER, Math.min(anchor.left, window.innerWidth  - POP_W     - GUTTER)),
        width: POP_W,
        zIndex: 60,
      }
    : { position: 'fixed', top: 80, left: 80, width: POP_W, zIndex: 60 };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-slate-900/25 backdrop-blur-[1px]"
        onClick={onClose}
        onWheel={e => e.preventDefault()}
        onTouchMove={e => e.preventDefault()}
        aria-hidden
      />
      <div
        ref={containerRef}
        style={style}
        className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{dayLabel}</div>
            <div className="text-sm font-semibold text-slate-800 truncate flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: staff.colour }} />
              {staff.name}
              <span className="text-xs font-normal text-slate-400">· {staff.role}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Close">
            <X size={14} />
          </button>
        </div>

        {/* Capacity counter */}
        <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Daily capacity
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`text-[11px] font-bold tabular-nums ${
              overBudget ? 'text-red-600' : total >= available * 0.95 ? 'text-amber-600' : 'text-slate-700'
            }`}>
              {total.toFixed(1)} / {available.toFixed(0)}h
            </span>
            {overBudget && (
              <span className={`flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                blockedByOverbook ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
              }`}>
                <AlertTriangle size={9} /> {blockedByOverbook ? 'OVER' : 'OVER (allowed)'}
              </span>
            )}
          </div>
        </div>

        {/* Rows */}
        <div className="px-3 py-2 space-y-1.5 max-h-60 overflow-y-auto">
          {rows.length === 0 && eligibleJobs.length === 0 && (
            <p className="text-[11px] text-slate-500 italic py-2">
              No active jobs assign {staff.name.split(' ')[0]}. Add them via Jobs → Edit.
            </p>
          )}
          {rows.length === 0 && eligibleJobs.length > 0 && (
            <p className="text-[11px] text-slate-400 italic py-1">
              No allocation yet. Add a job below.
            </p>
          )}
          {rows.map((row, idx) => {
            const job = jobs.find(j => j.id === row.jobId);
            return (
              <div key={idx} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: job?.colour ?? '#94a3b8' }}
                />
                <select
                  value={row.jobId}
                  onChange={e => updateRow(idx, { jobId: e.target.value })}
                  className="flex-1 min-w-0 border border-slate-200 rounded px-1.5 py-1 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  {!eligibleJobs.some(j => j.id === row.jobId) && job && (
                    /* Show the existing job even if it's no longer eligible
                       (e.g. status changed to completed) so the user sees what's there */
                    <option value={job.id}>{job.jobName} (inactive)</option>
                  )}
                  {eligibleJobs.map(j => (
                    <option key={j.id} value={j.id}>{j.jobName}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  step={0.25}
                  value={row.hours}
                  onChange={e => updateRow(idx, { hours: parseFloat(e.target.value) || 0 })}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                  className="w-14 border border-slate-200 rounded px-1.5 py-1 text-[11px] text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <span className="text-[10px] text-slate-400">h</span>
                <button
                  onClick={() => removeRow(idx)}
                  aria-label="Remove row"
                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}

          {/* Add row */}
          {addableJobs.length > 0 && (
            <div className="pt-1">
              <select
                value=""
                onChange={e => { if (e.target.value) addRow(e.target.value); }}
                className="w-full border border-dashed border-slate-300 rounded px-2 py-1 text-[11px] text-slate-500 bg-white hover:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              >
                <option value="">+ Add job to this day…</option>
                {addableJobs.map(j => (
                  <option key={j.id} value={j.id}>{j.jobName}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-1.5">
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-[11px] font-medium text-slate-600 rounded hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={blockedByOverbook}
            className={`flex items-center gap-1 px-3 py-1 text-[11px] font-semibold rounded transition-colors ${
              blockedByOverbook
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-amber-600 text-white hover:bg-amber-700'
            }`}
            title={blockedByOverbook ? 'Enable "Allow overbooking" in Settings to save over capacity.' : undefined}
          >
            <Plus size={11} className={blockedByOverbook ? 'opacity-50' : 'opacity-80'} /> Save
          </button>
        </div>
      </div>
    </>
  );
}

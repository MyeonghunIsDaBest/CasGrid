// @ts-nocheck
/**
 * StaffAllocationLayer
 *
 * Renders one row per active billable staff member, aligned to the same
 * horizontal date axis the job bars sit on. Each working day is a small block
 * coloured by that staff's utilisation; empty days = spare capacity.
 *
 * Memoises `computeDailyLoads` on (scheduleEntries, jobs, staffEvents, dayStrings)
 * so it doesn't re-walk all entries on every pointer-move during a job drag.
 */
import { useMemo } from 'react';
import { toDateString, isToday } from '../../utils/dateUtils';
import {
  computeDailyLoads,
  getEffectiveAvailable,
  getUtilisationBgClass,
} from '../../utils/schedulingEngine';
import { LiveBadge } from '../LiveBadge';

export function StaffAllocationLayer({ days, totalDays, scheduleEntries, jobs, staff, staffEvents }) {
  const billableStaff = useMemo(
    () => staff.filter(s => s.active && s.isBillable),
    [staff],
  );

  const dayStrings = useMemo(() => days.map(toDateString), [days]);

  const dailyLoads = useMemo(
    () => computeDailyLoads(dayStrings, billableStaff, scheduleEntries, jobs, staffEvents),
    [dayStrings, billableStaff, scheduleEntries, jobs, staffEvents],
  );

  // Days a staff member has approved overtime → render amber, not red.
  const otDays = useMemo(
    () => new Set(scheduleEntries.filter(e => e.isOvertime).map(e => `${e.date}|${e.staffId}`)),
    [scheduleEntries],
  );

  if (billableStaff.length === 0) return null;

  return (
    <div className="border-t-2 border-slate-100">
      {/* Section heading row */}
      <div className="flex border-b border-slate-100 bg-slate-50">
        <div className="w-60 flex-shrink-0 border-r border-slate-100 px-3 py-1.5 sticky left-0 bg-slate-50 z-10">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
              Staff capacity
            </span>
            <LiveBadge compact />
          </div>
        </div>
        <div className="flex-1" />
      </div>

      {billableStaff.map(member => {
        // Total scheduled vs total available across the visible window
        const totalScheduled = dayStrings.reduce(
          (s, d) => s + (dailyLoads[d]?.[member.id] ?? 0),
          0,
        );
        const totalAvail = dayStrings.reduce(
          (s, d) => s + getEffectiveAvailable(member, d, staffEvents),
          0,
        );

        return (
          <div key={member.id} className="flex items-stretch border-b border-slate-50 hover:bg-slate-50/40" style={{ minHeight: 28 }}>
            {/* Sticky left label */}
            <div className="w-60 flex-shrink-0 border-r border-slate-100 px-3 py-1 sticky left-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: member.colour }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold text-slate-800 truncate">
                    {member.name}
                  </div>
                </div>
                <div className="text-[10px] tabular-nums text-slate-500">
                  {totalScheduled.toFixed(0)}/{totalAvail.toFixed(0)}h
                </div>
              </div>
            </div>

            {/* Per-day blocks */}
            <div className="flex-1 relative flex">
              {days.map((day, i) => {
                const dStr = toDateString(day);
                const isT = isToday(day);
                const used = dailyLoads[dStr]?.[member.id] ?? 0;
                const avail = getEffectiveAvailable(member, dStr, staffEvents);
                const ratio = avail > 0 ? used / avail : 0;
                const widthPct = 100 / totalDays;

                // Sunday is a working day now — no weekend-shaded cell branch.

                // Empty (no schedule, has capacity) → dashed cell signalling spare slot
                if (used <= 0.01) {
                  return (
                    <div
                      key={i}
                      className={`border-r border-slate-100 flex items-center justify-center py-1 ${isT ? 'bg-amber-50/60' : ''}`}
                      style={{ width: `${widthPct}%` }}
                      title={avail > 0 ? `${dStr} · 0/${avail.toFixed(0)}h available` : `${dStr} · blocked`}
                    >
                      {avail > 0 && (
                        <div className="w-[70%] h-3 rounded border border-dashed border-slate-200" />
                      )}
                    </div>
                  );
                }

                const isOT = otDays.has(`${dStr}|${member.id}`);
                const bgClass = isOT && ratio > 1.0001 ? 'bg-amber-500' : getUtilisationBgClass(ratio);
                return (
                  <div
                    key={i}
                    className={`border-r border-slate-100 flex items-center justify-center py-1 ${isT ? 'bg-amber-50/60' : ''}`}
                    style={{ width: `${widthPct}%` }}
                    title={`${dStr} · ${used.toFixed(1)}/${avail.toFixed(0)}h (${Math.round(ratio * 100)}%)${isOT ? ' · overtime' : ''}`}
                  >
                    <div
                      className={`w-[80%] h-3 rounded ${bgClass} flex items-center justify-center`}
                      style={{ opacity: Math.min(1, 0.35 + ratio * 0.65) }}
                    >
                      <span className="text-[7px] font-bold text-white leading-none">
                        {used % 1 === 0 ? used : used.toFixed(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

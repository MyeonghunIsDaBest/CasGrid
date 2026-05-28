// @ts-nocheck
/**
 * WeeklyCapacityHeader
 *
 * One row above the Timeline date axis showing — per visible week — allocated
 * hours vs the two configurable goals: baseline (where we are now, e.g. 240h)
 * and stretch (where we want to be, e.g. 350h). The bar is a single segmented
 * fill: slate up to baseline, amber baseline→stretch, red over stretch.
 *
 * The widths line up with the existing week-header math (one week column per
 * { label, count } slot in the `weeks` array).
 */
import { useMemo } from 'react';
import { toDateString } from '../../utils/dateUtils';
import { computeWeeklyMetrics } from '../../utils/schedulingEngine';
import { LiveBadge } from '../LiveBadge';

export function WeeklyCapacityHeader({
  days,
  totalDays,
  weeks,
  scheduleEntries,
  jobs,
  staff,
  staffEvents,
  capacityTargets,
}) {
  const baseline = Math.max(0, capacityTargets?.weeklyBaseline ?? 240);
  const stretch  = Math.max(baseline, capacityTargets?.weeklyStretch  ?? 350);

  // Each week column = a contiguous slice of `days`. Build the slice indices
  // from the same `weeks` array the day header uses so things stay aligned.
  const slices = useMemo(() => {
    const out = [];
    let cursor = 0;
    for (const w of weeks) {
      out.push({ start: cursor, count: w.count, label: w.label });
      cursor += w.count;
    }
    return out;
  }, [weeks]);

  return (
    <div className="flex border-b border-slate-100 bg-white">
      <div className="w-60 flex-shrink-0 border-r border-slate-100 px-3 py-2 sticky left-0 bg-white z-10">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
            Weekly capacity
          </span>
          <LiveBadge compact />
        </div>
        <div className="text-[9px] text-slate-400 mt-0.5 tabular-nums">
          baseline {baseline}h · stretch {stretch}h
        </div>
      </div>
      <div className="flex-1 flex">
        {slices.map((slice, i) => {
          // Pull only this week's date strings; with the past-auto preservation
          // from Bug #1, summing the current week's entries gives an accurate
          // allocated total (no historical inflation from BHCS-style backfills).
          const weekDayStrings = days.slice(slice.start, slice.start + slice.count).map(toDateString);
          const metrics = computeWeeklyMetrics(
            weekDayStrings,
            staff,
            scheduleEntries,
            jobs,
            staffEvents,
          );

          const allocated = metrics.allocatedHours;
          const total = stretch; // bar's full width represents the stretch target
          const baselineEnd = total > 0 ? (baseline / total) * 100 : 0;
          const fillPct = total > 0 ? Math.min(100, (allocated / total) * 100) : 0;
          const overPct = allocated > stretch && total > 0 ? Math.min(100, ((allocated - stretch) / total) * 100) : 0;
          const overSegmentColour = '#dc2626'; // red
          const inStretch = allocated > baseline;
          const toStretch = Math.max(0, stretch - allocated);
          const overStretchAmount = Math.max(0, allocated - stretch);

          return (
            <div
              key={i}
              className="border-r border-slate-100 px-2 py-2"
              style={{ width: `${(slice.count / totalDays) * 100}%` }}
            >
              {/* Allocated header */}
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className={`font-semibold tabular-nums ${
                  allocated > stretch ? 'text-red-600' : inStretch ? 'text-amber-600' : 'text-slate-700'
                }`}>
                  {allocated.toFixed(0)}h
                </span>
                <span className="text-[9px] text-slate-400 truncate tabular-nums">
                  {allocated > stretch
                    ? `+${overStretchAmount.toFixed(0)}h over`
                    : inStretch
                      ? `${toStretch.toFixed(0)}h to target`
                      : `${(baseline - allocated).toFixed(0)}h to baseline`}
                </span>
              </div>

              {/* Segmented bar */}
              <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                {/* Base fill: slate up to baseline, amber baseline→stretch */}
                <div
                  className="absolute top-0 left-0 bottom-0 bg-slate-600"
                  style={{ width: `${Math.min(fillPct, baselineEnd)}%` }}
                />
                {fillPct > baselineEnd && (
                  <div
                    className="absolute top-0 bottom-0 bg-amber-500"
                    style={{ left: `${baselineEnd}%`, width: `${Math.min(fillPct - baselineEnd, 100 - baselineEnd)}%` }}
                  />
                )}
                {overPct > 0 && (
                  <div
                    className="absolute top-0 bottom-0"
                    style={{ left: `0%`, right: 0, backgroundColor: overSegmentColour, opacity: 0.85 }}
                  />
                )}
                {/* Baseline tick */}
                <div
                  className="absolute top-[-2px] bottom-[-2px] w-px bg-slate-400/70 pointer-events-none"
                  style={{ left: `${baselineEnd}%` }}
                />
                {/* Stretch tick (right edge) */}
                <div
                  className="absolute top-[-2px] bottom-[-2px] right-0 w-px bg-slate-500/70 pointer-events-none"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

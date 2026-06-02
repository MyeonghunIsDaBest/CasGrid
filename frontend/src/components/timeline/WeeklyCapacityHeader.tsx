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
import { CapacityTargetsControl } from './CapacityTargetsControl';

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

  // Theoretical max weekly team-hours (active billable staff × Mon–Sat),
  // used to scale the targets slider. 0 → control falls back to a sensible max.
  const teamWeeklyHours = useMemo(
    () => staff
      .filter(s => s.active && s.isBillable)
      .reduce((sum, s) => sum + (s.dailyAvailableHours || 0), 0) * 6,
    [staff],
  );

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
          <div className="ml-auto -mr-1">
            <CapacityTargetsControl baseline={baseline} stretch={stretch} maxHours={teamWeeklyHours} />
          </div>
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
          const inStretch = allocated > baseline;
          const toStretch = Math.max(0, stretch - allocated);
          const overStretchAmount = Math.max(0, allocated - stretch);

          // Bar scales to whichever is larger — the stretch target or the actual
          // allocation — so an over-capacity week shows a proportional red
          // overflow past the stretch tick instead of flooding the whole bar.
          const peak = Math.max(stretch, allocated, 1);
          const pctOf = (h: number) => Math.min(100, (h / peak) * 100);
          const baselinePos = (baseline / peak) * 100;
          const stretchPos = (stretch / peak) * 100;
          const slateW = pctOf(Math.min(allocated, baseline));
          const amberW = Math.max(0, pctOf(Math.min(allocated, stretch)) - baselinePos);
          const overW = allocated > stretch ? pctOf(allocated) - stretchPos : 0;

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

              {/* Segmented bar: slate 0→baseline, amber baseline→stretch, red past stretch */}
              <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 left-0 bottom-0 bg-slate-600"
                  style={{ width: `${slateW}%` }}
                />
                {amberW > 0 && (
                  <div
                    className="absolute top-0 bottom-0 bg-amber-500"
                    style={{ left: `${baselinePos}%`, width: `${amberW}%` }}
                  />
                )}
                {overW > 0 && (
                  <div
                    className="absolute top-0 bottom-0 bg-red-600"
                    style={{ left: `${stretchPos}%`, width: `${overW}%` }}
                  />
                )}
                {/* Baseline tick */}
                <div
                  className="absolute top-[-2px] bottom-[-2px] w-px bg-slate-400/70 pointer-events-none"
                  style={{ left: `${baselinePos}%` }}
                />
                {/* Stretch tick */}
                <div
                  className="absolute top-[-2px] bottom-[-2px] w-px bg-slate-500/70 pointer-events-none"
                  style={{ left: `${stretchPos}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

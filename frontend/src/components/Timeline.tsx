// @ts-nocheck
import { useMemo, useRef, useState } from 'react';
import { addDays, format, differenceInCalendarDays, isBefore, isAfter } from 'date-fns';
import { useApp } from '../context/AppContext';
import { useJobModal } from '../context/JobModalContext';
import { toDateString, isToday, formatDay } from '../utils/dateUtils';
import { isJobAtRisk, getRemainingHours, getAllJobStaffIds } from '../utils/schedulingEngine';
import { AlertTriangle, GripHorizontal, Clock, Users } from 'lucide-react';
import { StaffAllocationLayer } from './timeline/StaffAllocationLayer';
import { WeeklyCapacityHeader } from './timeline/WeeklyCapacityHeader';
import { StaffHoverCard } from './StaffHoverCard';
import { StaffListHoverCard } from './StaffListHoverCard';
import { toast } from 'sonner';

const DAYS_TO_SHOW = 49; // 7 weeks

/**
 * Build a stable map of staffId → 1-or-2-letter initials, matching the
 * convention used by JobDetailModal's Default Assigned Staff chips:
 *   single-word name → first letter
 *   multi-word name  → first letter of first + first letter of last
 * If two single-letter initials would collide (e.g. "Isaac" + "Iona" → "I"
 * twice), the colliders fall back to the first two letters of their name
 * ("IS", "IO") so every chip on screen is unique.
 */
function computeInitials(staffList) {
  const out = {};
  for (const s of staffList) {
    out[s.id] = s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }
  const counts = {};
  for (const v of Object.values(out)) counts[v] = (counts[v] ?? 0) + 1;
  for (const s of staffList) {
    if (out[s.id].length === 1 && counts[out[s.id]] > 1) {
      out[s.id] = s.name.slice(0, 2).toUpperCase();
    }
  }
  return out;
}

export function Timeline() {
  const { state, updateJob } = useApp();
  const { openJob } = useJobModal();
  const { jobs, staff, scheduleEntries, staffEvents, settings } = state;
  const capacityTargets = settings.capacityTargets ?? { weeklyBaseline: 240, weeklyStretch: 350 };

  const today = useMemo(() => new Date(), []);
  const days = useMemo(
    () => Array.from({ length: DAYS_TO_SHOW }, (_, i) => addDays(today, i - 7)),
    []
  );

  const trackRef = useRef(null);
  const dragRef = useRef(null);
  const [draggingJobId, setDraggingJobId] = useState(null);
  const [liveOffsets, setLiveOffsets] = useState({});

  // Click-to-highlight: one staff id at a time, or null. Pure UI filter —
  // dims non-matching job bars, doesn't mutate data.
  const [staffFilter, setStaffFilter] = useState(null);

  const billableStaff = useMemo(
    () => staff.filter(s => s.active && s.isBillable),
    [staff],
  );
  const initials = useMemo(() => computeInitials(billableStaff), [billableStaff]);

  const totalDays = days.length;
  const startDate = days[0];

  // ─── Week groups for header ───
  const weeks = useMemo(() => {
    const result = [];
    let cur = { label: '', count: 0 };
    days.forEach((day, i) => {
      const dow = day.getDay();
      if (i === 0 || dow === 1) {
        if (cur.count > 0) result.push({ ...cur });
        cur = { label: format(day, 'MMM d'), count: 1 };
      } else { cur.count++; }
    });
    if (cur.count > 0) result.push(cur);
    return result;
  }, [days]);

  function dateToPct(date) {
    const diff = differenceInCalendarDays(date, startDate);
    return Math.max(0, Math.min(100, (diff / totalDays) * 100));
  }

  function getBarStyle(job) {
    const off = liveOffsets[job.id] ?? { start: 0, end: 0 };
    const s = addDays(fromDate(job.startDate), off.start);
    const e = addDays(fromDate(job.deadline), off.end);
    const cs = isBefore(s, days[0]) ? days[0] : s;
    const ce = isAfter(e, days[totalDays-1]) ? days[totalDays-1] : e;
    const left = dateToPct(cs);
    const width = Math.max(dateToPct(ce) - left, 1.5);
    return { left: `${left}%`, width: `${width}%` };
  }

  function fromDate(str) {
    const [y,m,d] = str.split('-').map(Number);
    return new Date(y, m-1, d);
  }

  function startDrag(e, job, mode) {
    e.stopPropagation(); e.preventDefault();
    dragRef.current = {
      jobId: job.id, mode,
      startClientX: e.clientX,
      origStart: job.startDate,
      origEnd: job.deadline,
    };
    setDraggingJobId(job.id);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function getDelta(clientX) {
    if (!dragRef.current || !trackRef.current) return 0;
    const w = trackRef.current.getBoundingClientRect().width;
    return Math.round((clientX - dragRef.current.startClientX) / (w / totalDays));
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return;
    const delta = getDelta(e.clientX);
    const d = dragRef.current;
    setLiveOffsets(p => ({
      ...p,
      [d.jobId]: {
        start: d.mode !== 'resize-right' ? delta : 0,
        end: d.mode !== 'resize-left' ? delta : 0,
      },
    }));
  }

  function handlePointerUp(e) {
    const d = dragRef.current;
    if (!d) return;
    const delta = getDelta(e.clientX);
    if (delta !== 0) {
      const job = state.jobs.find(j => j.id === d.jobId);
      if (job) {
        const orig = { startDate: d.origStart, deadline: d.origEnd };
        const next = applyDelta(job, d.mode, delta);
        if (next.startDate !== orig.startDate || next.deadline !== orig.deadline) {
          updateJob({ ...job, startDate: next.startDate, deadline: next.deadline });
          toastReschedule(job, next, orig);
        }
      }
    }
    dragRef.current = null;
    setDraggingJobId(null);
    setLiveOffsets({});
  }

  // Apply a whole-day delta under a drag/keyboard mode, clamping to a minimum
  // 1-day duration so the edges can't cross. `clamped` flags when the limit bit.
  function applyDelta(job, mode, delta) {
    const origS = fromDate(job.startDate);
    const origE = fromDate(job.deadline);
    if (mode === 'move') {
      return {
        startDate: toDateString(addDays(origS, delta)),
        deadline:  toDateString(addDays(origE, delta)),
        clamped: false,
      };
    }
    if (mode === 'resize-left') {
      const want = addDays(origS, delta);
      const maxStart = addDays(origE, -1);
      const clamped = isAfter(want, maxStart);
      return { startDate: toDateString(clamped ? maxStart : want), deadline: job.deadline, clamped };
    }
    const want = addDays(origE, delta);
    const minEnd = addDays(origS, 1);
    const clamped = isBefore(want, minEnd);
    return { startDate: job.startDate, deadline: toDateString(clamped ? minEnd : want), clamped };
  }

  // Commit feedback + one-step undo. Reusing the toast id keeps rapid keyboard
  // nudges from stacking into a wall of toasts.
  function toastReschedule(job, next, orig) {
    const delta =
      differenceInCalendarDays(fromDate(next.startDate), fromDate(orig.startDate)) ||
      differenceInCalendarDays(fromDate(next.deadline), fromDate(orig.deadline));
    const sign = delta > 0 ? '+' : '';
    toast(`${job.jobName} rescheduled`, {
      id: `reschedule-${job.id}`,
      description: `${formatDay(fromDate(next.startDate))} → ${formatDay(fromDate(next.deadline))}${delta ? ` · ${sign}${delta}d` : ''}`,
      action: {
        label: 'Undo',
        onClick: () => updateJob({ ...job, startDate: orig.startDate, deadline: orig.deadline }),
      },
    });
  }

  // Keyboard control for a focused bar: arrows move, Shift = a week, Alt =
  // resize the deadline, Enter/Space opens the job.
  function handleKeyDown(e, job) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openJob(job.id);
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = e.shiftKey ? 7 : 1;
    const delta = (e.key === 'ArrowRight' ? 1 : -1) * step;
    const mode = e.altKey ? 'resize-right' : 'move';
    const orig = { startDate: job.startDate, deadline: job.deadline };
    const next = applyDelta(job, mode, delta);
    if (next.startDate !== orig.startDate || next.deadline !== orig.deadline) {
      updateJob({ ...job, startDate: next.startDate, deadline: next.deadline });
      toastReschedule(job, next, orig);
    }
  }

  // Active jobs only. When a staff filter is on, lift bars assigned to that
  // staff to the top so they're visible without scrolling. Non-matching bars
  // stay rendered (just dimmed) so the user keeps full context.
  const activeJobs = useMemo(() => {
    const all = jobs.filter(j => j.status !== 'completed');
    if (!staffFilter) return all;
    return [...all].sort((a, b) => {
      const aHas = a.assignedStaffIds.includes(staffFilter) ? 0 : 1;
      const bHas = b.assignedStaffIds.includes(staffFilter) ? 0 : 1;
      return aHas - bHas;
    });
  }, [jobs, staffFilter]);
  const todayPct = dateToPct(today);

  // ─── Per-job hours summary ───
  function getJobHours(jobId) {
    const scheduled = scheduleEntries.filter(e => e.jobId === jobId).reduce((s,e) => s+e.hours, 0);
    const job = jobs.find(j => j.id === jobId);
    return {
      scheduled,
      estimated: job?.estimatedHours ?? 0,
      remaining: job ? getRemainingHours(job, scheduleEntries) : 0,
    };
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden select-none">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-800 text-sm">Job Timeline</h2>
          <p className="text-xs text-slate-500">Drag bars to move • drag edges to resize dates • click to view job</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="w-3 h-1 rounded bg-amber-400 inline-block" /> Today</span>
          <span className="flex items-center gap-1"><AlertTriangle size={10} className="text-orange-400" /> At risk</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-200 inline-block" /> Trade school</span>
        </div>
      </div>

      {/* Team legend — colored initial chip per active billable staff. Click to
          filter the bars below; click again (or "Clear") to reset. The chip's
          initial matches what's shown inside each job bar, so the bar dots
          become directly identifiable instead of relying on color memory. */}
      {billableStaff.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-slate-100 bg-slate-50/40 overflow-x-auto">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide flex-shrink-0 mr-1">Team</span>
          {billableStaff.map(s => {
            const isFiltered = staffFilter === s.id;
            const isDimmed = staffFilter && !isFiltered;
            return (
              <StaffHoverCard key={s.id} staff={s}>
                <button
                  onClick={() => setStaffFilter(f => f === s.id ? null : s.id)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 transition-all ring-1 ${
                    isFiltered
                      ? 'text-white ring-transparent'
                      : isDimmed
                        ? 'opacity-40 ring-slate-200 text-slate-600 bg-white hover:opacity-70'
                        : 'ring-slate-200 text-slate-700 bg-white hover:ring-slate-300'
                  }`}
                  style={isFiltered ? { backgroundColor: s.colour } : undefined}
                >
                  <span
                    className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[7px] font-bold text-white ring-1 ring-white/60"
                    style={{ backgroundColor: s.colour }}
                  >
                    {initials[s.id] ?? s.name[0]}
                  </span>
                  {s.name.split(' ')[0]}
                </button>
              </StaffHoverCard>
            );
          })}
          {staffFilter && (
            <button
              onClick={() => setStaffFilter(null)}
              className="ml-auto text-[10px] text-slate-500 hover:text-slate-800 px-2 py-0.5 rounded hover:bg-slate-100 flex-shrink-0"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[960px]">

          {/* ── Weekly capacity header (Layer C) ── */}
          <WeeklyCapacityHeader
            days={days}
            totalDays={totalDays}
            weeks={weeks}
            scheduleEntries={scheduleEntries}
            jobs={jobs}
            staff={staff}
            staffEvents={staffEvents}
            capacityTargets={capacityTargets}
          />

          {/* ── Week header ── */}
          <div className="flex border-b border-slate-100">
            <div className="w-60 flex-shrink-0 border-r border-slate-100 px-3 py-1.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wide sticky left-0 bg-white z-10">
              Job / Client
            </div>
            <div className="flex-1 flex">
              {weeks.map((w,i) => (
                <div key={i} className="border-r border-slate-100 text-[10px] text-slate-500 px-2 py-1.5 font-semibold"
                  style={{ width: `${(w.count/totalDays)*100}%` }}>
                  {w.label}
                </div>
              ))}
            </div>
          </div>

          {/* ── Day header with DAY NAME ── */}
          <div className="flex border-b border-slate-200" ref={trackRef}>
            <div className="w-60 flex-shrink-0 border-r border-slate-100 bg-slate-50 sticky left-0 z-10" />
            <div className="flex-1 flex">
              {days.map((day, i) => {
                const isWknd = day.getDay() === 0 || day.getDay() === 6;
                const isT = isToday(day);
                const isMon = day.getDay() === 1;
                return (
                  <div key={i}
                    className={`border-r text-center transition-colors flex flex-col items-center justify-center py-1
                      ${isWknd ? 'bg-slate-50 border-slate-100' : 'border-slate-100'}
                      ${isT ? 'bg-amber-50 border-amber-200' : ''}`}
                    style={{ width: `${100/totalDays}%` }}
                  >
                    {/* Day letter — always show Mon, show others if wide enough */}
                    <div className={`text-[8px] font-bold leading-none ${isT ? 'text-amber-500' : isWknd ? 'text-slate-300' : 'text-slate-400'}`}>
                      {format(day, 'EEE').toUpperCase().slice(0,1)}
                    </div>
                    <div className={`text-[9px] font-semibold leading-none mt-0.5 ${isT ? 'text-amber-600' : isWknd ? 'text-slate-300' : isMon ? 'text-slate-700' : 'text-slate-400'}`}>
                      {format(day,'d')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Job rows ── */}
          {activeJobs.map(job => {
            const atRisk = isJobAtRisk(job, scheduleEntries, staff);
            const style = getBarStyle(job);
            const hrs = getJobHours(job.id);
            const prog = Math.min(100, (hrs.scheduled / Math.max(hrs.estimated, 1)) * 100);
            const isDraggingThis = draggingJobId === job.id;
            const off = liveOffsets[job.id];

            // Staff assigned to this job
            const assignedNames = staff
              .filter(s => job.assignedStaffIds.includes(s.id))
              .map(s => s.name.split(' ')[0])
              .join(', ');

            // Dim non-matching rows when a staff filter is active. The row stays
            // rendered (still useful for context) but visually recedes.
            const filterDim = staffFilter && !job.assignedStaffIds.includes(staffFilter);

            return (
              <div key={job.id}
                className={`flex items-stretch border-b border-slate-50 hover:bg-slate-50/40 group transition-opacity ${
                  filterDim ? 'opacity-40 grayscale-[40%]' : ''
                }`}
                style={{ minHeight: 56 }}
              >
                {/* ─ Job label ─ */}
                <div className="w-60 flex-shrink-0 border-r border-slate-100 px-3 py-2 cursor-pointer hover:bg-amber-50/40 transition-colors sticky left-0 bg-white group-hover:bg-amber-50/40 z-10"
                  onClick={() => openJob(job.id)}>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: job.colour }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-slate-800 truncate group-hover:text-amber-700">{job.jobName}</span>
                        {atRisk && <AlertTriangle size={9} className="text-orange-500 flex-shrink-0" />}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{job.clientName}</div>
                      {/* Hours summary inline */}
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex items-center gap-0.5 text-[9px] text-slate-400">
                          <Clock size={8} />
                          <span className={hrs.scheduled < hrs.estimated * 0.85 ? 'text-orange-500 font-semibold' : 'text-slate-400'}>
                            {hrs.scheduled.toFixed(0)}/{hrs.estimated}h
                          </span>
                        </div>
                        <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden max-w-[40px]">
                          <div className="h-full rounded-full" style={{ width: `${prog}%`, backgroundColor: job.colour }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ─ Timeline track ─ */}
                <div className="flex-1 relative"
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                >
                  {/* Weekend shading */}
                  {days.map((day, i) => {
                    const isWknd = day.getDay() === 0 || day.getDay() === 6;
                    if (!isWknd) return null;
                    return (
                      <div key={i} className="absolute top-0 bottom-0 bg-slate-50 pointer-events-none"
                        style={{ left:`${(i/totalDays)*100}%`, width:`${(1/totalDays)*100}%` }} />
                    );
                  })}

                  {/* Trade school indicators for assigned apprentices */}
                  {days.map((day, i) => {
                    const dateStr = toDateString(day);
                    const tsEvents = staffEvents.filter(ev =>
                      ev.type === 'tradeSchool' &&
                      ev.date === dateStr &&
                      job.assignedStaffIds.includes(ev.staffId)
                    );
                    if (!tsEvents.length) return null;
                    return (
                      <div key={`ts-${i}`} className="absolute top-0 bottom-0 pointer-events-none"
                        style={{ left:`${(i/totalDays)*100}%`, width:`${(1/totalDays)*100}%` }}>
                        <div className="absolute inset-0 bg-indigo-100 opacity-70 border-r border-indigo-200" />
                        <div className="absolute bottom-0.5 left-0 right-0 text-center">
                          <span className="text-[7px] text-indigo-500 font-bold">TS</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Today line */}
                  <div className="absolute top-0 bottom-0 w-px bg-amber-400 opacity-70 z-10 pointer-events-none"
                    style={{ left:`${todayPct}%` }} />

                  {/* ─ Job bar ─ */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`${job.jobName}: ${formatDay(fromDate(job.startDate))} to ${formatDay(fromDate(job.deadline))}`}
                    aria-roledescription="Schedule bar. Arrow keys move, Shift moves a week, Alt+arrows resize the deadline, Enter opens."
                    onKeyDown={e => handleKeyDown(e, job)}
                    className={`absolute top-1/2 -translate-y-1/2 h-9 rounded-lg flex items-center overflow-visible z-20 outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 ${isDraggingThis ? 'scale-[1.015]' : ''}`}
                    style={{
                      ...style,
                      backgroundColor: job.colour + '1a',
                      border: `2px solid ${job.colour}`,
                      boxShadow: isDraggingThis
                        ? `0 8px 28px ${job.colour}66, 0 2px 8px rgba(0,0,0,.12)`
                        : `0 1px 4px ${job.colour}33`,
                      cursor: isDraggingThis ? 'grabbing' : 'default',
                      zIndex: isDraggingThis ? 30 : 5,
                      transition: isDraggingThis ? 'none' : 'box-shadow .2s, left .25s ease, width .25s ease, transform .15s ease',
                    }}
                  >
                    {/* Progress fill */}
                    <div className="absolute left-0 top-0 bottom-0 rounded-l-lg opacity-40"
                      style={{ width:`${prog}%`, backgroundColor: job.colour }} />

                    {/* Left resize handle */}
                    <div className="absolute left-0 top-0 bottom-0 w-4 cursor-w-resize z-30 flex items-center justify-center rounded-l-lg hover:bg-white/50 transition-colors group/lh"
                      onPointerDown={e => startDrag(e, job, 'resize-left')}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      aria-hidden="true"
                    >
                      <div className="flex gap-[2px] opacity-40 group-hover/lh:opacity-100 transition-opacity">
                        <span className="w-[2px] h-3 rounded-full" style={{ backgroundColor: job.colour }} />
                        <span className="w-[2px] h-3 rounded-full" style={{ backgroundColor: job.colour }} />
                      </div>
                    </div>

                    {/* Centre drag + click */}
                    <div className="flex-1 flex items-center gap-1 cursor-grab active:cursor-grabbing px-3 min-w-0 z-20"
                      onPointerDown={e => startDrag(e, job, 'move')}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onDoubleClick={() => openJob(job.id)}
                    >
                      <GripHorizontal size={9} style={{ color: job.colour, opacity: 0.6, flexShrink: 0 }} />
                      <span className="flex-1 text-[9px] font-bold truncate" style={{ color: job.colour }}>
                        {job.jobName}
                      </span>
                      {/* Staff chips — colored circle with the staff's initial(s).
                          Each chip is wrapped in StaffHoverCard for a rich detail
                          popover. pointerdown still bubbles to the parent drag
                          handler, so the bar remains fully draggable. */}
                      {(() => {
                        const assigned = staff.filter(s => getAllJobStaffIds(job).includes(s.id));
                        const visible = assigned.slice(0, 3);
                        const extra = assigned.length - visible.length;
                        if (assigned.length === 0) return null;
                        return (
                          <div className="flex items-center flex-shrink-0">
                            {visible.map(s => (
                              <StaffHoverCard key={s.id} staff={s}>
                                <span
                                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full ring-1 ring-white text-[7px] font-bold text-white -ml-0.5 first:ml-0 tabular-nums cursor-help"
                                  style={{ backgroundColor: s.colour }}
                                >
                                  {initials[s.id] ?? s.name[0]}
                                </span>
                              </StaffHoverCard>
                            ))}
                            {extra > 0 && (
                              <StaffListHoverCard
                                staffList={assigned.slice(3)}
                                heading={`+${extra} more on ${job.jobName}`}
                              >
                                <span
                                  className="ml-1 inline-flex items-center justify-center px-1 h-3.5 rounded-full bg-white/80 text-[8px] font-bold ring-1 ring-white cursor-help"
                                  style={{ color: job.colour }}
                                >
                                  +{extra}
                                </span>
                              </StaffListHoverCard>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Right resize handle */}
                    <div className="absolute right-0 top-0 bottom-0 w-4 cursor-e-resize z-30 flex items-center justify-center rounded-r-lg hover:bg-white/50 transition-colors group/rh"
                      onPointerDown={e => startDrag(e, job, 'resize-right')}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      aria-hidden="true"
                    >
                      <div className="flex gap-[2px] opacity-40 group-hover/rh:opacity-100 transition-opacity">
                        <span className="w-[2px] h-3 rounded-full" style={{ backgroundColor: job.colour }} />
                        <span className="w-[2px] h-3 rounded-full" style={{ backgroundColor: job.colour }} />
                      </div>
                    </div>
                  </div>

                  {/* Live date readout while dragging — resulting dates, not just a delta */}
                  {isDraggingThis && off && (off.start !== 0 || off.end !== 0) && (() => {
                    const dmode = off.start !== 0 && off.end !== 0 ? 'move' : off.start !== 0 ? 'resize-left' : 'resize-right';
                    const delta = off.start || off.end;
                    const res = applyDelta(job, dmode, delta);
                    const sign = delta > 0 ? '+' : '';
                    return (
                      <div className="absolute z-40 pointer-events-none flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-md text-white shadow-lg whitespace-nowrap"
                        style={{ left: style.left, top: '-28px', backgroundColor: res.clamped ? '#e11d48' : job.colour }}>
                        <span>{formatDay(fromDate(res.startDate))} → {formatDay(fromDate(res.deadline))}</span>
                        <span className="opacity-80 tabular-nums">{res.clamped ? 'min 1 day' : `${sign}${delta}d`}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}

          {activeJobs.length === 0 && (
            <div className="py-16 text-center text-slate-400 text-sm">
              No active jobs. Add a job to see it on the timeline.
            </div>
          )}

          {/* ── Per-staff allocation strip (Layer B) ── */}
          <StaffAllocationLayer
            days={days}
            totalDays={totalDays}
            scheduleEntries={scheduleEntries}
            jobs={jobs}
            staff={staff}
            staffEvents={staffEvents}
          />
        </div>
      </div>
    </div>
  );
}

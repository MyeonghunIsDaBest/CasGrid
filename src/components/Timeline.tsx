// @ts-nocheck
import { useMemo, useRef, useState } from 'react';
import { addDays, format, differenceInCalendarDays, isBefore, isAfter } from 'date-fns';
import { useApp } from '../context/AppContext';
import { useJobModal } from '../context/JobModalContext';
import { toDateString, isToday } from '../utils/dateUtils';
import { isJobAtRisk } from '../utils/schedulingEngine';
import { AlertTriangle, GripHorizontal, Clock, Users } from 'lucide-react';

const DAYS_TO_SHOW = 49; // 7 weeks

export function Timeline() {
  const { state, updateJob } = useApp();
  const { openJob } = useJobModal();
  const { jobs, staff, scheduleEntries, staffEvents } = state;

  const today = useMemo(() => new Date(), []);
  const days = useMemo(
    () => Array.from({ length: DAYS_TO_SHOW }, (_, i) => addDays(today, i - 7)),
    []
  );

  const trackRef = useRef(null);
  const dragRef = useRef(null);
  const [draggingJobId, setDraggingJobId] = useState(null);
  const [liveOffsets, setLiveOffsets] = useState({});
  const [isDragging, setIsDragging] = useState(false);

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
    setIsDragging(true);
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
        const origS = fromDate(d.origStart);
        const origE = fromDate(d.origEnd);
        let newStart = d.origStart, newEnd = d.origEnd;
        if (d.mode === 'move') {
          newStart = toDateString(addDays(origS, delta));
          newEnd = toDateString(addDays(origE, delta));
        } else if (d.mode === 'resize-left') {
          const c = toDateString(addDays(origS, delta));
          if (c < d.origEnd) newStart = c;
        } else {
          const c = toDateString(addDays(origE, delta));
          if (c > d.origStart) newEnd = c;
        }
        updateJob({ ...job, startDate: newStart, deadline: newEnd });
      }
    }
    dragRef.current = null;
    setDraggingJobId(null);
    setLiveOffsets({});
    setTimeout(() => setIsDragging(false), 50);
  }

  const activeJobs = jobs.filter(j => j.status !== 'completed');
  const todayPct = dateToPct(today);

  // ─── Per-job hours summary ───
  function getJobHours(jobId) {
    const scheduled = scheduleEntries.filter(e => e.jobId === jobId).reduce((s,e) => s+e.hours, 0);
    const job = jobs.find(j => j.id === jobId);
    return { scheduled, estimated: job?.estimatedHours ?? 0, remaining: job?.remainingHours ?? 0 };
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

      <div className="overflow-x-auto">
        <div className="min-w-[780px]">

          {/* ── Week header ── */}
          <div className="flex border-b border-slate-100">
            <div className="w-60 flex-shrink-0 border-r border-slate-100 px-3 py-1.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
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
            <div className="w-60 flex-shrink-0 border-r border-slate-100 bg-slate-50" />
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

            return (
              <div key={job.id}
                className="flex items-stretch border-b border-slate-50 hover:bg-slate-50/40 group"
                style={{ minHeight: 56 }}
              >
                {/* ─ Job label ─ */}
                <div className="w-60 flex-shrink-0 border-r border-slate-100 px-3 py-2 cursor-pointer hover:bg-amber-50/40 transition-colors"
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
                  <div className="absolute top-1/2 -translate-y-1/2 h-9 rounded-lg flex items-center overflow-visible z-20"
                    style={{
                      ...style,
                      backgroundColor: job.colour + '1a',
                      border: `2px solid ${job.colour}`,
                      boxShadow: isDraggingThis
                        ? `0 8px 28px ${job.colour}66, 0 2px 8px rgba(0,0,0,.12)`
                        : `0 1px 4px ${job.colour}33`,
                      cursor: isDraggingThis ? 'grabbing' : 'default',
                      zIndex: isDraggingThis ? 30 : 5,
                      transition: isDraggingThis ? 'none' : 'box-shadow 0.2s',
                    }}
                  >
                    {/* Progress fill */}
                    <div className="absolute left-0 top-0 bottom-0 rounded-l-lg opacity-40"
                      style={{ width:`${prog}%`, backgroundColor: job.colour }} />

                    {/* Left resize handle */}
                    <div className="absolute left-0 top-0 bottom-0 w-3 cursor-w-resize z-30 flex items-center justify-center rounded-l-lg hover:bg-white/40 group/l"
                      onPointerDown={e => startDrag(e, job, 'resize-left')}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="w-0.5 h-2.5 rounded-full opacity-50" style={{ backgroundColor: job.colour }} />
                      </div>
                    </div>

                    {/* Centre drag + click */}
                    <div className="flex-1 flex items-center justify-center gap-1 cursor-grab active:cursor-grabbing px-3 min-w-0 z-20"
                      onPointerDown={e => startDrag(e, job, 'move')}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onClick={() => { if (!isDragging) openJob(job.id); }}
                    >
                      <GripHorizontal size={9} style={{ color: job.colour, opacity: 0.6, flexShrink: 0 }} />
                      <span className="text-[9px] font-bold truncate" style={{ color: job.colour }}>
                        {job.jobName}
                      </span>
                    </div>

                    {/* Right resize handle */}
                    <div className="absolute right-0 top-0 bottom-0 w-3 cursor-e-resize z-30 flex items-center justify-center rounded-r-lg hover:bg-white/40"
                      onPointerDown={e => startDrag(e, job, 'resize-right')}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                    >
                      <div className="w-0.5 h-2.5 rounded-full opacity-50" style={{ backgroundColor: job.colour }} />
                    </div>
                  </div>

                  {/* Drag delta tooltip */}
                  {isDraggingThis && off && (off.start !== 0 || off.end !== 0) && (
                    <div className="absolute top-1 z-40 pointer-events-none text-[9px] font-bold px-1.5 py-0.5 rounded text-white shadow-lg"
                      style={{ left: style.left, backgroundColor: job.colour }}>
                      {(off.start || off.end) > 0 ? '+' : ''}{off.start || off.end}d
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {activeJobs.length === 0 && (
            <div className="py-16 text-center text-slate-400 text-sm">
              No active jobs. Add a job to see it on the timeline.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// @ts-nocheck
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useJobModal } from '../context/JobModalContext';
import { getWeekWorkingDays, toDateString, formatDayShort, formatDayNum, isToday } from '../utils/dateUtils';
import { computeDailyLoads, getUtilisationBgClass, getEffectiveAvailable, generateId } from '../utils/schedulingEngine';
import { LiveBadge } from './LiveBadge';
import { WeeklyPlannerCellEditor } from './WeeklyPlannerCellEditor';
import { useNow } from '../utils/useNow';
import { getRunningTimeMs, formatRunningTime } from '../utils/runningTime';

export function WeeklyPlanner() {
  const { state, updateSettings, updateScheduleEntry, deleteScheduleEntry } = useApp();
  const { openJob } = useJobModal();
  const { staff, jobs, scheduleEntries, staffEvents, settings } = state;

  const weekOffset = settings.currentWeekOffset;
  const days = getWeekWorkingDays(weekOffset);
  const dayStrings = days.map(toDateString);
  const billableStaff = staff.filter(s => s.active && s.isBillable);
  const dailyLoads = computeDailyLoads(dayStrings, billableStaff, scheduleEntries, jobs, staffEvents);

  // Tick every second so the Week-column live running-time counter advances
  // visibly while any of the staff's assigned jobs are in a running state.
  const now = useNow(1000);

  // For a given staff: sum of getRunningTimeMs(job, now) across every job
  // the staff is assigned to that's currently in an active status with a
  // running clock. Capped at their week's scheduled hours so the number
  // doesn't pass what was planned.
  function liveRunningMsFor(member: typeof billableStaff[number], capHours: number) {
    const capMs = capHours * 3_600_000;
    let acc = 0;
    for (const j of jobs) {
      if (j.status === 'completed' || j.status === 'onHold') continue;
      if (!j.assignedStaffIds.includes(member.id)) continue;
      acc += getRunningTimeMs(j, new Date(now));
    }
    return Math.min(acc, capMs);
  }

  // The popover editor — one instance, switches target cell as the user
  // clicks around. `anchor` is screen-space so the popover follows scroll.
  const [editorCell, setEditorCell] = useState<{
    date: string;
    staffId: string;
    initial: { originalId?: string; jobId: string; hours: number }[];
    anchor: { top: number; left: number } | null;
  } | null>(null);

  const weekLabel = days.length > 0
    ? `Week of ${days[0].toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : '';

  function getCellEntries(date, staffId) {
    return scheduleEntries.filter(e => e.date === date && e.staffId === staffId &&
      !jobs.find(j => j.id === e.jobId && j.status === 'completed'));
  }

  function getCellHours(date, staffId) {
    return getCellEntries(date, staffId).reduce((s, e) => s + e.hours, 0);
  }

  function openCellEditor(e, date, staffId) {
    const rect = e.currentTarget.getBoundingClientRect();
    const initial = getCellEntries(date, staffId).map(en => ({
      originalId: en.id, jobId: en.jobId, hours: en.hours,
    }));
    setEditorCell({
      date,
      staffId,
      initial,
      anchor: { top: rect.bottom + 4, left: rect.left },
    });
  }

  // Replace-all-in-cell: delete every existing entry in the cell (manual or
  // auto), then insert one manual entry per non-zero row. This fixes all
  // four cell-edit bugs at once (silent fail / multi-job collapse / dup /
  // zero-doesn't-clear).
  function commitCellEntries(
    date: string,
    staffId: string,
    rows: { jobId: string; hours: number }[],
    overtime: boolean,
  ) {
    const existing = scheduleEntries.filter(
      e => e.date === date && e.staffId === staffId,
    );
    existing.forEach(en => deleteScheduleEntry(en.id));

    rows
      .filter(r => r.hours > 0 && r.jobId)
      .forEach(r => {
        updateScheduleEntry({
          id: generateId(),
          jobId: r.jobId,
          staffId,
          date,
          hours: r.hours,
          isManualOverride: true,
          isOvertime: overtime,
        });
      });

    setEditorCell(null);
  }

  const editorStaff = editorCell ? staff.find(s => s.id === editorCell.staffId) : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-800 text-sm">Weekly Planner</h2>
            <LiveBadge compact />
          </div>
          <p className="text-xs text-slate-500">{weekLabel} · click a cell to allocate hours · 🎓 = trade school</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => updateSettings({ currentWeekOffset: weekOffset - 1 })}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"><ChevronLeft size={16}/></button>
          <button onClick={() => updateSettings({ currentWeekOffset: 0 })}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">Today</button>
          <button onClick={() => updateSettings({ currentWeekOffset: weekOffset + 1 })}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"><ChevronRight size={16}/></button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-3 text-slate-500 font-medium w-40">Staff</th>
              {days.map(day => (
                <th key={toDateString(day)}
                  className={`py-2 px-1 text-center font-medium ${isToday(day) ? 'text-amber-600' : 'text-slate-500'}`}>
                  <div className="text-[9px] font-semibold">{formatDayShort(day)}</div>
                  <div className={`text-sm font-bold ${isToday(day) ? 'text-amber-600' : 'text-slate-800'}`}>
                    {formatDayNum(day)}
                  </div>
                </th>
              ))}
              <th className="py-2 px-3 text-center text-slate-500 font-medium">Week</th>
            </tr>
          </thead>
          <tbody>
            {billableStaff.map(member => {
              const weekTotal = dayStrings.reduce((s, d) => s + getCellHours(d, member.id), 0);
              const weekAvail = dayStrings.reduce((s, d) => s + getEffectiveAvailable(member, d, staffEvents), 0);
              const weekRatio = weekAvail > 0 ? weekTotal / weekAvail : weekTotal > 0 ? 1.5 : 0;
              const weekDotClass = getUtilisationBgClass(weekRatio);

              return (
                <tr key={member.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: member.colour }}/>
                      <div>
                        <div className="font-semibold text-slate-800 text-xs">{member.name}</div>
                        <div className="text-slate-400 text-[9px]">{member.role}{member.isApprentice ? ' 🎓' : ''}</div>
                      </div>
                    </div>
                  </td>

                  {days.map(day => {
                    const dateStr = toDateString(day);
                    const hours = getCellHours(dateStr, member.id);
                    const avail = getEffectiveAvailable(member, dateStr, staffEvents);
                    const ratio = avail > 0 ? hours / avail : hours > 0 ? 1.5 : 0;
                    const cellEntries = getCellEntries(dateStr, member.id);
                    // Approved overtime reads as calm amber, not alarming red.
                    const isOT = cellEntries.some(e => e.isOvertime);
                    const utilBg = isOT && ratio > 1.0001 ? 'bg-amber-500' : getUtilisationBgClass(ratio);

                    // Check for staff events on this day
                    const dayEvents = staffEvents.filter(ev => ev.staffId === member.id && ev.date === dateStr);
                    const isFullDay = dayEvents.some(ev => ev.hours >= 8);
                    const isPartialBlock = !isFullDay && dayEvents.length > 0;

                    if (isFullDay) {
                      const ev = dayEvents[0];
                      return (
                        <td key={dateStr} className={`py-1 px-1 text-center ${isToday(day) ? 'bg-amber-50/40' : ''}`}>
                          <div className="rounded-md px-1 py-1.5 flex flex-col items-center gap-0.5"
                            style={{ backgroundColor: ev.colour + '22', border: `1px solid ${ev.colour}44` }}
                            title={`${ev.label || ev.type} · ${ev.hours}h blocked`}>
                            <span className="text-[8px] font-bold" style={{ color: ev.colour }}>
                              {ev.type === 'tradeSchool' ? '🎓' : ev.type === 'leave' ? '🌴' : ev.type === 'sick' ? '🤒' : '📅'}
                            </span>
                            <span className="text-[7px] font-semibold" style={{ color: ev.colour }}>
                              {ev.type === 'tradeSchool' ? 'TAFE' : ev.type.slice(0,4).toUpperCase()}
                            </span>
                          </div>
                        </td>
                      );
                    }

                    // Build the cell tooltip from current entries.
                    const cellTitle = cellEntries.length > 0
                      ? cellEntries.map(e => {
                          const j = jobs.find(jb => jb.id === e.jobId);
                          return `${j?.jobName ?? 'Job'} · ${e.hours}h`;
                        }).join(' · ')
                      : 'Click to allocate hours';

                    return (
                      <td key={dateStr} className={`py-1 px-1 text-center ${isToday(day) ? 'bg-amber-50/40' : ''}`}>
                        <div className="group relative" title={cellTitle}>
                          {hours > 0 ? (
                            <button
                              onClick={e => openCellEditor(e, dateStr, member.id)}
                              className="w-full"
                            >
                              <div className="flex gap-0.5 justify-center mb-0.5">
                                {cellEntries.slice(0, 4).map(entry => {
                                  const j = jobs.find(jb => jb.id === entry.jobId);
                                  return (
                                    <span key={entry.id}
                                      className="h-1 rounded-full flex-1 max-w-[10px]"
                                      style={{ backgroundColor: j?.colour ?? '#94a3b8' }}
                                    />
                                  );
                                })}
                              </div>
                              <div
                                className={`inline-flex items-center justify-center w-9 h-6 rounded-md text-white text-[10px] font-bold hover:opacity-80 ${utilBg}`}
                              >
                                {hours % 1 === 0 ? hours : hours.toFixed(1)}h
                              </div>
                              {isOT && (
                                <div className="text-[7px] text-amber-600 font-bold mt-0.5">OT</div>
                              )}
                              {isPartialBlock && (
                                <div className="text-[7px] text-amber-500 font-bold mt-0.5">partial</div>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={e => openCellEditor(e, dateStr, member.id)}
                              className="inline-flex items-center justify-center w-9 h-6 rounded-md text-slate-300 text-[10px] border border-dashed border-slate-200 group-hover:border-amber-300 group-hover:text-amber-400"
                            >—</button>
                          )}
                        </div>
                      </td>
                    );
                  })}

                  <td className="py-1.5 px-3 text-center">
                    {(() => {
                      const liveMs = liveRunningMsFor(member, weekTotal);
                      const hasSchedule = weekTotal > 0;
                      const hasLive = liveMs > 0;
                      return (
                        <>
                          {/* Top line: live running-time counter for this staff,
                              capped at their weekly scheduled hours. Ticks every
                              second while any of their assigned jobs is active. */}
                          <div className="flex items-center justify-center gap-1.5">
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full ${
                                hasLive ? 'bg-emerald-500 animate-pulse' : weekDotClass
                              }`}
                              aria-hidden
                            />
                            <div
                              className={`text-xs font-bold tabular-nums ${
                                hasLive ? 'text-emerald-600' : hasSchedule ? 'text-slate-700' : 'text-slate-400'
                              }`}
                              title={hasLive ? 'Live running-time across this staff\'s active jobs (capped at their weekly schedule)' : undefined}
                            >
                              {hasSchedule ? formatRunningTime(liveMs) : '—'}
                            </div>
                          </div>
                          <div className="text-[9px] text-slate-400 tabular-nums">
                            of {Math.round(weekTotal * 10) / 10}h scheduled
                          </div>
                          <div className="text-[8px] text-slate-300 tabular-nums">
                            {weekAvail.toFixed(0)}h available
                          </div>
                          {weekAvail < member.dailyAvailableHours * days.length && (
                            <div className="text-[8px] text-indigo-500 font-bold">-events</div>
                          )}
                        </>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {billableStaff.length === 0 && (
        <div className="py-12 text-center text-slate-400 text-sm">No active billable staff.</div>
      )}

      {/* Per-cell editor popover */}
      {editorCell && editorStaff && (
        <WeeklyPlannerCellEditor
          date={editorCell.date}
          staff={editorStaff}
          initialRows={editorCell.initial}
          jobs={jobs}
          staffEvents={staffEvents}
          anchor={editorCell.anchor}
          onCommit={(rows, overtime) => commitCellEntries(editorCell.date, editorCell.staffId, rows, overtime)}
          onClose={() => setEditorCell(null)}
        />
      )}
    </div>
  );
}

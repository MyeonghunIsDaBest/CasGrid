// @ts-nocheck
/**
 * DailyStaffAssignment
 * Shows a grid: rows = working days of the job, columns = all eligible staff.
 * User can toggle which staff work on which day.
 * Changes are stored in job.dailyStaffOverrides and trigger re-schedule.
 */
import { useEffect, useRef } from 'react';
import { addDays, format } from 'date-fns';
import { useApp } from '../context/AppContext';
import { getWorkingDays, toDateString, fromDateString } from '../utils/dateUtils';
import { Users, Info, RotateCcw } from 'lucide-react';

export function DailyStaffAssignment({ job, onClose }) {
  const { state, updateJobNoReschedule, runAutoSchedule } = useApp();
  const { staff, staffEvents } = state;

  const eligibleStaff = staff.filter(s => s.active && s.isBillable);
  const workDays = getWorkingDays(fromDateString(job.startDate), fromDateString(job.deadline));

  // Autosave: every toggle persists + realtime-syncs immediately via
  // updateJobNoReschedule (reads the live job, no local buffer). The heavier
  // re-schedule is deferred to run once when this view unmounts (Done / X / tab
  // switch), so ticking several staff doesn't recompute hours on every click.
  const runAutoScheduleRef = useRef(runAutoSchedule);
  useEffect(() => { runAutoScheduleRef.current = runAutoSchedule; });
  const dirtyRef = useRef(false);
  useEffect(() => () => { if (dirtyRef.current) runAutoScheduleRef.current(); }, []);

  function getStaffForDay(dateStr) {
    return job.dailyStaffOverrides?.[dateStr] ?? job.assignedStaffIds;
  }

  function toggleStaffOnDay(dateStr, staffId) {
    const current = getStaffForDay(dateStr);
    const next = current.includes(staffId)
      ? current.filter(id => id !== staffId)
      : [...current, staffId];
    // If next equals job.assignedStaffIds exactly, drop the override.
    const isDefault = next.length === job.assignedStaffIds.length &&
      next.every(id => job.assignedStaffIds.includes(id));
    const updated = { ...job.dailyStaffOverrides };
    if (isDefault) delete updated[dateStr];
    else updated[dateStr] = next;
    dirtyRef.current = true;
    updateJobNoReschedule({ ...job, dailyStaffOverrides: updated });
  }

  function clearDayOverride(dateStr) {
    const updated = { ...job.dailyStaffOverrides };
    delete updated[dateStr];
    dirtyRef.current = true;
    updateJobNoReschedule({ ...job, dailyStaffOverrides: updated });
  }

  function getEventForDay(staffId, dateStr) {
    return staffEvents.find(e => e.staffId === staffId && e.date === dateStr);
  }

  // How many days each staff member is scheduled
  function getStaffDayCount(staffId) {
    return workDays.filter(d => {
      const dateStr = toDateString(d);
      return getStaffForDay(dateStr).includes(staffId);
    }).length;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
        <Info size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-700">
          Toggle which staff work on each day. Days without an override use the job's default assigned staff.
          Trade school days are highlighted — staff are automatically excluded.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="text-[10px] w-full min-w-max">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 pr-3 text-slate-500 font-semibold w-28 sticky left-0 bg-white">Day</th>
              {eligibleStaff.map(s => (
                <th key={s.id} className="text-center px-1.5 py-2 font-medium min-w-[52px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-5 h-5 rounded-full text-white text-[8px] font-bold flex items-center justify-center"
                      style={{ backgroundColor: s.colour }}>
                      {s.name[0]}
                    </div>
                    <div className="text-slate-600 text-[9px] whitespace-nowrap">{s.name.split(' ')[0]}</div>
                    <div className={`text-[8px] font-semibold ${s.isApprentice ? 'text-indigo-500' : 'text-slate-400'}`}>
                      {s.isApprentice ? 'App.' : s.role.split(' ').slice(-1)[0]}
                    </div>
                    <div className="text-[8px] text-slate-400">{getStaffDayCount(s.id)}d</div>
                  </div>
                </th>
              ))}
              <th className="px-2 text-slate-400 font-normal">Reset</th>
            </tr>
          </thead>
          <tbody>
            {workDays.map(day => {
              const dateStr = toDateString(day);
              const dayStaff = getStaffForDay(dateStr);
              const hasOverride = job.dailyStaffOverrides?.[dateStr] !== undefined;
              const dayName = format(day, 'EEE d MMM');

              return (
                <tr key={dateStr}
                  className={`border-b border-slate-50 ${hasOverride ? 'bg-amber-50/30' : ''}`}>
                  <td className="py-2 pr-3 sticky left-0 bg-inherit">
                    <div className={`font-semibold ${hasOverride ? 'text-amber-700' : 'text-slate-700'}`}>
                      {dayName}
                    </div>
                    {hasOverride && (
                      <div className="text-[8px] text-amber-500 font-medium">overridden</div>
                    )}
                  </td>
                  {eligibleStaff.map(s => {
                    const ev = getEventForDay(s.id, dateStr);
                    const isBlocked = ev && ev.hours >= 8;
                    const isOn = !isBlocked && dayStaff.includes(s.id);

                    return (
                      <td key={s.id} className="text-center px-1.5 py-2">
                        {isBlocked ? (
                          <div className="w-6 h-6 mx-auto rounded flex items-center justify-center bg-indigo-100"
                            title={ev.label}>
                            <span className="text-[7px] font-bold text-indigo-500">TS</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => toggleStaffOnDay(dateStr, s.id)}
                            className={`w-6 h-6 mx-auto rounded border-2 flex items-center justify-center transition-all
                              ${isOn
                                ? 'border-transparent text-white scale-110'
                                : 'border-slate-200 bg-white text-slate-300 hover:border-slate-300'
                              }`}
                            style={isOn ? { backgroundColor: s.colour, borderColor: s.colour } : {}}
                            title={`${isOn ? 'Remove' : 'Add'} ${s.name}`}
                          >
                            {isOn ? (
                              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                            ) : (
                              <span className="text-[9px]">+</span>
                            )}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-center px-2">
                    {hasOverride && (
                      <button onClick={() => clearDayOverride(dateStr)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                        title="Reset to default">
                        <RotateCcw size={10} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="text-xs text-slate-500">
          {Object.keys(job.dailyStaffOverrides ?? {}).length} day{Object.keys(job.dailyStaffOverrides ?? {}).length !== 1 ? 's' : ''} with custom staff · <span className="text-emerald-600 font-medium">saved automatically</span>
        </div>
        <button onClick={onClose}
          className="px-4 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700">
          Done
        </button>
      </div>
    </div>
  );
}

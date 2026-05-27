// @ts-nocheck
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Edit2, X, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useJobModal } from '../context/JobModalContext';
import { getWeekWorkingDays, toDateString, formatDayShort, formatDayNum, formatMonthYear, isToday } from '../utils/dateUtils';
import { computeDailyLoads, getUtilisationBgClass, getEffectiveAvailable, generateId } from '../utils/schedulingEngine';

export function WeeklyPlanner() {
  const { state, updateSettings, updateScheduleEntry, deleteScheduleEntry } = useApp();
  const { openJob } = useJobModal();
  const { staff, jobs, scheduleEntries, staffEvents, settings } = state;

  const weekOffset = settings.currentWeekOffset;
  const days = getWeekWorkingDays(weekOffset);
  const dayStrings = days.map(toDateString);
  const billableStaff = staff.filter(s => s.active && s.isBillable);
  const dailyLoads = computeDailyLoads(dayStrings, billableStaff, scheduleEntries, jobs, staffEvents);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');

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

  function commitEdit(date, staffId) {
    const newHours = parseFloat(editValue);
    if (isNaN(newHours) || newHours < 0) { setEditingCell(null); return; }
    const cellEntries = getCellEntries(date, staffId);
    const totalExisting = cellEntries.reduce((s, e) => s + e.hours, 0);
    if (Math.abs(newHours - totalExisting) < 0.01) { setEditingCell(null); return; }
    cellEntries.filter(e => !e.isManualOverride).forEach(e => deleteScheduleEntry(e.id));
    if (newHours > 0) {
      const firstEntry = cellEntries[0];
      if (firstEntry?.jobId) {
        updateScheduleEntry({ id: generateId(), jobId: firstEntry.jobId, staffId, date, hours: newHours, isManualOverride: true });
      }
    }
    setEditingCell(null);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div>
          <h2 className="font-semibold text-slate-800 text-sm">Weekly Planner</h2>
          <p className="text-xs text-slate-500">{weekLabel} · click hours to edit · 🎓 = trade school</p>
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
                    const cellKey = `${dateStr}-${member.id}`;
                    const isEditing = editingCell === cellKey;
                    const cellEntries = getCellEntries(dateStr, member.id);

                    // Check for staff events on this day
                    const dayEvents = staffEvents.filter(ev => ev.staffId === member.id && ev.date === dateStr);
                    const isFullDay = dayEvents.some(ev => ev.hours >= 8);
                    const isPartialBlock = !isFullDay && dayEvents.length > 0;

                    if (isFullDay) {
                      const ev = dayEvents[0];
                      return (
                        <td key={dateStr} className={`py-1 px-1 text-center ${isToday(day) ? 'bg-amber-50/40' : ''}`}>
                          <div className="rounded-md px-1 py-1.5 flex flex-col items-center gap-0.5"
                            style={{ backgroundColor: ev.colour + '22', border: `1px solid ${ev.colour}44` }}>
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

                    return (
                      <td key={dateStr} className={`py-1 px-1 text-center ${isToday(day) ? 'bg-amber-50/40' : ''}`}>
                        {isEditing ? (
                          <div className="flex items-center gap-0.5 justify-center">
                            <input type="number" value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              className="w-11 border border-amber-400 rounded text-center text-xs py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') commitEdit(dateStr, member.id);
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                            />
                            <button onClick={() => commitEdit(dateStr, member.id)}><Check size={11} className="text-green-600"/></button>
                            <button onClick={() => setEditingCell(null)}><X size={11} className="text-red-400"/></button>
                          </div>
                        ) : (
                          <div className="group relative">
                            {hours > 0 ? (
                              <div>
                                <div className="flex gap-0.5 justify-center mb-0.5">
                                  {cellEntries.slice(0, 4).map(entry => {
                                    const j = jobs.find(jb => jb.id === entry.jobId);
                                    return (
                                      <div key={entry.id}
                                        className="h-1 rounded-full flex-1 max-w-[10px] cursor-pointer hover:opacity-70"
                                        style={{ backgroundColor: j?.colour ?? '#94a3b8' }}
                                        title={j?.jobName}
                                        onClick={() => j && openJob(j.id)}
                                      />
                                    );
                                  })}
                                </div>
                                <div
                                  className={`inline-flex items-center justify-center w-9 h-6 rounded-md text-white text-[10px] font-bold cursor-pointer hover:opacity-80 ${getUtilisationBgClass(ratio)}`}
                                  onClick={() => { setEditingCell(cellKey); setEditValue(String(hours)); }}
                                  title="Click to edit hours"
                                >
                                  {hours % 1 === 0 ? hours : hours.toFixed(1)}h
                                </div>
                                {isPartialBlock && (
                                  <div className="text-[7px] text-amber-500 font-bold mt-0.5">partial</div>
                                )}
                              </div>
                            ) : (
                              <div
                                className="inline-flex items-center justify-center w-9 h-6 rounded-md text-slate-300 text-[10px] border border-dashed border-slate-200 group-hover:border-amber-300 group-hover:text-amber-400 cursor-pointer"
                                onClick={() => { setEditingCell(cellKey); setEditValue('0'); }}
                              >—</div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}

                  <td className="py-1.5 px-3 text-center">
                    <div className="text-xs font-bold text-slate-700">{Math.round(weekTotal*10)/10}h</div>
                    <div className="text-[9px] text-slate-400">/ {weekAvail.toFixed(0)}h</div>
                    {weekAvail < member.dailyAvailableHours * days.length && (
                      <div className="text-[8px] text-indigo-500 font-bold">-events</div>
                    )}
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
    </div>
  );
}

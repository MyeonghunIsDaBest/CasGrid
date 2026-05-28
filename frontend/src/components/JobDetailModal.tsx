// @ts-nocheck
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Edit2, CheckCircle, PauseCircle, Trash2, Clock,
  Calendar, Users, AlertTriangle, ChevronRight, CalendarDays, BarChart2
} from 'lucide-react';
import { differenceInCalendarDays, addDays } from 'date-fns';
import { useApp } from '../context/AppContext';
import { useJobModal } from '../context/JobModalContext';
import { JobForm } from './forms/JobForm';
import { DailyStaffAssignment } from './DailyStaffAssignment';
import { isJobAtRisk, getEffectiveAvailable, getRemainingHours } from '../utils/schedulingEngine';
import { fromDateString, toDateString, getWorkingDays } from '../utils/dateUtils';
import { format } from 'date-fns';

const STATUS_COLOURS = {
  unscheduled: 'bg-slate-100 text-slate-600', scheduled: 'bg-sky-100 text-sky-700',
  inProgress: 'bg-indigo-100 text-indigo-700', completed: 'bg-emerald-100 text-emerald-700',
  onHold: 'bg-amber-100 text-amber-700',
};
const STATUS_LABELS = {
  unscheduled: 'Unscheduled', scheduled: 'Scheduled', inProgress: 'In Progress',
  completed: 'Completed', onHold: 'On Hold',
};
const PRIORITY_COLOURS = {
  low: 'bg-slate-100 text-slate-500', medium: 'bg-sky-100 text-sky-700',
  high: 'bg-orange-100 text-orange-700', urgent: 'bg-red-100 text-red-700',
};

type Panel = 'overview' | 'dailyStaff' | 'hoursBreakdown';

export function JobDetailModal() {
  const { state, updateJob, deleteJob } = useApp();
  const { selectedJobId, closeJob } = useJobModal();
  const [showEditForm, setShowEditForm] = useState(false);
  const [activePanel, setActivePanel] = useState<Panel>('overview');

  const job = state.jobs.find(j => j.id === selectedJobId);
  if (!job) return null;

  const { staff, scheduleEntries, staffEvents } = state;
  const assignedStaff = staff.filter(s => job.assignedStaffIds.includes(s.id));
  const jobEntries = scheduleEntries.filter(e => e.jobId === job.id);
  const scheduledHours = jobEntries.reduce((s, e) => s + e.hours, 0);
  const remainingHours = getRemainingHours(job, scheduleEntries);
  const progressPct = Math.min(100, Math.round((scheduledHours / Math.max(job.estimatedHours, 1)) * 100));
  const atRisk = isJobAtRisk(job, scheduleEntries, staff);
  const daysLeft = differenceInCalendarDays(fromDateString(job.deadline), new Date());

  const workDays = getWorkingDays(fromDateString(job.startDate), fromDateString(job.deadline));

  // Per-staff hours breakdown
  const staffHoursMap = {};
  for (const s of assignedStaff) {
    staffHoursMap[s.id] = jobEntries.filter(e => e.staffId === s.id).reduce((sum, e) => sum + e.hours, 0);
  }

  // Total available staff-hours for this job window
  const totalStaffAvailable = workDays.reduce((sum, day) => {
    const dateStr = toDateString(day);
    // Use daily overrides if present
    const dayStaffIds = job.dailyStaffOverrides[dateStr] ?? job.assignedStaffIds;
    return sum + dayStaffIds.reduce((s, staffId) => {
      const staffMember = staff.find(sm => sm.id === staffId);
      if (!staffMember) return s;
      return s + getEffectiveAvailable(staffMember, dateStr, staffEvents);
    }, 0);
  }, 0);

  const allocUtilisation = totalStaffAvailable > 0 ? (scheduledHours / totalStaffAvailable) : 0;

  // Per-day hours for mini-grid (first 14 working days)
  const displayDays = workDays.slice(0, 14);
  const staffDayHours = {};
  for (const s of assignedStaff) {
    staffDayHours[s.id] = {};
    for (const d of displayDays) staffDayHours[s.id][toDateString(d)] = 0;
  }
  for (const entry of jobEntries) {
    if (staffDayHours[entry.staffId]?.[entry.date] !== undefined) {
      staffDayHours[entry.staffId][entry.date] += entry.hours;
    }
  }

  function handleDelete() {
    if (confirm(`Delete "${job.jobName}"?`)) { deleteJob(job.id); closeJob(); }
  }

  const panelTabs = [
    { id: 'overview', label: 'Overview', icon: <BarChart2 size={13}/> },
    { id: 'dailyStaff', label: 'Daily Staff', icon: <CalendarDays size={13}/> },
    { id: 'hoursBreakdown', label: 'Hours', icon: <Clock size={13}/> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeJob}
      />
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col z-10"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-slate-100 flex-shrink-0"
          style={{ borderTop: `4px solid ${job.colour}` }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-slate-900 text-base leading-tight">{job.jobName}</h2>
              {atRisk && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                  <AlertTriangle size={10}/> At Risk
                </span>
              )}
              {job.simproJobId && (
                <span className="text-[10px] font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                  Simpro #{job.simproJobId}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{job.clientName}{job.clientEmail ? ` · ${job.clientEmail}` : ''}</p>
          </div>
          <button onClick={closeJob} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 ml-2 flex-shrink-0">
            <X size={16}/>
          </button>
        </div>

        {/* ── Hours at a glance bar ── */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Scheduled vs Estimated */}
            <div className="flex-1 min-w-40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Scheduled / Estimated</span>
                <span className={`text-xs font-bold ${scheduledHours >= job.estimatedHours * 0.85 ? 'text-emerald-600' : 'text-orange-600'}`}>
                  {scheduledHours.toFixed(1)}h / {job.estimatedHours}h
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: progressPct >= 85 ? '#10b981' : progressPct >= 50 ? '#f59e0b' : '#ef4444' }}
                />
              </div>
            </div>
            {/* Available capacity */}
            <div className="text-center">
              <div className="text-base font-bold text-slate-800">{totalStaffAvailable.toFixed(0)}h</div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wide">Total Available</div>
            </div>
            <div className="text-center">
              <div className={`text-base font-bold ${daysLeft < 0 ? 'text-red-600' : daysLeft <= 3 ? 'text-orange-600' : 'text-slate-800'}`}>
                {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
              </div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wide">Deadline</div>
            </div>
            <div className="text-center">
              <div className={`text-base font-bold ${allocUtilisation > 0.95 ? 'text-red-600' : allocUtilisation > 0.75 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {Math.round(allocUtilisation * 100)}%
              </div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wide">Utilisation</div>
            </div>
          </div>
        </div>

        {/* Panel tabs */}
        <div className="flex gap-1 px-4 pt-2 pb-0 border-b border-slate-100 bg-white flex-shrink-0">
          {panelTabs.map(t => (
            <button key={t.id} onClick={() => setActivePanel(t.id as Panel)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                activePanel === t.id
                  ? 'text-amber-700 border-amber-600 bg-amber-50/50'
                  : 'text-slate-500 border-transparent hover:text-slate-700'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Panel body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">

          {/* ── Overview ── */}
          {activePanel === 'overview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOURS[job.status]}`}>
                  {STATUS_LABELS[job.status]}
                </span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PRIORITY_COLOURS[job.priority]}`}>
                  {job.priority.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Start', value: job.startDate },
                  { label: 'Deadline', value: job.deadline },
                  { label: 'Est. Hours', value: `${job.estimatedHours}h` },
                  { label: 'Remaining', value: `${remainingHours.toFixed(1)}h` },
                ].map(item => (
                  <div key={item.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="text-[9px] uppercase tracking-wide text-slate-400 mb-0.5">{item.label}</div>
                    <div className="font-bold text-slate-800 text-sm">{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Assigned staff */}
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-slate-600">
                  <Users size={12}/> Default Assigned Staff
                </div>
                <div className="flex flex-wrap gap-2">
                  {assignedStaff.map(s => (
                    <div key={s.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-xs font-medium"
                      style={{ backgroundColor: s.colour }}>
                      <div className="w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-[9px] font-bold">
                        {s.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                      </div>
                      {s.name}
                      {s.isApprentice && <span className="text-[8px] opacity-80">🎓</span>}
                    </div>
                  ))}
                  {assignedStaff.length === 0 && <p className="text-xs text-slate-400 italic">No staff assigned</p>}
                </div>
              </div>

              {/* Mini schedule grid */}
              {displayDays.length > 0 && assignedStaff.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-600 mb-2">Daily Allocation (first 14 days)</div>
                  <div className="overflow-x-auto">
                    <table className="text-[10px] min-w-max w-full">
                      <thead>
                        <tr>
                          <th className="text-left text-slate-400 font-medium pr-3 pb-1.5 w-20">Staff</th>
                          {displayDays.map(d => {
                            const dStr = toDateString(d);
                            const hasOverride = job.dailyStaffOverrides[dStr] !== undefined;
                            return (
                              <th key={dStr} className={`text-center px-0.5 pb-1.5 font-medium w-8 ${
                                dStr === toDateString(new Date()) ? 'text-amber-600' : 'text-slate-400'}`}>
                                <div>{format(d,'EEE').slice(0,1)}</div>
                                <div className={`text-[8px] ${hasOverride ? 'text-amber-500 font-bold' : ''}`}>{d.getDate()}</div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {assignedStaff.map(s => (
                          <tr key={s.id}>
                            <td className="pr-3 py-0.5 text-slate-700 font-medium truncate max-w-[80px]">
                              {s.name.split(' ')[0]}
                            </td>
                            {displayDays.map(d => {
                              const dStr = toDateString(d);
                              const hrs = staffDayHours[s.id]?.[dStr] ?? 0;
                              const tsEv = staffEvents.find(ev => ev.staffId === s.id && ev.date === dStr && ev.type === 'tradeSchool');
                              return (
                                <td key={dStr} className="text-center px-0.5 py-0.5">
                                  {tsEv ? (
                                    <div className="w-7 h-5 rounded bg-indigo-100 mx-auto flex items-center justify-center">
                                      <span className="text-[7px] font-bold text-indigo-500">TS</span>
                                    </div>
                                  ) : hrs > 0 ? (
                                    <div className="w-7 h-5 rounded flex items-center justify-center text-white font-bold mx-auto text-[9px]"
                                      style={{ backgroundColor: job.colour, opacity: Math.min(1, 0.4 + hrs/8) }}>
                                      {hrs % 1 === 0 ? hrs : hrs.toFixed(1)}
                                    </div>
                                  ) : (
                                    <div className="w-7 h-5 rounded bg-slate-50 border border-slate-100 mx-auto" />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {job.notes && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <div className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">Notes</div>
                  <p className="text-xs text-slate-700">{job.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Daily Staff Assignment ── */}
          {activePanel === 'dailyStaff' && (
            <DailyStaffAssignment job={job} onClose={() => setActivePanel('overview')} />
          )}

          {/* ── Hours Breakdown ── */}
          {activePanel === 'hoursBreakdown' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-500 mb-1">
                Breakdown of scheduled hours per staff member across the job window.
              </div>

              {/* Per-staff bars */}
              <div className="space-y-3">
                {assignedStaff.map(s => {
                  const sHrs = staffHoursMap[s.id] ?? 0;
                  const sAvail = workDays.reduce((sum, d) => {
                    const dStr = toDateString(d);
                    const dayStaffIds = job.dailyStaffOverrides[dStr] ?? job.assignedStaffIds;
                    if (!dayStaffIds.includes(s.id)) return sum;
                    return sum + getEffectiveAvailable(s, dStr, staffEvents);
                  }, 0);
                  const ratio = sAvail > 0 ? sHrs / sAvail : 0;

                  return (
                    <div key={s.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                            style={{ backgroundColor: s.colour }}>
                            {s.name[0]}
                          </div>
                          <span className="text-xs font-medium text-slate-700">{s.name}</span>
                          {s.isApprentice && <span className="text-[9px] text-indigo-500 font-semibold">🎓 Apprentice</span>}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-slate-800">{sHrs.toFixed(1)}h</span>
                          <span className="text-slate-400">/ {sAvail.toFixed(0)}h avail</span>
                          <span className={`font-semibold ${ratio > 0.95 ? 'text-red-600' : ratio > 0.75 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {Math.round(ratio*100)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${Math.min(100, ratio*100)}%` }}
                          transition={{ duration: 0.5, delay: 0.05 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: s.colour }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-600">Job Totals</span>
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      { label: 'Estimated Hours', value: `${job.estimatedHours}h` },
                      { label: 'Remaining Hours', value: `${remainingHours.toFixed(1)}h` },
                      { label: 'Scheduled Hours', value: `${scheduledHours.toFixed(1)}h`, highlight: scheduledHours >= job.estimatedHours * 0.85 },
                      { label: 'Total Staff Capacity', value: `${totalStaffAvailable.toFixed(0)}h` },
                      { label: 'Working Days', value: `${workDays.length} days` },
                      { label: 'Job Utilisation', value: `${Math.round(allocUtilisation*100)}%` },
                    ].map(row => (
                      <tr key={row.label} className="border-b border-slate-50">
                        <td className="px-4 py-2 text-slate-500">{row.label}</td>
                        <td className={`px-4 py-2 font-semibold text-right ${row.highlight ? 'text-emerald-600' : 'text-slate-800'}`}>
                          {row.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-100 flex-shrink-0 flex-wrap bg-white rounded-b-2xl">
          <button onClick={() => setShowEditForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-xl hover:bg-amber-700 transition-colors">
            <Edit2 size={12}/> Edit
          </button>
          {job.status !== 'completed' && (
            <button onClick={() => { updateJob({ ...job, status: 'completed' }); closeJob(); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl hover:bg-emerald-100 border border-emerald-200 transition-colors">
              <CheckCircle size={12}/> Complete
            </button>
          )}
          {job.status !== 'onHold' && job.status !== 'completed' && (
            <button onClick={() => updateJob({ ...job, status: 'onHold' })}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 text-xs font-semibold rounded-xl hover:bg-amber-100 border border-amber-200 transition-colors">
              <PauseCircle size={12}/> Hold
            </button>
          )}
          {job.status === 'onHold' && (
            <button onClick={() => updateJob({ ...job, status: 'scheduled' })}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 text-xs font-semibold rounded-xl hover:bg-amber-100 border border-amber-200 transition-colors">
              <ChevronRight size={12}/> Resume
            </button>
          )}
          <div className="flex-1" />
          <button onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-100 border border-red-100 transition-colors">
            <Trash2 size={12}/> Delete
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showEditForm && <JobForm job={job} onClose={() => setShowEditForm(false)} />}
      </AnimatePresence>
    </div>
  );
}

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useJobModal } from '../context/JobModalContext';
import { Job, JobStatus, JobPriority } from '../types';
import { fromDateString } from '../utils/dateUtils';
import { isJobAtRisk } from '../utils/schedulingEngine';
import { differenceInCalendarDays, isBefore, startOfDay } from 'date-fns';
import { JobForm } from './forms/JobForm';

const STATUS_LABELS: Record<JobStatus, string> = {
  unscheduled: 'Unscheduled', scheduled: 'Scheduled', inProgress: 'In Progress',
  completed: 'Completed', onHold: 'On Hold',
};
const STATUS_COLOURS: Record<JobStatus, string> = {
  unscheduled: 'bg-slate-100 text-slate-600', scheduled: 'bg-sky-100 text-sky-700',
  inProgress: 'bg-indigo-100 text-indigo-700', completed: 'bg-emerald-100 text-emerald-700',
  onHold: 'bg-amber-100 text-amber-700',
};
const PRIORITY_COLOURS: Record<JobPriority, string> = {
  low: 'bg-slate-100 text-slate-500', medium: 'bg-sky-100 text-sky-700',
  high: 'bg-orange-100 text-orange-700', urgent: 'bg-red-100 text-red-700',
};

export function JobsPanel() {
  const { state } = useApp();
  const { jobs, staff, scheduleEntries } = state;
  const { openJob } = useJobModal();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<JobStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<JobPriority | 'all'>('all');
  const [filterStaff, setFilterStaff] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);

  const filteredJobs = jobs.filter(job => {
    if (search && !job.jobName.toLowerCase().includes(search.toLowerCase()) &&
        !job.clientName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== 'all' && job.status !== filterStatus) return false;
    if (filterPriority !== 'all' && job.priority !== filterPriority) return false;
    if (filterStaff !== 'all' && !job.assignedStaffIds.includes(filterStaff)) return false;
    return true;
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    const po: Record<JobPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    return po[a.priority] - po[b.priority];
  });

  function getScheduledHours(jobId: string) {
    return scheduleEntries.filter(e => e.jobId === jobId).reduce((s, e) => s + e.hours, 0);
  }

  function getDeadlineBadge(job: Job) {
    const deadline = fromDateString(job.deadline);
    const now = startOfDay(new Date());
    const daysLeft = differenceInCalendarDays(deadline, now);
    if (job.status === 'completed') return null;
    if (isBefore(deadline, now))
      return <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">OVERDUE</span>;
    if (daysLeft <= 3)
      return <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">{daysLeft}d left</span>;
    if (daysLeft <= 7)
      return <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{daysLeft}d left</span>;
    return <span className="text-[10px] text-slate-400">{daysLeft}d</span>;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div>
          <h2 className="font-semibold text-slate-800 text-sm">Jobs</h2>
          <p className="text-[10px] text-slate-400 mt-0.5">Click any job to view, edit or update</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors"
        >
          <Plus size={14} /> New Job
        </button>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-32">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs or clients…"
            className="w-full pl-6 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400">
          <option value="all">All Status</option>
          {(Object.keys(STATUS_LABELS) as JobStatus[]).map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as any)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400">
          <option value="all">All Priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400">
          <option value="all">All Staff</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Jobs list */}
      <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
        <AnimatePresence>
          {sortedJobs.map(job => {
            const atRisk = isJobAtRisk(job, scheduleEntries, staff);
            const scheduledHours = getScheduledHours(job.id);
            const progressPct = Math.min(100, Math.round((scheduledHours / Math.max(job.estimatedHours, 1)) * 100));
            const assignedStaffMembers = staff.filter(s => job.assignedStaffIds.includes(s.id));

            return (
              <motion.div
                key={job.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => openJob(job.id)}
                className={`px-4 py-3 cursor-pointer hover:bg-amber-50/30 transition-colors ${
                  atRisk ? 'border-l-2 border-l-orange-400' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-1 h-12 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: job.colour }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800 text-sm truncate">{job.jobName}</span>
                          {atRisk && <AlertTriangle size={12} className="text-orange-500 flex-shrink-0" />}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{job.clientName}</div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PRIORITY_COLOURS[job.priority]}`}>
                          {job.priority.toUpperCase()}
                        </span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLOURS[job.status]}`}>
                          {STATUS_LABELS[job.status]}
                        </span>
                      </div>
                    </div>

                    {/* Progress + deadline */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${progressPct}%`, backgroundColor: job.colour }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">
                        {scheduledHours.toFixed(0)}/{job.estimatedHours}h
                      </span>
                      {getDeadlineBadge(job)}
                    </div>

                    {/* Staff avatars */}
                    <div className="mt-1.5 flex gap-1">
                      {assignedStaffMembers.slice(0, 5).map(s => (
                        <div
                          key={s.id}
                          className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                          style={{ backgroundColor: s.colour }}
                          title={s.name}
                        >
                          {s.name[0]}
                        </div>
                      ))}
                      {assignedStaffMembers.length > 5 && (
                        <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 text-[9px] font-bold flex items-center justify-center">
                          +{assignedStaffMembers.length - 5}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {sortedJobs.length === 0 && (
          <div className="py-12 text-center">
            <div className="text-slate-400 text-sm">No jobs found</div>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-xs text-amber-600 hover:underline"
            >
              Add your first job
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showForm && <JobForm job={null} onClose={() => setShowForm(false)} />}
      </AnimatePresence>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, AlertTriangle, Trash2,
  Zap, CheckCircle2, Inbox,
  ChevronRight, SlidersHorizontal, X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useJobModal } from '../context/JobModalContext';
import { Job, JobStatus, JobPriority } from '../types';
import { fromDateString } from '../utils/dateUtils';
import { isJobAtRisk, getAllJobStaffIds } from '../utils/schedulingEngine';
import { differenceInCalendarDays, isBefore, startOfDay } from 'date-fns';
import { JobForm } from './forms/JobForm';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<JobStatus, string> = {
  unscheduled: 'Unscheduled',
  scheduled: 'Scheduled',
  inProgress: 'In Progress',
  completed: 'Completed',
  onHold: 'On Hold',
};

const STATUS_STYLES: Record<JobStatus, string> = {
  unscheduled: 'bg-zinc-100 text-zinc-500 ring-zinc-200',
  scheduled:   'bg-sky-50 text-sky-600 ring-sky-200',
  inProgress:  'bg-violet-50 text-violet-600 ring-violet-200',
  completed:   'bg-emerald-50 text-emerald-600 ring-emerald-200',
  onHold:      'bg-amber-50 text-amber-600 ring-amber-200',
};

const PRIORITY_CONFIG: Record<JobPriority, {
  label: string; dot: string; bar: string; ring: string;
  text: string; bg: string; border: string;
}> = {
  urgent: {
    label: 'Urgent',
    dot:    'bg-red-500',
    bar:    'bg-red-500',
    ring:   'ring-red-200',
    text:   'text-red-600',
    bg:     'bg-red-50',
    border: 'border-l-red-400',
  },
  high: {
    label: 'High',
    dot:    'bg-orange-400',
    bar:    'bg-orange-400',
    ring:   'ring-orange-200',
    text:   'text-orange-600',
    bg:     'bg-orange-50',
    border: 'border-l-orange-300',
  },
  medium: {
    label: 'Medium',
    dot:    'bg-blue-400',
    bar:    'bg-blue-400',
    ring:   'ring-blue-200',
    text:   'text-blue-600',
    bg:     'bg-blue-50',
    border: 'border-l-blue-300',
  },
  low: {
    label: 'Low',
    dot:    'bg-zinc-300',
    bar:    'bg-zinc-300',
    ring:   'ring-zinc-200',
    text:   'text-zinc-500',
    bg:     'bg-zinc-50',
    border: 'border-l-zinc-200',
  },
};

const PRIORITY_ORDER: Record<JobPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode; label: string; value: string | number;
  sub: string; accent?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 min-w-0">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${accent ?? 'bg-zinc-100'}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest truncate">{label}</p>
        <p className={`text-lg font-semibold leading-tight tabular-nums ${accent ? 'text-zinc-800' : 'text-zinc-800'}`}>
          {value}
        </p>
        <p className="text-[10px] text-zinc-400 truncate">{sub}</p>
      </div>
    </div>
  );
}

function DeadlinePill({ job }: { job: Job }) {
  if (job.status === 'completed') return null;
  const deadline = fromDateString(job.deadline);
  const now = startOfDay(new Date());
  const days = differenceInCalendarDays(deadline, now);

  if (isBefore(deadline, now))
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 ring-1 ring-red-200 px-2 py-0.5 rounded-full">
        <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
        Overdue
      </span>
    );
  if (days <= 3)
    return <span className="text-[10px] font-semibold text-red-500 bg-red-50 ring-1 ring-red-100 px-2 py-0.5 rounded-full">{days}d left</span>;
  if (days <= 7)
    return <span className="text-[10px] font-semibold text-orange-500 bg-orange-50 ring-1 ring-orange-100 px-2 py-0.5 rounded-full">{days}d left</span>;
  if (days <= 14)
    return <span className="text-[10px] font-medium text-amber-600 bg-amber-50 ring-1 ring-amber-100 px-2 py-0.5 rounded-full">{days}d left</span>;
  return <span className="text-[10px] text-zinc-400">{days}d</span>;
}

function AvatarStack({ members, max = 5 }: { members: { id: string; name: string; colour: string }[]; max?: number }) {
  if (!members.length) return null;
  const visible = members.slice(0, max);
  const overflow = members.length - max;
  return (
    <div className="flex items-center" style={{ marginLeft: '-2px' }}>
      {visible.map((s, i) => (
        <div
          key={s.id}
          title={s.name}
          className="w-6 h-6 rounded-full text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white flex-shrink-0"
          style={{ backgroundColor: s.colour, zIndex: max - i, marginLeft: i === 0 ? 0 : '-6px' }}
        >
          {s.name[0].toUpperCase()}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="w-6 h-6 rounded-full bg-zinc-200 text-zinc-500 text-[9px] font-bold flex items-center justify-center ring-2 ring-white flex-shrink-0"
          style={{ marginLeft: '-6px' }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function JobsPanel() {
  const { state, deleteJob } = useApp();
  const { jobs, staff, scheduleEntries } = state;
  const { openJob } = useJobModal();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<JobStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<JobPriority | 'all'>('all');
  const [filterStaff, setFilterStaff] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  function handleDelete(e: React.MouseEvent, job: Job) {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Delete "${job.jobName}"? This cannot be undone.`)) deleteJob(job.id);
  }

  function getScheduledHours(jobId: string) {
    return scheduleEntries.filter(e => e.jobId === jobId).reduce((s, e) => s + e.hours, 0);
  }

  const activeFilterCount = [
    filterStatus !== 'all', filterPriority !== 'all', filterStaff !== 'all',
  ].filter(Boolean).length;

  const filtered = useMemo(() => jobs.filter(job => {
    if (search && !job.jobName.toLowerCase().includes(search.toLowerCase()) &&
        !job.clientName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== 'all' && job.status !== filterStatus) return false;
    if (filterPriority !== 'all' && job.priority !== filterPriority) return false;
    if (filterStaff !== 'all' && !job.assignedStaffIds.includes(filterStaff)) return false;
    return true;
  }), [jobs, search, filterStatus, filterPriority, filterStaff]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]),
    [filtered]
  );

  const grouped = useMemo(() =>
    (['urgent', 'high', 'medium', 'low'] as JobPriority[]).map(p => ({
      priority: p,
      jobs: sorted.filter(j => j.priority === p),
    })).filter(g => g.jobs.length > 0),
    [sorted]
  );

  // Stats
  const urgentCount     = jobs.filter(j => j.priority === 'urgent').length;
  const unscheduledCount = jobs.filter(j => j.status === 'unscheduled').length;
  const completedCount  = jobs.filter(j => j.status === 'completed').length;
  const totalHours      = jobs.reduce((s, j) => s + getScheduledHours(j.id), 0);

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">

      {/* ── Stats bar ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 divide-x divide-zinc-100 border-b border-zinc-100">
        <StatPill
          icon={<Zap size={15} className="text-amber-500" />}
          label="Total Jobs" value={jobs.length} sub={`${urgentCount} urgent`}
          accent="bg-amber-50"
        />
        <StatPill
          icon={<AlertTriangle size={15} className="text-red-500" />}
          label="Urgent" value={urgentCount} sub="Need attention"
          accent="bg-red-50"
        />
        <StatPill
          icon={<Inbox size={15} className="text-blue-500" />}
          label="Unscheduled" value={unscheduledCount} sub="Awaiting assignment"
          accent="bg-blue-50"
        />
        <StatPill
          icon={<CheckCircle2 size={15} className="text-emerald-500" />}
          label="Completed" value={completedCount} sub={`${Math.round(totalHours)}h logged`}
          accent="bg-emerald-50"
        />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
        <div>
          <h2 className="text-sm font-semibold text-zinc-800 tracking-tight">Jobs</h2>
          <p className="text-[11px] text-zinc-400 mt-0.5">Click any job to view, edit or update</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltersOpen(v => !v)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              filtersOpen || activeFilterCount > 0
                ? 'bg-zinc-800 text-white border-zinc-800'
                : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <SlidersHorizontal size={13} />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm shadow-amber-200"
          >
            <Plus size={14} strokeWidth={2.5} /> New Job
          </button>
        </div>
      </div>

      {/* ── Search + Filters ───────────────────────────────────────────── */}
      <div className="border-b border-zinc-100">
        <div className="px-5 py-2.5 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search jobs or clients…"
              className="w-full pl-8 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-all placeholder:text-zinc-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <span className="text-[11px] text-zinc-400 tabular-nums flex-shrink-0">
            {filtered.length} / {jobs.length} jobs
          </span>
        </div>

        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-3 flex flex-wrap gap-2 bg-zinc-50/60 border-t border-zinc-100">
                <div className="pt-2.5 w-full flex flex-wrap gap-2">
                  {/* Status filter */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Status</span>
                    <div className="flex flex-wrap gap-1">
                      {(['all', ...Object.keys(STATUS_LABELS)] as (JobStatus | 'all')[]).map(s => (
                        <button
                          key={s}
                          onClick={() => setFilterStatus(s)}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                            filterStatus === s
                              ? 'bg-zinc-800 text-white'
                              : 'bg-white border border-zinc-200 text-zinc-500 hover:border-zinc-300'
                          }`}
                        >
                          {s === 'all' ? 'All' : STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Priority filter */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Priority</span>
                    <div className="flex flex-wrap gap-1">
                      {(['all', 'urgent', 'high', 'medium', 'low'] as (JobPriority | 'all')[]).map(p => (
                        <button
                          key={p}
                          onClick={() => setFilterPriority(p)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                            filterPriority === p
                              ? 'bg-zinc-800 text-white'
                              : 'bg-white border border-zinc-200 text-zinc-500 hover:border-zinc-300'
                          }`}
                        >
                          {p !== 'all' && (
                            <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_CONFIG[p].dot}`} />
                          )}
                          {p === 'all' ? 'All' : PRIORITY_CONFIG[p].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Staff filter */}
                  {staff.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Staff</span>
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => setFilterStaff('all')}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                            filterStaff === 'all'
                              ? 'bg-zinc-800 text-white'
                              : 'bg-white border border-zinc-200 text-zinc-500 hover:border-zinc-300'
                          }`}
                        >
                          All
                        </button>
                        {staff.map(s => (
                          <button
                            key={s.id}
                            onClick={() => setFilterStaff(s.id)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                              filterStaff === s.id
                                ? 'bg-zinc-800 text-white'
                                : 'bg-white border border-zinc-200 text-zinc-500 hover:border-zinc-300'
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full text-[8px] text-white flex items-center justify-center font-bold flex-shrink-0"
                              style={{ backgroundColor: s.colour }}
                            >
                              {s.name[0]}
                            </span>
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Job list ───────────────────────────────────────────────────── */}
      <div className="overflow-y-auto max-h-[640px]">
        <AnimatePresence mode="popLayout">
          {grouped.length > 0 ? (
            grouped.map(({ priority, jobs: groupJobs }) => {
              const cfg = PRIORITY_CONFIG[priority];
              return (
                <div key={priority}>
                  {/* Section heading */}
                  <div className="sticky top-0 z-10 flex items-center gap-2.5 px-5 py-2 bg-white/95 backdrop-blur-sm border-b border-zinc-50">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                      {cfg.label}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                      {groupJobs.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="divide-y divide-zinc-50">
                    {groupJobs.map((job, idx) => {
                      const atRisk = isJobAtRisk(job, scheduleEntries, staff);
                      const scheduledHours = getScheduledHours(job.id);
                      const pct = Math.min(100, Math.round((scheduledHours / Math.max(job.estimatedHours, 1)) * 100));
                      const isComplete = pct >= 100;
                      const assignedStaff = staff.filter(s => getAllJobStaffIds(job).includes(s.id));

                      return (
                        <motion.div
                          key={job.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ delay: idx * 0.03, duration: 0.2 }}
                          onClick={() => openJob(job.id)}
                          className={`group relative flex items-stretch cursor-pointer
                            hover:bg-zinc-50/80 active:bg-zinc-100
                            transition-colors duration-150
                            border-l-2 ${cfg.border}
                          `}
                        >
                          {/* Job colour pip */}
                          <div
                            className="w-0.5 flex-shrink-0 self-stretch mx-4 my-3 rounded-full opacity-60"
                            style={{ backgroundColor: job.colour }}
                          />

                          <div className="flex-1 py-3 pr-4 min-w-0">
                            {/* Row 1 — name + badges + actions */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-sm font-semibold text-zinc-800 truncate leading-snug">
                                    {job.jobName}
                                  </span>
                                  {atRisk && (
                                    <AlertTriangle
                                      size={12}
                                      className="text-orange-400 flex-shrink-0"
                                      aria-label="At risk"
                                    />
                                  )}
                                </div>
                                <p className="text-[11px] text-zinc-400 mt-0.5 truncate">{job.clientName}</p>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {/* Priority badge */}
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
                                  {cfg.label}
                                </span>
                                {/* Status badge */}
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ring-1 ${STATUS_STYLES[job.status]}`}>
                                  {STATUS_LABELS[job.status]}
                                </span>
                                {/* Delete — revealed on hover */}
                                <button
                                  onClick={e => handleDelete(e, job)}
                                  aria-label={`Delete ${job.jobName}`}
                                  className="p-1 rounded-md text-zinc-300 hover:text-red-500 hover:bg-red-50
                                    transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                >
                                  <Trash2 size={13} />
                                </button>
                                <ChevronRight
                                  size={14}
                                  className="text-zinc-300 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all"
                                />
                              </div>
                            </div>

                            {/* Row 2 — progress */}
                            <div className="mt-2.5 flex items-center gap-2.5">
                              <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{ backgroundColor: isComplete ? '#10B981' : job.colour }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.6, ease: 'easeOut', delay: idx * 0.03 }}
                                />
                              </div>
                              <span className="text-[10px] font-medium text-zinc-400 tabular-nums flex-shrink-0">
                                {Math.round(scheduledHours)}/{job.estimatedHours}h
                              </span>
                              <span className={`text-[10px] font-semibold tabular-nums flex-shrink-0 ${
                                isComplete ? 'text-emerald-500' : pct > 80 ? 'text-orange-500' : 'text-zinc-500'
                              }`}>
                                {pct}%
                              </span>
                              <DeadlinePill job={job} />
                            </div>

                            {/* Row 3 — avatars */}
                            {assignedStaff.length > 0 && (
                              <div className="mt-2">
                                <AvatarStack members={assignedStaff} />
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 flex flex-col items-center gap-3 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center">
                <Search size={20} className="text-zinc-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-500">No jobs found</p>
                <p className="text-xs text-zinc-400 mt-0.5">Try adjusting your search or filters</p>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="mt-1 flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <Plus size={13} /> Add a job
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── New Job Form ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && <JobForm job={null} onClose={() => setShowForm(false)} />}
      </AnimatePresence>
    </div>
  );
}
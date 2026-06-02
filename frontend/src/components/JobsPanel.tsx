import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, AlertTriangle, Trash2,
  Zap, CheckCircle2, Inbox, Flag,
  ArrowUpRight, SlidersHorizontal, X,
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
  unscheduled: 'bg-slate-100 text-slate-500 ring-slate-200/70',
  scheduled:   'bg-sky-50 text-sky-600 ring-sky-200/70',
  inProgress:  'bg-violet-50 text-violet-600 ring-violet-200/70',
  completed:   'bg-emerald-50 text-emerald-600 ring-emerald-200/70',
  onHold:      'bg-amber-50 text-amber-600 ring-amber-200/70',
};

// Calmer, intentionally muted priority palette. We reserve loud signals for
// genuinely time-critical states (handled in DeadlinePill) so the board reads
// as "in control" rather than "everything is on fire".
const PRIORITY_CONFIG: Record<JobPriority, {
  label: string; dot: string; bar: string; ring: string;
  text: string; bg: string; accent: string;
}> = {
  urgent: {
    label: 'Urgent',
    dot:    'bg-rose-400',
    bar:    'bg-rose-400',
    ring:   'ring-rose-200/70',
    text:   'text-rose-600',
    bg:     'bg-rose-50',
    accent: 'from-rose-300 to-rose-400',
  },
  high: {
    label: 'High',
    dot:    'bg-amber-400',
    bar:    'bg-amber-400',
    ring:   'ring-amber-200/70',
    text:   'text-amber-700',
    bg:     'bg-amber-50',
    accent: 'from-amber-300 to-amber-400',
  },
  medium: {
    label: 'Medium',
    dot:    'bg-sky-400',
    bar:    'bg-sky-400',
    ring:   'ring-sky-200/70',
    text:   'text-sky-600',
    bg:     'bg-sky-50',
    accent: 'from-sky-300 to-sky-400',
  },
  low: {
    label: 'Low',
    dot:    'bg-slate-300',
    bar:    'bg-slate-300',
    ring:   'ring-slate-200/70',
    text:   'text-slate-500',
    bg:     'bg-slate-100',
    accent: 'from-slate-200 to-slate-300',
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
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${accent ?? 'bg-slate-100'}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest truncate">{label}</p>
        <p className={`text-lg font-semibold leading-tight tabular-nums ${accent ? 'text-slate-800' : 'text-slate-800'}`}>
          {value}
        </p>
        <p className="text-[10px] text-slate-400 truncate">{sub}</p>
      </div>
    </div>
  );
}

function DeadlinePill({ job }: { job: Job }) {
  if (job.status === 'completed')
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 ring-1 ring-emerald-200/70 px-2 py-0.5 rounded-full">
        <CheckCircle2 size={10} strokeWidth={2.5} />
        Done
      </span>
    );
  const deadline = fromDateString(job.deadline);
  const now = startOfDay(new Date());
  const days = differenceInCalendarDays(deadline, now);

  // Only a true miss earns the one red moment on the board.
  if (isBefore(deadline, now))
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 ring-1 ring-rose-200/70 px-2 py-0.5 rounded-full">
        <span className="w-1 h-1 rounded-full bg-rose-500" />
        Overdue
      </span>
    );
  if (days <= 3)
    return <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 ring-1 ring-amber-200/60 px-2 py-0.5 rounded-full tabular-nums">{days}d left</span>;
  if (days <= 14)
    return <span className="text-[10px] font-medium text-amber-600/90 bg-amber-50/70 ring-1 ring-amber-100 px-2 py-0.5 rounded-full tabular-nums">{days}d left</span>;
  return <span className="text-[10px] font-medium text-slate-400 tabular-nums px-1.5 py-0.5">{days}d left</span>;
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
          className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 text-[9px] font-bold flex items-center justify-center ring-2 ring-white flex-shrink-0"
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
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">

      {/* ── Stats bar ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 border-b border-slate-100">
        <StatPill
          icon={<Zap size={15} className="text-amber-500" />}
          label="Total Jobs" value={jobs.length} sub={`${urgentCount} need prioritising`}
          accent="bg-amber-50"
        />
        <StatPill
          icon={<Flag size={14} className="text-rose-400" />}
          label="Urgent" value={urgentCount} sub={urgentCount === 0 ? 'All clear' : 'Top of the list'}
          accent="bg-rose-50"
        />
        <StatPill
          icon={<Inbox size={15} className="text-sky-500" />}
          label="Unscheduled" value={unscheduledCount} sub="Ready to assign"
          accent="bg-sky-50"
        />
        <StatPill
          icon={<CheckCircle2 size={15} className="text-emerald-500" />}
          label="Completed" value={completedCount} sub={`${Math.round(totalHours)}h logged`}
          accent="bg-emerald-50"
        />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 tracking-tight">Jobs</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Click any job to view, edit or update</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltersOpen(v => !v)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              filtersOpen || activeFilterCount > 0
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
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
      <div className="border-b border-slate-100">
        <div className="px-5 py-2.5 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search jobs or clients…"
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-all placeholder:text-slate-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-400 tabular-nums flex-shrink-0">
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
              <div className="px-5 pb-3 flex flex-wrap gap-2 bg-slate-50/60 border-t border-slate-100">
                <div className="pt-2.5 w-full flex flex-wrap gap-2">
                  {/* Status filter */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</span>
                    <div className="flex flex-wrap gap-1">
                      {(['all', ...Object.keys(STATUS_LABELS)] as (JobStatus | 'all')[]).map(s => (
                        <button
                          key={s}
                          onClick={() => setFilterStatus(s)}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                            filterStatus === s
                              ? 'bg-slate-800 text-white'
                              : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {s === 'all' ? 'All' : STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Priority filter */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Priority</span>
                    <div className="flex flex-wrap gap-1">
                      {(['all', 'urgent', 'high', 'medium', 'low'] as (JobPriority | 'all')[]).map(p => (
                        <button
                          key={p}
                          onClick={() => setFilterPriority(p)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                            filterPriority === p
                              ? 'bg-slate-800 text-white'
                              : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
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
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Staff</span>
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => setFilterStaff('all')}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                            filterStaff === 'all'
                              ? 'bg-slate-800 text-white'
                              : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
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
                                ? 'bg-slate-800 text-white'
                                : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
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

      {/* ── Job board ──────────────────────────────────────────────────── */}
      <div className="overflow-y-auto max-h-[680px] bg-slate-50/40 px-5 py-1">
        <AnimatePresence mode="popLayout">
          {grouped.length > 0 ? (
            grouped.map(({ priority, jobs: groupJobs }) => {
              const cfg = PRIORITY_CONFIG[priority];
              return (
                <div key={priority} className="pt-4 first:pt-3">
                  {/* Section heading */}
                  <div className="flex items-center gap-2.5 pb-2.5">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                      {cfg.label}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-white text-slate-400 ring-1 ring-slate-200/70 tabular-nums">
                      {groupJobs.length}
                    </span>
                    <span className="flex-1 h-px bg-slate-200/60" />
                  </div>

                  {/* Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                    {groupJobs.map((job, idx) => {
                      const atRisk = isJobAtRisk(job, scheduleEntries, staff);
                      const scheduledHours = getScheduledHours(job.id);
                      const pct = Math.min(100, Math.round((scheduledHours / Math.max(job.estimatedHours, 1)) * 100));
                      const isComplete = pct >= 100;
                      const assignedStaff = staff.filter(s => getAllJobStaffIds(job).includes(s.id));

                      return (
                        <motion.div
                          key={job.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ delay: idx * 0.025, duration: 0.22 }}
                          draggable
                          // Framer Motion's onDragStart prop is typed for its
                          // own pan handler; cast lets us attach the native
                          // HTML5 DragEvent handler instead.
                          {...({
                            onDragStart: (e: React.DragEvent<HTMLDivElement>) => {
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData(
                                'application/x-casgrid-job',
                                JSON.stringify({ jobId: job.id }),
                              );
                            },
                          } as any)}
                          onClick={() => openJob(job.id)}
                          title="Click to view · drag to move"
                          className="group relative flex flex-col cursor-grab active:cursor-grabbing bg-white rounded-xl
                            ring-1 ring-slate-200/70 shadow-sm overflow-hidden
                            hover:ring-slate-300 hover:shadow-md hover:-translate-y-0.5
                            transition-all duration-200"
                        >
                          {/* Top accent — calm priority cue */}
                          <span className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${cfg.accent}`} />

                          <div className="flex flex-col flex-1 p-3.5 pt-4">
                            {/* Row 1 — chips */}
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                              </span>
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ring-1 ${STATUS_STYLES[job.status]}`}>
                                {STATUS_LABELS[job.status]}
                              </span>

                              <span className="ml-auto flex items-center gap-1">
                                {atRisk && (
                                  <span
                                    title="Needs attention to stay on track"
                                    className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-700 bg-amber-50 ring-1 ring-amber-200/60 px-1.5 py-0.5 rounded-full"
                                  >
                                    <AlertTriangle size={9} strokeWidth={2.5} />
                                    Watch
                                  </span>
                                )}
                                <button
                                  onClick={e => handleDelete(e, job)}
                                  aria-label={`Delete ${job.jobName}`}
                                  className="p-1 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50
                                    transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </span>
                            </div>

                            {/* Row 2 — name + client */}
                            <div className="mt-2.5 flex items-start gap-2">
                              <span
                                className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: job.colour }}
                              />
                              <div className="min-w-0">
                                <h3 className="text-[13.5px] font-semibold text-slate-800 leading-snug line-clamp-2">
                                  {job.jobName}
                                </h3>
                                <p className="text-[11px] text-slate-400 mt-0.5 truncate">{job.clientName}</p>
                              </div>
                            </div>

                            {/* Row 3 — progress (pinned toward the bottom) */}
                            <div className="mt-auto pt-3.5">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-medium text-slate-400 tabular-nums">
                                  {Math.round(scheduledHours)} / {job.estimatedHours}h
                                </span>
                                <span className={`text-[10px] font-semibold tabular-nums ${
                                  isComplete ? 'text-emerald-600' : 'text-slate-500'
                                }`}>
                                  {pct}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{ backgroundColor: isComplete ? '#10B981' : job.colour }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.6, ease: 'easeOut', delay: idx * 0.025 }}
                                />
                              </div>
                            </div>

                            {/* Row 4 — footer */}
                            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                              {assignedStaff.length > 0 ? (
                                <AvatarStack members={assignedStaff} />
                              ) : (
                                <span className="text-[10px] text-slate-300 font-medium">Unassigned</span>
                              )}
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <DeadlinePill job={job} />
                                <ArrowUpRight
                                  size={14}
                                  className="text-slate-300 group-hover:text-amber-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all"
                                />
                              </div>
                            </div>
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
              <div className="w-12 h-12 rounded-2xl bg-white ring-1 ring-slate-200 flex items-center justify-center">
                <Search size={20} className="text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">No jobs found</p>
                <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search or filters</p>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="mt-1 flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm shadow-amber-200"
              >
                <Plus size={13} /> Add a job
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="h-3" />
      </div>

      {/* ── New Job Form ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && <JobForm job={null} onClose={() => setShowForm(false)} />}
      </AnimatePresence>
    </div>
  );
}
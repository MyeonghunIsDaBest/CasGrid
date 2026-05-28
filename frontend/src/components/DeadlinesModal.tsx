// @ts-nocheck
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { differenceInCalendarDays, format, startOfDay } from 'date-fns';
import { X, AlertTriangle, CheckCircle, Clock, PauseCircle, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useJobModal } from '../context/JobModalContext';
import { fromDateString } from '../utils/dateUtils';
import { isJobAtRisk } from '../utils/schedulingEngine';

type Filter = 'all' | 'active' | 'completed' | 'onHold' | 'overdue';

const STATUS_META = {
  unscheduled: { label: 'Unscheduled', cls: 'bg-slate-100 text-slate-600' },
  scheduled:   { label: 'Scheduled',   cls: 'bg-sky-100 text-sky-700' },
  inProgress:  { label: 'In Progress', cls: 'bg-indigo-100 text-indigo-700' },
  completed:   { label: 'Completed',   cls: 'bg-emerald-100 text-emerald-700' },
  onHold:      { label: 'On Hold',     cls: 'bg-amber-100 text-amber-700' },
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DeadlinesModal({ open, onClose }: Props) {
  const { state } = useApp();
  const { openJob } = useJobModal();
  const { jobs, scheduleEntries, staff } = state;

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const today = startOfDay(new Date());

  const rows = useMemo(() => {
    return jobs.map(j => {
      const daysLeft = differenceInCalendarDays(fromDateString(j.deadline), today);
      const scheduledHours = scheduleEntries
        .filter(e => e.jobId === j.id)
        .reduce((s, e) => s + e.hours, 0);
      const progress = Math.min(100, Math.round((scheduledHours / Math.max(j.estimatedHours, 1)) * 100));
      const isOverdue = daysLeft < 0 && j.status !== 'completed';
      const atRisk = j.status !== 'completed' && j.status !== 'onHold' && isJobAtRisk(j, scheduleEntries, staff);
      return { ...j, daysLeft, scheduledHours, progress, isOverdue, atRisk };
    });
  }, [jobs, scheduleEntries, staff, today]);

  const counts = useMemo(() => ({
    all: rows.length,
    active: rows.filter(r => r.status !== 'completed' && r.status !== 'onHold').length,
    completed: rows.filter(r => r.status === 'completed').length,
    onHold: rows.filter(r => r.status === 'onHold').length,
    overdue: rows.filter(r => r.isOverdue).length,
  }), [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filter === 'active')    list = list.filter(r => r.status !== 'completed' && r.status !== 'onHold');
    if (filter === 'completed') list = list.filter(r => r.status === 'completed');
    if (filter === 'onHold')    list = list.filter(r => r.status === 'onHold');
    if (filter === 'overdue')   list = list.filter(r => r.isOverdue);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        r.jobName.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      // overdue first, then upcoming, then completed/onHold by deadline desc
      const aFinished = a.status === 'completed' || a.status === 'onHold';
      const bFinished = b.status === 'completed' || b.status === 'onHold';
      if (aFinished !== bFinished) return aFinished ? 1 : -1;
      return a.daysLeft - b.daysLeft;
    });
  }, [rows, filter, search]);

  const handleRowClick = (id: string) => {
    onClose();
    openJob(id);
  };

  const tabs: { id: Filter; label: string }[] = [
    { id: 'all',       label: 'All' },
    { id: 'active',    label: 'Active' },
    { id: 'overdue',   label: 'Overdue' },
    { id: 'completed', label: 'Completed' },
    { id: 'onHold',    label: 'On Hold' },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-800 text-sm">All Deadlines</h2>
                <p className="text-[11px] text-slate-400">Track every job's status and progress</p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Filters */}
            <div className="px-5 pt-3 pb-2 flex items-center gap-3 border-b border-slate-100">
              <div className="flex items-center gap-1 flex-wrap">
                {tabs.map(t => {
                  const active = filter === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setFilter(t.id)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {t.label}
                      <span className={`ml-1.5 text-[10px] ${active ? 'text-slate-300' : 'text-slate-400'}`}>
                        {counts[t.id]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="relative ml-auto">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search jobs…"
                  className="text-[11px] pl-6 pr-2 py-1 rounded-md border border-slate-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-300 outline-none w-40"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <CheckCircle size={28} className="mx-auto text-emerald-400 mb-2" />
                  <div className="text-sm text-slate-500">No jobs match this filter</div>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {filtered.map(job => (
                    <DeadlineRow key={job.id} job={job} onClick={() => handleRowClick(job.id)} />
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-2 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-500 flex items-center justify-between">
              <span>{filtered.length} of {counts.all} jobs</span>
              <span>Click a row to open job details</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DeadlineRow({ job, onClick }: { job: any; onClick: () => void }) {
  const status = STATUS_META[job.status as keyof typeof STATUS_META] || STATUS_META.unscheduled;
  const isFinished = job.status === 'completed' || job.status === 'onHold';
  const progressColor =
    job.progress >= 100 ? 'bg-emerald-500' :
    job.progress >= 75  ? 'bg-sky-500' :
    job.progress >= 25  ? 'bg-amber-500' : 'bg-slate-300';

  let deadlineLabel: React.ReactNode;
  if (job.status === 'completed') {
    deadlineLabel = (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
        <CheckCircle size={10} /> Done
      </span>
    );
  } else if (job.status === 'onHold') {
    deadlineLabel = (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
        <PauseCircle size={10} /> Paused
      </span>
    );
  } else if (job.isOverdue) {
    deadlineLabel = (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
        <AlertTriangle size={10} /> {Math.abs(job.daysLeft)}d overdue
      </span>
    );
  } else if (job.daysLeft <= 3) {
    deadlineLabel = (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
        <Clock size={10} /> {job.daysLeft}d left
      </span>
    );
  } else {
    deadlineLabel = (
      <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
        {job.daysLeft}d
      </span>
    );
  }

  return (
    <li
      onClick={onClick}
      className="px-5 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-amber-50/30 transition-colors"
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: job.colour }} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold text-slate-800 truncate">{job.jobName}</div>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${status.cls} flex-shrink-0`}>
            {status.label}
          </span>
          {job.atRisk && (
            <span className="flex items-center gap-0.5 text-[9px] font-semibold text-orange-600 flex-shrink-0">
              <AlertTriangle size={9} /> At risk
            </span>
          )}
        </div>
        <div className="text-[10px] text-slate-500 truncate mt-0.5">
          {job.clientName} · due {format(fromDateString(job.deadline), 'd MMM yyyy')}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${progressColor} transition-all`}
              style={{ width: `${job.progress}%`, opacity: isFinished && job.status === 'onHold' ? 0.5 : 1 }}
            />
          </div>
          <span className="text-[10px] font-semibold text-slate-500 w-9 text-right">
            {job.progress}%
          </span>
        </div>
      </div>

      <div className="flex-shrink-0">
        {deadlineLabel}
      </div>
    </li>
  );
}

import { useMemo, useState } from 'react';
import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useJobModal } from '../context/JobModalContext';
import { fromDateString } from '../utils/dateUtils';
import { isJobAtRisk } from '../utils/schedulingEngine';
import { DeadlinesModal } from './DeadlinesModal';
import { LiveBadge } from './LiveBadge';

const PREVIEW_COUNT = 5;

type FilterMode = 'all' | 'overdue' | 'urgent';

export function UpcomingDeadlines() {
  const { state } = useApp();
  const { openJob } = useJobModal();
  const { jobs, staff, scheduleEntries } = state;
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');

  const today = startOfDay(new Date());

  const annotated = useMemo(() => {
    const active = jobs.filter(j => j.status !== 'completed' && j.status !== 'onHold');
    return active.map(j => ({
      ...j,
      daysLeft: differenceInCalendarDays(fromDateString(j.deadline), today),
      atRisk: isJobAtRisk(j, scheduleEntries, staff),
    }));
  }, [jobs, scheduleEntries, staff, today]);

  const counts = useMemo(() => ({
    all: annotated.length,
    overdue: annotated.filter(j => j.daysLeft < 0).length,
    urgent: annotated.filter(j => j.daysLeft >= 0 && j.daysLeft <= 3).length,
  }), [annotated]);

  const filtered = useMemo(() => {
    const matchesFilter = (j: typeof annotated[number]) => {
      if (filter === 'overdue') return j.daysLeft < 0;
      if (filter === 'urgent')  return j.daysLeft >= 0 && j.daysLeft <= 3;
      return true;
    };
    return annotated
      .filter(matchesFilter)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [annotated, filter]);

  const upcoming = filtered.slice(0, PREVIEW_COUNT);
  const hiddenCount = Math.max(0, filtered.length - upcoming.length);

  const FILTERS: { id: FilterMode; label: string; count: number }[] = [
    { id: 'all',     label: 'All',     count: counts.all },
    { id: 'overdue', label: 'Overdue', count: counts.overdue },
    { id: 'urgent',  label: 'Urgent',  count: counts.urgent },
  ];

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col overflow-hidden">

        {/* Header band */}
        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-semibold text-slate-800 text-xs">Upcoming Deadlines</h3>
            <LiveBadge compact />
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex-shrink-0 text-[10px] font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-0.5 transition-colors"
          >
            View all <ChevronRight size={11} />
          </button>
        </div>

        {/* Sub-header band — filter pills mirroring the chart-card controls. */}
        <div className="px-3 py-1.5 border-b border-slate-100 flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-md ring-1 ring-slate-200 overflow-hidden bg-slate-50 flex-shrink-0">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                  filter === f.id ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {f.label}
                <span className="ml-1 text-[9px] text-slate-400 tabular-nums">{f.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Body band — list rows */}
        <ul className="divide-y divide-slate-100 flex-1">
          {upcoming.map(job => {
            const isOverdue = job.daysLeft < 0;
            const isUrgent = job.daysLeft >= 0 && job.daysLeft <= 3;
            const pillCls = isOverdue
              ? 'bg-red-50 text-red-600 border-red-100'
              : isUrgent
                ? 'bg-orange-50 text-orange-600 border-orange-100'
                : 'bg-slate-50 text-slate-500 border-slate-100';
            const pillLabel = isOverdue ? `${Math.abs(job.daysLeft)}d overdue` : `${job.daysLeft}d`;
            return (
              <li
                key={job.id}
                className="px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-amber-50/40 transition-colors"
                onClick={() => openJob(job.id)}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: job.colour }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-slate-800 truncate leading-tight">{job.jobName}</div>
                  <div className="text-[9px] text-slate-500 truncate leading-tight">{job.clientName}</div>
                </div>
                {job.atRisk && !isOverdue && (
                  <AlertTriangle size={10} className="text-orange-400 flex-shrink-0" />
                )}
                <span
                  className={`flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-md border tabular-nums ${pillCls}`}
                >
                  {pillLabel}
                </span>
              </li>
            );
          })}
          {upcoming.length === 0 && (
            <li className="py-6 text-center">
              <CheckCircle size={20} className="mx-auto text-emerald-400 mb-1.5" />
              <div className="text-[10px] text-slate-500">
                {filter === 'all' ? 'No upcoming deadlines' : `No ${filter} deadlines`}
              </div>
            </li>
          )}
        </ul>

        {/* Footer band — "+N more" trigger to open the full modal */}
        {hiddenCount > 0 && (
          <button
            onClick={() => setModalOpen(true)}
            className="border-t border-slate-100 px-3 py-1.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors flex items-center justify-center gap-1"
          >
            + {hiddenCount} more deadline{hiddenCount === 1 ? '' : 's'}
          </button>
        )}
      </div>

      <DeadlinesModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

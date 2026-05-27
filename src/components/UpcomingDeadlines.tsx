import { differenceInCalendarDays, isBefore, startOfDay } from 'date-fns';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useJobModal } from '../context/JobModalContext';
import { fromDateString } from '../utils/dateUtils';
import { isJobAtRisk } from '../utils/schedulingEngine';

export function UpcomingDeadlines() {
  const { state } = useApp();
  const { openJob } = useJobModal();
  const { jobs, staff, scheduleEntries } = state;

  const today = startOfDay(new Date());

  const upcoming = jobs
    .filter(j => j.status !== 'completed' && j.status !== 'onHold')
    .map(j => ({
      ...j,
      daysLeft: differenceInCalendarDays(fromDateString(j.deadline), today),
      atRisk: isJobAtRisk(j, scheduleEntries, staff),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 8);

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h2 className="font-semibold text-slate-800 text-sm">Upcoming Deadlines</h2>
        <p className="text-[10px] text-slate-400 mt-0.5">Click to view job</p>
      </div>
      <div className="divide-y divide-slate-50">
        {upcoming.map(job => {
          const isOverdue = job.daysLeft < 0;
          const isUrgent = job.daysLeft <= 3 && !isOverdue;
          return (
            <div
              key={job.id}
              className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-amber-50/30 transition-colors"
              onClick={() => openJob(job.id)}
            >
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: job.colour }} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-800 truncate">{job.jobName}</div>
                <div className="text-[10px] text-slate-500 truncate">{job.clientName}</div>
              </div>
              <div className="flex-shrink-0 flex items-center gap-1.5">
                {isOverdue ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                    <AlertTriangle size={10} /> Overdue
                  </span>
                ) : isUrgent ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                    <Clock size={10} /> {job.daysLeft}d
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">{job.daysLeft}d</span>
                )}
                {job.atRisk && !isOverdue && (
                  <AlertTriangle size={10} className="text-orange-400" />
                )}
              </div>
            </div>
          );
        })}
        {upcoming.length === 0 && (
          <div className="py-8 text-center">
            <CheckCircle size={24} className="mx-auto text-emerald-400 mb-2" />
            <div className="text-sm text-slate-500">No upcoming deadlines</div>
          </div>
        )}
      </div>
    </div>
  );
}

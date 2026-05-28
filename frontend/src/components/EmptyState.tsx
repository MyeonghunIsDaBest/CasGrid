/**
 * EmptyState — defensive zero-data card for the dashboard.
 *
 * Only renders when Supabase has no staff AND no jobs. In normal operation
 * (where Luke's existing rows are present) this never shows. Lives here so a
 * future "Clear all" or first-time install doesn't leave the dashboard
 * looking broken.
 */
import { Database, Users, Briefcase } from 'lucide-react';

interface Props {
  onAddStaff: () => void;
  onAddJob: () => void;
}

export function EmptyState({ onAddStaff, onAddJob }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 mb-4">
        <Database size={20} className="text-amber-500" />
      </div>
      <h2 className="text-base font-semibold text-slate-800 mb-1">No data yet</h2>
      <p className="text-sm text-slate-500 max-w-sm mx-auto">
        CasGrid pulls everyone and every job straight from your Supabase
        project. Add staff and jobs to see live capacity, scheduling, and
        utilisation here.
      </p>
      <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
        <button
          onClick={onAddStaff}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
        >
          <Users size={13} /> Add staff
        </button>
        <button
          onClick={onAddJob}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Briefcase size={13} /> Add a job
        </button>
      </div>
    </div>
  );
}

/**
 * RealtimeStatus — dashboard strip showing live sync state at a glance.
 *
 * Sits between KPICards and WeeklyPlanner on the dashboard route. Reuses the
 * existing `syncStatus` + `state.lastSyncAt` + `state.recentEvents` from
 * AppContext. No new persistence — everything is UI-only telemetry that the
 * AppContext reducers maintain (STAMP_SYNC / LOG_EVENT actions).
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp, Activity, Plus, Edit2, Trash2, Database } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LiveBadge } from './LiveBadge';
import { useNow, formatAgo } from '../utils/useNow';

const KIND_ICON = {
  add:    <Plus size={10} className="text-emerald-500" />,
  update: <Edit2 size={10} className="text-sky-500" />,
  delete: <Trash2 size={10} className="text-red-500" />,
  load:   <Database size={10} className="text-slate-400" />,
};

export function RealtimeStatus() {
  const { state } = useApp();
  const [expanded, setExpanded] = useState(false);
  const now = useNow(1000);

  const counts = {
    staff:      state.staff.length,
    jobs:       state.jobs.length,
    entries:    state.scheduleEntries.length,
    events:     state.staffEvents.length,
  };

  const recent = state.recentEvents.slice(0, 5);

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
          <Activity size={13} className="text-amber-500" />
          <span>Realtime sync</span>
        </div>

        <LiveBadge />

        <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500 tabular-nums">
          <span><strong className="text-slate-800">{counts.staff}</strong> staff</span>
          <span className="text-slate-300">·</span>
          <span><strong className="text-slate-800">{counts.jobs}</strong> jobs</span>
          <span className="text-slate-300">·</span>
          <span><strong className="text-slate-800">{counts.entries}</strong> entries</span>
          <span className="text-slate-300">·</span>
          <span><strong className="text-slate-800">{counts.events}</strong> events</span>
        </div>

        <button
          onClick={() => setExpanded(e => !e)}
          className="ml-auto flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors"
        >
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          Recent activity
        </button>
      </div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          {recent.length === 0 ? (
            <div className="text-[11px] text-slate-400 italic py-1">
              No activity yet — your changes and any cross-device edits will appear here.
            </div>
          ) : (
            <ul className="space-y-1">
              {recent.map((ev, i) => (
                <li key={i} className="flex items-center gap-2 text-[11px] text-slate-600">
                  {KIND_ICON[ev.kind]}
                  <span className="flex-1 truncate">{ev.label}</span>
                  <span className="text-slate-400 tabular-nums">{formatAgo(now - ev.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * LiveBadge — shared "● Live · updated 4s ago" chip.
 *
 * Used across every realtime-fed panel (WeeklyPlanner, WeeklyCapacityHeader,
 * StaffAllocationLayer, StaffUtilisationChart, RealtimeStatus). Reuses the
 * existing app-wide `syncStatus` and `lastSyncAt` from AppContext.
 */
import { useApp } from '../context/AppContext';
import { useNow, formatAgo } from '../utils/useNow';

interface Props {
  /** Optional label override (e.g. "Live data") */
  label?: string;
  /** Force a specific sync-status (defaults to AppContext.syncStatus) */
  status?: 'live' | 'reconnecting' | 'offline';
  /** Override the timestamp source (defaults to AppContext state.lastSyncAt) */
  lastSyncAt?: number | null;
  /** Compact mode — smaller chip for tight headers */
  compact?: boolean;
}

const META = {
  live:         { label: 'Live',   dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', pulse: false },
  reconnecting: { label: 'Sync…',  dot: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',   pulse: true  },
  offline:      { label: 'Offline',dot: 'bg-red-500',     text: 'text-red-600',     bg: 'bg-red-50',      border: 'border-red-200',     pulse: false },
};

export function LiveBadge({ label, status, lastSyncAt, compact = false }: Props) {
  const { syncStatus, state } = useApp();
  const effectiveStatus = status ?? syncStatus;
  const effectiveStamp = lastSyncAt ?? state.lastSyncAt;
  const meta = META[effectiveStatus] ?? META.reconnecting;
  const now = useNow(1000);
  const ago = effectiveStamp ? formatAgo(now - effectiveStamp) : '—';

  const padding = compact ? 'px-1.5 py-0.5' : 'px-2 py-1';
  const textSize = compact ? 'text-[9px]' : 'text-[10px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border ${meta.border} ${meta.bg} ${meta.text} ${padding} ${textSize} font-semibold leading-none`}
      title={effectiveStamp ? `Last sync: ${new Date(effectiveStamp).toLocaleString('en-AU')}` : 'Awaiting first sync'}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} ${meta.pulse ? 'animate-pulse' : ''}`} />
      <span>{label ?? meta.label}</span>
      <span className="opacity-60 font-medium tabular-nums">· {ago}</span>
    </span>
  );
}

// @ts-nocheck
/**
 * StaffUtilisationModal — full-size expanded view of the Staff Utilisation
 * chart. Mirrors the dashboard card's data + tooltip, but renders bigger
 * so all staff are visible without scrolling and the bars have room to
 * breathe. Triggered by the "View full →" link in the card header.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { X, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '../context/AppContext';
import { getWeekWorkingDays, toDateString } from '../utils/dateUtils';
import {
  getEffectiveAvailable, getJobRiskLevel, getJobRiskFill, getJobRiskLabel,
} from '../utils/schedulingEngine';
import { useNow } from '../utils/useNow';
import { LiveBadge } from './LiveBadge';

type StaffRange = 'day' | 'week' | 'month';

// Small KPI tile used in the modal's stats strip. `accent` tints the
// primary value text to give each tile a clear status at a glance.
function KpiTile({
  label,
  primary,
  secondary,
  accent,
}: {
  label: string;
  primary: string;
  secondary?: string;
  accent: 'slate' | 'amber' | 'emerald' | 'red';
}) {
  const accentClass = {
    slate:   'text-slate-800',
    amber:   'text-amber-600',
    emerald: 'text-emerald-600',
    red:     'text-red-600',
  }[accent];
  const accentRing = {
    slate:   'ring-slate-200',
    amber:   'ring-amber-200',
    emerald: 'ring-emerald-200',
    red:     'ring-red-200',
  }[accent];
  return (
    <div className={`rounded-lg bg-white ring-1 ${accentRing} px-3 py-2 min-w-0`}>
      <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 truncate">
        {label}
      </div>
      <div className={`text-base font-bold tabular-nums leading-tight truncate ${accentClass}`}>
        {primary}
      </div>
      {secondary && (
        <div className="text-[9px] text-slate-500 truncate mt-0.5">{secondary}</div>
      )}
    </div>
  );
}

function StaffTickModal({ x, y, payload, nonBillableMap, width = 140 }: any) {
  const isNB = !!nonBillableMap?.[payload.value];
  // 14px safe-zone from the YAxis label area's left edge prevents the
  // first character from clipping on the chart's render boundary.
  const leftX = -(width - 14);
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={leftX} y={0} dy={4} textAnchor="start" fontSize={13} fill="#1e293b" fontWeight={500}>
        {payload.value}
      </text>
      {isNB && (
        <text x={leftX} y={15} dy={4} textAnchor="start" fontSize={10} fill="#94a3b8">
          non-billable
        </text>
      )}
    </g>
  );
}

function StackedTooltipModal({ active, payload, label, jobMeta }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const segments = payload
    .filter((p: any) => p.dataKey !== 'Available' && p.value > 0)
    .sort((a: any, b: any) => b.value - a.value);
  const total = segments.reduce((s: number, p: any) => s + p.value, 0);
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-[11px] min-w-[180px]">
      <div className="text-slate-500 font-semibold mb-1">{label}</div>
      {segments.map((p: any) => {
        const meta = jobMeta?.[p.dataKey];
        const risk = meta?.risk ?? 'ok';
        return (
          <div key={p.dataKey} className="flex items-center gap-1.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getJobRiskFill(risk) }} />
            <span className="flex-1 text-slate-700 truncate" style={{ maxWidth: 200 }}>
              {meta?.name ?? p.dataKey}
            </span>
            <span className="font-bold text-slate-800 tabular-nums">{p.value.toFixed(1)}h</span>
            <span className="text-[9px] text-slate-400">{getJobRiskLabel(risk)}</span>
          </div>
        );
      })}
      {segments.length > 1 && (
        <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-100">
          <span className="flex-1 text-slate-500 font-semibold">Total</span>
          <span className="font-bold tabular-nums">{total.toFixed(1)}h</span>
        </div>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function StaffUtilisationModal({ open, onClose }: Props) {
  const { state } = useApp();
  const { staff, jobs, scheduleEntries, staffEvents, settings } = state;
  const now = useNow(60_000);

  const [range, setRange] = useState<StaffRange>('week');

  const days = useMemo(() => {
    if (range === 'day') return [new Date()];
    if (range === 'month') {
      return Array.from({ length: 4 }, (_, i) =>
        getWeekWorkingDays(settings.currentWeekOffset + i),
      ).flat();
    }
    return getWeekWorkingDays(settings.currentWeekOffset);
  }, [range, settings.currentWeekOffset]);

  const dayStrings = days.map(toDateString);

  // Show every active staff member; sort billable first.
  const activeStaff = useMemo(
    () => [...staff]
      .filter(s => s.active)
      .sort((a, b) =>
        (Number(b.isBillable) - Number(a.isBillable)) || a.name.localeCompare(b.name),
      ),
    [staff],
  );

  const { rows, jobsInView, jobMeta, nonBillableMap, jobTotals, totalScheduled, totalAvailable, totalAtRisk, topUtilised } = useMemo(() => {
    const completedIds = new Set(jobs.filter(j => j.status === 'completed').map(j => j.id));
    const sjh: Record<string, Record<string, number>> = {};
    for (const s of activeStaff) sjh[s.id] = {};
    for (const e of scheduleEntries) {
      if (!dayStrings.includes(e.date)) continue;
      if (completedIds.has(e.jobId)) continue;
      if (!sjh[e.staffId]) continue;
      sjh[e.staffId][e.jobId] = (sjh[e.staffId][e.jobId] ?? 0) + e.hours;
    }
    const ids = new Set<string>();
    for (const sid of Object.keys(sjh)) for (const jid of Object.keys(sjh[sid])) ids.add(jid);
    const jobsInView = jobs.filter(j => ids.has(j.id));
    const meta: Record<string, { name: string; risk: ReturnType<typeof getJobRiskLevel>; colour: string }> = {};
    for (const j of jobsInView) {
      meta[j.id] = {
        name: j.jobName,
        risk: getJobRiskLevel(j, scheduleEntries, new Date(now)),
        colour: j.colour,
      };
    }
    const totals: Record<string, number> = {};
    for (const j of jobsInView) {
      totals[j.id] = Object.values(sjh).reduce((s, jh) => s + (jh[j.id] ?? 0), 0);
    }
    const ordered = [...jobsInView].sort((a, b) => totals[b.id] - totals[a.id]);

    const nonBillableMap: Record<string, boolean> = {};
    let totalScheduled = 0;
    let totalAvailable = 0;
    let topUtilised: { name: string; pct: number } | null = null;
    const rows = activeStaff.map(member => {
      if (!member.isBillable) nonBillableMap[member.name] = true;
      const avail = Math.round(dayStrings.reduce(
        (s, d) => s + getEffectiveAvailable(member, d, staffEvents), 0,
      ));
      let staffTotal = 0;
      for (const j of ordered) staffTotal += sjh[member.id][j.id] ?? 0;
      totalScheduled += staffTotal;
      totalAvailable += avail;
      if (member.isBillable && avail > 0) {
        const pct = (staffTotal / avail) * 100;
        if (!topUtilised || pct > topUtilised.pct) {
          topUtilised = { name: member.name, pct };
        }
      }
      const row: Record<string, number | string> = {
        name: member.name,
        Available: avail,
      };
      for (const j of ordered) row[j.id] = sjh[member.id][j.id] ?? 0;
      return row;
    });
    // Sum at-risk job hours (just the at-risk-classified jobs' totals)
    const totalAtRisk = ordered
      .filter(j => meta[j.id].risk === 'critical')
      .reduce((s, j) => s + totals[j.id], 0);
    return {
      rows, jobsInView: ordered, jobMeta: meta, nonBillableMap,
      jobTotals: totals,
      totalScheduled: Math.round(totalScheduled * 10) / 10,
      totalAvailable,
      totalAtRisk: Math.round(totalAtRisk * 10) / 10,
      topUtilised,
    };
  }, [activeStaff, dayStrings.join(','), jobs, scheduleEntries, staffEvents, now]);

  const utilisationPct = totalAvailable > 0
    ? Math.round((totalScheduled / totalAvailable) * 100)
    : 0;

  const rangeLabel = useMemo(() => {
    if (days.length === 0) return '';
    if (range === 'day') return `Today, ${format(days[0], 'EEE d MMM')}`;
    if (range === 'month') return `${format(days[0], 'd MMM')} → ${format(days[days.length - 1], 'd MMM')} · 4 weeks`;
    return `${format(days[0], 'EEE d MMM')} → ${format(days[days.length - 1], 'EEE d MMM')}`;
  }, [days, range]);

  // Keep a ref to onClose so the body-scroll-lock effect doesn't tear down
  // and set up every time the parent re-renders (parents typically pass an
  // inline arrow function whose identity changes each render).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Body scroll lock + ESC closes
  useEffect(() => {
    if (!open) return;
    const prevBody = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCloseRef.current(); }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevBody;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open) return null;

  // Height per staff is generous in the modal — every staff visible.
  const chartHeight = Math.max(280, 34 * activeStaff.length + 60);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col z-10 overflow-hidden"
      >
        {/* Header band — bolder treatment for the modal */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-amber-50/60 via-white to-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm shadow-amber-500/30 ring-1 ring-amber-600/20 flex items-center justify-center">
              <Users size={16} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-900 text-base leading-tight">Staff Utilisation</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <LiveBadge compact />
                <span className="text-[10px] text-slate-400 tabular-nums">· {rangeLabel}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 flex-shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* KPI strip — at-a-glance team summary */}
        <div className="px-5 py-3 border-b border-slate-100 grid grid-cols-4 gap-2">
          <KpiTile
            label="Scheduled"
            primary={`${totalScheduled.toFixed(1)}h`}
            secondary={`of ${totalAvailable}h`}
            accent="slate"
          />
          <KpiTile
            label="Utilisation"
            primary={`${utilisationPct}%`}
            secondary={
              utilisationPct < 75 ? 'Healthy load' :
              utilisationPct < 95 ? 'Near capacity' : 'Overloaded'
            }
            accent={
              utilisationPct < 75 ? 'emerald' :
              utilisationPct < 95 ? 'amber' : 'red'
            }
          />
          <KpiTile
            label="At-risk hours"
            primary={`${totalAtRisk.toFixed(1)}h`}
            secondary={totalAtRisk > 0 ? 'Needs attention' : 'All clear'}
            accent={totalAtRisk > 0 ? 'red' : 'emerald'}
          />
          <KpiTile
            label="Top utilised"
            primary={topUtilised ? topUtilised.name.split(' ')[0] : '—'}
            secondary={topUtilised ? `${Math.round(topUtilised.pct)}%` : 'No data'}
            accent="amber"
          />
        </div>

        {/* Sub-header band — range toggle + risk legend */}
        <div className="px-5 py-2.5 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <div className="inline-flex rounded-md ring-1 ring-slate-200 overflow-hidden bg-slate-50 flex-shrink-0">
            {(['day','week','month'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-[11px] font-semibold capitalize transition-colors ${
                  range === r ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <span className="flex-1" />
          <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-shrink-0">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"/>On track</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"/>Behind</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"/>At risk</span>
          </div>
        </div>

        {/* Body band — full-size chart, generous spacing */}
        <div className="p-5 flex-1 overflow-y-auto custom-thin-scrollbar">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="h" domain={[0, 'dataMax + 5']} />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                width={140}
                tick={<StaffTickModal nonBillableMap={nonBillableMap} width={140} />}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                content={<StackedTooltipModal jobMeta={jobMeta} />}
              />
              {jobsInView.map(j => (
                <Bar
                  key={j.id}
                  dataKey={j.id}
                  stackId="alloc"
                  name={j.jobName}
                  fill={getJobRiskFill(jobMeta[j.id].risk)}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
          {jobsInView.length === 0 && (
            <div className="text-center text-[12px] text-slate-400 py-6">No allocated work in this range.</div>
          )}

          {/* Per-job legend — chips with the job's risk-coloured dot, name,
              total hours across the team, and risk label. Biggest contributors
              first. Helps users tie a colour in the bars to a real job. */}
          {jobsInView.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Jobs in view ({jobsInView.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {jobsInView.map(j => {
                  const meta = jobMeta[j.id];
                  const hours = jobTotals[j.id];
                  return (
                    <div
                      key={j.id}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-200 bg-white text-[11px]"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getJobRiskFill(meta.risk) }}
                      />
                      <span className="font-semibold text-slate-700 truncate" style={{ maxWidth: 180 }}>
                        {meta.name}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="font-bold text-slate-800 tabular-nums">{hours.toFixed(1)}h</span>
                      <span
                        className="text-[9px] font-semibold"
                        style={{ color: getJobRiskFill(meta.risk) }}
                      >
                        {getJobRiskLabel(meta.risk)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer band — context summary */}
        <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between gap-2 text-[11px]">
          <span className="text-slate-500">
            Showing {activeStaff.length} active staff{' '}
            {activeStaff.some(s => !s.isBillable) && (
              <span className="text-slate-400">· non-billable tagged</span>
            )}
          </span>
          <button
            onClick={onClose}
            className="text-amber-600 hover:text-amber-700 font-semibold"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}

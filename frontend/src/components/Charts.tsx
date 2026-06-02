// @ts-nocheck
/**
 * Risk-aware dashboard charts.
 *
 * - CapacityChart: one stacked bar per weekday, segments = per-job hours,
 *   colored by job risk (red/amber/green), biggest contributor of the week
 *   on top. A dashed "available" line traces per-day capacity so an
 *   overbooked day visibly overshoots.
 * - StaffUtilisationChart: one horizontal stacked bar per staff, segments =
 *   per-job allocation, colored by risk, sorted biggest-first.
 *
 * Risk is derived live from `getJobRiskLevel`; a 1-minute tick re-evaluates
 * so jobs transition into "warning" / "critical" as time passes even
 * without data changes.
 */
import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ComposedChart, Line,
} from 'recharts';
import { format, differenceInCalendarDays } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getWeekWorkingDays, toDateString, formatDayShort, fromDateString } from '../utils/dateUtils';
import {
  computeDailyLoads,
  getEffectiveAvailable,
  getJobRiskLevel,
  getJobRiskFill,
  getJobRiskLabel,
  getRemainingHours,
  worstRisk,
} from '../utils/schedulingEngine';
import { LiveBadge } from './LiveBadge';
import { useNow } from '../utils/useNow';
import { StaffUtilisationModal } from './StaffUtilisationModal';

function RiskLegend() {
  return (
    <div className="flex items-center gap-2 text-[9px] text-slate-500 flex-shrink-0">
      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"/>On track</span>
      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"/>Behind</span>
      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"/>At risk</span>
    </div>
  );
}

// CapacityChart tooltip — three risk tiers, each with its underlying job
// breakdown for that day, plus the day total + available + overage.
function TierTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  // The row data is identical for every entry in payload — grab it once.
  const row = payload[0]?.payload as
    | {
        onTrack: number;
        behind: number;
        atRisk: number;
        Available: number;
        _jobs: Record<'ok' | 'warning' | 'critical', Array<{ id: string; name: string; hours: number }>>;
      }
    | undefined;
  if (!row) return null;
  const tiers: Array<['ok' | 'warning' | 'critical', number]> = [
    ['critical', row.atRisk],
    ['warning',  row.behind],
    ['ok',       row.onTrack],
  ];
  const total = row.onTrack + row.behind + row.atRisk;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-2.5 py-1.5 text-[10px] min-w-[160px]">
      <div className="text-slate-500 font-semibold mb-1">{label}</div>
      {tiers.map(([tier, hours]) => {
        if (hours <= 0) return null;
        const jobs = row._jobs[tier];
        return (
          <div key={tier} className="mb-1 last:mb-0">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getJobRiskFill(tier) }} />
              <span className="flex-1 font-semibold text-slate-700">{getJobRiskLabel(tier)}</span>
              <span className="font-bold tabular-nums text-slate-800">{hours.toFixed(1)}h</span>
            </div>
            {jobs.map(j => (
              <div key={j.id} className="flex items-center gap-1.5 pl-3 text-[9px] text-slate-500">
                <span className="flex-1 truncate" style={{ maxWidth: 140 }}>{j.name}</span>
                <span className="tabular-nums">{j.hours.toFixed(1)}h</span>
              </div>
            ))}
          </div>
        );
      })}
      {total === 0 && (
        <div className="text-[9px] text-slate-400 italic">No allocations.</div>
      )}
      <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-100 text-[9px] text-slate-500">
        <span className="flex-1">Total</span>
        <span className="font-bold tabular-nums text-slate-700">{total.toFixed(1)}h</span>
        <span className="text-slate-400">/ {row.Available}h</span>
      </div>
      {total > row.Available && (
        <div className="text-[9px] text-red-500 font-semibold mt-0.5">
          +{(total - row.Available).toFixed(1)}h over capacity
        </div>
      )}
    </div>
  );
}

// Recharts tooltip rendering — show the segment's job + hours + risk tier
function StackedTooltip({ active, payload, label, jobMeta }) {
  if (!active || !payload || payload.length === 0) return null;
  // Filter out the Available line entry and zero-hour entries
  const segments = payload
    .filter(p => p.dataKey !== 'Available' && p.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = segments.reduce((s, p) => s + p.value, 0);
  const avail = payload.find(p => p.dataKey === 'Available')?.value;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-2.5 py-1.5 text-[10px] min-w-[140px]">
      <div className="text-slate-500 font-semibold mb-1">{label}</div>
      {segments.map(p => {
        const meta = jobMeta?.[p.dataKey];
        const risk = meta?.risk ?? 'ok';
        return (
          <div key={p.dataKey} className="flex items-center gap-1.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getJobRiskFill(risk) }} />
            <span className="flex-1 text-slate-700 truncate" style={{ maxWidth: 140 }}>
              {meta?.name ?? p.dataKey}
            </span>
            <span className="font-bold text-slate-800 tabular-nums">{p.value.toFixed(1)}h</span>
            <span className="text-[8px] text-slate-400">{getJobRiskLabel(risk)}</span>
          </div>
        );
      })}
      {segments.length > 1 && (
        <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-100">
          <span className="flex-1 text-slate-500 font-semibold">Total</span>
          <span className="font-bold tabular-nums">{total.toFixed(1)}h</span>
        </div>
      )}
      {typeof avail === 'number' && (
        <div className="text-[9px] text-slate-400 mt-0.5">
          Avail {avail.toFixed(0)}h
          {total > avail && (
            <span className="ml-1 text-red-500 font-semibold">+{(total - avail).toFixed(1)}h over</span>
          )}
        </div>
      )}
    </div>
  );
}

export function CapacityChart() {
  const { state } = useApp();
  const { staff, jobs, scheduleEntries, staffEvents, settings } = state;

  // Tick risk re-evaluation every minute so colours stay accurate as time
  // passes even when nothing else changes in the data.
  const now = useNow(60_000);

  // 'all' or a specific job id. Picks ONE project to visualise across the
  // week — useful when scanning a single job's progression.
  const [projectFilter, setProjectFilter] = useState<string | 'all'>('all');

  const days = getWeekWorkingDays(settings.currentWeekOffset);
  const dayStrings = days.map(toDateString);
  const billableStaff = staff.filter(s => s.active && s.isBillable);

  // Picker options (active jobs only, alphabetical).
  const filterableJobs = useMemo(
    () => jobs
      .filter(j => j.status !== 'completed' && j.status !== 'onHold')
      .sort((a, b) => a.jobName.localeCompare(b.jobName)),
    [jobs],
  );

  // One row per day with three risk-tier totals (onTrack / behind / atRisk)
  // plus the day's available capacity and a hidden `_jobs` map for the
  // tooltip to list which jobs sit in which tier.
  const chartData = useMemo(() => {
    const completedIds = new Set(jobs.filter(j => j.status === 'completed').map(j => j.id));
    return days.map(day => {
      const dateStr = toDateString(day);

      // Sum hours per job for that day. Restrict to the selected project
      // when a filter is on — everything downstream still bucket-sorts the
      // hours into the three risk tiers.
      const dayJobHours: Record<string, number> = {};
      for (const e of scheduleEntries) {
        if (e.date !== dateStr) continue;
        if (completedIds.has(e.jobId)) continue;
        if (projectFilter !== 'all' && e.jobId !== projectFilter) continue;
        dayJobHours[e.jobId] = (dayJobHours[e.jobId] ?? 0) + e.hours;
      }

      // Bucket each job's hours into its risk tier
      const _jobs: Record<'ok' | 'warning' | 'critical', Array<{ id: string; name: string; hours: number }>> = {
        ok: [], warning: [], critical: [],
      };
      let onTrack = 0, behind = 0, atRisk = 0;
      for (const [jid, hours] of Object.entries(dayJobHours)) {
        const job = jobs.find(j => j.id === jid);
        if (!job) continue;
        const risk = getJobRiskLevel(job, scheduleEntries, new Date(now));
        _jobs[risk].push({ id: job.id, name: job.jobName, hours });
        if (risk === 'ok') onTrack += hours;
        else if (risk === 'warning') behind += hours;
        else atRisk += hours;
      }

      // Per-day available capacity (the dashed line series)
      const Available = Math.round(
        billableStaff.reduce((s, m) => s + getEffectiveAvailable(m, dateStr, staffEvents), 0),
      );

      // Sort each tier's job list biggest-first so the tooltip reads naturally
      for (const k of Object.keys(_jobs) as Array<keyof typeof _jobs>) {
        _jobs[k].sort((a, b) => b.hours - a.hours);
      }

      return {
        day: formatDayShort(day),
        onTrack: Math.round(onTrack * 10) / 10,
        behind:  Math.round(behind  * 10) / 10,
        atRisk:  Math.round(atRisk  * 10) / 10,
        Available,
        _jobs,
      };
    });
  }, [dayStrings.join(','), jobs, scheduleEntries, staffEvents, billableStaff, now, projectFilter]);

  const hasAny = chartData.some(r => r.onTrack > 0 || r.behind > 0 || r.atRisk > 0);

  // Info row about the filtered project: scheduled vs estimated, days to
  // deadline, current risk tier.
  const filteredJobInfo = useMemo(() => {
    if (projectFilter === 'all') return null;
    const job = jobs.find(j => j.id === projectFilter);
    if (!job) return null;
    const scheduledHours = scheduleEntries
      .filter(e => e.jobId === job.id)
      .reduce((s, e) => s + e.hours, 0);
    const remaining = getRemainingHours(job, scheduleEntries);
    const risk = getJobRiskLevel(job, scheduleEntries, new Date(now));
    const daysLeft = differenceInCalendarDays(fromDateString(job.deadline), new Date());
    return { job, scheduledHours, remaining, risk, daysLeft };
  }, [projectFilter, jobs, scheduleEntries, now]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col overflow-hidden">

      {/* Header band */}
      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-semibold text-slate-800 text-xs">Weekly Capacity</h3>
          <LiveBadge compact />
        </div>
        <RiskLegend />
      </div>

      {/* Sub-header band — project filter */}
      <div className="px-10 py-6 border-b border-slate-100 flex items-center gap-2">
        <span className="text-[12px] text-slate-400 font-semibold uppercase tracking-wide flex-shrink-0">Project</span>
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400 flex-1 min-w-0 truncate"
        >
          <option value="all">All projects</option>
          {filterableJobs.map(j => (
            <option key={j.id} value={j.id}>{j.jobName}</option>
          ))}
        </select>
      </div>

      {/* Body band */}
      <div className="p-3 flex-1">
        <ResponsiveContainer width="100%" height={150}>
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 8, bottom: 4, left: -8 }}
            barCategoryGap="22%"
            barGap={2}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="h" width={28} />
            <Tooltip
              cursor={{ fill: 'rgba(148,163,184,0.08)' }}
              content={<TierTooltip />}
            />
            {/* Three grouped bars per day — on-track / behind / at-risk hours.
                No stackId → Recharts renders them side-by-side. */}
            <Bar dataKey="onTrack" name="On track" fill={getJobRiskFill('ok')}       radius={[2,2,0,0]} isAnimationActive={false} />
            <Bar dataKey="behind"  name="Behind"   fill={getJobRiskFill('warning')}  radius={[2,2,0,0]} isAnimationActive={false} />
            <Bar dataKey="atRisk"  name="At risk"  fill={getJobRiskFill('critical')} radius={[2,2,0,0]} isAnimationActive={false} />
            {/* Dashed Available capacity line stays so overbooked days visibly
                overshoot the three bars below. */}
            <Line
              type="monotone"
              dataKey="Available"
              stroke="#475569"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={{ r: 2, fill: '#475569' }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        {!hasAny && (
          <div className="text-center text-[10px] text-slate-400 pt-1">
            {projectFilter === 'all' ? 'No allocated work this week.' : 'No allocations for this project this week.'}
          </div>
        )}
      </div>

      {/* Footer band — only present when a project is filtered. Surfaces
          scheduling status inline so the picker is doing real work. */}
      {filteredJobInfo && (
        <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px] flex-wrap">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: getJobRiskFill(filteredJobInfo.risk) }}
          />
          <span className="font-semibold text-slate-700 truncate" style={{ maxWidth: 140 }}>
            {filteredJobInfo.job.jobName}
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-600 tabular-nums">
            {filteredJobInfo.scheduledHours.toFixed(0)}h / {filteredJobInfo.job.estimatedHours}h
          </span>
          <span className="text-slate-300">·</span>
          <span className={`tabular-nums font-semibold ${
            filteredJobInfo.daysLeft < 0 ? 'text-red-600' :
            filteredJobInfo.daysLeft <= 3 ? 'text-orange-600' : 'text-slate-600'
          }`}>
            {filteredJobInfo.daysLeft < 0
              ? `${Math.abs(filteredJobInfo.daysLeft)}d overdue`
              : `${filteredJobInfo.daysLeft}d to deadline`}
          </span>
          <span className="text-slate-300">·</span>
          <span className="font-semibold" style={{ color: getJobRiskFill(filteredJobInfo.risk) }}>
            {getJobRiskLabel(filteredJobInfo.risk)}
          </span>
        </div>
      )}
    </div>
  );
}

type StaffRange = 'day' | 'week' | 'month';

// Custom YAxis tick: staff name on top, "non-billable" tag below for
// non-billable rows. Names are LEFT-aligned (textAnchor="start") at the
// leftmost edge of the YAxis label area so every staff row's name hugs
// the card's left side. `compact` shrinks fonts for the dashboard-card
// variant; `width` is the YAxis width so the start offset can be sized
// to match.
function StaffTick({ x, y, payload, nonBillableMap, compact, width = 80 }: any) {
  const isNB = !!nonBillableMap?.[payload.value];
  const nameSize = compact ? 10 : 12;
  const tagSize = compact ? 8 : 9;
  const tagDy = compact ? 12 : 14;
  // Recharts tick x is the axis position (right edge of label area for
  // a vertical-layout YAxis). textAnchor="start" anchors text at leftX;
  // -(width - 14) keeps a 14px safe-zone from the YAxis label area's
  // left edge so the first character doesn't clip on the chart's render
  // boundary while still hugging the card's left side.
  const leftX = -(width - 14);
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={leftX} y={0} dy={4} textAnchor="start" fontSize={nameSize} fill="#1e293b" fontWeight={500}>
        {payload.value}
      </text>
      {isNB && (
        <text x={leftX} y={tagDy} dy={4} textAnchor="start" fontSize={tagSize} fill="#94a3b8">
          non-billable
        </text>
      )}
    </g>
  );
}

export function StaffUtilisationChart() {
  const { state } = useApp();
  const { staff, jobs, scheduleEntries, staffEvents, settings } = state;

  const now = useNow(60_000);

  // 'day' (today only), 'week' (5 working days, default), 'month'
  // (~4 working weeks). Local UI state; doesn't affect data persistence.
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

  // Show every active staff member — including non-billable. Sort billable
  // first so the field crew stays at the top of the chart.
  const activeStaff = useMemo(
    () => [...staff]
      .filter(s => s.active)
      .sort((a, b) =>
        (Number(b.isBillable) - Number(a.isBillable)) || a.name.localeCompare(b.name),
      ),
    [staff],
  );

  // For each staff: ordered segments by job (largest first), each tagged with risk.
  const { rows, jobsInView, jobMeta, nonBillableMap } = useMemo(() => {
    const completedIds = new Set(jobs.filter(j => j.status === 'completed').map(j => j.id));

    // staffId → jobId → hours
    const sjh: Record<string, Record<string, number>> = {};
    for (const s of activeStaff) sjh[s.id] = {};
    for (const e of scheduleEntries) {
      if (!dayStrings.includes(e.date)) continue;
      if (completedIds.has(e.jobId)) continue;
      if (!sjh[e.staffId]) continue;
      sjh[e.staffId][e.jobId] = (sjh[e.staffId][e.jobId] ?? 0) + e.hours;
    }

    // Jobs that appear for anyone this range
    const ids = new Set<string>();
    for (const sid of Object.keys(sjh)) for (const jid of Object.keys(sjh[sid])) ids.add(jid);
    const jobsInView = jobs.filter(j => ids.has(j.id));
    const meta: Record<string, { name: string; risk: ReturnType<typeof getJobRiskLevel> }> = {};
    for (const j of jobsInView) {
      meta[j.id] = {
        name: j.jobName,
        risk: getJobRiskLevel(j, scheduleEntries, new Date(now)),
      };
    }

    // Sort jobs globally by total range hours desc so the top of each row is
    // the biggest contributor for the period.
    const totals: Record<string, number> = {};
    for (const j of jobsInView) {
      totals[j.id] = Object.values(sjh).reduce((s, jh) => s + (jh[j.id] ?? 0), 0);
    }
    const ordered = [...jobsInView].sort((a, b) => totals[b.id] - totals[a.id]);

    const nonBillableMap: Record<string, boolean> = {};
    const rows = activeStaff.map(member => {
      if (!member.isBillable) nonBillableMap[member.name] = true;
      const totalAvail = dayStrings.reduce(
        (s, d) => s + getEffectiveAvailable(member, d, staffEvents), 0,
      );
      const row: Record<string, number | string> = {
        name: member.name,
        Available: Math.round(totalAvail),
      };
      for (const j of ordered) row[j.id] = sjh[member.id][j.id] ?? 0;
      return row;
    });

    return { rows, jobsInView: ordered, jobMeta: meta, nonBillableMap };
  }, [activeStaff, dayStrings.join(','), jobs, scheduleEntries, staffEvents, now]);

  const rangeLabel = useMemo(() => {
    if (days.length === 0) return '';
    if (range === 'day') return `Today, ${format(days[0], 'EEE d MMM')}`;
    if (range === 'month') return `${format(days[0], 'd MMM')} → ${format(days[days.length - 1], 'd MMM')} · 4 weeks`;
    return `${format(days[0], 'EEE d MMM')} → ${format(days[days.length - 1], 'EEE d MMM')}`;
  }, [days, range]);

  const chartHeight = Math.max(120, 22 * activeStaff.length + 32);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
    <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col overflow-hidden">

      {/* Header band */}
      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-semibold text-slate-800 text-xs">Staff Utilisation</h3>
          <LiveBadge compact />
        </div>
        <RiskLegend />
      </div>

      {/* Sub-header band — toggle + range subtitle, View full link on right */}
      <div className="px-3 py-1.5 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-md ring-1 ring-slate-200 overflow-hidden bg-slate-50 flex-shrink-0">
          {(['day','week','month'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-0.5 text-[10px] font-semibold capitalize transition-colors ${
                range === r ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <span className="text-[9px] text-slate-400 truncate tabular-nums flex-1 min-w-0">{rangeLabel}</span>
        <button
          onClick={() => setModalOpen(true)}
          className="flex-shrink-0 text-[10px] font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-0.5 transition-colors"
        >
          View full <ChevronRight size={11} />
        </button>
      </div>

      {/* Body band — scroll wrapper + chart */}
      <div className="p-3 flex-1">
        <div className="overflow-y-auto overflow-x-hidden custom-thin-scrollbar" style={{ maxHeight: 200 }}>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="h" domain={[0, 'dataMax + 5']} />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                width={110}
                tick={<StaffTick nonBillableMap={nonBillableMap} compact width={110} />}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                content={<StackedTooltip jobMeta={jobMeta} />}
              />
              {/* Per-staff allocation stack; the per-staff available figure is
                  surfaced via the tooltip ("Avail Xh / +Y over") instead of a
                  side-by-side track. */}
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
        </div>
        {jobsInView.length === 0 && (
          <div className="text-center text-[10px] text-slate-400 pt-2">No allocated work in this range.</div>
        )}
      </div>
    </div>

    <StaffUtilisationModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

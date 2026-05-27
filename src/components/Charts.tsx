// @ts-nocheck
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell, ReferenceLine
} from 'recharts';
import { useApp } from '../context/AppContext';
import { getWeekWorkingDays, toDateString, formatDayShort } from '../utils/dateUtils';
import { computeDailyLoads, getEffectiveAvailable } from '../utils/schedulingEngine';

export function CapacityChart() {
  const { state } = useApp();
  const { staff, jobs, scheduleEntries, staffEvents, settings } = state;
  const days = getWeekWorkingDays(settings.currentWeekOffset);
  const dayStrings = days.map(toDateString);
  const billableStaff = staff.filter(s => s.active && s.isBillable);
  const dailyLoads = computeDailyLoads(dayStrings, billableStaff, scheduleEntries, jobs, staffEvents);

  const chartData = days.map(day => {
    const dateStr = toDateString(day);
    // Effective available accounts for trade school / leave
    const totalAvailable = billableStaff.reduce(
      (s, m) => s + getEffectiveAvailable(m, dateStr, staffEvents), 0
    );
    const totalAllocated = billableStaff.reduce(
      (s, m) => s + (dailyLoads[dateStr]?.[m.id] ?? 0), 0
    );
    const hasTradeSchool = staffEvents.some(ev => ev.date === dateStr && ev.type === 'tradeSchool');
    return {
      day: formatDayShort(day),
      Available: Math.round(totalAvailable),
      Allocated: Math.round(totalAllocated * 10) / 10,
      hasTS: hasTradeSchool,
    };
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800 text-sm">Weekly Capacity</h3>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-slate-200 inline-block"/>Available</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500 inline-block"/>Allocated</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} barSize={28} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="h" />
          <Tooltip
            contentStyle={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,.1)' }}
            formatter={(val, name) => [`${val}h`, name]}
          />
          <Bar dataKey="Available" fill="#e2e8f0" radius={[4,4,0,0]} />
          <Bar dataKey="Allocated" radius={[4,4,0,0]}>
            {chartData.map((entry, i) => {
              const ratio = entry.Allocated / Math.max(entry.Available, 1);
              const color = ratio < 0.75 ? '#10b981' : ratio < 0.95 ? '#f59e0b' : '#ef4444';
              return <Cell key={i} fill={color} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StaffUtilisationChart() {
  const { state } = useApp();
  const { staff, jobs, scheduleEntries, staffEvents, settings } = state;
  const days = getWeekWorkingDays(settings.currentWeekOffset);
  const dayStrings = days.map(toDateString);
  const billableStaff = staff.filter(s => s.active && s.isBillable);
  const dailyLoads = computeDailyLoads(dayStrings, billableStaff, scheduleEntries, jobs, staffEvents);

  const chartData = billableStaff.map(member => {
    const totalAllocated = dayStrings.reduce(
      (s, d) => s + (dailyLoads[d]?.[member.id] ?? 0), 0
    );
    const totalAvailable = dayStrings.reduce(
      (s, d) => s + getEffectiveAvailable(member, d, staffEvents), 0
    );
    const util = totalAvailable > 0 ? Math.round((totalAllocated / totalAvailable) * 100) : 0;
    const tsCount = staffEvents.filter(ev =>
      ev.staffId === member.id && dayStrings.includes(ev.date) && ev.type === 'tradeSchool'
    ).length;
    return {
      name: member.name.split(' ')[0],
      Allocated: Math.round(totalAllocated * 10) / 10,
      Available: totalAvailable,
      Utilisation: util,
      colour: member.colour,
      tsCount,
    };
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800 text-sm">Staff Utilisation This Week</h3>
        <div className="text-[10px] text-slate-400">🎓 = trade school day</div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} layout="vertical" barSize={14}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="h" domain={[0,'dataMax + 5']} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={52} />
          <Tooltip
            contentStyle={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 8 }}
            formatter={(val, name) => [`${val}h`, name]}
          />
          <Bar dataKey="Available" fill="#f1f5f9" radius={[0,4,4,0]} />
          <Bar dataKey="Allocated" radius={[0,4,4,0]}>
            {chartData.map((entry, i) => <Cell key={i} fill={entry.colour} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-2">
        {chartData.map(d => {
          const color = d.Utilisation < 75 ? 'text-emerald-600' : d.Utilisation < 95 ? 'text-amber-600' : 'text-red-600';
          return (
            <div key={d.name} className="flex items-center gap-1 text-[10px]">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.colour }} />
              <span className="text-slate-600">{d.name}</span>
              <span className={`font-bold ${color}`}>{d.Utilisation}%</span>
              {d.tsCount > 0 && <span className="text-indigo-500 text-[9px]">🎓×{d.tsCount}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

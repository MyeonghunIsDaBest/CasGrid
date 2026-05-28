// @ts-nocheck
import { useState } from 'react';
import { format, addDays, startOfWeek, addWeeks } from 'date-fns';
import { useApp } from '../context/AppContext';
import { toDateString, getWeekWorkingDays } from '../utils/dateUtils';
import { GraduationCap, Plus, Trash2, RefreshCw, Calendar } from 'lucide-react';
import { StaffEventType } from '../types';

const EVENT_TYPES = [
  { value: 'tradeSchool', label: 'Trade School', colour: '#6366f1', icon: '🎓' },
  { value: 'leave', label: 'Annual Leave', colour: '#10b981', icon: '🌴' },
  { value: 'sick', label: 'Sick Day', colour: '#f59e0b', icon: '🤒' },
  { value: 'publicHoliday', label: 'Public Holiday', colour: '#64748b', icon: '🏛️' },
  { value: 'other', label: 'Other', colour: '#94a3b8', icon: '📅' },
];

export function TradeSchoolPanel() {
  const { state, addStaffEvent, deleteStaffEvent } = useApp();
  const { staff, staffEvents } = state;

  const [form, setForm] = useState({
    staffId: '',
    date: toDateString(new Date()),
    type: 'tradeSchool' as StaffEventType,
    label: 'Trade School',
    hours: 8,
  });
  const [bulkWeeks, setBulkWeeks] = useState(4);
  const [bulkDay, setBulkDay] = useState(3); // 3 = Wednesday
  const [showBulk, setShowBulk] = useState(false);

  const apprentices = staff.filter(s => s.isApprentice && s.active);
  const allActiveStaff = staff.filter(s => s.active);

  // Group events by week for display
  const sortedEvents = [...staffEvents].sort((a,b) => a.date.localeCompare(b.date));

  function handleAdd() {
    if (!form.staffId || !form.date) return;
    const et = EVENT_TYPES.find(t => t.value === form.type);
    addStaffEvent({
      staffId: form.staffId,
      date: form.date,
      type: form.type,
      label: form.label || et?.label || form.type,
      hours: form.hours,
      colour: et?.colour ?? '#6366f1',
    });
  }

  function handleBulkAddTradeSchool(staffId) {
    if (!staffId) return;
    const today = new Date();
    const thisWeek = startOfWeek(today, { weekStartsOn: 1 });
    // bulkDay: 1=Mon ... 5=Fri
    for (let w = 0; w < bulkWeeks; w++) {
      const weekStart = addWeeks(thisWeek, w);
      const targetDate = addDays(weekStart, bulkDay - 1); // 1=Mon offset 0
      const dateStr = toDateString(targetDate);
      // Don't add if already exists
      if (staffEvents.some(e => e.staffId === staffId && e.date === dateStr && e.type === 'tradeSchool')) continue;
      addStaffEvent({
        staffId, date: dateStr, type: 'tradeSchool',
        label: 'Trade School', hours: 8, colour: '#6366f1',
      });
    }
  }

  function getStaffName(id) {
    return staff.find(s => s.id === id)?.name ?? 'Unknown';
  }

  function getStaffColour(id) {
    return staff.find(s => s.id === id)?.colour ?? '#94a3b8';
  }

  const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <GraduationCap size={18} className="text-indigo-500" />
        <div>
          <h2 className="font-semibold text-slate-800">Staff Events</h2>
          <p className="text-xs text-slate-500">Trade school, leave, sick days — blocks capacity from scheduling</p>
        </div>
      </div>

      {/* Quick bulk-add trade school */}
      {apprentices.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-indigo-800">🎓 Apprentice Trade School Setup</span>
            </div>
            <button onClick={() => setShowBulk(b => !b)}
              className="text-xs text-indigo-600 hover:underline">
              {showBulk ? 'Hide' : 'Bulk Add'}
            </button>
          </div>

          {showBulk && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-indigo-700 mb-1">Trade school day</label>
                  <select value={bulkDay} onChange={e => setBulkDay(+e.target.value)}
                    className="w-full border border-indigo-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400">
                    {[1,2,3,4,5].map(d => <option key={d} value={d}>{dayNames[d]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-indigo-700 mb-1">Weeks ahead</label>
                  <select value={bulkWeeks} onChange={e => setBulkWeeks(+e.target.value)}
                    className="w-full border border-indigo-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400">
                    {[2,4,6,8,12,16,26].map(w => <option key={w} value={w}>{w} weeks</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {apprentices.map(a => (
                  <button key={a.id} onClick={() => handleBulkAddTradeSchool(a.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    <RefreshCw size={11} />
                    Add for {a.name.split(' ')[0]} ({bulkWeeks}×{dayNames[bulkDay]})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-2 text-xs text-indigo-600">
            {apprentices.map(a => a.name).join(', ')} •
            {' '}{staffEvents.filter(e => e.type === 'tradeSchool' && apprentices.some(ap => ap.id === e.staffId)).length} trade school days scheduled
          </div>
        </div>
      )}

      {/* Manual add form */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Add Event</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Staff Member</label>
            <select value={form.staffId} onChange={e => setForm(f => ({ ...f, staffId: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-400">
              <option value="">Select staff…</option>
              {allActiveStaff.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.isApprentice ? ' 🎓' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Event Type</label>
            <select value={form.type}
              onChange={e => {
                const t = e.target.value;
                const et = EVENT_TYPES.find(x => x.value === t);
                setForm(f => ({ ...f, type: t as StaffEventType, label: et?.label ?? t }));
              }}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-400">
              {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
            <input type="text" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
              placeholder="e.g. Box Hill TAFE" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hours blocked</label>
            <select value={form.hours} onChange={e => setForm(f => ({ ...f, hours: +e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-400">
              {[2,4,6,8].map(h => <option key={h} value={h}>{h}h ({h===8?'full day':h+'h'})</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={handleAdd} disabled={!form.staffId}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Plus size={14} /> Add Event
            </button>
          </div>
        </div>
      </div>

      {/* Events list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Scheduled Events ({staffEvents.length})</span>
        </div>
        <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
          {sortedEvents.map(ev => {
            const et = EVENT_TYPES.find(t => t.value === ev.type);
            return (
              <div key={ev.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: ev.colour }} />
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                    style={{ backgroundColor: getStaffColour(ev.staffId) }}>
                    {getStaffName(ev.staffId)[0]}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-800">
                    {getStaffName(ev.staffId)}
                    <span className="ml-1.5 font-normal text-slate-500">{et?.icon} {ev.label}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {format(new Date(ev.date + 'T00:00:00'), 'EEE d MMM yyyy')} · {ev.hours}h blocked
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Delete this event (${ev.label || ev.type})?`)) deleteStaffEvent(ev.id);
                  }}
                  aria-label="Delete event"
                  className="p-1 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded transition-colors flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
          {staffEvents.length === 0 && (
            <div className="py-10 text-center text-slate-400 text-sm">
              No events scheduled. Add trade school days, leave, or other absences above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

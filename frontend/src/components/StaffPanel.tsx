import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, UserCheck, UserX, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Staff } from '../types';
import { StaffForm } from './forms/StaffForm';

type SortKey = 'name' | 'role' | 'hours' | 'billable' | 'active';
type StatusFilter = 'all' | 'active' | 'inactive';

export function StaffPanel() {
  const { state, updateStaff, deleteStaff } = useApp();
  const { staff, scheduleEntries } = state;
  const [showForm, setShowForm] = useState(false);
  const [editStaff, setEditStaff] = useState<Staff | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Sort + filter + search applied to both field and office groups.
  // Search matches name/role/skills (case-insensitive substring).
  const { fieldStaff, officeStaff } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (s: Staff) =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q) ||
      s.skills.some(sk => sk.toLowerCase().includes(q));
    const matchesStatus = (s: Staff) =>
      statusFilter === 'all'
        ? true
        : statusFilter === 'active' ? s.active : !s.active;

    const compare = (a: Staff, b: Staff): number => {
      switch (sortKey) {
        case 'role':
          return a.role.localeCompare(b.role) || a.name.localeCompare(b.name);
        case 'hours':
          return (b.dailyAvailableHours - a.dailyAvailableHours) || a.name.localeCompare(b.name);
        case 'billable':
          return (Number(b.isBillable) - Number(a.isBillable)) || a.name.localeCompare(b.name);
        case 'active':
          return (Number(b.active) - Number(a.active)) || a.name.localeCompare(b.name);
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    };

    const filtered = staff.filter(s => matches(s) && matchesStatus(s));
    const sorted = [...filtered].sort(compare);
    return {
      fieldStaff:  sorted.filter(s => s.type === 'field'),
      officeStaff: sorted.filter(s => s.type === 'office'),
    };
  }, [staff, search, sortKey, statusFilter]);

  function getWeekHours(staffId: string) {
    // Get current week's hours (simplified - just total scheduled)
    return scheduleEntries
      .filter(e => e.staffId === staffId)
      .reduce((s, e) => s + e.hours, 0);
  }

  function StaffCard({ member }: { member: Staff }) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`group relative border rounded-xl p-4 ${member.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: member.colour }}
            >
              {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-sm">{member.name}</div>
              <div className="text-xs text-slate-500">{member.role}</div>
            </div>
          </div>
          {/* Primary actions only — Delete is moved to the card footer to keep it
              away from Edit (so Andrew can't mis-click it next to a save-like action). */}
          <div className="flex gap-1">
            <button
              onClick={() => updateStaff({ ...member, active: !member.active })}
              className={`p-1.5 rounded-lg transition-colors ${
                member.active
                  ? 'hover:bg-amber-50 text-amber-600'
                  : 'hover:bg-emerald-50 text-emerald-600'
              }`}
              title={member.active ? 'Deactivate' : 'Activate'}
            >
              {member.active ? <UserX size={14} /> : <UserCheck size={14} />}
            </button>
            <button
              onClick={() => { setEditStaff(member); setShowForm(true); }}
              className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors"
              title="Edit"
            >
              <Edit2 size={14} />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="bg-slate-50 rounded-lg p-2 text-center">
            <div className="font-bold text-slate-700">{member.dailyAvailableHours}h</div>
            <div className="text-slate-400 text-[10px]">Per Day</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-2 text-center">
            <div className="font-bold text-slate-700 capitalize">{member.type}</div>
            <div className="text-slate-400 text-[10px]">Type</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-2 text-center">
            <div className={`font-bold ${member.isBillable ? 'text-emerald-600' : 'text-slate-500'}`}>
              {member.isBillable ? 'Yes' : 'No'}
            </div>
            <div className="text-slate-400 text-[10px]">Billable</div>
          </div>
        </div>

        {/* Skills */}
        <div className="mt-2 flex flex-wrap gap-1">
          {member.skills.map(skill => (
            <span
              key={skill}
              className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded"
            >
              {skill}
            </span>
          ))}
        </div>

        {member.type === 'office' && member.canAssistFieldWork && (
          <div className="mt-2 text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded">
            ✓ Can assist field work
          </div>
        )}

        {/* Delete moved to the card footer (and hover-revealed) so it is not next
            to Edit / Activate where it was being mis-clicked. */}
        <button
          onClick={() => {
            if (confirm(`Remove ${member.name}? This cannot be undone.`)) deleteStaff(member.id);
          }}
          aria-label={`Remove ${member.name}`}
          title="Remove"
          className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-red-500 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 transition-opacity"
        >
          <Trash2 size={11} /> Remove
        </button>
      </motion.div>
    );
  }

  const totalActive = staff.filter(s => s.active).length;
  const totalInactive = staff.length - totalActive;
  const totalShown = fieldStaff.length + officeStaff.length;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-slate-800">Staff Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {totalShown} of {staff.length} · {totalActive} active{totalInactive > 0 ? ` · ${totalInactive} inactive` : ''}
          </p>
        </div>
        <button
          onClick={() => { setEditStaff(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors"
        >
          <Plus size={14} /> Add Staff
        </button>
      </div>

      {/* Controls — search, sort, status filter. Sticky so they stay
          accessible while scrolling longer staff lists. */}
      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex flex-wrap items-center gap-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, role, or skill…"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sort</span>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            <option value="name">Name (A→Z)</option>
            <option value="role">Role</option>
            <option value="hours">Daily hours (high→low)</option>
            <option value="billable">Billable first</option>
            <option value="active">Active first</option>
          </select>
        </div>

        <div className="inline-flex rounded-lg ring-1 ring-slate-200 overflow-hidden bg-slate-50">
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 text-[11px] font-semibold capitalize transition-colors ${
                statusFilter === s ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Field staff */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Field Staff ({fieldStaff.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence>
            {fieldStaff.map(s => <StaffCard key={s.id} member={s} />)}
          </AnimatePresence>
        </div>
        {fieldStaff.length === 0 && (
          <p className="text-sm text-slate-400 italic">No field staff added yet.</p>
        )}
      </div>

      {/* Office staff */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Office Staff ({officeStaff.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence>
            {officeStaff.map(s => <StaffCard key={s.id} member={s} />)}
          </AnimatePresence>
        </div>
        {officeStaff.length === 0 && (
          <p className="text-sm text-slate-400 italic">No office staff added yet.</p>
        )}
      </div>

      {/* Staff form modal */}
      <AnimatePresence>
        {showForm && (
          <StaffForm
            staff={editStaff}
            onClose={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

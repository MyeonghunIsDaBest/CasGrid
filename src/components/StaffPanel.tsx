import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, UserCheck, UserX } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Staff } from '../types';
import { StaffForm } from './forms/StaffForm';

export function StaffPanel() {
  const { state, updateStaff, deleteStaff } = useApp();
  const { staff, scheduleEntries } = state;
  const [showForm, setShowForm] = useState(false);
  const [editStaff, setEditStaff] = useState<Staff | null>(null);

  const fieldStaff = staff.filter(s => s.type === 'field');
  const officeStaff = staff.filter(s => s.type === 'office');

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
        className={`border rounded-xl p-4 ${member.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}
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
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={() => {
                if (confirm(`Remove ${member.name}?`)) deleteStaff(member.id);
              }}
              className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
            >
              <Trash2 size={14} />
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
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">Staff Management</h2>
        <button
          onClick={() => { setEditStaff(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors"
        >
          <Plus size={14} /> Add Staff
        </button>
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

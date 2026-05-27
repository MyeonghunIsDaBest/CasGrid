import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Staff, StaffType } from '../../types';

const STAFF_COLOURS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#ef4444', '#64748b', '#0ea5e9', '#f97316', '#14b8a6',
];

const COMMON_SKILLS = [
  'domestic', 'commercial', 'industrial', 'solar', 'batteries',
  'HV', 'EV', 'data', 'admin', 'quoting', 'invoicing', 'management',
];

interface Props {
  staff: Staff | null;
  onClose: () => void;
}

function blankStaff(): Omit<Staff, 'id'> {
  return {
    name: '',
    role: '',
    type: 'field',
    dailyAvailableHours: 8,
    skills: [],
    isBillable: true,
    canAssistFieldWork: true,
    isApprentice: false,
    active: true,
    colour: STAFF_COLOURS[0],
  };
}

export function StaffForm({ staff, onClose }: Props) {
  const { addStaff, updateStaff } = useApp();
  const isEdit = !!staff;

  const [form, setForm] = useState<Omit<Staff, 'id'>>(blankStaff());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customSkill, setCustomSkill] = useState('');

  useEffect(() => {
    if (staff) {
      const { id, ...rest } = staff;
      setForm(rest);
    }
  }, [staff]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.role.trim()) errs.role = 'Role is required';
    if (form.dailyAvailableHours <= 0 || form.dailyAvailableHours > 24) {
      errs.dailyAvailableHours = 'Must be 1–24';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    if (isEdit && staff) {
      updateStaff({ ...form, id: staff.id });
    } else {
      addStaff(form);
    }
    onClose();
  }

  function toggleSkill(skill: string) {
    setForm(f => ({
      ...f,
      skills: f.skills.includes(skill)
        ? f.skills.filter(s => s !== skill)
        : [...f.skills, skill],
    }));
  }

  function addCustomSkill() {
    if (!customSkill.trim()) return;
    toggleSkill(customSkill.trim().toLowerCase());
    setCustomSkill('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto z-10"
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-semibold text-slate-800">{isEdit ? 'Edit Staff' : 'Add Staff Member'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${errors.name ? 'border-red-400' : 'border-slate-200'}`}
                placeholder="e.g. Marco Ricci"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Role *</label>
              <input
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${errors.role ? 'border-red-400' : 'border-slate-200'}`}
                placeholder="e.g. Lead Electrician"
              />
              {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
              <select
                value={form.type}
                onChange={e => {
                  const t = e.target.value as StaffType;
                  setForm(f => ({
                    ...f,
                    type: t,
                    dailyAvailableHours: t === 'office' ? 6 : 8,
                    isBillable: t === 'field' ? true : f.isBillable,
                  }));
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="field">Field</option>
                <option value="office">Office</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Daily Hours</label>
              <input
                type="number"
                min={1}
                max={24}
                step={0.5}
                value={form.dailyAvailableHours}
                onChange={e => setForm(f => ({ ...f, dailyAvailableHours: parseFloat(e.target.value) || 8 }))}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${errors.dailyAvailableHours ? 'border-red-400' : 'border-slate-200'}`}
              />
            </div>
          </div>

          {/* Colour */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Colour</label>
            <div className="flex gap-2 flex-wrap">
              {STAFF_COLOURS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, colour: c }))}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    form.colour === c ? 'scale-125 border-slate-600' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Flags */}
          <div className="space-y-2">
            {[
              { key: 'isBillable', label: 'Billable (counts toward capacity)' },
              { key: 'canAssistFieldWork', label: 'Can assist field work' },
              { key: 'active', label: 'Active' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[key as keyof typeof form] as boolean}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-400"
                />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>

          {/* Skills */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Skills</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COMMON_SKILLS.map(skill => (
                <button
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className={`px-2 py-0.5 rounded text-xs transition-all ${
                    form.skills.includes(skill)
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={customSkill}
                onChange={e => setCustomSkill(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomSkill()}
                placeholder="Add custom skill…"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <button
                onClick={addCustomSkill}
                className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex gap-3 justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            {isEdit ? 'Save Changes' : 'Add Staff'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

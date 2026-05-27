import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Job, JobStatus, JobPriority } from '../../types';
import { toDateString } from '../../utils/dateUtils';
import { addDays } from 'date-fns';

const JOB_COLOURS = [
  '#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6',
  '#ec4899', '#f97316', '#0ea5e9', '#64748b', '#14b8a6',
];

interface Props {
  job: Job | null;
  onClose: () => void;
}

function today() { return toDateString(new Date()); }
function inTwoWeeks() { return toDateString(addDays(new Date(), 14)); }

export function JobForm({ job, onClose }: Props) {
  const { state, addJob, updateJob } = useApp();
  const { staff } = state;

  const isEdit = !!job;
  const [form, setForm] = useState<Omit<Job, 'id'>>({
    jobName: '',
    clientName: '',
    estimatedHours: 8,
    remainingHours: 8,
    priority: 'medium',
    startDate: today(),
    deadline: inTwoWeeks(),
    assignedStaffIds: [],
    status: 'unscheduled',
    notes: '',
    colour: JOB_COLOURS[0],
    clientEmail: '',
    clientPhone: '',
    simproJobId: '',
    dailyStaffOverrides: {},
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (job) {
      const { id, ...rest } = job;
      setForm(rest);
    }
  }, [job]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.jobName.trim()) errs.jobName = 'Job name is required';
    if (!form.clientName.trim()) errs.clientName = 'Client name is required';
    if (form.estimatedHours <= 0) errs.estimatedHours = 'Must be > 0';
    if (form.startDate > form.deadline) errs.deadline = 'Deadline must be after start date';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    if (isEdit && job) {
      updateJob({ ...form, id: job.id });
    } else {
      addJob({ ...form, remainingHours: form.estimatedHours });
    }
    onClose();
  }

  function toggleStaff(id: string) {
    setForm(f => ({
      ...f,
      assignedStaffIds: f.assignedStaffIds.includes(id)
        ? f.assignedStaffIds.filter(s => s !== id)
        : [...f.assignedStaffIds, id],
    }));
  }

  const billableStaff = staff.filter(s => s.active && s.isBillable);

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
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto z-10"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="font-semibold text-slate-800">{isEdit ? 'Edit Job' : 'New Job'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Job name */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Job Name *</label>
            <input
              value={form.jobName}
              onChange={e => setForm(f => ({ ...f, jobName: e.target.value }))}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${errors.jobName ? 'border-red-400' : 'border-slate-200'}`}
              placeholder="e.g. Residential Solar Install"
            />
            {errors.jobName && <p className="text-xs text-red-500 mt-1">{errors.jobName}</p>}
          </div>

          {/* Client */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Client Name *</label>
            <input
              value={form.clientName}
              onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${errors.clientName ? 'border-red-400' : 'border-slate-200'}`}
              placeholder="e.g. Smith Family"
            />
            {errors.clientName && <p className="text-xs text-red-500 mt-1">{errors.clientName}</p>}
          </div>

          {/* Hours + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Estimated Hours *</label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={form.estimatedHours}
                onChange={e => setForm(f => ({ ...f, estimatedHours: parseFloat(e.target.value) || 0 }))}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${errors.estimatedHours ? 'border-red-400' : 'border-slate-200'}`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Remaining Hours</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={form.remainingHours}
                onChange={e => setForm(f => ({ ...f, remainingHours: parseFloat(e.target.value) || 0 }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Deadline *</label>
              <input
                type="date"
                value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${errors.deadline ? 'border-red-400' : 'border-slate-200'}`}
              />
              {errors.deadline && <p className="text-xs text-red-500 mt-1">{errors.deadline}</p>}
            </div>
          </div>

          {/* Priority + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value as JobPriority }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="urgent">🔴 Urgent</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">⚪ Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as JobStatus }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="unscheduled">Unscheduled</option>
                <option value="scheduled">Scheduled</option>
                <option value="inProgress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="onHold">On Hold</option>
              </select>
            </div>
          </div>

          {/* Colour */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Job Colour</label>
            <div className="flex gap-2 flex-wrap">
              {JOB_COLOURS.map(c => (
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

          {/* Assign staff */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Assign Staff</label>
            <div className="flex flex-wrap gap-2">
              {billableStaff.map(s => {
                const selected = form.assignedStaffIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleStaff(s.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      selected
                        ? 'text-white border-transparent'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                    style={selected ? { backgroundColor: s.colour, borderColor: s.colour } : {}}
                  >
                    {s.name.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              placeholder="Site access, materials, special requirements…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex gap-3 justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            {isEdit ? 'Save Changes' : 'Add Job'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

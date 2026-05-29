import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Job, JobStatus, JobPriority } from '../../types';
import { toDateString, fromDateString, getWorkingDays } from '../../utils/dateUtils';
import { addDays } from 'date-fns';
import { getRunningTimeMs, isJobRunning, useRunningTimeNow, fromManualHours, applyStatusChange, isActiveStatus } from '../../utils/runningTime';
import { DateField } from '../ui/date-field';

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

  // Editable "running time" in decimal hours. Tracked separately from the
  // form so we know when the user has manually changed it (vs the live ticker
  // pre-fill on open) and can compute the right runningStartedAt on save.
  const [runningHoursInput, setRunningHoursInput] = useState<string>('');
  const [runningEdited, setRunningEdited] = useState(false);

  useEffect(() => {
    if (job) {
      const { id, ...rest } = job;
      setForm(rest);
      // Pre-fill the editable hours input with the live total at open time.
      const hrs = getRunningTimeMs(job) / 3600 / 1000;
      setRunningHoursInput(hrs.toFixed(2));
      setRunningEdited(false);
    }
    // Re-hydrate only when switching to a different job — not on every parent
    // re-render (e.g. Realtime echoes), which would wipe in-progress edits.
  }, [job?.id]);

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
      // Compute running-time fields based on what the user changed:
      //  - If they edited the hours input, that wins; convert to ms and
      //    restart the ticker from now so it keeps counting up from the new
      //    total.
      //  - Else if status crossed an active↔paused boundary, accumulate or
      //    resume via applyStatusChange.
      //  - Else pass through the current values.
      let runningFields: Pick<Job, 'runningStartedAt' | 'runningTimeMs'>;
      if (runningEdited) {
        const hrs = parseFloat(runningHoursInput);
        runningFields = fromManualHours(Number.isFinite(hrs) ? hrs : 0, form.status);
      } else if (form.status !== job.status) {
        runningFields = applyStatusChange(job, form.status);
      } else {
        runningFields = {
          runningStartedAt: form.runningStartedAt ?? job.runningStartedAt ?? null,
          runningTimeMs:    form.runningTimeMs    ?? job.runningTimeMs    ?? 0,
        };
      }

      // Snapshot per-day overrides for newly-added staff so they don't auto-tick
      // every day in the Daily Staff tab. For each working day that has no
      // existing override, pin it to the prior assigned-staff list (without the
      // new staff). Days the user already customised stay as-is — the new staff
      // is not auto-added there.
      const added = form.assignedStaffIds.filter(id => !job.assignedStaffIds.includes(id));
      let dailyStaffOverrides = form.dailyStaffOverrides;
      if (added.length > 0) {
        const days = getWorkingDays(fromDateString(form.startDate), fromDateString(form.deadline));
        const updated = { ...dailyStaffOverrides };
        for (const day of days) {
          const dStr = toDateString(day);
          if (updated[dStr] === undefined) {
            updated[dStr] = [...job.assignedStaffIds];
          }
        }
        dailyStaffOverrides = updated;
      }

      updateJob({ ...form, dailyStaffOverrides, ...runningFields, id: job.id });
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

  // Real-time running clock for the job being edited. When the user hasn't
  // touched the input we keep it in sync with the ticker so it shows the
  // current live value; once they edit it we leave their value alone.
  const tickTarget: Job = job ?? ({ status: 'unscheduled', runningStartedAt: null, runningTimeMs: 0 } as Job);
  const now = useRunningTimeNow(tickTarget);
  useEffect(() => {
    if (!job || runningEdited) return;
    const hrs = getRunningTimeMs(job, now) / 3600 / 1000;
    setRunningHoursInput(hrs.toFixed(2));
  }, [now, job, runningEdited]);
  const running = job ? isJobRunning({ ...job, status: form.status } as Job) && !runningEdited : false;

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
          {/* Running time — editable hours; live-syncs from the ticker until
              the user types into it. Status determines whether the timer keeps
              ticking after save (active statuses) or pauses (completed/onHold). */}
          {isEdit && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    running ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                  }`}
                  aria-hidden
                />
                <label className="text-xs font-medium text-slate-700">
                  Running Time (hours)
                </label>
                {runningEdited && (
                  <button
                    type="button"
                    onClick={() => {
                      setRunningEdited(false);
                      if (job) {
                        const hrs = getRunningTimeMs(job) / 3600 / 1000;
                        setRunningHoursInput(hrs.toFixed(2));
                      }
                    }}
                    className="ml-auto text-[10px] text-amber-600 hover:underline"
                  >
                    Reset to live
                  </button>
                )}
                {!runningEdited && !isActiveStatus(form.status) && (
                  <span className="ml-auto text-[10px] text-slate-400">paused</span>
                )}
              </div>
              <input
                type="number"
                min={0}
                step={0.25}
                value={runningHoursInput}
                onChange={e => { setRunningHoursInput(e.target.value); setRunningEdited(true); }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="0.00"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Filling this in updates the progress bar. The timer keeps ticking from this value while the status is active.
              </p>
            </div>
          )}

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

          {/* Estimated hours */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Estimated Hours *</label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={form.estimatedHours}
              onChange={e => {
                const v = parseFloat(e.target.value) || 0;
                // Keep remainingHours in lockstep with estimatedHours; progress is now
                // derived from schedule entries, so this field is no longer the source
                // of truth — but we keep the column in sync for any external reader.
                setForm(f => ({ ...f, estimatedHours: v, remainingHours: v }));
              }}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${errors.estimatedHours ? 'border-red-400' : 'border-slate-200'}`}
            />
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
              <DateField
                value={form.startDate}
                onChange={v => setForm(f => ({ ...f, startDate: v }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Deadline *</label>
              <DateField
                value={form.deadline}
                onChange={v => setForm(f => ({ ...f, deadline: v }))}
                error={!!errors.deadline}
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
            {isEdit ? 'Update' : 'Add Job'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

import { useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Download, Upload, Shield, Zap, Settings, Database, Link2, ArrowRight, Table2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SimproConnectionSettings } from './SimproConnectionSettings';

interface SettingsPanelProps {
  /** Jump to the Simpro workspace tab (import/push/messages live there). */
  onOpenSimpro?: () => void;
}

export function SettingsPanel({ onOpenSimpro }: SettingsPanelProps) {
  const { state, updateSettings, exportData, importData, syncStatus } = useApp();
  const { settings } = state;
  const fileRef = useRef<HTMLInputElement>(null);

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      importData(text);
    };
    reader.readAsText(file);
  }

  // ── Live Supabase status ──
  const supa =
    syncStatus === 'live'    ? { dot: 'bg-emerald-500', text: 'text-emerald-600', label: 'Connected · Live' } :
    syncStatus === 'offline' ? { dot: 'bg-red-500',     text: 'text-red-500',     label: 'Offline' } :
                               { dot: 'bg-amber-400',   text: 'text-amber-600',   label: 'Reconnecting…' };

  const card = "bg-white rounded-xl border border-slate-200 shadow-sm";

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
          <Settings size={18} className="text-slate-600" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-800">Settings</h2>
          <p className="text-xs text-slate-500">Scheduling rules, your data, and integrations for CasGrid</p>
        </div>
      </div>

      {/* ── Scheduling ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}
        className={`${card} p-5 space-y-4`}>
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center"><Zap size={14} className="text-amber-500" /></span>
          Scheduling
        </h3>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.overrideOverbooking}
            onChange={e => updateSettings({ overrideOverbooking: e.target.checked })}
            className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-400"
          />
          <div>
            <div className="text-sm font-medium text-slate-800">Allow overbooking</div>
            <div className="text-xs text-slate-500 mt-0.5">
              When enabled, the auto-scheduler can assign up to 150% of daily capacity to a staff
              member to fit urgent jobs. (Per-day overtime in the planner is always allowed.)
            </div>
          </div>
        </label>

        <div className="pt-3 border-t border-slate-100 space-y-3">
          <div>
            <div className="text-sm font-medium text-slate-800 mb-1">Weekly capacity</div>
            <p className="text-xs text-slate-500 mb-2">
              Baseline = the team-hours you're currently expected to schedule. Stretch = the target
              you're pushing toward. Shown above the Timeline.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-600">
                <span className="block mb-1">Baseline (h/week)</span>
                <input
                  type="number" min={0} step={5}
                  value={settings.capacityTargets?.weeklyBaseline ?? 240}
                  onChange={e => updateSettings({
                    capacityTargets: {
                      weeklyBaseline: parseInt(e.target.value, 10) || 0,
                      weeklyStretch:  settings.capacityTargets?.weeklyStretch ?? 350,
                    },
                  })}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </label>
              <label className="text-xs text-slate-600">
                <span className="block mb-1">Stretch target (h/week)</span>
                <input
                  type="number" min={0} step={5}
                  value={settings.capacityTargets?.weeklyStretch ?? 350}
                  onChange={e => updateSettings({
                    capacityTargets: {
                      weeklyBaseline: settings.capacityTargets?.weeklyBaseline ?? 240,
                      weeklyStretch:  parseInt(e.target.value, 10) || 0,
                    },
                  })}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </label>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            <strong>Working days:</strong> Monday to Friday (fixed). A future version will support custom working days and public-holiday exclusions.
          </p>
        </div>
      </motion.div>

      {/* ── Data Management ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
        className={`${card} p-5 space-y-4`}>
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center"><Shield size={14} className="text-slate-500" /></span>
          Data Management
        </h3>
        <p className="text-xs text-slate-500">
          All data lives in your Supabase project and syncs live across every device.
          Use export/import to back up or transfer your schedule.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportData}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors font-medium">
            <Download size={14} /> Export JSON
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-50 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors font-medium">
            <Upload size={14} /> Import JSON
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      </motion.div>

      {/* ── Integrations ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className={`${card} p-5 space-y-4`}>
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center"><Link2 size={14} className="text-sky-500" /></span>
          Integrations
        </h3>

        {/* Supabase — live status */}
        <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0"><Database size={14} className="text-emerald-500" /></span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-800">Supabase</div>
              <div className="text-xs text-slate-400 truncate">Real-time sync across every device</div>
            </div>
          </div>
          <span className={`flex items-center gap-1.5 text-xs font-medium flex-shrink-0 ${supa.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${supa.dot} ${syncStatus !== 'live' ? 'animate-pulse' : ''}`} />
            {supa.label}
          </span>
        </div>

        {/* Simpro — shared connection editor (synced with the Simpro workspace) */}
        <div className="space-y-1.5">
          <SimproConnectionSettings />
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-[10px] text-slate-400 leading-snug">
              Live API needs a backend proxy (CORS). Field mapping, import, push &amp; messages live in the workspace.
            </p>
            <button onClick={() => onOpenSimpro?.()}
              className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 flex-shrink-0 whitespace-nowrap">
              Open Simpro workspace <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* Google Sheets — planned */}
        <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-200 px-3 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0"><Table2 size={14} className="text-slate-400" /></span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-600">Google Sheets</div>
              <div className="text-xs text-slate-400 truncate">Read/write staff, jobs &amp; schedule tabs</div>
            </div>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200/70 flex-shrink-0">Planned</span>
        </div>
      </motion.div>
    </div>
  );
}

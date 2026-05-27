import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Upload, RefreshCw, Shield, Calendar, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function SettingsPanel() {
  const { state, updateSettings, resetDemo, exportData, importData } = useApp();
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

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="font-semibold text-slate-800">Settings</h2>

      {/* Scheduling */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Zap size={14} className="text-amber-500" /> Scheduling
        </h3>

        <label className="flex items-start gap-3 cursor-pointer">
          <div className="mt-0.5">
            <input
              type="checkbox"
              checked={settings.overrideOverbooking}
              onChange={e => updateSettings({ overrideOverbooking: e.target.checked })}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-400"
            />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-800">Allow overbooking</div>
            <div className="text-xs text-slate-500 mt-0.5">
              When enabled, the scheduler can assign up to 150% of daily capacity
              to a staff member to fit urgent jobs.
            </div>
          </div>
        </label>

        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            <strong>Working days:</strong> Monday to Friday (fixed). Future version will support custom working days and public holiday exclusions.
          </p>
        </div>
      </div>

      {/* Data management */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Shield size={14} className="text-slate-500" /> Data Management
        </h3>

        <p className="text-xs text-slate-500">
          All data is saved automatically to your browser's local storage. Use export/import to back up or transfer your schedule.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportData}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors font-medium"
          >
            <Download size={14} /> Export JSON
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-50 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors font-medium"
          >
            <Upload size={14} /> Import JSON
          </button>

          <button
            onClick={() => {
              if (confirm('Reset all data to demo? This cannot be undone.')) resetDemo();
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors font-medium"
          >
            <RefreshCw size={14} /> Reset to Demo
          </button>
        </div>

        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      </div>

      {/* Integration notes */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Integration Roadmap</h3>
        <div className="space-y-3 text-xs text-slate-600">
          <div className="flex gap-2">
            <span className="text-amber-500 font-bold mt-0.5">→</span>
            <div>
              <strong>Supabase:</strong> Replace localStorage with Supabase client. AppContext actions map 1:1 to table operations.
              Add auth for multi-user access. Enable real-time sync via Supabase Realtime channels.
            </div>
          </div>
          <div className="flex gap-2">
            <span className="text-green-500 font-bold mt-0.5">→</span>
            <div>
              <strong>Google Sheets:</strong> Use Google Apps Script or Sheets API to read/write staff, jobs, and schedule_entries tabs.
              The JSON export format maps directly to spreadsheet rows.
            </div>
          </div>
          <div className="flex gap-2">
            <span className="text-purple-500 font-bold mt-0.5">→</span>
            <div>
              <strong>Simpro:</strong> Map Job entities to Simpro quotes/jobs via REST API.
              Pull estimated hours from Simpro cost centres into estimatedHours field.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

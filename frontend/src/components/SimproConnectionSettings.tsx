/**
 * SimproConnectionSettings — the shared Simpro connection editor.
 *
 * Rendered identically in BOTH the Settings → Integrations card and the SimPro
 * page's Configuration tab. Both read/write the same `simproConfig` via
 * `updateSimproConfig`, so edits in either place stay in sync — and it's the
 * single source of truth for the future Simpro REST API.
 */
import { Zap, Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function SimproConnectionSettings() {
  const { state, updateSimproConfig } = useApp();
  const { simproConfig } = state;

  const configured = !!(simproConfig.subdomain && simproConfig.companyId && simproConfig.apiToken);
  const status =
    simproConfig.enabled && configured ? { label: 'Enabled',        cls: 'bg-emerald-50 text-emerald-600 ring-emerald-200/70' } :
    configured                         ? { label: 'Configured',     cls: 'bg-amber-50 text-amber-600 ring-amber-200/70' } :
                                         { label: 'Not configured', cls: 'bg-slate-100 text-slate-500 ring-slate-200/70' };

  return (
    <div className="rounded-lg border border-slate-200 p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Zap size={14} className="text-orange-500" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-800">Simpro</div>
            <div className="text-xs text-slate-400 truncate">Sync jobs &amp; schedules to Simpro</div>
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 flex-shrink-0 ${status.cls}`}>
          {status.label}
        </span>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={simproConfig.enabled}
          onChange={e => updateSimproConfig({ enabled: e.target.checked })}
          className="rounded border-slate-300 text-orange-500 focus:ring-orange-400" />
        <span className="text-sm font-medium text-slate-700">Enable integration</span>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Subdomain</label>
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-orange-400">
            <span className="px-2 py-2 bg-slate-50 text-xs text-slate-500 border-r border-slate-200">https://</span>
            <input value={simproConfig.subdomain}
              onChange={e => updateSimproConfig({ subdomain: e.target.value })}
              placeholder="casone"
              className="flex-1 min-w-0 px-2 py-2 text-sm focus:outline-none" />
            <span className="px-2 py-2 bg-slate-50 text-xs text-slate-500 border-l border-slate-200">.simprosuite.com</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Company / Branch ID</label>
          <input value={simproConfig.companyId}
            onChange={e => updateSimproConfig({ companyId: e.target.value })}
            placeholder="0"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            <Lock size={10} className="inline mr-1" />API Token
          </label>
          <input type="password" value={simproConfig.apiToken}
            onChange={e => updateSimproConfig({ apiToken: e.target.value })}
            placeholder="Bearer token from Simpro → Settings → API"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-orange-400" />
        </div>
      </div>

      <div className="space-y-2 pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={simproConfig.autoSyncOnSave}
            onChange={e => updateSimproConfig({ autoSyncOnSave: e.target.checked })}
            className="rounded border-slate-300 text-orange-500 focus:ring-orange-400" />
          <span className="text-xs text-slate-600">Auto-push to Simpro when the schedule changes</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={simproConfig.sendClientMessages}
            onChange={e => updateSimproConfig({ sendClientMessages: e.target.checked })}
            className="rounded border-slate-300 text-orange-500 focus:ring-orange-400" />
          <span className="text-xs text-slate-600">Send client messages via Simpro on push</span>
        </label>
      </div>
    </div>
  );
}

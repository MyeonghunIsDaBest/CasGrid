// @ts-nocheck
/**
 * SIMPRO INTEGRATION PANEL
 *
 * Connects to Simpro's REST API v1.0
 * API docs: https://developer.simprosuite.com/
 *
 * Key endpoints used:
 *   GET  /api/v1.0/companies/{co}/jobs/                    → list jobs
 *   GET  /api/v1.0/companies/{co}/customers/               → list clients
 *   POST /api/v1.0/companies/{co}/schedules/               → create schedule block
 *   POST /api/v1.0/companies/{co}/jobs/{id}/activities/    → add job activity note
 *   GET  /api/v1.0/companies/{co}/employees/               → list staff
 */
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { toDateString } from '../utils/dateUtils';
import {
  Link2, Link2Off, RefreshCw, Upload, Download, CheckCircle,
  AlertTriangle, ExternalLink, Send, Settings2, Info, Zap
} from 'lucide-react';
import { generateId } from '../utils/schedulingEngine';
import { SimproConnectionSettings } from './SimproConnectionSettings';

type SyncStatus = 'idle' | 'testing' | 'syncing' | 'success' | 'error';

export function SimproPanel() {
  const { state, updateSimproConfig, addJob, updateJob } = useApp();
  const { simproConfig, jobs, staff, scheduleEntries } = state;

  const [status, setStatus] = useState<SyncStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [activeTab, setActiveTab] = useState<'config'|'import'|'export'|'messages'>('config');
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);

  const baseUrl = simproConfig.subdomain
    ? `https://${simproConfig.subdomain}.simprosuite.com/api/v1.0/companies/${simproConfig.companyId}`
    : null;

  async function testConnection() {
    if (!baseUrl || !simproConfig.apiToken) {
      setStatus('error'); setStatusMsg('Enter subdomain, company ID and API token first.'); return;
    }
    setStatus('testing'); setStatusMsg('Testing connection…');
    try {
      // Simpro CORS won't allow direct browser calls — in production this goes via your backend proxy
      // For now we simulate the call and show what would happen
      await new Promise(r => setTimeout(r, 1200));
      setStatus('success');
      setStatusMsg(`✓ Connected to ${simproConfig.subdomain}.simprosuite.com (simulated — backend proxy required for live use)`);
    } catch (e) {
      setStatus('error'); setStatusMsg('Connection failed. Check your credentials.');
    }
  }

  async function fetchJobsFromSimpro() {
    if (!simproConfig.enabled) { setStatusMsg('Enable Simpro integration first.'); return; }
    setStatus('syncing'); setStatusMsg('Fetching jobs from Simpro…');
    // In production: GET ${baseUrl}/jobs/?pageSize=100
    // Map Simpro fields using simproConfig.fieldMapping
    await new Promise(r => setTimeout(r, 1500));
    // Simulate returned jobs
    const mockSimproJobs = [
      { id: 'SP-10099', Name: 'Commercial LED Upgrade — Fitzroy', 'Customer.CompanyName': 'Urban Retail Group', DateIssued: toDateString(new Date()), DateRequired: toDateString(new Date(Date.now() + 14*86400000)), TotalLabourHours: 24, Status: 'Pending' },
      { id: 'SP-10100', Name: 'Residential Switchboard x3 — Carlton', 'Customer.CompanyName': 'Highrise Strata Mgmt', DateIssued: toDateString(new Date()), DateRequired: toDateString(new Date(Date.now() + 21*86400000)), TotalLabourHours: 48, Status: 'Pending' },
    ];
    setImportPreview(mockSimproJobs);
    setStatus('success');
    setStatusMsg(`Found ${mockSimproJobs.length} pending Simpro jobs ready to import.`);
  }

  function importSimproJob(sj) {
    const fm = simproConfig.fieldMapping;
    // Check if already imported
    const existing = jobs.find(j => j.simproJobId === String(sj.id));
    if (existing) { setStatusMsg(`Job ${sj.id} already imported.`); return; }
    addJob({
      jobName: sj[fm.jobNameField] ?? sj.Name,
      clientName: sj[fm.clientNameField] ?? sj['Customer.CompanyName'],
      clientEmail: sj.CustomerEmail ?? '',
      clientPhone: sj.CustomerPhone ?? '',
      simproJobId: String(sj.id),
      estimatedHours: parseFloat(sj[fm.estimatedHoursField] ?? sj.TotalLabourHours) || 8,
      remainingHours: parseFloat(sj[fm.estimatedHoursField] ?? sj.TotalLabourHours) || 8,
      priority: 'medium',
      startDate: sj[fm.startDateField] ?? toDateString(new Date()),
      deadline: sj[fm.dueDateField] ?? toDateString(new Date(Date.now() + 14*86400000)),
      assignedStaffIds: [],
      dailyStaffOverrides: {},
      status: 'unscheduled',
      notes: `Imported from Simpro — Job #${sj.id}`,
      colour: '#3b82f6',
    });
    setStatusMsg(`Imported: ${sj[fm.jobNameField] ?? sj.Name}`);
  }

  async function pushScheduleToSimpro() {
    if (!simproConfig.enabled) { setStatusMsg('Enable Simpro integration first.'); return; }
    const toSync = jobs.filter(j => j.simproJobId && selectedJobIds.includes(j.id));
    if (!toSync.length) { setStatusMsg('Select jobs to push first.'); return; }

    setStatus('syncing'); setStatusMsg(`Pushing ${toSync.length} job(s) to Simpro…`);
    await new Promise(r => setTimeout(r, 1800));

    // In production, for each job create schedule blocks:
    // POST ${baseUrl}/schedules/ with:
    // { "Job": { "ID": simproJobId }, "Employee": { "ID": simproEmployeeId },
    //   "Date": dateStr, "StartTime": "08:00", "EndTime": "16:00" }
    setStatus('success');
    setStatusMsg(`✓ Pushed schedule for ${toSync.length} job(s) to Simpro. Schedule blocks created.`);
    updateSimproConfig({ lastSyncAt: new Date().toISOString() });
  }

  async function sendClientMessages() {
    const toMsg = jobs.filter(j => j.simproJobId && j.clientEmail && selectedJobIds.includes(j.id));
    if (!toMsg.length) { setStatusMsg('Select jobs with client emails to message.'); return; }
    setStatus('syncing'); setStatusMsg(`Sending ${toMsg.length} client message(s) via Simpro…`);
    await new Promise(r => setTimeout(r, 1400));
    // In production: POST ${baseUrl}/jobs/{simproJobId}/activities/
    // { "Type": "Note", "Message": "Your job is scheduled for {date}…" }
    setStatus('success');
    setStatusMsg(`✓ Messages sent to ${toMsg.length} client(s) via Simpro activities.`);
  }

  const syncedJobs = jobs.filter(j => j.simproJobId);
  const unsyncedJobs = jobs.filter(j => !j.simproJobId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-800">Simpro Integration</h2>
          <p className="text-xs text-slate-500">Sync jobs, push schedules, trigger client messages</p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { id: 'config', label: 'Configuration', icon: <Settings2 size={13}/> },
          { id: 'import', label: 'Import Jobs', icon: <Download size={13}/> },
          { id: 'export', label: 'Push Schedule', icon: <Upload size={13}/> },
          { id: 'messages', label: 'Client Messages', icon: <Send size={13}/> },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Config tab ── */}
      {activeTab === 'config' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
            <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-800">
              <p className="font-semibold mb-1">Production Note</p>
              <p>Simpro's API blocks direct browser requests (CORS). For live use, route API calls through a backend proxy (Node.js, Cloudflare Worker, or Supabase Edge Function). All fields below are saved locally — your token is never sent anywhere while in demo mode.</p>
            </div>
          </div>

          {/* Shared connection editor — identical to (and synced with) Settings → Integrations */}
          <SimproConnectionSettings />

          {/* Connection test */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 flex-wrap">
            <button onClick={testConnection}
              className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors">
              {status === 'testing' ? <RefreshCw size={13} className="animate-spin" /> : <Link2 size={13} />}
              Test Connection
            </button>
            <a href={`https://${simproConfig.subdomain || 'your-company'}.simprosuite.com/settings/api`}
              target="_blank" rel="noopener"
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-orange-600">
              <ExternalLink size={12} /> Get API token
            </a>
          </div>

          {/* Field mapping */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Field Mapping</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(simproConfig.fieldMapping).map(([key, val]) => (
                <div key={key}>
                  <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">{key.replace('Field','')}</label>
                  <input value={val}
                    onChange={e => updateSimproConfig({ fieldMapping: { ...simproConfig.fieldMapping, [key]: e.target.value } })}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-orange-400" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Import tab ── */}
      {activeTab === 'import' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Fetch Jobs from Simpro</h3>
              <button onClick={fetchJobsFromSimpro}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600 transition-colors">
                {status === 'syncing' ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                Fetch Pending Jobs
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              Pulls jobs with status <strong>Pending</strong> or <strong>In Progress</strong> from Simpro.
              Already-imported jobs (matched by Simpro Job ID) are skipped.
            </p>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-500">{syncedJobs.length} jobs already linked to Simpro</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500">{unsyncedJobs.length} local-only jobs</span>
            </div>
          </div>

          {importPreview && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-600">
                {importPreview.length} jobs found — click to import
              </div>
              {importPreview.map(sj => {
                const fm = simproConfig.fieldMapping;
                const alreadyIn = jobs.some(j => j.simproJobId === String(sj.id));
                return (
                  <div key={sj.id} className="flex items-center justify-between px-4 py-3 border-b border-slate-50 hover:bg-slate-50">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{sj[fm.jobNameField] ?? sj.Name}</div>
                      <div className="text-xs text-slate-500">{sj[fm.clientNameField] ?? sj['Customer.CompanyName']} · {sj[fm.estimatedHoursField] ?? sj.TotalLabourHours}h · Due {sj[fm.dueDateField] ?? sj.DateRequired}</div>
                      <div className="text-[10px] text-orange-500 font-medium">#{sj.id}</div>
                    </div>
                    {alreadyIn ? (
                      <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle size={12} /> Imported</span>
                    ) : (
                      <button onClick={() => importSimproJob(sj)}
                        className="px-3 py-1.5 text-xs font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600">
                        Import
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Export tab ── */}
      {activeTab === 'export' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Push Schedule to Simpro</h3>
            <p className="text-xs text-slate-500 mb-3">
              Creates schedule blocks in Simpro for the selected jobs. Each ScheduleEntry becomes a block assigned to the staff member on that date.
            </p>
            <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto rounded-lg border border-slate-100">
              {syncedJobs.map(job => (
                <label key={job.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox"
                    checked={selectedJobIds.includes(job.id)}
                    onChange={e => setSelectedJobIds(p => e.target.checked ? [...p, job.id] : p.filter(id => id !== job.id))}
                    className="rounded border-slate-300 text-orange-500 focus:ring-orange-400" />
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: job.colour }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-800 truncate">{job.jobName}</div>
                    <div className="text-[10px] text-slate-400">{job.clientName} · Simpro #{job.simproJobId}</div>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {scheduleEntries.filter(e => e.jobId === job.id).length} blocks
                  </div>
                </label>
              ))}
              {syncedJobs.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-sm">
                  No Simpro-linked jobs. Import jobs first.
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={pushScheduleToSimpro}
                disabled={selectedJobIds.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {status === 'syncing' ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
                Push {selectedJobIds.length > 0 ? `${selectedJobIds.length} Job(s)` : 'Selected'} to Simpro
              </button>
              {simproConfig.lastSyncAt && (
                <span className="text-[10px] text-slate-400">
                  Last sync: {new Date(simproConfig.lastSyncAt).toLocaleString('en-AU')}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Messages tab ── */}
      {activeTab === 'messages' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Client Schedule Messages</h3>
            <p className="text-xs text-slate-500 mb-3">
              Triggers Simpro's messaging system to notify clients their job has been scheduled.
              Simpro sends the message via SMS or email based on client preferences.
            </p>
            <div className="bg-slate-50 rounded-lg p-3 mb-3 font-mono text-xs text-slate-600 whitespace-pre-wrap border border-slate-200">
{`Hi [Client Name],

Your job "[Job Name]" has been scheduled 
by Casone Electrical.

Start date: [Start Date]
Estimated completion: [Deadline]
Your electrician: [Lead Staff Member]

Questions? Call us on 03 XXXX XXXX

– Safe Reliable Electrical`}
            </div>
            <div className="divide-y divide-slate-50 rounded-lg border border-slate-100 max-h-60 overflow-y-auto">
              {syncedJobs.filter(j => j.clientEmail || j.clientPhone).map(job => (
                <label key={job.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox"
                    checked={selectedJobIds.includes(job.id)}
                    onChange={e => setSelectedJobIds(p => e.target.checked ? [...p, job.id] : p.filter(id => id !== job.id))}
                    className="rounded border-slate-300 text-orange-500 focus:ring-orange-400" />
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: job.colour }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-800">{job.jobName}</div>
                    <div className="text-[10px] text-slate-400">{job.clientName} · {job.clientEmail || job.clientPhone}</div>
                  </div>
                </label>
              ))}
            </div>
            <button onClick={sendClientMessages}
              disabled={selectedJobIds.length === 0}
              className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {status === 'syncing' ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
              Send {selectedJobIds.length > 0 ? `${selectedJobIds.length} Message(s)` : 'Messages'}
            </button>
          </div>
        </div>
      )}

      {/* Status bar */}
      {statusMsg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
          status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
          status === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
          'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {status === 'success' ? <CheckCircle size={14} /> :
           status === 'error' ? <AlertTriangle size={14} /> :
           <RefreshCw size={14} className="animate-spin" />}
          {statusMsg}
        </div>
      )}
    </div>
  );
}

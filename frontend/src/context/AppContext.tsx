import React, {
  createContext, useContext, useReducer, useEffect,
  useCallback, useRef, useState,
} from 'react';
import { toast } from 'sonner';
import type { AppState, Staff, Job, ScheduleEntry, AppSettings, StaffEvent, SimproConfig } from '../types';
import { autoSchedule, generateId } from '../utils/schedulingEngine';
import { DEMO_STAFF, DEMO_JOBS, DEMO_SCHEDULE_ENTRIES, DEMO_STAFF_EVENTS } from '../utils/demoData';
import { supabase } from '../lib/supabase';
import * as db from '../lib/db';

// ─── Default values ──────────────────────────────────────────────────────────

const defaultSettings: AppSettings = {
  overrideOverbooking:   false,
  workingDaysPerWeek:    [1, 2, 3, 4, 5],
  currentWeekOffset:     0,
};

const defaultSimproConfig: SimproConfig = {
  enabled: false, subdomain: '', companyId: '0', apiToken: '',
  autoSyncOnSave: false, sendClientMessages: false, lastSyncAt: null,
  fieldMapping: {
    jobNameField: 'Name', clientNameField: 'Customer.CompanyName',
    startDateField: 'DateIssued', dueDateField: 'DateRequired',
    estimatedHoursField: 'TotalLabourHours', statusField: 'Status',
  },
};

const emptyState: AppState = {
  staff: [], jobs: [], scheduleEntries: [], staffEvents: [],
  settings: defaultSettings, simproConfig: defaultSimproConfig,
};

// currentWeekOffset is per-device (each user navigates calendar independently)
const LOCAL_WEEK_OFFSET_KEY = 'casgrid_week_offset';

// Live cross-device sync status, surfaced as a small indicator in the header.
export type SyncStatus = 'live' | 'reconnecting' | 'offline';

// ─── Reducer ─────────────────────────────────────────────────────────────────

type Action =
  | { type: 'LOAD_ALL';           payload: Omit<AppState, 'settings'> & { settings: Omit<AppSettings,'currentWeekOffset'> } }
  | { type: 'ADD_STAFF';          payload: Staff }
  | { type: 'UPDATE_STAFF';       payload: Staff }
  | { type: 'UPSERT_STAFF';       payload: Staff }        // from Realtime
  | { type: 'DELETE_STAFF';       payload: string }
  | { type: 'ADD_JOB';            payload: Job }
  | { type: 'UPDATE_JOB';         payload: Job }
  | { type: 'UPSERT_JOB';         payload: Job }          // from Realtime
  | { type: 'DELETE_JOB';         payload: string }
  | { type: 'SET_SCHEDULE_ENTRIES'; payload: ScheduleEntry[] }
  | { type: 'UPDATE_SCHEDULE_ENTRY'; payload: ScheduleEntry }
  | { type: 'UPSERT_SCHEDULE_ENTRY'; payload: ScheduleEntry } // from Realtime
  | { type: 'DELETE_SCHEDULE_ENTRY'; payload: string }
  | { type: 'ADD_STAFF_EVENT';    payload: StaffEvent }
  | { type: 'UPDATE_STAFF_EVENT'; payload: StaffEvent }
  | { type: 'UPSERT_STAFF_EVENT'; payload: StaffEvent }   // from Realtime
  | { type: 'DELETE_STAFF_EVENT'; payload: string }
  | { type: 'UPDATE_SETTINGS';    payload: Partial<AppSettings> }
  | { type: 'UPDATE_SIMPRO_CONFIG'; payload: Partial<SimproConfig> }
  | { type: 'RESET_DEMO' };

function upsert<T extends { id: string | number }>(list: T[], item: T): T[] {
  return list.some(x => x.id === item.id)
    ? list.map(x => x.id === item.id ? item : x)
    : [...list, item];
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {

    case 'LOAD_ALL':
      return {
        ...action.payload,
        settings: {
          ...action.payload.settings,
          // Preserve the per-device week offset that came in via localStorage
          currentWeekOffset: state.settings.currentWeekOffset,
        },
      };

    // ── Staff ──
    case 'ADD_STAFF':
    case 'UPSERT_STAFF':
      return { ...state, staff: upsert(state.staff, action.payload) };
    case 'UPDATE_STAFF':
      return { ...state, staff: state.staff.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_STAFF':
      return {
        ...state,
        staff: state.staff.filter(s => s.id !== action.payload),
        jobs: state.jobs.map(j => ({
          ...j, assignedStaffIds: j.assignedStaffIds.filter(id => id !== action.payload),
        })),
        scheduleEntries: state.scheduleEntries.filter(e => e.staffId !== action.payload),
        staffEvents:     state.staffEvents.filter(e => e.staffId !== action.payload),
      };

    // ── Jobs ──
    case 'ADD_JOB':
    case 'UPSERT_JOB':
      return { ...state, jobs: upsert(state.jobs, action.payload) };
    case 'UPDATE_JOB':
      return { ...state, jobs: state.jobs.map(j => j.id === action.payload.id ? action.payload : j) };
    case 'DELETE_JOB':
      return {
        ...state,
        jobs:            state.jobs.filter(j => j.id !== action.payload),
        scheduleEntries: state.scheduleEntries.filter(e => e.jobId !== action.payload),
      };

    // ── Schedule entries ──
    case 'SET_SCHEDULE_ENTRIES':
      return { ...state, scheduleEntries: action.payload };
    case 'UPDATE_SCHEDULE_ENTRY':
    case 'UPSERT_SCHEDULE_ENTRY':
      return { ...state, scheduleEntries: upsert(state.scheduleEntries, action.payload) };
    case 'DELETE_SCHEDULE_ENTRY':
      return { ...state, scheduleEntries: state.scheduleEntries.filter(e => e.id !== action.payload) };

    // ── Staff events ──
    case 'ADD_STAFF_EVENT':
    case 'UPSERT_STAFF_EVENT':
      return { ...state, staffEvents: upsert(state.staffEvents, action.payload) };
    case 'UPDATE_STAFF_EVENT':
      return { ...state, staffEvents: state.staffEvents.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'DELETE_STAFF_EVENT':
      return { ...state, staffEvents: state.staffEvents.filter(e => e.id !== action.payload) };

    // ── Settings ──
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'UPDATE_SIMPRO_CONFIG':
      return { ...state, simproConfig: { ...state.simproConfig, ...action.payload } };

    // ── Reset ──
    case 'RESET_DEMO':
      return { ...emptyState, settings: { ...defaultSettings, currentWeekOffset: state.settings.currentWeekOffset } };

    default:
      return state;
  }
}

// ─── Context interface (unchanged from prototype + syncStatus) ────────────────

interface AppContextType {
  state: AppState;
  syncStatus: SyncStatus;
  addStaff:             (s: Omit<Staff,'id'>)         => void;
  updateStaff:          (s: Staff)                    => void;
  deleteStaff:          (id: string)                  => void;
  addJob:               (j: Omit<Job,'id'>)           => void;
  updateJob:            (j: Job)                      => void;
  deleteJob:            (id: string)                  => void;
  updateScheduleEntry:  (e: ScheduleEntry)            => void;
  deleteScheduleEntry:  (id: string)                  => void;
  addStaffEvent:        (e: Omit<StaffEvent,'id'>)    => void;
  updateStaffEvent:     (e: StaffEvent)               => void;
  deleteStaffEvent:     (id: string)                  => void;
  runAutoSchedule:      ()                            => void;
  updateSettings:       (s: Partial<AppSettings>)     => void;
  updateSimproConfig:   (c: Partial<SimproConfig>)    => void;
  resetDemo:            ()                            => void;
  exportData:           ()                            => void;
  importData:           (json: string)                => void;
}

const AppContext = createContext<AppContextType | null>(null);

// ─── Write helper ─────────────────────────────────────────────────────────────
// The caller has already dispatched its optimistic update. This persists the
// change to Supabase, retries once on a transient failure, and — if it still
// fails — surfaces a toast so a write is never silently lost (which previously
// looked like "my change didn't show up on other devices").

function persist(label: string, fn: () => Promise<void>) {
  fn()
    .catch(() => fn())                       // one retry covers a brief network blip
    .catch((err) => {
      console.error(`[CasGrid] ${label} save failed`, err);
      toast.error(`Couldn't save ${label}. Your change may not have synced — please try again.`);
    });
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {

  // Seed currentWeekOffset from localStorage before first render
  const savedOffset = parseInt(localStorage.getItem(LOCAL_WEEK_OFFSET_KEY) ?? '0', 10) || 0;
  const [state, dispatch] = useReducer(reducer, {
    ...emptyState,
    settings: { ...defaultSettings, currentWeekOffset: savedOffset },
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    () => (typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'reconnecting'),
  );

  /**
   * skipAutoScheduleRef — set to true before applying Realtime-sourced or
   * catch-up state changes so the auto-schedule effect does NOT fire a redundant
   * re-calculation (the client that made the change already ran it and wrote the
   * results). The effect consumes the flag exactly once per render (see §5).
   */
  const skipAutoScheduleRef = useRef(false);
  // Have we been SUBSCRIBED before? A later SUBSCRIBED means a reconnect → catch up.
  const isSubscribedRef = useRef(false);
  // Debounce timer so online + visibility + reconnect don't stack re-syncs.
  const resyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 1. Data load (reusable; silent = quiet background catch-up) ─────────────

  const loadAll = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);                       // full-screen loader on first load only
    try {
      const [staff, jobs, entries, events, settings, simpro] = await Promise.all([
        db.fetchStaff(),
        db.fetchJobs(),
        db.fetchScheduleEntries(),
        db.fetchStaffEvents(),
        db.fetchSettings(),
        db.fetchSimproConfig(),
      ]);
      // A background catch-up must not re-run auto-schedule (it would write churn
      // back to the DB and echo to everyone). The initial load still schedules.
      if (silent) skipAutoScheduleRef.current = true;
      dispatch({
        type: 'LOAD_ALL',
        payload: {
          staff,
          jobs,
          scheduleEntries: entries,
          staffEvents:     events,
          settings:        settings ?? { overrideOverbooking: false, workingDaysPerWeek: [1,2,3,4,5] },
          simproConfig:    simpro   ?? defaultSimproConfig,
        },
      });
      if (!silent) setLoadError(null);
    } catch (err: unknown) {
      if (!silent) {
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Failed to load data. Check your Supabase credentials.'
        );
      } else {
        // Never blank the app on a background re-sync — just log and try again later.
        console.error('[CasGrid] background re-sync failed', err);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Debounced background catch-up — pulls the full current state from Supabase.
  const scheduleResync = useCallback(() => {
    if (resyncTimerRef.current) clearTimeout(resyncTimerRef.current);
    resyncTimerRef.current = setTimeout(() => {
      resyncTimerRef.current = null;
      loadAll({ silent: true });
    }, 300);
  }, [loadAll]);

  // ── 2. Realtime subscriptions ─────────────────────────────────────────────
  // One shared channel for all tables.
  // On any remote change: skip auto-schedule (the originating client handles it),
  // then merge the new row into local state.

  useEffect(() => {
    function withSkip(fn: () => void) {
      skipAutoScheduleRef.current = true;   // consumed once by the auto-schedule effect (§5)
      fn();
    }

    const channel = supabase
      .channel('casgrid-app-changes')

      // ── staff ──
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff' },
        ({ new: r }) => withSkip(() => dispatch({ type: 'UPSERT_STAFF', payload: db.fromDbStaff(r as Record<string,unknown>) })))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'staff' },
        ({ new: r }) => withSkip(() => dispatch({ type: 'UPSERT_STAFF', payload: db.fromDbStaff(r as Record<string,unknown>) })))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'staff' },
        ({ old: r }) => withSkip(() => dispatch({ type: 'DELETE_STAFF', payload: (r as { id: string }).id })))

      // ── jobs ──
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' },
        ({ new: r }) => withSkip(() => dispatch({ type: 'UPSERT_JOB', payload: db.fromDbJob(r as Record<string,unknown>) })))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs' },
        ({ new: r }) => withSkip(() => dispatch({ type: 'UPSERT_JOB', payload: db.fromDbJob(r as Record<string,unknown>) })))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'jobs' },
        ({ old: r }) => withSkip(() => dispatch({ type: 'DELETE_JOB', payload: (r as { id: string }).id })))

      // ── schedule_entries ──
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'schedule_entries' },
        ({ new: r }) => withSkip(() => dispatch({ type: 'UPSERT_SCHEDULE_ENTRY', payload: db.fromDbEntry(r as Record<string,unknown>) })))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'schedule_entries' },
        ({ new: r }) => withSkip(() => dispatch({ type: 'UPSERT_SCHEDULE_ENTRY', payload: db.fromDbEntry(r as Record<string,unknown>) })))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'schedule_entries' },
        ({ old: r }) => withSkip(() => dispatch({ type: 'DELETE_SCHEDULE_ENTRY', payload: (r as { id: string }).id })))

      // ── staff_events ──
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff_events' },
        ({ new: r }) => withSkip(() => dispatch({ type: 'UPSERT_STAFF_EVENT', payload: db.fromDbEvent(r as Record<string,unknown>) })))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'staff_events' },
        ({ new: r }) => withSkip(() => dispatch({ type: 'UPSERT_STAFF_EVENT', payload: db.fromDbEvent(r as Record<string,unknown>) })))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'staff_events' },
        ({ old: r }) => withSkip(() => dispatch({ type: 'DELETE_STAFF_EVENT', payload: (r as { id: string }).id })))

      // ── app_settings ──
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' },
        ({ new: r }) => {
          const row = r as Record<string, unknown>;
          withSkip(() => dispatch({
            type: 'UPDATE_SETTINGS',
            payload: {
              overrideOverbooking: row.override_overbooking as boolean,
              workingDaysPerWeek:  row.working_days_per_week as number[],
            },
          }));
        })

      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setSyncStatus('live');
          // A SUBSCRIBED *after* a previous one means the socket dropped and came
          // back — Realtime does not replay missed events, so pull a fresh copy.
          if (isSubscribedRef.current) scheduleResync();
          isSubscribedRef.current = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[CasGrid] realtime status:', status);
          setSyncStatus('reconnecting');
        }
      });

    return () => {
      supabase.removeChannel(channel);
      isSubscribedRef.current = false;   // also keeps React StrictMode's double-mount clean
    };
  }, [scheduleResync]);

  // ── 3. Recover after a dropped connection / sleep / tab switch ─────────────
  // Realtime reconnects on its own but won't backfill missed changes, so re-pull
  // whenever the device comes back online or the tab is refocused.

  useEffect(() => {
    const onOnline  = () => { setSyncStatus('reconnecting'); scheduleResync(); };
    const onOffline = () => setSyncStatus('offline');
    const onVisible = () => { if (document.visibilityState === 'visible') scheduleResync(); };

    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      if (resyncTimerRef.current) clearTimeout(resyncTimerRef.current);
    };
  }, [scheduleResync]);

  // ── 4. Persist currentWeekOffset locally (per-device) ────────────────────

  useEffect(() => {
    localStorage.setItem(LOCAL_WEEK_OFFSET_KEY, String(state.settings.currentWeekOffset));
  }, [state.settings.currentWeekOffset]);

  // ── 5. Auto-schedule ──────────────────────────────────────────────────────
  // Runs when jobs / staff / events / overbooking setting change locally.
  // Writes the result to Supabase so other clients receive it via Realtime.

  const runAutoSchedule = useCallback(() => {
    if (skipAutoScheduleRef.current) return;

    const newEntries = autoSchedule(
      state.jobs, state.staff, state.scheduleEntries,
      state.staffEvents, state.settings.overrideOverbooking,
    );
    dispatch({ type: 'SET_SCHEDULE_ENTRIES', payload: newEntries });
    // Persist asynchronously — don't block the UI
    persist('schedule', () => db.replaceAutoScheduleEntries(newEntries));
  }, [state.jobs, state.staff, state.scheduleEntries, state.staffEvents, state.settings.overrideOverbooking]);

  useEffect(() => {
    if (loading) return;
    // Edge-triggered: a Realtime/catch-up change set the skip flag — consume it
    // once (deterministically, no timers) and don't recompute/write the schedule.
    if (skipAutoScheduleRef.current) {
      skipAutoScheduleRef.current = false;
      return;
    }
    runAutoSchedule();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.jobs, state.staff, state.staffEvents, state.settings.overrideOverbooking, loading]);

  // ── 6. Action functions (same signatures as the prototype) ────────────────

  function addStaff(s: Omit<Staff,'id'>) {
    const staff: Staff = { ...s, id: generateId() };
    dispatch({ type: 'ADD_STAFF', payload: staff });
    persist('staff member', () => db.upsertStaff(staff));
  }
  function updateStaff(s: Staff) {
    dispatch({ type: 'UPDATE_STAFF', payload: s });
    persist('staff member', () => db.upsertStaff(s));
  }
  function deleteStaff(id: string) {
    dispatch({ type: 'DELETE_STAFF', payload: id });
    persist('staff removal', () => db.deleteStaff(id));
  }

  function addJob(j: Omit<Job,'id'>) {
    const job: Job = { ...j, id: generateId() };
    dispatch({ type: 'ADD_JOB', payload: job });
    persist('job', () => db.upsertJob(job));
  }
  function updateJob(j: Job) {
    dispatch({ type: 'UPDATE_JOB', payload: j });
    persist('job', () => db.upsertJob(j));
  }
  function deleteJob(id: string) {
    dispatch({ type: 'DELETE_JOB', payload: id });
    persist('job removal', () => db.deleteJob(id));
  }

  function updateScheduleEntry(e: ScheduleEntry) {
    dispatch({ type: 'UPDATE_SCHEDULE_ENTRY', payload: e });
    persist('schedule change', () => db.upsertScheduleEntry(e));
  }
  function deleteScheduleEntry(id: string) {
    dispatch({ type: 'DELETE_SCHEDULE_ENTRY', payload: id });
    persist('schedule change', () => db.deleteScheduleEntry(id));
  }

  function addStaffEvent(e: Omit<StaffEvent,'id'>) {
    const ev: StaffEvent = { ...e, id: generateId() };
    dispatch({ type: 'ADD_STAFF_EVENT', payload: ev });
    persist('event', () => db.upsertStaffEvent(ev));
  }
  function updateStaffEvent(e: StaffEvent) {
    dispatch({ type: 'UPDATE_STAFF_EVENT', payload: e });
    persist('event', () => db.upsertStaffEvent(e));
  }
  function deleteStaffEvent(id: string) {
    dispatch({ type: 'DELETE_STAFF_EVENT', payload: id });
    persist('event removal', () => db.deleteStaffEvent(id));
  }

  function updateSettings(partial: Partial<AppSettings>) {
    dispatch({ type: 'UPDATE_SETTINGS', payload: partial });
    // Persist shared settings (not currentWeekOffset — that's local)
    const { currentWeekOffset: _skip, ...shared } = { ...state.settings, ...partial };
    persist('settings', () => db.upsertSettings(shared));
  }

  function updateSimproConfig(partial: Partial<SimproConfig>) {
    dispatch({ type: 'UPDATE_SIMPRO_CONFIG', payload: partial });
    const next = { ...state.simproConfig, ...partial };
    persist('Simpro settings', () => db.upsertSimproConfig(next));
  }

  function resetDemo() {
    dispatch({ type: 'RESET_DEMO' });
    persist('demo reset', () =>
      db.seedDatabase(DEMO_STAFF, DEMO_JOBS, DEMO_SCHEDULE_ENTRIES, DEMO_STAFF_EVENTS));
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `casgrid-schedule-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(json: string) {
    try {
      const parsed = JSON.parse(json) as AppState;
      // Write everything to Supabase
      db.seedDatabase(
        parsed.staff,
        parsed.jobs,
        parsed.scheduleEntries,
        parsed.staffEvents,
      ).then(() => {
        dispatch({ type: 'LOAD_ALL', payload: parsed });
      }).catch(err => toast.error(`Import failed: ${err.message}`));
    } catch {
      toast.error('Invalid JSON file. Please check the format and try again.');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen casgrid-grid-bg flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-5">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 opacity-20 blur-md" />
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <span className="w-5 h-5 border-[3px] border-white/40 border-t-white rounded-full animate-spin" />
            </div>
          </div>
          <p className="font-display font-bold text-slate-800">Loading CasGrid…</p>
          <p className="text-slate-400 text-sm mt-1">Connecting to the live schedule</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen casgrid-grid-bg flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-xl">!</span>
          </div>
          <h2 className="font-display font-bold text-slate-800 text-lg mb-2">Database connection failed</h2>
          <p className="text-slate-500 text-sm mb-1">
            Could not connect to Supabase. Check that your environment variables are set correctly.
          </p>
          <p className="text-red-500 text-xs font-mono bg-red-50 rounded p-2 mb-5 break-all">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-colors shadow-sm shadow-amber-600/30"
          >
            Retry connection
          </button>
          <p className="text-xs text-slate-400 mt-4">
            See <code className="bg-slate-100 px-1 rounded">.env.example</code> for required variables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{
      state,
      syncStatus,
      addStaff, updateStaff, deleteStaff,
      addJob, updateJob, deleteJob,
      updateScheduleEntry, deleteScheduleEntry,
      addStaffEvent, updateStaffEvent, deleteStaffEvent,
      runAutoSchedule, updateSettings, updateSimproConfig,
      resetDemo, exportData, importData,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

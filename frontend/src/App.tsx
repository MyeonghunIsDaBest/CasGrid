// @ts-nocheck
import { useState } from 'react';
import { Toaster } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, LayoutDashboard, Briefcase, Users, GitBranch, Settings, Menu, X, GraduationCap, Link2 } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { JobModalProvider, useJobModal } from './context/JobModalContext';
import { KPICards } from './components/KPICards';
import { RealtimeStatus } from './components/RealtimeStatus';
import { EmptyState } from './components/EmptyState';
import { WeeklyPlanner } from './components/WeeklyPlanner';
import { JobsPanel } from './components/JobsPanel';
import { StaffPanel } from './components/StaffPanel';
import { Timeline } from './components/Timeline';
import { CapacityChart, StaffUtilisationChart } from './components/Charts';
import { UpcomingDeadlines } from './components/UpcomingDeadlines';
import { SettingsPanel } from './components/SettingsPanel';
import { TradeSchoolPanel } from './components/TradeSchoolPanel';
import { SimproPanel } from './components/SimproPanel';
import { JobDetailModal } from './components/JobDetailModal';
import { getWeekWorkingDays, toDateString } from './utils/dateUtils';
import { computeWeeklyMetrics } from './utils/schedulingEngine';
import './index.css';

type Tab = 'dashboard' | 'jobs' | 'staff' | 'timeline' | 'events' | 'simpro' | 'settings';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={15}/> },
  { id: 'jobs', label: 'Jobs', icon: <Briefcase size={15}/> },
  { id: 'staff', label: 'Staff', icon: <Users size={15}/> },
  { id: 'timeline', label: 'Timeline', icon: <GitBranch size={15}/> },
  { id: 'events', label: 'Events', icon: <GraduationCap size={15}/> },
  { id: 'simpro', label: 'Simpro', icon: <Link2 size={15}/> },
  { id: 'settings', label: 'Settings', icon: <Settings size={15}/> },
];

const SYNC_META = {
  live:         { label: 'Live',   dot: 'bg-emerald-500', text: 'text-emerald-600', pulse: false, title: 'Live — changes sync instantly across every device' },
  reconnecting: { label: 'Sync…',  dot: 'bg-amber-400',   text: 'text-amber-600',   pulse: true,  title: 'Connecting to live sync…' },
  offline:      { label: 'Offline',dot: 'bg-red-500',     text: 'text-red-500',     pulse: false, title: 'Offline — changes are saved and will sync when you reconnect' },
};

function SyncIndicator({ status }: { status: 'live' | 'reconnecting' | 'offline' }) {
  const m = SYNC_META[status] ?? SYNC_META.reconnecting;
  return (
    <span title={m.title}
      className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg bg-white/70 ring-1 ring-black/5 ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${m.pulse ? 'animate-pulse' : ''}`} />
      {m.label}
    </span>
  );
}

function CasGridLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm shadow-amber-500/30 ring-1 ring-amber-600/20">
        <Zap size={16} className="text-white" fill="currentColor" />
      </div>
      <div className="leading-none">
        <div className="font-display font-extrabold text-[15px] tracking-tight text-slate-900">
          Cas<span className="text-amber-500">Grid</span>
        </div>
        <div className="text-[8px] font-bold tracking-[0.2em] text-slate-400 mt-1">CASONE ELECTRICAL</div>
      </div>
    </div>
  );
}

function AppShell() {
  const { state, syncStatus } = useApp();
  const { selectedJobId } = useJobModal();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const days = getWeekWorkingDays(state.settings.currentWeekOffset);
  const dayStrings = days.map(toDateString);
  const metrics = computeWeeklyMetrics(dayStrings, state.staff, state.scheduleEntries, state.jobs, state.staffEvents);
  const unscheduledCount = state.jobs.filter(j => j.status === 'unscheduled').length;
  const tradeSchoolCount = (state.staffEvents || []).filter(e => e.type === 'tradeSchool').length;
  const simproLinked = state.jobs.filter(j => j.simproJobId).length;

  const navBadge = (id: string) => {
    if (id === 'jobs' && unscheduledCount > 0)
      return <span className="min-w-4 h-4 px-1 bg-amber-500 text-white text-[8px] rounded-full inline-flex items-center justify-center font-bold">{unscheduledCount}</span>;
    if (id === 'events' && tradeSchoolCount > 0)
      return <span className="min-w-4 h-4 px-1 bg-indigo-500 text-white text-[8px] rounded-full inline-flex items-center justify-center font-bold">{tradeSchoolCount > 9 ? '9+' : tradeSchoolCount}</span>;
    if (id === 'simpro' && simproLinked > 0)
      return <span className="min-w-4 h-4 px-1 bg-sky-500 text-white text-[8px] rounded-full inline-flex items-center justify-center font-bold">{simproLinked}</span>;
    return null;
  };

  return (
    <div className="min-h-screen casgrid-grid-bg flex flex-col">
      <header className="bg-white/85 backdrop-blur-md border-b border-amber-100/70 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <CasGridLogo />

          <div className="flex items-center gap-2">
            <SyncIndicator status={syncStatus} />

            <nav className="hidden md:flex items-center gap-0.5 bg-slate-100/70 rounded-xl p-1">
              {NAV_ITEMS.map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === item.id
                      ? 'bg-white text-amber-700 shadow-sm ring-1 ring-black/5'
                      : 'text-slate-500 hover:text-slate-800'}`}>
                  {item.icon} {item.label}
                  {navBadge(item.id)}
                </button>
              ))}
            </nav>

            <button className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
              onClick={() => setMobileMenuOpen(o => !o)}>
              {mobileMenuOpen ? <X size={18}/> : <Menu size={18}/>}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div initial={{ height:0 }} animate={{ height:'auto' }} exit={{ height:0 }}
              className="overflow-hidden border-t border-slate-100 md:hidden bg-white/95">
              <div className="px-4 py-2 grid grid-cols-2 gap-1">
                {NAV_ITEMS.map(item => (
                  <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === item.id ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                    {item.icon} {item.label} {navBadge(item.id)}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-5">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }}
            exit={{ opacity:0 }} transition={{ duration:0.12 }}>

            {activeTab === 'dashboard' && (
              <div className="space-y-4">
                {state.staff.length === 0 && state.jobs.length === 0 && (
                  <EmptyState
                    onAddStaff={() => setActiveTab('staff')}
                    onAddJob={() => setActiveTab('jobs')}
                  />
                )}
                <KPICards
                  totalAvailable={metrics.totalAvailableHours} allocated={metrics.allocatedHours}
                  remaining={metrics.remainingCapacity} utilisationPct={metrics.utilisationPct}
                  jobsAtRisk={metrics.jobsAtRisk} overbookedDays={metrics.overbookedDays}
                />
                <RealtimeStatus />
                <WeeklyPlanner />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <CapacityChart />
                  <UpcomingDeadlines />
                  <StaffUtilisationChart />
                </div>
                <Timeline />
              </div>
            )}
            {activeTab === 'jobs' && <div className="max-w-4xl mx-auto"><JobsPanel /></div>}
            {activeTab === 'staff' && <StaffPanel />}
            {activeTab === 'timeline' && (
              <div className="space-y-5">
                <Timeline />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <CapacityChart />
                  <StaffUtilisationChart />
                </div>
              </div>
            )}
            {activeTab === 'events' && <div className="max-w-3xl"><TradeSchoolPanel /></div>}
            {activeTab === 'simpro' && <div className="max-w-3xl"><SimproPanel /></div>}
            {activeTab === 'settings' && <SettingsPanel />}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {selectedJobId && <JobDetailModal />}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <JobModalProvider>
        <AppShell />
        <Toaster position="top-right" richColors closeButton />
      </JobModalProvider>
    </AppProvider>
  );
}

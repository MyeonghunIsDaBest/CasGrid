export type StaffType = 'field' | 'office';
export type JobStatus = 'unscheduled' | 'scheduled' | 'inProgress' | 'completed' | 'onHold';
export type JobPriority = 'low' | 'medium' | 'high' | 'urgent';
export type StaffEventType = 'tradeSchool' | 'leave' | 'sick' | 'publicHoliday' | 'other';

export interface Staff {
  id: string;
  name: string;
  role: string;
  type: StaffType;
  dailyAvailableHours: number;
  skills: string[];
  isBillable: boolean;
  canAssistFieldWork: boolean;
  active: boolean;
  colour: string;
  isApprentice: boolean; // enables trade school tracking
}

export interface Job {
  id: string;
  jobName: string;
  clientName: string;
  clientEmail: string;    // for Simpro messaging
  clientPhone: string;
  simproJobId: string;    // linked Simpro job number
  estimatedHours: number;
  remainingHours: number;
  priority: JobPriority;
  startDate: string;
  deadline: string;
  assignedStaffIds: string[];
  // Per-day staff override: date string → array of staffIds to use THAT day
  // If a date key exists, its staff list is used instead of assignedStaffIds
  dailyStaffOverrides: Record<string, string[]>;
  status: JobStatus;
  notes: string;
  colour: string;
  // Running-time tracker: how long the job has been actively running.
  // `runningStartedAt` is set whenever the job is in an active status
  // (unscheduled/scheduled/inProgress); null when paused (completed/onHold).
  // `runningTimeMs` is the accumulated ms from previous active runs.
  // Optional so legacy rows / demo data without the fields still validate;
  // the runningTime helpers handle the undefined case as "no time accumulated".
  runningStartedAt?: string | null;
  runningTimeMs?: number;
}

export interface ScheduleEntry {
  id: string;
  jobId: string;
  staffId: string;
  date: string;
  hours: number;
  isManualOverride: boolean;
  // Day was intentionally approved for overtime (allocated > daily capacity).
  // Optional so legacy rows / demo data without the field still validate;
  // treated as false when absent.
  isOvertime?: boolean;
}

/** Blocks a staff member's capacity for a day (trade school, leave, etc.) */
export interface StaffEvent {
  id: string;
  staffId: string;
  date: string;
  type: StaffEventType;
  label: string;
  hours: number; // how many hours this blocks (8 = full day)
  colour: string;
}

export interface SimproConfig {
  enabled: boolean;
  subdomain: string;       // e.g. "casone" → https://casone.simprosuite.com
  companyId: string;       // Simpro company/branch ID
  apiToken: string;        // Bearer token from Simpro API settings
  autoSyncOnSave: boolean; // push schedule changes to Simpro automatically
  sendClientMessages: boolean; // trigger Simpro client messages on schedule
  lastSyncAt: string | null;
  fieldMapping: SimproFieldMapping;
}

export interface SimproFieldMapping {
  jobNameField: string;      // Simpro field that maps to jobName (default: 'Name')
  clientNameField: string;   // default: 'Customer.CompanyName'
  startDateField: string;    // default: 'DateIssued'
  dueDateField: string;      // default: 'DateRequired'
  estimatedHoursField: string; // default: 'TotalLabourHours'
  statusField: string;       // default: 'Status'
}

export type SyncTable = 'staff' | 'jobs' | 'schedule_entries' | 'staff_events' | 'app_settings' | 'simpro_config';
export type EventKind = 'add' | 'update' | 'delete' | 'load';

export interface RecentEvent {
  kind: EventKind;
  entity: SyncTable;
  label: string;
  at: number;
  count?: number; // when consecutive same-entity events coalesce
}

export interface AppState {
  staff: Staff[];
  jobs: Job[];
  scheduleEntries: ScheduleEntry[];
  staffEvents: StaffEvent[];
  settings: AppSettings;
  simproConfig: SimproConfig;
  // Realtime telemetry — UI-only, not persisted.
  lastSyncAt: number | null;
  lastEventAt: Partial<Record<SyncTable, number>>;
  recentEvents: RecentEvent[];
}

export interface AppSettings {
  overrideOverbooking: boolean;
  workingDaysPerWeek: number[];
  currentWeekOffset: number;
  /**
   * Per-week capacity goals shown above the Timeline. `weeklyBaseline` is
   * "what we currently expect to schedule" (e.g. 240h); `weeklyStretch` is
   * the target to push toward (e.g. 350h). Optional — JS defaults to
   * {240, 350} so the app works pre-migration.
   */
  capacityTargets?: { weeklyBaseline: number; weeklyStretch: number };
}

// Derived types
export interface DailyLoad {
  date: string;
  staffId: string;
  allocatedHours: number;
  availableHours: number;
  utilisation: number;
  isOverbooked: boolean;
  entries: ScheduleEntry[];
}

export interface WeeklyMetrics {
  totalAvailableHours: number;
  allocatedHours: number;
  remainingCapacity: number;
  utilisationPct: number;
  jobsAtRisk: number;
  overbookedDays: number;
}

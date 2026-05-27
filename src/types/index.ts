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
}

export interface ScheduleEntry {
  id: string;
  jobId: string;
  staffId: string;
  date: string;
  hours: number;
  isManualOverride: boolean;
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

export interface AppState {
  staff: Staff[];
  jobs: Job[];
  scheduleEntries: ScheduleEntry[];
  staffEvents: StaffEvent[];
  settings: AppSettings;
  simproConfig: SimproConfig;
}

export interface AppSettings {
  overrideOverbooking: boolean;
  workingDaysPerWeek: number[];
  currentWeekOffset: number;
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

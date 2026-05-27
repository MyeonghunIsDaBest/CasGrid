import { Staff, Job, ScheduleEntry, StaffEvent } from '../types';
import { format, addDays, startOfWeek } from 'date-fns';

const today = new Date();
const weekStart = startOfWeek(today, { weekStartsOn: 1 });
const d = (offset: number) => format(addDays(weekStart, offset), 'yyyy-MM-dd');

export const DEMO_STAFF: Staff[] = [
  { id: 'staff-1', name: 'Marco Ricci', role: 'Lead Electrician', type: 'field', dailyAvailableHours: 8, skills: ['domestic','commercial','solar','HV'], isBillable: true, canAssistFieldWork: true, active: true, colour: '#3b82f6', isApprentice: false },
  { id: 'staff-2', name: 'Jordan Blake', role: 'Electrician', type: 'field', dailyAvailableHours: 8, skills: ['domestic','commercial','solar'], isBillable: true, canAssistFieldWork: true, active: true, colour: '#8b5cf6', isApprentice: false },
  { id: 'staff-3', name: 'Sam Torres', role: 'Electrician', type: 'field', dailyAvailableHours: 8, skills: ['domestic','solar','batteries'], isBillable: true, canAssistFieldWork: true, active: true, colour: '#ec4899', isApprentice: false },
  { id: 'staff-4', name: 'Priya Sharma', role: 'Apprentice', type: 'field', dailyAvailableHours: 8, skills: ['domestic','commercial'], isBillable: true, canAssistFieldWork: true, active: true, colour: '#f59e0b', isApprentice: true },
  { id: 'staff-5', name: 'Tyler Chen', role: 'Electrician', type: 'field', dailyAvailableHours: 8, skills: ['domestic','commercial','industrial'], isBillable: true, canAssistFieldWork: true, active: true, colour: '#10b981', isApprentice: false },
  { id: 'staff-6', name: 'Ash Mullen', role: 'Electrician', type: 'field', dailyAvailableHours: 8, skills: ['domestic','solar','batteries','HV'], isBillable: true, canAssistFieldWork: true, active: true, colour: '#ef4444', isApprentice: false },
  { id: 'staff-7', name: 'Rochelle Park', role: 'Office Manager', type: 'office', dailyAvailableHours: 6, skills: ['admin','quoting','invoicing'], isBillable: false, canAssistFieldWork: false, active: true, colour: '#64748b', isApprentice: false },
  { id: 'staff-8', name: 'Luke Casone', role: 'Director', type: 'office', dailyAvailableHours: 6, skills: ['domestic','commercial','solar','management'], isBillable: true, canAssistFieldWork: true, active: true, colour: '#0ea5e9', isApprentice: false },
];

export const DEMO_JOBS: Job[] = [
  {
    id: 'job-1', jobName: 'Residential Solar & Battery Install', clientName: 'Thompson Family',
    clientEmail: 'thompsons@email.com', clientPhone: '0412 345 678', simproJobId: 'SP-10041',
    estimatedHours: 32, remainingHours: 32, priority: 'high', startDate: d(0), deadline: d(9),
    assignedStaffIds: ['staff-1','staff-3'], dailyStaffOverrides: {
      [d(0)]: ['staff-1','staff-3','staff-2'], // 3 staff on day 1 for install
      [d(1)]: ['staff-1','staff-3','staff-2'], // 3 staff on day 2
    },
    status: 'scheduled', notes: 'GoodWe 10kW + 50kWh battery. Access via side gate.', colour: '#f59e0b',
  },
  {
    id: 'job-2', jobName: 'Commercial Fit-Out — Level 3', clientName: 'Nexus Property Group',
    clientEmail: 'pm@nexusproperty.com.au', clientPhone: '03 9123 4567', simproJobId: 'SP-10042',
    estimatedHours: 80, remainingHours: 80, priority: 'urgent', startDate: d(0), deadline: d(14),
    assignedStaffIds: ['staff-2','staff-5'],
    dailyStaffOverrides: {},
    status: 'inProgress', notes: 'Council access required. Overtime may be needed.', colour: '#ef4444',
  },
  {
    id: 'job-3', jobName: 'Switchboard Upgrade', clientName: 'Parkview Apartments',
    clientEmail: 'manager@parkview.com.au', clientPhone: '0400 111 222', simproJobId: 'SP-10043',
    estimatedHours: 16, remainingHours: 16, priority: 'medium', startDate: d(2), deadline: d(11),
    assignedStaffIds: ['staff-4'], dailyStaffOverrides: {},
    status: 'scheduled', notes: '3-phase board, 24 circuits. Notify tenants 48h before.', colour: '#8b5cf6',
  },
  {
    id: 'job-4', jobName: 'EV Charger Installation ×4', clientName: 'Meridian Motors',
    clientEmail: 'facilities@meridianmotors.com.au', clientPhone: '0450 999 888', simproJobId: '',
    estimatedHours: 12, remainingHours: 12, priority: 'medium', startDate: d(5), deadline: d(16),
    assignedStaffIds: ['staff-6'], dailyStaffOverrides: {},
    status: 'scheduled', notes: 'Tesla Wall Connector units supplied by client.', colour: '#10b981',
  },
  {
    id: 'job-5', jobName: 'Industrial Data Centre Cabling', clientName: 'CoreStack Systems',
    clientEmail: 'ops@corestack.com.au', clientPhone: '03 8800 1234', simproJobId: 'SP-10045',
    estimatedHours: 120, remainingHours: 120, priority: 'high', startDate: d(7), deadline: d(35),
    assignedStaffIds: ['staff-1','staff-2','staff-5'], dailyStaffOverrides: {},
    status: 'scheduled', notes: 'Security clearance required. No photography on site.', colour: '#3b82f6',
  },
  {
    id: 'job-6', jobName: 'Domestic Rewire', clientName: 'Garcia Residence',
    clientEmail: 'garcia@email.com', clientPhone: '0422 000 111', simproJobId: '',
    estimatedHours: 24, remainingHours: 24, priority: 'low', startDate: d(10), deadline: d(21),
    assignedStaffIds: ['staff-4','staff-6'], dailyStaffOverrides: {},
    status: 'unscheduled', notes: 'Full rewire, asbestos inspection first.', colour: '#64748b',
  },
  {
    id: 'job-7', jobName: 'Solar Farm Maintenance', clientName: 'Sunridge Energy',
    clientEmail: 'maintenance@sunridge.com.au', clientPhone: '1300 786 000', simproJobId: 'SP-10047',
    estimatedHours: 40, remainingHours: 40, priority: 'medium', startDate: d(14), deadline: d(28),
    assignedStaffIds: ['staff-3','staff-6'], dailyStaffOverrides: {},
    status: 'unscheduled', notes: '200-panel array. Annual inspection + cleaning.', colour: '#0ea5e9',
  },
  {
    id: 'job-8', jobName: 'Generator Disconnection', clientName: 'Hallmark Foods (Deer Park)',
    clientEmail: 'safety@hallmarkfoods.com.au', clientPhone: '03 9000 7777', simproJobId: 'SP-10048',
    estimatedHours: 8, remainingHours: 8, priority: 'urgent', startDate: d(-1), deadline: d(3),
    assignedStaffIds: ['staff-8'], dailyStaffOverrides: {},
    status: 'inProgress', notes: 'Urgent — compliance deadline.', colour: '#f97316',
  },
];

export const DEMO_SCHEDULE_ENTRIES: ScheduleEntry[] = [];

// Priya has trade school every Wednesday
export const DEMO_STAFF_EVENTS: StaffEvent[] = [
  {
    id: 'ev-1', staffId: 'staff-4', date: d(2), type: 'tradeSchool',
    label: 'Trade School — Box Hill TAFE', hours: 8, colour: '#6366f1',
  },
  {
    id: 'ev-2', staffId: 'staff-4', date: d(9), type: 'tradeSchool',
    label: 'Trade School — Box Hill TAFE', hours: 8, colour: '#6366f1',
  },
  {
    id: 'ev-3', staffId: 'staff-4', date: d(16), type: 'tradeSchool',
    label: 'Trade School — Box Hill TAFE', hours: 8, colour: '#6366f1',
  },
];

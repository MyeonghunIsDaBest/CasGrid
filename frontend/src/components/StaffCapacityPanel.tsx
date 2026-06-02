// @ts-nocheck
//
// StaffCapacityPanel
// ------------------
// Thin wrapper that wires the portable StaffCapacity strip to live AppContext
// data, so it can be mounted independently of the Timeline (they're now separate
// components). Keeps StaffCapacity itself presentational/portable — all the
// AppContext coupling lives here.
//
import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { StaffCapacity } from './ui/StaffCapacity';

export function StaffCapacityPanel() {
  const { state } = useApp();
  const { staff, scheduleEntries, staffEvents } = state;

  // Map live data into the shapes StaffCapacity expects:
  //   staff   → { id, name, colour, dailyCapacity }
  //   entries → { staffId, date, hours }  (daily allocations)
  //   events  → { staffId, date, type }   (leave / tradeSchool)
  const capacityStaff = useMemo(
    () => staff
      .filter(s => s.active && s.isBillable)
      .map(s => ({ id: s.id, name: s.name, colour: s.colour, dailyCapacity: s.dailyAvailableHours })),
    [staff],
  );
  const entries = useMemo(
    () => scheduleEntries.map(e => ({ staffId: e.staffId, date: e.date, hours: e.hours })),
    [scheduleEntries],
  );
  const events = useMemo(
    () => staffEvents.map(ev => ({ staffId: ev.staffId, date: ev.date, type: ev.type })),
    [staffEvents],
  );

  return <StaffCapacity staff={capacityStaff} entries={entries} events={events} />;
}

export default StaffCapacityPanel;

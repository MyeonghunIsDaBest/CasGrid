/**
 * StaffHoverCard — wrap any element with a rich hover popover that shows
 * complete details about a staff member. Opens on mouse enter (after a
 * small delay so it doesn't flicker while scanning), closes on leave.
 *
 * Pure presentation — pulls extra details (job count) from the AppContext
 * itself so callers only need to pass the staff record.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Staff } from '../types';
import { useApp } from '../context/AppContext';

interface Props {
  staff: Staff;
  children: React.ReactNode;
  /** Delay before opening (ms). Default 120 — avoids flicker on quick passes. */
  openDelay?: number;
}

export function StaffHoverCard({ staff, children, openDelay = 120 }: Props) {
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; flipUp: boolean }>({ top: 0, left: 0, flipUp: false });

  const { state } = useApp();
  const activeJobsForStaff = state.jobs.filter(
    j => j.assignedStaffIds.includes(staff.id) && j.status !== 'completed',
  ).length;

  function compute() {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const POP_W = 240;
    const POP_H_GUESS = 200;
    const GUTTER = 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < POP_H_GUESS + GUTTER && rect.top > POP_H_GUESS + GUTTER;
    const top = flipUp ? rect.top - GUTTER : rect.bottom + GUTTER;
    let left = rect.left + rect.width / 2 - POP_W / 2;
    left = Math.max(GUTTER, Math.min(left, window.innerWidth - POP_W - GUTTER));
    setPos({ top, left, flipUp });
  }

  function handleEnter() {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    openTimerRef.current = setTimeout(() => {
      compute();
      setOpen(true);
    }, openDelay);
  }
  function handleLeave() {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    setOpen(false);
  }

  // Close on scroll / resize so the popover never drifts off its anchor.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  useEffect(() => () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
  }, []);

  const initials = staff.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    top: pos.flipUp ? undefined : pos.top,
    bottom: pos.flipUp ? window.innerHeight - pos.top : undefined,
    left: pos.left,
    width: 240,
    zIndex: 80,
  };

  return (
    <>
      <span
        ref={wrapperRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocus={handleEnter}
        onBlur={handleLeave}
        style={{ display: 'inline-flex' }}
      >
        {children}
      </span>
      {open && createPortal(
        <div
          style={popoverStyle}
          className="bg-white rounded-xl shadow-2xl border border-slate-200 p-3 text-xs animate-in fade-in slide-in-from-top-1 duration-100"
          role="tooltip"
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold text-white ring-2 ring-white shadow"
              style={{ backgroundColor: staff.colour }}
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-800 truncate">{staff.name}</div>
              <div className="text-[10px] text-slate-500 truncate">
                {staff.role}{staff.isApprentice ? ' · 🎓 Apprentice' : ''}
              </div>
            </div>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                staff.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {staff.active ? 'Active' : 'Inactive'}
            </span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            <div className="bg-slate-50 rounded-lg p-1.5 text-center">
              <div className="font-bold text-slate-800 text-[11px] tabular-nums">{staff.dailyAvailableHours}h</div>
              <div className="text-[8px] text-slate-400 uppercase tracking-wide">Per day</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-1.5 text-center">
              <div className="font-bold text-slate-800 text-[11px] capitalize">{staff.type}</div>
              <div className="text-[8px] text-slate-400 uppercase tracking-wide">Type</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-1.5 text-center">
              <div className="font-bold text-slate-800 text-[11px] tabular-nums">{activeJobsForStaff}</div>
              <div className="text-[8px] text-slate-400 uppercase tracking-wide">Jobs</div>
            </div>
          </div>

          {/* Billable + can-assist */}
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
              staff.isBillable ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {staff.isBillable ? '✓ Billable' : '✗ Non-billable'}
            </span>
            {staff.type === 'office' && staff.canAssistFieldWork && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                ✓ Can assist field work
              </span>
            )}
          </div>

          {/* Skills */}
          {staff.skills && staff.skills.length > 0 && (
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Skills</div>
              <div className="flex flex-wrap gap-1">
                {staff.skills.map(skill => (
                  <span
                    key={skill}
                    className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

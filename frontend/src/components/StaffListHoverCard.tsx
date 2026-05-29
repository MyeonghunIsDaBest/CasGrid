/**
 * StaffListHoverCard — compact hover popover that lists multiple staff
 * (used for the "+N" overflow pill on job bars). One row per staff with
 * the same colored-initial-chip pattern as elsewhere, so the +N badge
 * stops being a black box.
 *
 * Mirrors StaffHoverCard's open/position/close behaviour — they could
 * share a generic HoverPopover wrapper later if a third popover appears.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Staff } from '../types';

interface Props {
  staffList: Staff[];
  /** Optional heading shown above the list. */
  heading?: string;
  children: React.ReactNode;
  openDelay?: number;
}

function staffInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export function StaffListHoverCard({ staffList, heading, children, openDelay = 120 }: Props) {
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; flipUp: boolean }>({ top: 0, left: 0, flipUp: false });

  function compute() {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const POP_W = 240;
    const rowH = 36;
    const headerH = heading ? 28 : 8;
    const POP_H_GUESS = Math.min(360, headerH + staffList.length * rowH + 16);
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

  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    top: pos.flipUp ? undefined : pos.top,
    bottom: pos.flipUp ? window.innerHeight - pos.top : undefined,
    left: pos.left,
    width: 240,
    maxHeight: 360,
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
          className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-xs animate-in fade-in slide-in-from-top-1 duration-100"
          role="tooltip"
        >
          {heading && (
            <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {heading}
            </div>
          )}
          <ul className="max-h-[320px] overflow-y-auto py-1">
            {staffList.map(s => (
              <li
                key={s.id}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50"
              >
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-bold text-white flex-shrink-0 ring-1 ring-white shadow-sm"
                  style={{ backgroundColor: s.colour }}
                >
                  {staffInitials(s.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-800 truncate text-[11px]">{s.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {s.role}
                    {s.isApprentice ? ' · 🎓' : ''}
                    {!s.isBillable ? ' · non-billable' : ''}
                  </div>
                </div>
                <div className="text-[9px] text-slate-400 tabular-nums flex-shrink-0">
                  {s.dailyAvailableHours}h/d
                </div>
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </>
  );
}

// @ts-nocheck
//
// StaffCapacity.tsx — "Drafting table" capacity strip
// ---------------------------------------------------
// A companion to the redesigned Timeline. Shows each staff member's daily
// allocated hours across the same date grid, with a utilization-colored pill
// per day (under / near / over an 8-hour day), a per-person used/total meter,
// and a "Live" header.
//
// Geometry is identical to Timeline.tsx (RAIL width, day width per density,
// Monday week start, Sunday weekend tint, cobalt today line), so the two
// components line up column-for-column when stacked. When placing this directly
// under the Timeline, pass showHeader={false} to drop the duplicate week/day
// header and butt it flush against the timeline grid.
//
// • Runs standalone with sample data.
// • Production: pass `staff`, `entries` (daily allocations) and optional
//   `events` (leave / trade school), plus the same range/density you give the
//   Timeline so the columns stay in sync.
//
import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  addDays, format, differenceInCalendarDays, startOfDay, startOfWeek,
} from 'date-fns';
import { CalendarDays } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Tokens + scoped styles (injected once) — shares the Timeline's visual identity
// ─────────────────────────────────────────────────────────────────────────────
const STYLE_ID = 'cgc-staffcap-styles';
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.cgc-root{
  --paper:#FBFAF6; --surface:#FFFFFF; --ink:#181712; --ink2:#6A675C; --ink3:#A8A498;
  --line:#ECE9DF; --line2:#DBD7C9; --weekend:#F4F1E8; --accent:#2E45D6; --danger:#C2452F;
  --live:#3F8A5C; --low-bg:#E6F0E7; --low-ink:#2F6B45; --mid-bg:#F6EAD2; --mid-ink:#94661A;
  --rs:8px; --ease:cubic-bezier(.2,.8,.2,1);
  --cell-h:18px; --pill-fs:9.5px; --pill-pad:0 6px; --ring:7px;
  font-family:'Hanken Grotesk',ui-sans-serif,system-ui,sans-serif;
  color:var(--ink); background:var(--paper);
  border:1px solid var(--line2); border-radius:18px; overflow:hidden; -webkit-font-smoothing:antialiased;
}
.cgc-root.compact{ --cell-h:15px; --pill-fs:8.5px; --pill-pad:0 3px; --ring:6px; }
.cgc-root *{ box-sizing:border-box; }
.cgc-mono{ font-family:'IBM Plex Mono',ui-monospace,monospace; font-variant-numeric:tabular-nums; letter-spacing:-.01em; }

.cgc-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:18px;
  padding:16px 22px 14px; border-bottom:1px solid var(--line); animation:cgc-rise .5s var(--ease) both; }
.cgc-titlerow{ display:flex; align-items:center; gap:10px; }
.cgc-title{ font-size:16px; font-weight:600; letter-spacing:-.01em; }
.cgc-live{ display:inline-flex; align-items:center; gap:6px; padding:3px 9px 3px 8px; border-radius:99px;
  background:color-mix(in srgb, var(--live) 12%, #FBFAF6); color:var(--live); font-size:11px; font-weight:600; }
.cgc-livedot{ width:7px; height:7px; border-radius:50%; background:var(--live); box-shadow:0 0 0 0 var(--live); animation:cgc-ping 2s var(--ease) infinite; }
.cgc-livetime{ color:color-mix(in srgb, var(--live) 70%, #6A675C); font-size:10.5px; font-weight:500; }
.cgc-sub{ display:flex; align-items:center; gap:13px; margin-top:7px; }
.cgc-leg{ display:inline-flex; align-items:center; gap:5px; font-size:10.5px; color:var(--ink3); }
.cgc-legdot{ width:8px; height:8px; border-radius:3px; display:inline-block; }
.cgc-legdot.low{ background:var(--low-bg); box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--low-ink) 30%, transparent); }
.cgc-legdot.mid{ background:var(--mid-bg); box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--mid-ink) 30%, transparent); }
.cgc-legdot.high{ background:var(--danger); }

.cgc-controls{ display:flex; align-items:center; gap:10px; }
.cgc-seg{ display:inline-flex; background:#F1EEE4; border:1px solid var(--line2); border-radius:10px; padding:2px; gap:2px; }
.cgc-seg button{ font-family:inherit; font-size:12px; font-weight:500; padding:6px 10px; border-radius:8px;
  color:var(--ink2); background:transparent; border:none; cursor:pointer; transition:background .18s var(--ease),color .18s var(--ease); }
.cgc-seg button:hover{ color:var(--ink); }
.cgc-seg button[aria-pressed="true"]{ background:var(--surface); color:var(--ink); box-shadow:0 1px 2px rgba(20,18,12,.07); }
.cgc-btn{ display:inline-flex; align-items:center; gap:7px; font-family:inherit; font-size:12px; font-weight:500;
  color:var(--ink); background:var(--surface); border:1px solid var(--line2); border-radius:10px; padding:7px 12px; cursor:pointer;
  transition:border-color .18s var(--ease),background .18s var(--ease); }
.cgc-btn:hover{ border-color:#C9C4B4; background:#FCFBF7; }
.cgc-btn:active{ transform:translateY(.5px); }

.cgc-scroll{ overflow-x:auto; overflow-y:hidden; scrollbar-width:thin; scroll-behavior:smooth; }
.cgc-scroll::-webkit-scrollbar{ height:10px; }
.cgc-scroll::-webkit-scrollbar-thumb{ background:#E2DECF; border-radius:99px; border:3px solid var(--paper); }

.cgc-railhead{ position:sticky; left:0; z-index:7; flex:0 0 auto; background:var(--paper); border-right:1px solid var(--line); }
.cgc-weekrow,.cgc-dayrow{ display:flex; }
.cgc-weekrow{ border-bottom:1px solid var(--line); }
.cgc-week{ flex:0 0 auto; padding:8px 10px; font-size:10.5px; font-weight:600; color:var(--ink2);
  border-left:1px solid var(--line2); text-transform:uppercase; letter-spacing:.04em; }
.cgc-week:first-child{ border-left:none; }
.cgc-dayrow{ border-bottom:1px solid var(--line2); }
.cgc-day{ flex:0 0 auto; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:6px 0; gap:2px; }
.cgc-day .dl{ font-size:9px; font-weight:600; letter-spacing:.04em; color:var(--ink3); }
.cgc-day .dn{ font-size:11px; font-weight:500; color:var(--ink2); }
.cgc-day.wknd .dl,.cgc-day.wknd .dn{ color:#C7C3B5; }
.cgc-day.today .dl{ color:var(--accent); }
.cgc-day.today .dn{ color:#fff; background:var(--accent); width:20px; height:20px; line-height:20px; border-radius:7px; text-align:center; }

.cgc-body{ position:relative; }
.cgc-bg{ position:absolute; top:0; bottom:0; z-index:0; pointer-events:none; }
.cgc-vline{ position:absolute; top:0; bottom:0; width:1px; background:var(--line); }
.cgc-vline.wk{ background:var(--line2); }
.cgc-wkndcol{ position:absolute; top:0; bottom:0; background:var(--weekend); }
.cgc-today{ position:absolute; top:0; bottom:0; width:0; border-left:1.5px solid var(--accent); z-index:1; }
.cgc-today::before{ content:''; position:absolute; top:0; left:-3.5px; width:7px; height:7px; border-radius:2px; background:var(--accent); }

.cgc-row{ display:flex; position:relative; z-index:1; animation:cgc-fade .5s var(--ease) both; }
.cgc-row:hover .cgc-track{ background:rgba(46,69,214,.018); }
.cgc-rail{ position:sticky; left:0; z-index:5; flex:0 0 auto; display:flex; align-items:center; gap:11px;
  padding:0 14px; background:var(--paper); border-right:1px solid var(--line); border-bottom:1px solid var(--line); }
.cgc-dot{ width:9px; height:9px; border-radius:50%; flex:0 0 auto; box-shadow:0 0 0 3px rgba(0,0,0,.025); }
.cgc-rc-main{ min-width:0; flex:1; }
.cgc-rc-name{ font-size:13px; font-weight:600; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cgc-rc-foot{ display:flex; align-items:center; gap:8px; margin-top:4px; }
.cgc-rc-meter{ flex:1; max-width:96px; height:3px; border-radius:99px; background:#EAE7DD; overflow:hidden; }
.cgc-rc-fill{ height:100%; border-radius:99px; transition:width .3s var(--ease); }
.cgc-rc-hrs{ font-size:10px; color:var(--ink2); white-space:nowrap; }
.cgc-rc-hrs.over{ color:var(--danger); font-weight:600; }

.cgc-track{ flex:0 0 auto; display:flex; position:relative; z-index:1; border-bottom:1px solid var(--line); transition:background .16s var(--ease); }
.cgc-cell{ flex:0 0 auto; display:flex; align-items:center; justify-content:center; }
.cgc-pill{ display:inline-flex; align-items:center; justify-content:center; height:var(--cell-h); padding:var(--pill-pad);
  border-radius:6px; font-family:'IBM Plex Mono',monospace; font-variant-numeric:tabular-nums; font-size:var(--pill-fs); font-weight:600; line-height:1; }
.cgc-pill.u-low{ background:var(--low-bg); color:var(--low-ink); }
.cgc-pill.u-mid{ background:var(--mid-bg); color:var(--mid-ink); }
.cgc-pill.u-high{ background:var(--danger); color:#fff; }
.cgc-ring{ width:var(--ring); height:var(--ring); border-radius:50%; border:1.25px solid #E2DECE; }
.cgc-tag{ display:inline-flex; align-items:center; justify-content:center; height:var(--cell-h); padding:0 4px; border-radius:6px;
  font-family:'IBM Plex Mono',monospace; font-size:8px; font-weight:700; letter-spacing:.02em; }
.cgc-tag.ts{ background:color-mix(in srgb, var(--accent) 12%, #FBFAF6); color:var(--accent); }
.cgc-tag.lv{ background:#EFEDE4; color:var(--ink3); }

.cgc-empty{ padding:56px 24px; text-align:center; color:var(--ink3); font-size:13px; }

/* ── Enhancements: today-column wash, interactive pills, team-total row ── */
.cgc-todaycol{ position:absolute; top:0; bottom:0; background:color-mix(in srgb, var(--accent) 6%, transparent); }
.cgc-pill{ transition:transform .14s var(--ease), box-shadow .14s var(--ease); }
.cgc-pill:hover{ transform:translateY(-1px); box-shadow:0 3px 9px rgba(20,18,12,.15); }
.cgc-teamrow .cgc-rail{ background:#F2EFE6; border-top:2px solid var(--line2); }
.cgc-teamrow .cgc-track{ background:#FBFAF4; border-top:2px solid var(--line2); }
.cgc-teamrow .cgc-rc-name{ font-weight:700; }
.cgc-teamrow .cgc-pill{ font-weight:700; }

@keyframes cgc-rise{ from{opacity:0; transform:translateY(7px)} to{opacity:1; transform:translateY(0)} }
@keyframes cgc-fade{ from{opacity:0} to{opacity:1} }
@keyframes cgc-ping{ 0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--live) 55%, transparent)} 70%,100%{box-shadow:0 0 0 5px transparent} }
@media (prefers-reduced-motion: reduce){ .cgc-root *{ animation:none !important; } }
`;

function useInjectStyles() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID; el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (portable — no external utils)
// ─────────────────────────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0');
const toDateString = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtH = h => (Number.isInteger(h) ? String(h) : String(Math.round(h * 10) / 10));

// ─────────────────────────────────────────────────────────────────────────────
// Sample data (used only when no props are supplied)
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLE_STAFF = [
  { id: 's1', name: 'Andrew Johnson',  colour: '#3C5C99' },
  { id: 's2', name: 'Isaac',           colour: '#A9781C' },
  { id: 's3', name: 'Jordan D Tester', colour: '#6A675C', dailyCapacity: 16 },
  { id: 's4', name: 'Lochlan',         colour: '#AD4A66' },
  { id: 's5', name: 'Rory',            colour: '#6E7B8A' },
  { id: 's6', name: 'Ruby',            colour: '#2F7A4F' },
  { id: 's7', name: 'Sarah',           colour: '#BD5638' },
  { id: 's8', name: 'Thomas',          colour: '#7B4A86' },
];

function makeSampleEntries(today) {
  const out = [];
  const add = (staffId, off, hours) => out.push({ staffId, date: toDateString(addDays(today, off)), hours });
  const block = (staffId, off, hours, n) => { let placed = 0, o = off; while (placed < n) { if (addDays(today, o).getDay() !== 0) { add(staffId, o, hours); placed++; } o++; } };
  // Andrew — full days early + a long multi-week job on the right
  add('s1', -2, 8); add('s1', -1, 5.3); block('s1', 21, 5.3, 4); block('s1', 27, 5, 2); block('s1', 33, 4.8, 4); add('s1', 39, 4.5); add('s1', 40, 4.5);
  // Isaac — a couple of full days, then light
  add('s2', 3, 8); add('s2', 4, 8); add('s2', 6, 2.5); add('s2', 20, 0.3);
  // Jordan — scattered small allocations (low utilization against a 16h cap)
  add('s3', 1, 0.5); add('s3', 4, 0.8); add('s3', 5, 1.8); add('s3', 6, 1.3); add('s3', 7, 1); add('s3', 8, 0.8);
  // Lochlan — shares the long job with Andrew + a few odds
  add('s4', 4, 4); add('s4', 6, 2.8); add('s4', 12, 0.3); add('s4', 20, 0.3); block('s4', 21, 5.3, 4); block('s4', 27, 5, 2); block('s4', 33, 4.8, 4);
  // Rory / Ruby — one full day each
  add('s5', 1, 8);
  add('s6', -3, 8);
  // Sarah — busy stretch incl. a near-full day
  add('s7', -1, 8); add('s7', 3, 8); add('s7', 4, 7.3); add('s7', 20, 8);
  // Thomas — several full days
  add('s8', 3, 8); add('s8', 4, 8); add('s8', 6, 8); add('s8', 20, 8);
  return out;
}

function makeSampleEvents(today) {
  const out = [];
  const ev = (staffId, off, type) => out.push({ staffId, date: toDateString(addDays(today, off)), type });
  ev('s5', 24, 'leave'); ev('s5', 25, 'leave');
  ev('s6', 24, 'leave'); ev('s6', 25, 'leave');
  ev('s7', 24, 'leave'); ev('s7', 25, 'leave'); ev('s7', 26, 'leave'); ev('s7', 27, 'leave');
  return out;
}

const RANGES = [{ w: 4, label: '4w' }, { w: 7, label: '7w' }, { w: 10, label: '10w' }];
const DENSITY = { roomy: { dayW: 30, rowH: 46 }, compact: { dayW: 22, rowH: 36 } };
const RAIL = 252;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function StaffCapacity({
  staff = SAMPLE_STAFF,
  entries,
  events,
  dailyCapacityHours = 8,
  initialRangeWeeks = 7,
  initialDensity = 'roomy',
  showHeader = true,
  lastUpdatedLabel = 'just now',
} = {}) {
  useInjectStyles();

  const today = useMemo(() => startOfDay(new Date()), []);
  const start = useMemo(() => startOfWeek(addDays(today, -7), { weekStartsOn: 1 }), [today]);

  const [rangeWeeks, setRangeWeeks] = useState(initialRangeWeeks);
  const [density, setDensity] = useState(initialDensity);
  const { dayW, rowH } = DENSITY[density];

  const DAYS = rangeWeeks * 7;
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(start, i)), [start, DAYS]);
  const gridW = DAYS * dayW;
  const contentW = RAIL + gridW;
  const todayIdx = differenceInCalendarDays(today, start);

  const sampleEntries = useMemo(() => makeSampleEntries(today), [today]);
  const sampleEvents = useMemo(() => makeSampleEvents(today), [today]);
  // Default to ZERO data until real allocations are wired in. Pass `entries`
  // (daily {staffId,date,hours}) and `events` ({staffId,date,type}) props to
  // populate it from AppContext. The sample generators above are kept only as a
  // reference/demo and are no longer used as the fallback.
  const E = entries ?? [];
  const V = events ?? [];

  const allocMap = useMemo(() => {
    const m = new Map();
    for (const e of E) {
      let s = m.get(e.staffId); if (!s) { s = new Map(); m.set(e.staffId, s); }
      s.set(e.date, (s.get(e.date) || 0) + e.hours);
    }
    return m;
  }, [E]);

  const eventMap = useMemo(() => {
    const m = new Map();
    for (const ev of V) {
      let s = m.get(ev.staffId); if (!s) { s = new Map(); m.set(ev.staffId, s); }
      s.set(ev.date, ev.type);
    }
    return m;
  }, [V]);

  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    el.scrollLeft = Math.max(0, RAIL + todayIdx * dayW - (el.clientWidth - RAIL) / 2);
  }, [todayIdx, dayW, rangeWeeks]); // eslint-disable-line

  function jumpToToday() {
    const el = scrollRef.current; if (!el) return;
    el.scrollTo({ left: Math.max(0, RAIL + todayIdx * dayW - (el.clientWidth - RAIL) / 2), behavior: 'smooth' });
  }

  const dayCapOf = useCallback(s => s.dailyCapacity ?? dailyCapacityHours, [dailyCapacityHours]);

  // Totals per staff over the visible range.
  const totals = useMemo(() => {
    const out = {};
    for (const s of staff) {
      const cap = dayCapOf(s);
      const alloc = allocMap.get(s.id);
      const evs = eventMap.get(s.id);
      let used = 0, avail = 0;
      for (const d of days) {
        const ds = toDateString(d);
        avail += evs && evs.get(ds) ? 0 : cap;
        used += alloc ? (alloc.get(ds) || 0) : 0;
      }
      out[s.id] = { used, avail, util: avail > 0 ? used / avail : 0 };
    }
    return out;
  }, [staff, days, allocMap, eventMap, dayCapOf]);

  // Per-day team totals (allocated vs capacity across all staff) → summary row.
  const dayTotals = useMemo(() => days.map(d => {
    const ds = toDateString(d);
    let used = 0, cap = 0;
    for (const s of staff) {
      const evs = eventMap.get(s.id);
      cap += evs && evs.get(ds) ? 0 : dayCapOf(s);
      const alloc = allocMap.get(s.id);
      used += alloc ? (alloc.get(ds) || 0) : 0;
    }
    return { used, cap, ratio: cap > 0 ? used / cap : 0 };
  }), [days, staff, allocMap, eventMap, dayCapOf]);
  const teamTotal = useMemo(() => {
    let used = 0, avail = 0;
    for (const t of dayTotals) { used += t.used; avail += t.cap; }
    return { used, avail, util: avail > 0 ? used / avail : 0 };
  }, [dayTotals]);

  // Background grid pieces.
  const bg = useMemo(() => {
    const lines = [], wknd = [];
    for (let i = 0; i < DAYS; i++) {
      if (i > 0) lines.push({ x: i * dayW, wk: i % 7 === 0 });
      if (i % 7 === 6) wknd.push({ x: i * dayW }); // Sunday
    }
    return { lines, wknd };
  }, [DAYS, dayW]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={`cgc-root${density === 'compact' ? ' compact' : ''}`}>
      {/* Header */}
      <div className="cgc-head">
        <div>
          <div className="cgc-titlerow">
            <span className="cgc-title">Staff capacity</span>
            <span className="cgc-live"><span className="cgc-livedot" aria-hidden /> Live <span className="cgc-livetime cgc-mono">· {lastUpdatedLabel}</span></span>
          </div>
          <div className="cgc-sub">
            <span className="cgc-leg"><i className="cgc-legdot low" /> under</span>
            <span className="cgc-leg"><i className="cgc-legdot mid" /> near</span>
            <span className="cgc-leg"><i className="cgc-legdot high" /> over capacity</span>
          </div>
        </div>
        <div className="cgc-controls">
          <div className="cgc-seg" role="group" aria-label="Visible range">
            {RANGES.map(r => <button key={r.w} aria-pressed={rangeWeeks === r.w} onClick={() => setRangeWeeks(r.w)}>{r.label}</button>)}
          </div>
          <div className="cgc-seg" role="group" aria-label="Row density">
            <button aria-pressed={density === 'roomy'} onClick={() => setDensity('roomy')}>Roomy</button>
            <button aria-pressed={density === 'compact'} onClick={() => setDensity('compact')}>Compact</button>
          </div>
          <button className="cgc-btn" onClick={jumpToToday}><CalendarDays size={14} /> Today</button>
        </div>
      </div>

      {/* Scrollable grid */}
      <div className="cgc-scroll" ref={scrollRef}>
        <div style={{ width: contentW }}>

          {showHeader && (
            <>
              <div className="cgc-weekrow">
                <div className="cgc-railhead" style={{ width: RAIL }} />
                {Array.from({ length: rangeWeeks }, (_, w) => (
                  <div key={w} className="cgc-week cgc-mono" style={{ width: dayW * 7 }}>{format(addDays(start, w * 7), 'MMM d')}</div>
                ))}
              </div>
              <div className="cgc-dayrow">
                <div className="cgc-railhead" style={{ width: RAIL }} />
                {days.map((day, i) => {
                  const wknd = day.getDay() === 0, isT = i === todayIdx;
                  return (
                    <div key={i} className={`cgc-day${wknd ? ' wknd' : ''}${isT ? ' today' : ''}`} style={{ width: dayW }}>
                      <span className="dl">{format(day, 'EEEEE')}</span>
                      <span className="dn cgc-mono">{format(day, 'd')}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Body */}
          <div className="cgc-body">
            <div className="cgc-bg" style={{ left: RAIL, width: gridW }}>
              {bg.wknd.map((c, i) => <div key={`w${i}`} className="cgc-wkndcol" style={{ left: c.x, width: dayW }} />)}
              {todayIdx >= 0 && todayIdx < DAYS && (
                <div className="cgc-todaycol" style={{ left: todayIdx * dayW, width: dayW }} />
              )}
              {bg.lines.map((l, i) => <div key={`l${i}`} className={`cgc-vline${l.wk ? ' wk' : ''}`} style={{ left: l.x }} />)}
              {todayIdx >= 0 && todayIdx < DAYS && <div className="cgc-today" style={{ left: todayIdx * dayW }} />}
            </div>

            {staff.length === 0 && <div className="cgc-empty">No staff to show.</div>}

            {staff.map((s, rowIdx) => {
              const cap = dayCapOf(s);
              const alloc = allocMap.get(s.id);
              const evs = eventMap.get(s.id);
              const t = totals[s.id];
              const fill = t.util >= 1 ? 'var(--danger)' : t.util >= 0.85 ? '#B07A1E' : '#3F8A5C';

              return (
                <div key={s.id} className="cgc-row" style={{ height: rowH, animationDelay: `${Math.min(rowIdx, 16) * 26}ms` }}>
                  {/* Rail card */}
                  <div className="cgc-rail" style={{ width: RAIL }}>
                    <span className="cgc-dot" style={{ backgroundColor: s.colour }} />
                    <span className="cgc-rc-main">
                      <span className="cgc-rc-name">{s.name}</span>
                      <span className="cgc-rc-foot">
                        <span className="cgc-rc-meter"><span className="cgc-rc-fill" style={{ width: `${Math.min(100, t.util * 100)}%`, backgroundColor: fill }} /></span>
                        <span className={`cgc-rc-hrs cgc-mono${t.util > 1 ? ' over' : ''}`}>{Math.round(t.used)}/{Math.round(t.avail)}h</span>
                      </span>
                    </span>
                  </div>

                  {/* Allocation track */}
                  <div className="cgc-track" style={{ width: gridW }}>
                    {days.map((day, i) => {
                      const ds = toDateString(day);
                      const h = alloc ? (alloc.get(ds) || 0) : 0;
                      const type = evs ? evs.get(ds) : undefined;
                      const sun = day.getDay() === 0;
                      let inner = null;
                      if (h > 0) {
                        const u = h / cap;
                        const cls = u >= 1 ? 'u-high' : u >= 0.75 ? 'u-mid' : 'u-low';
                        inner = <span className={`cgc-pill ${cls}`} title={`${fmtH(h)}h of ${cap}h`}>{fmtH(h)}</span>;
                      } else if (type) {
                        inner = <span className={`cgc-tag ${type === 'tradeSchool' ? 'ts' : 'lv'}`} title={type === 'tradeSchool' ? 'Trade school' : 'Leave'}>{type === 'tradeSchool' ? 'TS' : 'Lv'}</span>;
                      } else if (!sun) {
                        inner = <span className="cgc-ring" aria-hidden />;
                      }
                      return <div key={i} className="cgc-cell" style={{ width: dayW }}>{inner}</div>;
                    })}
                  </div>
                </div>
              );
            })}

            {/* Team-load summary: total allocated vs capacity per day */}
            {staff.length > 0 && (
              <div className="cgc-row cgc-teamrow" style={{ height: rowH }}>
                <div className="cgc-rail" style={{ width: RAIL }}>
                  <span className="cgc-dot" style={{ backgroundColor: 'var(--ink)' }} />
                  <span className="cgc-rc-main">
                    <span className="cgc-rc-name">Team load</span>
                    <span className="cgc-rc-foot">
                      <span className="cgc-rc-meter">
                        <span className="cgc-rc-fill" style={{
                          width: `${Math.min(100, teamTotal.util * 100)}%`,
                          backgroundColor: teamTotal.util >= 1 ? 'var(--danger)' : teamTotal.util >= 0.85 ? '#B07A1E' : '#3F8A5C',
                        }} />
                      </span>
                      <span className={`cgc-rc-hrs cgc-mono${teamTotal.util > 1 ? ' over' : ''}`}>
                        {Math.round(teamTotal.used)}/{Math.round(teamTotal.avail)}h
                      </span>
                    </span>
                  </span>
                </div>
                <div className="cgc-track" style={{ width: gridW }}>
                  {dayTotals.map((t, i) => {
                    const cls = t.ratio >= 1 ? 'u-high' : t.ratio >= 0.75 ? 'u-mid' : 'u-low';
                    const val = fmtH(Math.round(t.used * 10) / 10);
                    return (
                      <div key={i} className="cgc-cell" style={{ width: dayW }}>
                        {t.used > 0.01
                          ? <span className={`cgc-pill ${cls}`} title={`Team ${val}h of ${fmtH(t.cap)}h`}>{val}</span>
                          : <span className="cgc-ring" aria-hidden />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StaffCapacity;
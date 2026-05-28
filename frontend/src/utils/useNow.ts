/**
 * useNow — tick-every-Ns hook for live-updating timestamps.
 *
 * Same shape as `useRunningTimeNow` in `runningTime.ts` but generic: anything
 * that needs to show "Updated Ns ago" can subscribe. Idle when the document
 * is hidden so background tabs don't burn cycles.
 */
import { useEffect, useState } from 'react';

export function useNow(intervalMs: number = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer) return;
      timer = setInterval(() => setNow(Date.now()), intervalMs);
    }
    function stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }

    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      start();
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        setNow(Date.now());
        start();
      } else {
        stop();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs]);

  return now;
}

/**
 * Returns a CSS class string that pulses (briefly applies `pulseClass`) every
 * time `value` increments. Use for a "data just landed" visual cue.
 */
export function usePulseOnChange(
  value: number | null | undefined,
  pulseClass: string = 'ring-2 ring-emerald-300/60',
  durationMs: number = 600,
): string {
  const [active, setActive] = useState(false);
  const [last, setLast] = useState<number | null | undefined>(value);

  useEffect(() => {
    if (value == null) return;
    if (last != null && value > last) {
      setActive(true);
      const t = setTimeout(() => setActive(false), durationMs);
      setLast(value);
      return () => clearTimeout(t);
    }
    setLast(value);
  }, [value, last, durationMs]);

  return active ? pulseClass : '';
}

/** Format a millisecond delta as "just now", "12s ago", "3m ago", "1h ago", "2d ago". */
export function formatAgo(deltaMs: number): string {
  if (deltaMs < 0) deltaMs = 0;
  const sec = Math.floor(deltaMs / 1000);
  if (sec < 5)   return 'just now';
  if (sec < 60)  return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60)  return `${min}m ago`;
  const hr  = Math.floor(min / 60);
  if (hr  < 24)  return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

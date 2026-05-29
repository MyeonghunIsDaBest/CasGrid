/**
 * CapacityTargetsControl
 *
 * A compact popover housing a dual-thumb slider for the team's weekly capacity
 * goals — baseline (expected load) and stretch (target). It sits in the
 * Timeline's capacity header so the values can be dialled in right where their
 * effect is shown: because WeeklyCapacityHeader reads the same
 * settings.capacityTargets, every week's bar re-renders live as you drag.
 *
 * Thumb movement is instant (local state); the persisted write is debounced so
 * dragging doesn't spam Supabase, with a final exact write on release.
 */
import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Slider } from '../ui/slider';

interface CapacityTargetsControlProps {
  baseline: number;
  stretch: number;
  /** Theoretical max weekly team-hours — scales the slider track. */
  maxHours: number;
}

export function CapacityTargetsControl({ baseline, stretch, maxHours }: CapacityTargetsControlProps) {
  const { updateSettings } = useApp();

  // Local thumb state for instant feedback; commit (persist) is debounced.
  const [vals, setVals] = useState<[number, number]>([baseline, stretch]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Re-sync to external changes (e.g. the Settings tab) without an effect, using
  // React's "adjust state during render" pattern. It also avoids snapping the
  // thumb mid-drag, since the props only change after our own debounced commit.
  const [syncedFrom, setSyncedFrom] = useState<[number, number]>([baseline, stretch]);
  if (syncedFrom[0] !== baseline || syncedFrom[1] !== stretch) {
    setSyncedFrom([baseline, stretch]);
    setVals([baseline, stretch]);
  }

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // Round the scale up to a tidy number and never clip the current stretch.
  const max = Math.max(Math.ceil(maxHours / 50) * 50, stretch, 100);

  function commit(next: [number, number]) {
    updateSettings({ capacityTargets: { weeklyBaseline: next[0], weeklyStretch: next[1] } });
  }

  function handleChange(next: number[]) {
    const pair: [number, number] = [next[0], next[1] ?? next[0]];
    setVals(pair);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commit(pair), 200);
  }

  function handleCommit(next: number[]) {
    clearTimeout(debounceRef.current);
    const pair: [number, number] = [next[0], next[1] ?? next[0]];
    setVals(pair);
    commit(pair);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Adjust weekly capacity targets"
          className="p-1 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
        >
          <SlidersHorizontal size={12} />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={6} className="w-72 p-4">
        <div className="space-y-3.5">
          <div>
            <h4 className="text-[12px] font-semibold text-slate-800">Weekly capacity targets</h4>
            <p className="text-[10.5px] text-slate-400 leading-snug mt-0.5">
              Drag to set the team's expected load and the target you're pushing toward.
            </p>
          </div>

          {/* Live readouts — slate baseline / amber stretch, mirroring the bar */}
          <div className="flex items-stretch gap-2">
            <div className="flex-1 rounded-lg bg-slate-50 ring-1 ring-slate-200/70 px-2.5 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Baseline</span>
              </div>
              <div className="text-[15px] font-semibold text-slate-700 tabular-nums leading-tight mt-0.5">
                {vals[0]}<span className="text-[10px] font-medium text-slate-400 ml-0.5">h/wk</span>
              </div>
            </div>
            <div className="flex-1 rounded-lg bg-amber-50 ring-1 ring-amber-200/60 px-2.5 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-600/80">Stretch</span>
              </div>
              <div className="text-[15px] font-semibold text-amber-700 tabular-nums leading-tight mt-0.5">
                {vals[1]}<span className="text-[10px] font-medium text-amber-600/60 ml-0.5">h/wk</span>
              </div>
            </div>
          </div>

          <div className="pt-1">
            <Slider
              value={vals}
              min={0}
              max={max}
              step={5}
              minStepsBetweenThumbs={1}
              onValueChange={handleChange}
              onValueCommit={handleCommit}
              aria-label="Weekly capacity baseline and stretch targets"
            />
            <div className="flex justify-between text-[9px] text-slate-300 font-medium tabular-nums mt-1.5">
              <span>0h</span>
              <span>{max}h</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

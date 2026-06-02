// @ts-nocheck
/**
 * CapacityHeaderBar
 *
 * Single-week Available-vs-Allocated readout used inside WeeklyCapacityHeader.
 * Concrete numbers, no abstract baseline/stretch targets — Available is the
 * natural reference, Allocated past Available reads as overtime in amber.
 */

export function CapacityHeaderBar({
  allocated,
  available,
}: {
  allocated: number;
  available: number;
}) {
  const overtime = Math.max(0, allocated - available);
  const peak = Math.max(available, allocated, 1);
  const baseW  = Math.min(allocated, available) / peak * 100;
  const overW  = overtime / peak * 100;
  const availPos = (available / peak) * 100;

  return (
    <div>
      {/* Numeric readout */}
      <div className="flex items-baseline justify-between gap-2 text-[10px] mb-1 tabular-nums">
        <span className="font-semibold text-slate-700">
          {allocated.toFixed(0)}h
          <span className="text-slate-400 font-normal"> / {available.toFixed(0)}h</span>
        </span>
        {overtime > 0 ? (
          <span className="text-[9px] font-semibold text-amber-600">+{overtime.toFixed(0)}h overtime</span>
        ) : (
          <span className="text-[9px] text-slate-400">{(available - allocated).toFixed(0)}h headroom</span>
        )}
      </div>

      {/* Bar — slate up to available, amber overflow past available */}
      <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 bottom-0 bg-slate-600"
          style={{ width: `${baseW}%` }}
        />
        {overW > 0 && (
          <div
            className="absolute top-0 bottom-0 bg-amber-500"
            style={{ left: `${availPos}%`, width: `${overW}%` }}
          />
        )}
        {/* Available tick */}
        <div
          className="absolute top-[-2px] bottom-[-2px] w-px bg-slate-400/70 pointer-events-none"
          style={{ left: `${availPos}%` }}
        />
      </div>
    </div>
  );
}

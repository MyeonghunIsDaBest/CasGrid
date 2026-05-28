import { motion } from 'framer-motion';
import { Clock, TrendingUp, AlertTriangle, Zap, CalendarX, CheckCircle } from 'lucide-react';

interface KPICardsProps {
  totalAvailable: number;
  allocated: number;
  remaining: number;
  utilisationPct: number;
  jobsAtRisk: number;
  overbookedDays: number;
}

type Tone = 'slate' | 'amber' | 'emerald' | 'orange' | 'red';

interface KPICard {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  tone: Tone;
}

const TONE: Record<Tone, { chipBg: string; chipText: string; valueText: string; subText: string }> = {
  slate:   { chipBg: 'bg-slate-100',   chipText: 'text-slate-600',   valueText: 'text-slate-900',   subText: 'text-slate-500' },
  amber:   { chipBg: 'bg-amber-100',   chipText: 'text-amber-700',   valueText: 'text-slate-900',   subText: 'text-amber-600' },
  emerald: { chipBg: 'bg-emerald-100', chipText: 'text-emerald-700', valueText: 'text-slate-900',   subText: 'text-emerald-600' },
  orange:  { chipBg: 'bg-orange-100',  chipText: 'text-orange-700',  valueText: 'text-slate-900',   subText: 'text-orange-600' },
  red:     { chipBg: 'bg-red-100',     chipText: 'text-red-700',     valueText: 'text-slate-900',   subText: 'text-red-600' },
};

export function KPICards({
  totalAvailable, allocated, remaining, utilisationPct, jobsAtRisk, overbookedDays
}: KPICardsProps) {
  const utilTone: Tone =
    utilisationPct < 75 ? 'emerald' :
    utilisationPct < 95 ? 'amber' : 'red';

  const cards: KPICard[] = [
    {
      label: 'Available',
      value: `${totalAvailable}h`,
      sub: 'Total capacity',
      icon: <Clock size={14} />,
      tone: 'slate',
    },
    {
      label: 'Allocated',
      value: `${Math.round(allocated)}h`,
      sub: `${remaining >= 0 ? remaining.toFixed(1) : 0}h remaining`,
      icon: <TrendingUp size={14} />,
      tone: 'amber',
    },
    {
      label: 'Utilisation',
      value: `${utilisationPct}%`,
      sub: utilisationPct < 75 ? 'Under capacity' : utilisationPct < 95 ? 'Healthy load' : 'Near limit',
      icon: <Zap size={14} />,
      tone: utilTone,
    },
    {
      label: 'Jobs At Risk',
      value: jobsAtRisk,
      sub: jobsAtRisk === 0 ? 'All on track' : 'Need attention',
      icon: <AlertTriangle size={14} />,
      tone: jobsAtRisk > 0 ? 'orange' : 'emerald',
    },
    {
      label: 'Overbooked',
      value: overbookedDays,
      sub: overbookedDays === 0 ? 'No overloads' : 'Adjust schedule',
      icon: <CalendarX size={14} />,
      tone: overbookedDays > 0 ? 'red' : 'emerald',
    },
    {
      label: 'On Track',
      value: `${Math.max(0, 100 - utilisationPct)}%`,
      sub: 'Buffer remaining',
      icon: <CheckCircle size={14} />,
      tone: 'emerald',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
      {cards.map((card, i) => {
        const t = TONE[card.tone];
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-start gap-2.5"
          >
            <div className={`flex-shrink-0 w-7 h-7 rounded-lg ${t.chipBg} ${t.chipText} flex items-center justify-center`}>
              {card.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 leading-tight">{card.label}</div>
              <div className={`text-lg font-bold leading-tight mt-0.5 ${t.valueText}`}>{card.value}</div>
              {card.sub && (
                <div className={`text-[10px] mt-0.5 truncate ${t.subText}`}>{card.sub}</div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

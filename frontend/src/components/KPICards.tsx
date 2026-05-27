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

interface KPICard {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  colour: string;
  textColour: string;
  borderColour: string;
}

export function KPICards({
  totalAvailable, allocated, remaining, utilisationPct, jobsAtRisk, overbookedDays
}: KPICardsProps) {
  const utilColour =
    utilisationPct < 75 ? 'emerald' :
    utilisationPct < 95 ? 'amber' : 'red';

  const cards: KPICard[] = [
    {
      label: 'Available This Week',
      value: `${totalAvailable}h`,
      sub: 'Total capacity',
      icon: <Clock size={20} />,
      colour: 'bg-slate-50',
      textColour: 'text-slate-700',
      borderColour: 'border-slate-200',
    },
    {
      label: 'Allocated This Week',
      value: `${Math.round(allocated)}h`,
      sub: `${remaining >= 0 ? remaining.toFixed(1) : 0}h remaining`,
      icon: <TrendingUp size={20} />,
      colour: 'bg-amber-50',
      textColour: 'text-amber-700',
      borderColour: 'border-amber-200',
    },
    {
      label: 'Utilisation',
      value: `${utilisationPct}%`,
      sub: utilisationPct < 75 ? 'Under capacity' : utilisationPct < 95 ? 'Healthy load' : 'Near limit',
      icon: <Zap size={20} />,
      colour: utilColour === 'emerald' ? 'bg-emerald-50' : utilColour === 'amber' ? 'bg-amber-50' : 'bg-red-50',
      textColour: utilColour === 'emerald' ? 'text-emerald-700' : utilColour === 'amber' ? 'text-amber-700' : 'text-red-700',
      borderColour: utilColour === 'emerald' ? 'border-emerald-200' : utilColour === 'amber' ? 'border-amber-200' : 'border-red-200',
    },
    {
      label: 'Jobs At Risk',
      value: jobsAtRisk,
      sub: jobsAtRisk === 0 ? 'All on track' : 'Need attention',
      icon: <AlertTriangle size={20} />,
      colour: jobsAtRisk > 0 ? 'bg-orange-50' : 'bg-emerald-50',
      textColour: jobsAtRisk > 0 ? 'text-orange-700' : 'text-emerald-700',
      borderColour: jobsAtRisk > 0 ? 'border-orange-200' : 'border-emerald-200',
    },
    {
      label: 'Overbooked Days',
      value: overbookedDays,
      sub: overbookedDays === 0 ? 'No overloads' : 'Adjust schedule',
      icon: <CalendarX size={20} />,
      colour: overbookedDays > 0 ? 'bg-red-50' : 'bg-emerald-50',
      textColour: overbookedDays > 0 ? 'text-red-700' : 'text-emerald-700',
      borderColour: overbookedDays > 0 ? 'border-red-200' : 'border-emerald-200',
    },
    {
      label: 'On Track',
      value: `${Math.max(0, 100 - utilisationPct)}%`,
      sub: 'Buffer remaining',
      icon: <CheckCircle size={20} />,
      colour: 'bg-slate-50',
      textColour: 'text-slate-700',
      borderColour: 'border-slate-200',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className={`rounded-xl border p-4 ${card.colour} ${card.borderColour}`}
        >
          <div className={`flex items-center gap-2 mb-2 ${card.textColour} opacity-70`}>
            {card.icon}
            <span className="text-xs font-medium uppercase tracking-wide">{card.label}</span>
          </div>
          <div className={`text-2xl font-bold ${card.textColour}`}>{card.value}</div>
          {card.sub && (
            <div className={`text-xs mt-1 ${card.textColour} opacity-60`}>{card.sub}</div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

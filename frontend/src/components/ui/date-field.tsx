/**
 * DateField — an Australian-format (DD/MM/YYYY) date picker.
 *
 * Native <input type="date"> renders in the browser's locale (US here) and
 * can't be forced to DD/MM/YYYY, so we use a Popover + react-day-picker calendar
 * instead. The value in/out stays ISO (yyyy-MM-dd) — only the display is AU.
 */
import { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from './popover';
import { Calendar } from './calendar';
import { toDateString, fromDateString, formatDateAU } from '../../utils/dateUtils';

interface DateFieldProps {
  /** ISO yyyy-MM-dd, or '' when unset. */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  error?: boolean;
  id?: string;
}

export function DateField({ value, onChange, placeholder = 'Select date…', error, id }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? fromDateString(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            'w-full flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm bg-white text-left transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400',
            error ? 'border-red-400' : 'border-slate-200 hover:border-slate-300',
            !value && 'text-slate-400',
          )}
        >
          <span className="tabular-nums">{selected ? formatDateAU(selected) : placeholder}</span>
          <CalendarIcon size={15} className="text-slate-400 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          weekStartsOn={1}
          selected={selected}
          defaultMonth={selected}
          onSelect={(d?: Date) => {
            onChange(d ? toDateString(d) : '');
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

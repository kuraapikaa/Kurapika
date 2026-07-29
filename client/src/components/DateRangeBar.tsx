import { useRef } from 'react';
import type { DateRange } from '../api/client';
import { Calendar, ChevronRight, RefreshCw } from 'lucide-react';

interface DateRangeBarProps {
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  onRefresh?: () => void;
  isLoading: boolean;
}

function formatLynonDate(value: string) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : 'Tarih seçin';
}

function LynonDateField({
  value,
  label,
  min,
  max,
  onChange,
}: {
  value: string;
  label: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const openPicker = () => {
    const input = inputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!input) return;
    input.focus();
    try {
      input.showPicker?.();
    } catch {
      input.click();
    }
  };

  return (
    <div className="relative min-w-[112px]">
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={openPicker}
        className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-transparent bg-[#080c12] px-2 text-left text-[11px] font-semibold text-[color:var(--panel-text-dim,#c8cdd5)] transition hover:border-blue-400/30 hover:bg-[#0f151f] focus:outline-none focus:ring-2 focus:ring-blue-400/25"
        aria-label={label}
      >
        <span>{formatLynonDate(value)}</span>
        <Calendar size={13} className="shrink-0 text-blue-300" />
      </button>
    </div>
  );
}

export function DateRangeBar({ range, onRangeChange, onRefresh, isLoading }: DateRangeBarProps) {
  const changeStart = (startDate: string) => {
    onRangeChange({ startDate, endDate: range.endDate < startDate ? startDate : range.endDate });
  };
  const changeEnd = (endDate: string) => {
    onRangeChange({ startDate: range.startDate > endDate ? endDate : range.startDate, endDate });
  };

  return (
    <div className="flex h-9 shrink-0 flex-nowrap items-center gap-1 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[#0c1119] p-0.5">
      <div className="hidden shrink-0 items-center gap-1.5 px-1.5 text-[color:var(--panel-muted,#8a919c)] 2xl:flex" title="Lynon tarih aralığı">
        <Calendar size={14} className="text-blue-300" />
        <span className="whitespace-nowrap text-[9px] font-bold uppercase tracking-wider">Tarih aralığı</span>
      </div>

      <div className="flex h-8 shrink-0 items-center gap-0.5 rounded-md border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 p-0">
        <LynonDateField value={range.startDate} label="Başlangıç tarihi" max={range.endDate} onChange={changeStart} />
        <ChevronRight size={14} className="shrink-0 text-[color:var(--panel-muted,#8a919c)]" />
        <LynonDateField value={range.endDate} label="Bitiş tarihi" min={range.startDate} onChange={changeEnd} />
      </div>

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-[color:var(--panel-accent,#0a84ff)] px-2.5 text-[10px] font-bold text-white transition hover:bg-[color:var(--panel-accent-deep,#0060df)] disabled:cursor-wait disabled:opacity-70"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          {isLoading ? 'Bekleyin…' : 'Yenile'}
        </button>
      )}
    </div>
  );
}
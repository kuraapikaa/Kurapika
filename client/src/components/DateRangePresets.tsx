import { getPresetRanges } from '../lib/datePresets';
import { useDateRange } from '../context/DateRangeContext';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export function DateRangePresets() {
  const { setDateRange, activePresetId } = useDateRange();
  const presets = getPresetRanges();
  const compactLabels: Record<string, string> = {
    today: 'Bugün',
    yesterday: 'Dün',
    thisWeek: 'Hafta',
    lastWeek: 'G. hafta',
    thisMonth: 'Ay',
    lastMonth: 'G. ay',
    allTime: 'Tümü',
  };

  return (
    <div className="shrink-0">
      <div className="flex h-9 flex-nowrap items-center gap-0.5 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[#0c1119] p-0.5">
        {presets.map((preset) => {
          const range = preset.getRange();
          const isActive = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setDateRange(range, preset.id)}
              className={cn(
                'relative h-8 shrink-0 rounded-md px-2.5 text-[10px] font-semibold transition-colors duration-150 outline-none',
                isActive ? 'text-white' : 'text-[color:var(--panel-muted,#8a919c)] hover:text-[color:var(--panel-text,#f2f4f8)]'
              )}
              title={preset.label}
            >
              {isActive && (
                <motion.div
                  layoutId="dateRangeIndicator"
                  className="absolute inset-0 z-0 rounded-md bg-[color:var(--panel-accent,#0a84ff)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 whitespace-nowrap">{compactLabels[preset.id] ?? preset.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

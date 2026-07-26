import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { DateRange } from '../api/client';

function todayYMD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysAgoYMD(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const defaultRange: DateRange = {
  startDate: daysAgoYMD(29),
  endDate: todayYMD(),
};

type DateRangeContextValue = {
  dateRange: DateRange;
  setDateRange: (range: DateRange, presetId?: string) => void;
  activePresetId: string | null;
};

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [dateRange, setDateRangeState] = useState<DateRange>(defaultRange);
  const [activePresetId, setActivePresetId] = useState<string | null>('last30days');

  const setDateRange = useCallback((range: DateRange, presetId?: string) => {
    setDateRangeState(range);
    setActivePresetId(presetId || null);
  }, []);

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange, activePresetId }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error('useDateRange must be used within DateRangeProvider');
  return ctx;
}

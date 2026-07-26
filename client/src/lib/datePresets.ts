import type { DateRange } from '../api/client';

/** Yerel tarih → YYYY-MM-DD (UTC değil, yerel saat dilimi) */
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonday(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(copy.getFullYear(), copy.getMonth(), diff);
}

export function getPresetRanges(): { id: string; label: string; getRange: () => DateRange }[] {
  return [
    {
      id: 'today',
      label: 'Bugün',
      getRange: () => {
        const t = new Date();
        const s = toYMD(t);
        return { startDate: s, endDate: s };
      },
    },
    {
      id: 'yesterday',
      label: 'Dün',
      getRange: () => {
        const t = new Date();
        t.setDate(t.getDate() - 1);
        const s = toYMD(t);
        return { startDate: s, endDate: s };
      },
    },
    {
      id: 'thisWeek',
      label: 'Bu hafta',
      getRange: () => {
        const today = new Date();
        const monday = getMonday(today);
        return { startDate: toYMD(monday), endDate: toYMD(today) };
      },
    },
    {
      id: 'lastWeek',
      label: 'Geçen hafta',
      getRange: () => {
        const today = new Date();
        const monday = getMonday(today);
        const lastWeekEnd = new Date(monday);
        lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
        const lastWeekStart = getMonday(lastWeekEnd);
        return { startDate: toYMD(lastWeekStart), endDate: toYMD(lastWeekEnd) };
      },
    },
    {
      id: 'thisMonth',
      label: 'Bu ay',
      getRange: () => {
        const t = new Date();
        const start = new Date(t.getFullYear(), t.getMonth(), 1);
        return { startDate: toYMD(start), endDate: toYMD(t) };
      },
    },
    {
      id: 'lastMonth',
      label: 'Geçen ay',
      getRange: () => {
        const t = new Date();
        const start = new Date(t.getFullYear(), t.getMonth() - 1, 1);
        const end = new Date(t.getFullYear(), t.getMonth(), 0);
        return { startDate: toYMD(start), endDate: toYMD(end) };
      },
    },
    {
      id: 'allTime',
      label: 'Tüm zamanlar',
      getRange: () => {
        const t = new Date();
        const start = new Date(2000, 0, 1);
        return { startDate: toYMD(start), endDate: toYMD(t) };
      },
    },
  ];
}

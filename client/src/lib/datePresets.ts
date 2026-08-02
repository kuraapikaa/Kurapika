import type { DateRange } from '../api/client';

/**
 * TARIH SAAT DILIMI.
 *
 * Bu hazir araliklar TARAYICININ yerel saat dilimini kullaniyordu.
 * Kasanin is gunu ise Turkiye saatine gore. Operatorun makinesi baska
 * bir dilimdeyse (ya da isletim sistemi UTC ise) "Bugun" kasanin
 * bugununden farkli bir gun secip raporu yanlis gosteriyordu.
 *
 * Sunucu tarafi zaten `istanbulDateKey` ile Turkiye gununu kullaniyor;
 * istemci de ayni gunu uretmeli, yoksa iki taraf farkli gun konusur.
 */
const KASA_DILIMI = 'Europe/Istanbul';

/** Verilen ani TURKIYE gunune cevirir → YYYY-MM-DD */
function toYMD(d: Date): string {
  // en-CA bicimi zaten YYYY-MM-DD veriyor; elle parcalamaya gerek yok.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KASA_DILIMI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Turkiye gununu yerel bir Date'e cevirir; gun aritmetigi bunun uzerinde yapilir. */
function kasaGunu(d: Date = new Date()): Date {
  const [y, m, g] = toYMD(d).split('-').map(Number);
  return new Date(y, m - 1, g);
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
        const t = kasaGunu();
        const s = toYMD(t);
        return { startDate: s, endDate: s };
      },
    },
    {
      id: 'yesterday',
      label: 'Dün',
      getRange: () => {
        const t = kasaGunu();
        t.setDate(t.getDate() - 1);
        const s = toYMD(t);
        return { startDate: s, endDate: s };
      },
    },
    {
      id: 'thisWeek',
      label: 'Bu hafta',
      getRange: () => {
        const today = kasaGunu();
        const monday = getMonday(today);
        return { startDate: toYMD(monday), endDate: toYMD(today) };
      },
    },
    {
      id: 'lastWeek',
      label: 'Geçen hafta',
      getRange: () => {
        const today = kasaGunu();
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
        const t = kasaGunu();
        const start = new Date(t.getFullYear(), t.getMonth(), 1);
        return { startDate: toYMD(start), endDate: toYMD(t) };
      },
    },
    {
      id: 'lastMonth',
      label: 'Geçen ay',
      getRange: () => {
        const t = kasaGunu();
        const start = new Date(t.getFullYear(), t.getMonth() - 1, 1);
        const end = new Date(t.getFullYear(), t.getMonth(), 0);
        return { startDate: toYMD(start), endDate: toYMD(end) };
      },
    },
    {
      id: 'allTime',
      label: 'Tüm zamanlar',
      getRange: () => {
        const t = kasaGunu();
        const start = new Date(2000, 0, 1);
        return { startDate: toYMD(start), endDate: toYMD(t) };
      },
    },
  ];
}

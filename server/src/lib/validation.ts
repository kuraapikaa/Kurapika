const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(str: string | undefined): Date | null {
  if (!str || !DATE_REGEX.test(str)) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function validateDateRange(
  startDate: string | undefined,
  endDate: string | undefined,
  maxDays: number
): { ok: true } | { ok: false; message: string } {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start) return { ok: false, message: 'Geçersiz startDate (YYYY-MM-DD olmalı)' };
  if (!end) return { ok: false, message: 'Geçersiz endDate (YYYY-MM-DD olmalı)' };
  if (start > end) return { ok: false, message: "startDate endDate'ten sonra olamaz" };
  const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (days > maxDays) {
    return { ok: false, message: `Tarih aralığı en fazla ${maxDays} gün olabilir` };
  }
  return { ok: true };
}

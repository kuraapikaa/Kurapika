export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '–';
  if (Number.isInteger(value)) return value.toLocaleString('tr-TR');
  return Number(value).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Tarih: 01-02-26 (DD-MM-YY) */
export function formatDateDisplay(value: string | null | undefined): string {
  if (value == null || value === '') return '–';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  } catch {
    return value;
  }
}

/** Tarih + saat: 01-02-26 14:30 */
export function formatDateTimeDisplay(value: string | null | undefined): string {
  if (value == null || value === '') return '–';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${h}:${m}`;
  } catch {
    return value;
  }
}

/** Tarih + saat + saniye: 01-02-26 14:30:45 */
export function formatDateTimeWithSeconds(value: string | null | undefined): string {
  if (value == null || value === '') return '–';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${day}-${month}-${year} ${h}:${m}:${s}`;
  } catch {
    return value;
  }
}

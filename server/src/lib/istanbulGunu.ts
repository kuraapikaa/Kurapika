/**
 * Turkiye is gunu.
 *
 * Kasa gunu Turkiye saatine gore doner; Turkiye 2016'dan beri kalici
 * UTC+3 ve yaz saati uygulamasi yok. Bu donusum kod boyunca elle
 * tekrarlandigi surece "tarih ayari yanlis" hatasi geri geliyor — 27
 * ayri yerde `${ymd}T00:00:00Z` yazilmisti ve hepsi pencereyi 3 saat
 * kaydiriyordu.
 *
 * Bu dosya o donusumun TEK kaynagidir. `lynonBackofficeService` bunu
 * yeniden disari verir; yeni kod dogrudan buradan alir.
 */

export const ISTANBUL_DILIMI = 'Europe/Istanbul';
export const ISTANBUL_OFSETI = '+03:00';

/** Verilen anin Turkiye takvimindeki gunu → "YYYY-MM-DD". Cozulemezse "". */
export function istanbulDateKey(value: Date | string | number = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ISTANBUL_DILIMI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

/** Verilen an, `baslangic`–`bitis` (Turkiye gunleri, ikisi de dahil) araliginda mi? */
export function gunAraligindaMi(
  value: Date | string | number | null | undefined,
  baslangic?: string | null,
  bitis?: string | null,
): boolean {
  if (value === null || value === undefined || value === '') return false;
  const gun = istanbulDateKey(value);
  if (!gun) return false;
  if (baslangic && gun < baslangic) return false;
  if (bitis && gun > bitis) return false;
  return true;
}

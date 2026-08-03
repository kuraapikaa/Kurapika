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

/**
 * Lynon'un `sl-timezone` basligi.
 *
 * ── Bildirilen "pano yanlis donduruyor" hatasinin KOK NEDENI ──────────
 *
 * Lynon backoffice arayuzu her istekte `sl-timezone: -3` gonderiyor.
 * Panel bu basligi HIC gondermiyordu. Baslik yoksa Lynon tarih-only
 * parametreleri (`startDate=2026-08-03`) UTC sanıyor ve pencere Turkiye
 * saatiyle 03:00'te basliyor.
 *
 * Sonuc olculdu: ayni gun icin Lynon arayuzu 12.010 TL yatirim ve 3.400
 * TL cekim gosterirken panel 1.010 TL ve 0 TL donduruyordu. Fark tam
 * olarak 00:00-03:00 arasindaki islemler — 3 Agustos gecesi saat 02:00
 * civarinda yapilan 11.000 TL yatirim ve 3.400 TL cekim.
 *
 * ── Isaret neden negatif ──────────────────────────────────────────────
 *
 * Lynon, JavaScript'in `Date.getTimezoneOffset()` kuralini kullaniyor:
 * UTC+3 icin bu deger -180 dakika, yani -3 saat. Yerel saatten UTC'ye
 * gitmek icin EKLENECEK miktar. Turkiye 2016'dan beri kalici UTC+3
 * oldugu icin deger sabit.
 */
export const LYNON_SL_TIMEZONE = slTimezoneDegeri(ISTANBUL_OFSETI);

/** "+03:00" → -3. Lynon `getTimezoneOffset()` isaret kuralini kullaniyor. */
export function slTimezoneDegeri(ofset: string): number {
  const eslesme = ofset.trim().match(/^([+-])(\d{2}):(\d{2})$/);
  if (!eslesme) return 0;
  const [, isaret, saat, dakika] = eslesme;
  const toplamSaat = Number(saat) + Number(dakika) / 60;
  // Ofset +03:00 ise getTimezoneOffset karsiligi -3.
  return isaret === '+' ? -toplamSaat : toplamSaat;
}

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

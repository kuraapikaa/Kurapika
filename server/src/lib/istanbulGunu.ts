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

/** Verilen anin Turkiye saati ve dakikasi — gece yarisi penceresi kontrolleri icin. */
export function istanbulSaatDakika(now: Date = new Date()): { saat: number; dakika: number } {
  const parcalar = new Intl.DateTimeFormat('en-GB', {
    timeZone: ISTANBUL_DILIMI, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const al = (tur: string) => Number(parcalar.find((p) => p.type === tur)?.value ?? NaN);
  return { saat: al('hour'), dakika: al('minute') };
}

/**
 * Verilen anin Turkiye gunu+saati → "YYYY-MM-DDTHH". Saat-basi tekilleme
 * anahtari: her saat icin bir kez gonderilecek periyodik raporlarda
 * "bu saat icin zaten gonderildi mi" sorusunu tek bir string
 * karsilastirmasiyla cevaplar; sure-bazli (`Date.now() - sonGonderim >=
 * araikMs`) desen surec yeniden baslamalarinda veya pencere disi
 * calismalarda saatin kaymasina (13:15, 13:47 gibi) yol acar, bu
 * anahtar TAM saatte (XX:00) sabitler.
 */
export function istanbulSaatEtiketi(now: Date = new Date()): string {
  const { saat } = istanbulSaatDakika(now);
  return `${istanbulDateKey(now)}T${String(saat).padStart(2, '0')}`;
}

/** Turkiye gun adindan ISO hafta sirasi (Pazartesi=0 ... Pazar=6). */
const HAFTA_GUN_SIRASI: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

/**
 * Verilen anin icinde bulundugu Turkiye haftasinin BASLANGICI (Pazartesi
 * 00:00 Europe/Istanbul) — epoch ms.
 *
 * Turkiye kalici UTC+3 oldugu icin (yaz saati yok) bir Istanbul gununun
 * gece yarisi her zaman `${YYYY-MM-DD}T00:00:00+03:00` ile birebir
 * cozulur; gunler arasi fark saf gun-sayisi çıkarma islemiyle guvenle
 * hesaplanabilir (DST sicramasi riski yok).
 */
export function istanbulHaftaBaslangiciMs(simdi: number = Date.now()): number {
  const now = new Date(simdi);
  const bugunAnahtari = istanbulDateKey(now);
  const gunAdi = new Intl.DateTimeFormat('en-US', {
    timeZone: ISTANBUL_DILIMI, weekday: 'short',
  }).format(now);
  const gunFarki = HAFTA_GUN_SIRASI[gunAdi] ?? 0;
  const bugunGeceYarisiMs = Date.parse(`${bugunAnahtari}T00:00:00${ISTANBUL_OFSETI}`);
  return bugunGeceYarisiMs - gunFarki * 86_400_000;
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

/**
 * PANELDEN GİRİLEN YEREL TARİHİ İSTANBUL SAATİ OLARAK OKUR.
 *
 * ── Bildirilen vaka ───────────────────────────────────────────────────
 *
 * "Tahmin başlangıç ve kapanış ayarladığım halde durum tahmine açık
 * olmaya devam ediyor."
 *
 * ── Mekanizma ─────────────────────────────────────────────────────────
 *
 * `<input type="datetime-local">` saat dilimi TAŞIMAYAN bir dizge üretir:
 * `2026-08-20T18:00`. JS bunu ÇALIŞTIĞI ORTAMIN yerel saati sayar:
 *
 *   UTC sunucuda  : 2026-08-20T18:00:00.000Z
 *   TR tarayıcıda : 2026-08-20T15:00:00.000Z   ← üç saat fark
 *
 * Railway'de `TZ` tanımlı değil, yani sunucu UTC. Yönetici 18:00 (İstanbul)
 * yazıyor, sunucu bunu 18:00 UTC = 21:00 İstanbul sanıyor ve üç saat daha
 * tahmin kabul ediyor. Operatör "kapattım ama açık" diyor; haklı.
 *
 * Bu, deponun daha önce yaşadığı hatanın aynısı (bkz. dosya başı: pano
 * tarihleri üç saat kayıyordu). Tahmin yoluna uygulanmamış.
 *
 * Dizgede saat dilimi ZATEN varsa (`Z` ya da `+03:00`) dokunulmaz —
 * eski kayıtlar ve API'den gelen ISO damgaları bozulmasın.
 */
export function istanbulYerelAn(value: unknown): number {
  const metin = String(value ?? '').trim();
  if (!metin) return Number.NaN;

  // Saat dilimi taşıyor mu? `Z`, `+03:00`, `-0500` …
  const dilimVar = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(metin);
  if (dilimVar) return new Date(metin).getTime();

  // `YYYY-MM-DDTHH:mm[:ss]` — saniye yoksa tamamlanır.
  const m = metin.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?$/);
  if (!m) return new Date(metin).getTime();

  return new Date(`${m[1]}T${m[2]}${m[3] ?? ':00'}${ISTANBUL_OFSETI}`).getTime();
}

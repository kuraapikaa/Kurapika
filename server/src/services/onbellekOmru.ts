/**
 * Rapor onbellek omru — araliga gore.
 *
 * ── Iki farkli soru, tek omur ─────────────────────────────────────────
 *
 * Pano ve raporlar sabit bes dakikalik onbellek kullaniyordu. Bu, iki
 * tamamen farkli soruya ayni cevabi vermek demekti:
 *
 *   • BUGUN — rakam her yatirimda degisiyor. Bes dakika, canli rakama
 *     bakan operator icin cok uzun; "pano guncellenmiyor" sikayeti
 *     buradan cikiyor.
 *
 *   • GECMIS GUN — 2 Agustos'un yatirim toplami bir daha ASLA
 *     degismeyecek. Onu bes dakikada bir yeniden cekmek saf israf:
 *     Railway'de CPU, Lynon'da istek, ikisinde de bosuna trafik.
 *
 * Dogru cevap ikisini ayirmak: bugunu iceren pencere KISA, tamamen
 * gecmiste kalan pencere UZUN omurlu.
 *
 * ── Gelecek tarihler ──────────────────────────────────────────────────
 *
 * Bitis tarihi bugunden ileriyse pencere hala "bugunu iceriyor" sayilir;
 * icine yeni islem dusmeye devam eder.
 */

/** Bugunu iceren pencere: operator canli rakama bakiyor. */
export const CANLI_TTL_MS = Number(process.env.CANLI_RAPOR_CACHE_MS) || 60_000;

/** Tamami gecmiste kalan pencere: veri artik degismez. */
export const GECMIS_TTL_MS = Number(process.env.GECMIS_RAPOR_CACHE_MS) || 30 * 60 * 1000;

/**
 * Bu aralik icin onbellek omru.
 *
 * @param endDate  Pencerenin bitisi, "YYYY-MM-DD".
 * @param bugun    Turkiye gunu, "YYYY-MM-DD".
 */
export function araligaGoreTtl(endDate: string | null | undefined, bugun: string): number {
  const bitis = String(endDate ?? '').trim();
  // Tarih okunamiyorsa canli varsay: bayat veri gostermektense fazladan
  // istek atmak yeglenir.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bitis)) return CANLI_TTL_MS;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bugun)) return CANLI_TTL_MS;
  return bitis < bugun ? GECMIS_TTL_MS : CANLI_TTL_MS;
}

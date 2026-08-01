/**
 * Odul talebi kilidi.
 *
 * ── Neden gerekli ─────────────────────────────────────────────────────
 * Odul talebi uclari "kontrol et, sonra ver" seklinde calisiyor:
 *
 *   1. Bu odul zaten alinmis mi?   (oku)
 *   2. Alinmamis -> odulu ver       (Lynon kampanya atamasi)
 *   3. Kaydi yaz                    (yaz)
 *
 * Okuma ile yazma arasindaki her an bir yaris penceresi. Iki es zamanli
 * istek (cift tiklama, istemci yeniden denemesi, iki sekme) 1'i birlikte
 * gecip AYNI odulu iki kez veriyor.
 *
 * Kayit sirasini duzeltmek (once rezerve et, sonra ver) pencereyi
 * daraltiyor ama KAPATMIYOR: read-modify-write hala atomik degil.
 * Olculdu — iki es zamanli istek yine iki odul uretiyor.
 *
 * ── Kapsam ────────────────────────────────────────────────────────────
 * Bu kilit SUREC ICI. Tek instance'ta yarisi tamamen kapatir.
 *
 * Birden fazla instance'a olceklenirse dagitik kilit gerekir (Redis
 * SET NX PX). O gun gelene kadar bu kilit korumanin tamami degil, ilk
 * katmani: ikinci katman uclardaki "zaten alinmis" kontrolu.
 */

/** Anahtar -> o anahtardaki son islemin sonu. */
const kuyruklar = new Map<string, Promise<unknown>>();

/**
 * Ayni anahtardaki islemleri SIRAYA sokar.
 *
 * Farkli anahtarlar paralel calisir; yalnizca ayni oyuncu + ayni odul
 * bekletilir. Islem hata atsa bile kuyruk ilerler — aksi halde bir hata
 * o anahtari kalici kilitlerdi.
 */
export async function kilitle<T>(anahtar: string, islem: () => Promise<T>): Promise<T> {
  const onceki = kuyruklar.get(anahtar) ?? Promise.resolve();

  // Hatayi yutup zinciri saglam tutuyoruz; cagirana kendi hatasi doner.
  const calistir = onceki.then(islem, islem);
  const zincir = calistir.catch(() => undefined);
  kuyruklar.set(anahtar, zincir);

  try {
    return await calistir;
  } finally {
    // Bekleyen baska istek yoksa anahtari birak; Map sinirsiz buyumesin.
    if (kuyruklar.get(anahtar) === zincir) kuyruklar.delete(anahtar);
  }
}

/** Odul kilidi anahtari: oyuncu + odul turu + odul kimligi. */
export function odulAnahtari(login: string, tur: string, kimlik: string | number): string {
  return `odul:${String(login).trim().toLocaleLowerCase('tr-TR')}:${tur}:${kimlik}`;
}

/**
 * KİRACI (TENANT) ANAHTARI.
 *
 * Bu panel tek bir markaya değil, birden çok siteye hizmet ediyor.
 * Her isteğin kiracısı bir kez çözülüyor (`app.ts`) ve servislere
 * AÇIK PARAMETRE olarak geçiyor.
 *
 * ── Neden AsyncLocalStorage yok ──
 *
 * BugsPanel'de kiracı bir çalışma bağlamında taşınıyor, çünkü orada
 * anahtarı isteyen ~100 senkron çağrı noktası var ve hepsine parametre
 * eklemek pratik değildi. Burada öyle bir miras yok: her servis zaten
 * ilk parametre olarak `kiraci` alıyor. Bağlam kurmak, hiçbir şey
 * kazandırmadan görünmez bir bağımlılık eklerdi — ve unutulan bir
 * `runWithTenant`, sessizce yanlış kiracıya yazmak demektir.
 *
 * Açık parametrenin bedeli imzaların uzunluğu; karşılığında derleyici
 * unutulan kiracıyı yakalıyor.
 */

const VARSAYILAN = 'varsayilan';

/**
 * Anahtarı dosya yolunda ve veritabanı satırında kullanılabilir hale
 * getirir. Dizin geçişi (`../`) burada kesiliyor: anahtar dosya adına
 * dönüştüğü için filtrelenmemiş bir değer, depo dizininin dışına yazma
 * imkânı verirdi.
 */
export function guvenliKiraciAnahtari(ham: unknown): string {
  const temiz = String(ham ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
  return temiz || VARSAYILAN;
}

export function varsayilanKiraci(): string {
  return guvenliKiraciAnahtari(process.env.VARSAYILAN_KIRACI || VARSAYILAN);
}

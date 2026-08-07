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

/**
 * TEK MARKA DAĞITIMI.
 *
 * `AFF_SABIT_KIRACI` verilirse, hangi adresten gelinirse gelinsin
 * kiracı budur.
 *
 * ── Neden gerekli ──
 *
 * Kiracı normalde alt alan adından çözülüyor. Ama `affiliate.` ve
 * `ortak.` bir MÜŞTERİYİ değil bir İŞLEVİ adlandırıyor (yönetim /
 * ortak portali). İkisi ayrı kiracıya düştüğü için yönetimde
 * oluşturulan ortak portalda GÖRÜNMÜYOR ve ortak giriş yapamıyordu:
 * hesap "yok" diye dönüyordu, çünkü başka bir kiracıda aranıyordu.
 *
 * Tek markalı bir kurulumda doğru cevap "alt alan adına hiç bakma".
 * Çok kiracılı kurulumlarda değişken boş bırakılır, eski davranış aynen
 * sürer.
 */
export function sabitKiraci(): string | null {
  const deger = String(process.env.AFF_SABIT_KIRACI || '').trim();
  return deger ? guvenliKiraciAnahtari(deger) : null;
}

/**
 * İsteğin kiracısı.
 *
 * Sıra: SABİT → oturum → `x-kiraci` başlığı → alt alan adı → varsayılan.
 *
 * Sabit kiracı oturumu da eziyor: tek marka kurulumunda tek kiracı var
 * ve elde kalmış eski bir oturum çerezi yanlış anahtarı taşıyorsa
 * kullanıcı kendi verisini göremezdi.
 *
 * Oturum, başlıktan ÖNCE geliyor. Aksi hâlde geçerli bir oturuma sahip
 * biri başlığı değiştirerek başka bir kiracının verisine erişirdi — çok
 * kiracılı bir panelde en kolay yapılan ve en pahalıya patlayan hata.
 */
export function kiraciCozumle(
  oturumKiracisi: string | null,
  basliklar: { host?: unknown; 'x-kiraci'?: unknown },
): string {
  const sabit = sabitKiraci();
  if (sabit) return sabit;

  if (oturumKiracisi) return oturumKiracisi;

  const baslik = String(basliklar['x-kiraci'] ?? '').trim();
  if (baslik) return guvenliKiraciAnahtari(baslik);

  const sunucu = String(basliklar.host ?? '').split(':')[0];
  const parcalar = sunucu.split('.');
  if (parcalar.length > 2 && parcalar[0] !== 'www') return guvenliKiraciAnahtari(parcalar[0]);

  return varsayilanKiraci();
}

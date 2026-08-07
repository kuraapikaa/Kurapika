import { degistir, diziOku, kayitOku, oku } from '../lib/depo.js';

/**
 * İLK YATIRIM (FTD) TÜRETME.
 *
 * Backoffice raporu "kaç oyuncu ilk kez yatırım yaptı" diye bir alan
 * vermiyor; toplam düzeyinde konuşuyor. Bu yüzden `ftdSayisi` şimdiye
 * kadar `null` (ölçülemedi) yazılıyordu ve CPA bileşeni olan planlar
 * hesaplanamıyordu.
 *
 * Ama rapor OYUNCU BAZINDA satır veriyor. Yani bilgi orada: bugün
 * yatırım yapanlardan daha önce hiç yatırım yapmamış olanlar, ilk
 * yatırımını bugün yapmış demektir. Tek gereken, kimin daha önce
 * yatırım yaptığını hatırlamak.
 *
 * ── KALİBRASYON: neden ilk günler `null` ──
 *
 * Kayıt defteri boş başlıyor. İlk senkronda HERKES "daha önce hiç
 * yatırım yapmamış" görünür ve o günün FTD'si tavan yapar — üstelik
 * bu rakam gerçek görünür, çünkü tipi doğrudur.
 *
 * Bu yüzden geri doldurma penceresi KALİBRASYON sayılıyor: o günlerin
 * oyuncuları deftere yazılıyor ama FTD `null` dönüyor. Ölçüm, defter
 * dolduktan sonraki günlerde başlıyor.
 *
 * ── Kalan sınır, açıkça ──
 *
 * Kalibrasyon penceresinden ÖNCE yatırım yapmış ve pencere içinde hiç
 * görünmemiş bir oyuncu, sonradan yatırım yaptığında bir kez yanlışlıkla
 * FTD sayılır. Pencereyi uzatmak bu hatayı küçültüyor ama sıfırlamıyor;
 * sıfırlamanın tek yolu backoffice'in kendi ilk-yatırım alanını vermesi.
 * Panel bu yüzden ölçümün hangi günden itibaren güvenilir olduğunu
 * kaydediyor ve gösteriyor.
 */

const ALAN = 'ilk-yatirim-defteri';

interface Defter {
  version: 1;
  /** Yatırım yaptığı görülmüş oyuncu kimlikleri. */
  yatiranlar: string[];
  /** Defterin ilk yazıldığı gün. */
  ilkGun: string | null;
  /**
   * Bu günden İTİBAREN FTD ölçülüyor sayılır. Kalibrasyon boyunca
   * `null` dönmenin sebebi bu eşik.
   */
  olcumBaslangici: string | null;
}

const cozDefter = (ham: unknown): Defter => {
  const k = kayitOku(ham);
  return {
    version: 1,
    yatiranlar: diziOku<string>(k.yatiranlar),
    ilkGun: typeof k.ilkGun === 'string' ? k.ilkGun : null,
    olcumBaslangici: typeof k.olcumBaslangici === 'string' ? k.olcumBaslangici : null,
  };
};

export interface FtdSonucu {
  /** `null` = kalibrasyon sürüyor, ölçülemedi. */
  ftdSayisi: number | null;
  /** Bu turda deftere eklenen yeni oyuncu sayısı; teşhis için. */
  deftereEklenen: number;
}

/**
 * Bir günün yatırım yapan oyuncularını işler ve FTD sayısını döndürür.
 *
 * Defter TÜM ortaklar için ortak: aynı oyuncu iki ortağın listesinde
 * görünürse (mümkün — atıf değişebilir) ikisine birden FTD yazmak,
 * tek bir ilk yatırım için iki kez CPA ödemek olurdu.
 */
export async function ftdIsle(
  kiraci: string,
  gun: string,
  yatiranOyuncular: string[],
  { kalibrasyonMu }: { kalibrasyonMu: boolean },
): Promise<FtdSonucu> {
  const temiz = [...new Set(yatiranOyuncular.map((o) => String(o ?? '').trim()).filter(Boolean))];

  return degistir<Defter, FtdSonucu>(kiraci, ALAN, cozDefter, (defter) => {
    const bilinen = new Set(defter.yatiranlar);
    const yeniler = temiz.filter((o) => !bilinen.has(o));

    for (const o of yeniler) defter.yatiranlar.push(o);
    if (!defter.ilkGun) defter.ilkGun = gun;

    if (kalibrasyonMu) {
      return { ftdSayisi: null, deftereEklenen: yeniler.length };
    }

    // Kalibrasyon bittigi ilk gunde esik yaziliyor; panel "olcum su
    // gunden itibaren guvenilir" diyebilsin.
    if (!defter.olcumBaslangici) defter.olcumBaslangici = gun;

    return { ftdSayisi: yeniler.length, deftereEklenen: yeniler.length };
  });
}

/** Panelde "FTD ne zamandan beri ölçülüyor" sorusunu cevaplamak için. */
export async function ftdDurumu(kiraci: string): Promise<{
  olculuyorMu: boolean;
  olcumBaslangici: string | null;
  defterdekiOyuncu: number;
}> {
  const defter = await oku<Defter>(kiraci, ALAN, cozDefter);
  return {
    olculuyorMu: Boolean(defter.olcumBaslangici),
    olcumBaslangici: defter.olcumBaslangici,
    defterdekiOyuncu: defter.yatiranlar.length,
  };
}

/**
 * Defteri sıfırlar.
 *
 * Backoffice değiştiğinde ya da oyuncu kimlik biçimi değiştiğinde
 * gerekli: eski kimlikler yeni sistemde hiç eşleşmez ve defter
 * herkesi "yeni" gösterir. Sıfırlama, kalibrasyonu baştan başlatıyor.
 */
export async function ftdDefteriniSifirla(kiraci: string): Promise<void> {
  await degistir<Defter, void>(kiraci, ALAN, cozDefter, (defter) => {
    defter.yatiranlar = [];
    defter.ilkGun = null;
    defter.olcumBaslangici = null;
  });
}

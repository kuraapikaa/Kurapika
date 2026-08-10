import type { GelirKademesi, KomisyonPlani } from './komisyon.js';
import { gelirPayiHesapla } from './komisyon.js';

/**
 * DİKEY — casino mu, spor bahis mi?
 *
 * Panel şimdiye kadar tek bir gelir akışı taşıyordu (`ggr`). Bu, iki
 * dikeyi aynı orana mahkûm ediyordu ve pratikte yanlış: spor bahsin
 * brüt marjı casinodan yapısal olarak düşük. Aynı yüzdeyi ikisine
 * uygulamak spor trafiğini taşınamaz hale getiriyor, ayrı yüzde
 * verebilmek için de ölçümün hangi dikeyden geldiğini bilmek gerekiyor.
 *
 * ── Neden üçüncü bir değer var ──
 *
 * `bilinmiyor`, `casino` ile aynı şey DEĞİL. Toplam düzeyinde rapor
 * veren bir backoffice iki dikeyi ayırmıyor; o veriyi "casino" diye
 * etiketlemek, spor gelirini casino oranıyla ödemek olurdu. Ayrıca
 * mevcut kayıtların tamamı bu durumda: geçişte hiçbir satır uydurma
 * bir dikeye atanmıyor.
 *
 * `bilinmiyor` ölçümler plandaki DÜZ orana düşüyor (`gelirPayiYuzde`),
 * yani bugünkü davranış birebir korunuyor. Bir bağlantı dikey vermeye
 * başladığı gün yeni satırlar ayrışıyor, eski satırlar olduğu gibi
 * kalıyor — geriye dönük yeniden yorumlama yok.
 */
export type Dikey = 'casino' | 'spor' | 'bilinmiyor';

export const DIKEYLER: Dikey[] = ['casino', 'spor', 'bilinmiyor'];

export const DIKEY_ETIKETI: Record<Dikey, string> = {
  casino: 'Casino',
  spor: 'Spor bahis',
  bilinmiyor: 'Ayrışmamış',
};

/**
 * Dışarıdan gelen değeri güvenli bir dikeye çevirir.
 *
 * Tanımadığı bir değer `bilinmiyor` oluyor, HATA ATMIYOR: adaptör
 * yarın "livecasino" diye bir dize göndermeye başlarsa senkron turunun
 * tamamının düşmesi, o günün bütün ölçümünü kaybetmek demek olurdu.
 * Bilinmeyen dikey düz orana düşer; para hesabı yine doğru kalır,
 * yalnızca kırılım kaba olur.
 */
export function dikeyOku(deger: unknown): Dikey {
  const s = String(deger ?? '').trim().toLowerCase();
  if (s === 'casino' || s === 'slots' || s === 'slot' || s === 'livecasino' || s === 'canli-casino') return 'casino';
  if (s === 'spor' || s === 'sport' || s === 'sports' || s === 'sportsbook' || s === 'betting') return 'spor';
  return 'bilinmiyor';
}

/**
 * PLANIN BİR DİKEY İÇİN ORANI.
 *
 * Plan iki oranı ayrı taşıyabiliyor ama taşımak ZORUNDA değil:
 * `dikeyOranlari` boşsa düz alanlar (`gelirPayiYuzde`, `cpaTutari`,
 * `gelirKademeleri`) geçerli. Mevcut planların hiçbiri düzenlenmeden
 * çalışmaya devam ediyor — dikey desteği bir geçiş adımı, kesme değil.
 */
export interface DikeyOrani {
  yuzde: number;
  cpaTutari: number;
  gelirKademeleri: GelirKademesi[];
}

export function planinDikeyOrani(plan: KomisyonPlani, dikey: Dikey): DikeyOrani {
  const duz: DikeyOrani = {
    yuzde: plan.gelirPayiYuzde,
    cpaTutari: plan.cpaTutari,
    gelirKademeleri: plan.gelirKademeleri,
  };
  // `bilinmiyor` HER ZAMAN duz orana duser: ayrisamamis bir geliri
  // casino oranindan odemek, olculmeyen bir seyi olculmus gibi
  // gostermek olurdu.
  if (dikey === 'bilinmiyor') return duz;

  const ozel = plan.dikeyOranlari?.[dikey];
  if (!ozel) return duz;

  return {
    yuzde: typeof ozel.yuzde === 'number' ? ozel.yuzde : duz.yuzde,
    cpaTutari: typeof ozel.cpaTutari === 'number' ? ozel.cpaTutari : duz.cpaTutari,
    gelirKademeleri: ozel.gelirKademeleri?.length ? ozel.gelirKademeleri : duz.gelirKademeleri,
  };
}

export interface DikeyGirdisi {
  dikey: Dikey;
  ggr: number;
  /** `null` = ölçülemedi. O dikeyin CPA bileşeni hesaplanamaz. */
  ftdSayisi: number | null;
}

export interface DikeySatiri {
  dikey: Dikey;
  brutGelir: number;
  /** Sabit işletme payından bu dikeye düşen pay. */
  yonetimGideri: number;
  netGelir: number;
  /** Devreden zarardan bu dikeye düşen pay uygulandıktan sonra. */
  hesapTabani: number;
  gelirPayi: number;
  gelirPayiYuzdesi: number;
  ulasilanKademe: GelirKademesi | null;
  cpaPayi: number;
  cpaHesaplanamadiSebebi: string | null;
  toplam: number;
}

export interface DikeyHakedis {
  satirlar: DikeySatiri[];
  brutGelir: number;
  yonetimGideri: number;
  netGelir: number;
  hesapTabani: number;
  gelirPayi: number;
  cpaPayi: number;
  /** Bu dönemin kazancı + devreden ödeme. */
  toplam: number;
  odenecek: number;
  sonrakiDevredenZarar: number;
  sonrakiDevredenOdeme: number;
}

const kurusa = (n: number): number => Math.round(n * 100) / 100;

/**
 * DİKEY BAZINDA HAKEDİŞ.
 *
 * `komisyon.ts`'teki `hakedisHesapla` tek akışlı; bu onun dikey
 * farkındalıklı hâli. Hesap sırası AYNI kalıyor — önce işletme payı,
 * sonra devreden zarar, en sonda ortağın yüzdesi — çünkü sıranın
 * gerekçesi dikeyden bağımsız.
 *
 * ── Üç şey dikey BAŞINA değil, DÖNEM başına ──
 *
 * Sabit işletme payı, devreden zarar ve asgari ödeme ortak düzeyinde
 * tanımlı; her dikeye ayrı ayrı uygulamak üçünü de ikiye katlardı.
 * Bu yüzden:
 *
 *   • SABİT GİDER brüt gelire göre PAYLAŞTIRILIYOR. Tamamını tek
 *     dikeye yüklemek keyfî olurdu; eşit bölmek 100 ₺ casino + 10.000 ₺
 *     spor geliri olan bir ayda casino'yu eksiye düşürürdü.
 *
 *   • DEVREDEN ZARAR net gelire göre paylaştırılıyor. Zararı yalnızca
 *     yüzdesi yüksek dikeye yazmak ortağa en pahalı yorumu uygulamak,
 *     yalnızca düşük olana yazmak siteye en pahalısını uygulamak olurdu.
 *     Payına göre bölmek ikisinden de bağımsız tek tutarlı kural.
 *
 *   • ASGARİ ÖDEME ve DEVREDEN ÖDEME toplamda bir kez uygulanıyor.
 *     Dikey başına uygulamak, iki dikeyden de eşiğin biraz altında
 *     kalan bir ortağın hiç ödeme almamasına yol açardı — oysa toplamı
 *     eşiği geçiyor.
 */
export function dikeyHakedisHesapla(
  plan: KomisyonPlani,
  girdiler: DikeyGirdisi[],
  devredenZarar = 0,
  devredenOdeme = 0,
): DikeyHakedis {
  // Ayni dikey iki kez gelirse topluyoruz: cagiran taraf gunleri
  // gruplarken hata yaparsa satirin biri sessizce kaybolmasin.
  const toplananlar = new Map<Dikey, DikeyGirdisi>();
  for (const g of girdiler) {
    const dikey = dikeyOku(g.dikey);
    const mevcut = toplananlar.get(dikey);
    if (!mevcut) {
      toplananlar.set(dikey, { dikey, ggr: Number(g.ggr) || 0, ftdSayisi: g.ftdSayisi });
      continue;
    }
    mevcut.ggr += Number(g.ggr) || 0;
    // Bir gun olculup digeri olculmediyse toplam OLCULMUS sayilir:
    // elimizdeki sayi eksik ama uydurma degil. `null` + 3 = 3.
    if (g.ftdSayisi !== null) mevcut.ftdSayisi = (mevcut.ftdSayisi ?? 0) + g.ftdSayisi;
  }

  const kalemler = [...toplananlar.values()];
  const brutToplam = kurusa(kalemler.reduce((t, k) => t + k.ggr, 0));
  const pozitifBrut = kalemler.reduce((t, k) => t + Math.max(0, k.ggr), 0);

  // ── Isletme payi ──
  const sabitGider = Math.max(0, Number(plan.yonetimGideriSabit) || 0);
  // Sabit gider brut geliri asamaz; gelirin olmadigi bir ayda ortagi
  // borclu cikarmaz (bkz. `yonetimGideriSabit` aciklamasi).
  const dagitilacakSabit = Math.min(sabitGider, Math.max(0, brutToplam));

  const araSatirlar = kalemler.map((k) => {
    const brut = kurusa(k.ggr);
    const yuzdeGideri = kurusa(Math.max(0, brut) * (plan.yonetimGideriYuzde / 100));
    // Pay brut gelire gore; hic pozitif gelir yoksa sabit gider dagitilmiyor.
    const payOrani = pozitifBrut > 0 ? Math.max(0, brut) / pozitifBrut : 0;
    const sabitPayi = kurusa(dagitilacakSabit * payOrani);
    const yonetimGideri = kurusa(Math.min(Math.max(0, brut), yuzdeGideri + sabitPayi));
    return { ...k, brut, yonetimGideri, netGelir: kurusa(brut - yonetimGideri) };
  });

  const netToplam = kurusa(araSatirlar.reduce((t, s) => t + s.netGelir, 0));

  // ── Devreden zarar ──
  // Yalnizca NEGATIF olabilir; pozitif gelirse yok sayiliyor, aksi
  // halde gecmis bir ay ortaga iki kez kazanc yazardi.
  const zarar = Math.min(0, Number(devredenZarar) || 0);
  const pozitifNet = araSatirlar.reduce((t, s) => t + Math.max(0, s.netGelir), 0);

  const satirlar: DikeySatiri[] = araSatirlar.map((s) => {
    const zararPayi = pozitifNet > 0 ? kurusa(zarar * (Math.max(0, s.netGelir) / pozitifNet)) : 0;
    // Hic pozitif net yoksa zarar hicbir satira yazilmiyor; zaten
    // tamami sonraki doneme devredecek.
    const taban = kurusa(s.netGelir + zararPayi);
    const oran = planinDikeyOrani(plan, s.dikey);

    // Gelir payi yalnizca POZITIF tabandan hesaplaniyor: negatif taban
    // "ortak bize borclu" demek olurdu.
    //
    // `gelirPayiHesapla(plan, taban)` PLAN nesnesinden okuyor; dikeyin
    // kendi orani/kademeleri varsa duz `plan` yerine SADECE bu ikisi
    // ezilmis sentetik bir plan gecirilir -- `kademeModu` her zaman
    // `plan`'dan geliyor, dikey basina degismiyor.
    const payli = taban > 0 && (plan.tur === 'gelir-payi' || plan.tur === 'hibrit')
      ? gelirPayiHesapla({ ...plan, gelirPayiYuzde: oran.yuzde, gelirKademeleri: oran.gelirKademeleri }, taban)
      : { tutar: 0, efektifYuzde: taban > 0 ? oran.yuzde : 0, ulasilanKademe: null };

    let cpaPayi = 0;
    let cpaHesaplanamadiSebebi: string | null = null;
    if (plan.tur === 'cpa' || plan.tur === 'hibrit') {
      if (s.ftdSayisi === null) {
        // SIFIR YAZMIYORUZ. "Hic ilk yatirim getirmedin" ile "biz
        // olcemiyoruz" ayri seyler; ikincisini birincisi gibi yazmak
        // dogrudan bir odeme anlasmazligi uretir.
        cpaHesaplanamadiSebebi = `${DIKEY_ETIKETI[s.dikey]} için ilk yatırım sayısı bu bağlantıdan ölçülemiyor.`;
      } else {
        cpaPayi = kurusa(s.ftdSayisi * oran.cpaTutari);
      }
    }

    return {
      dikey: s.dikey,
      brutGelir: s.brut,
      yonetimGideri: s.yonetimGideri,
      netGelir: s.netGelir,
      hesapTabani: taban,
      gelirPayi: payli.tutar,
      gelirPayiYuzdesi: payli.efektifYuzde,
      ulasilanKademe: payli.ulasilanKademe,
      cpaPayi,
      cpaHesaplanamadiSebebi,
      toplam: kurusa(payli.tutar + cpaPayi),
    };
  });

  const tabanToplam = kurusa(satirlar.reduce((t, s) => t + s.hesapTabani, 0));
  const gelirPayi = kurusa(satirlar.reduce((t, s) => t + s.gelirPayi, 0));
  const cpaPayi = kurusa(satirlar.reduce((t, s) => t + s.cpaPayi, 0));

  const devirOdeme = Math.max(0, Number(devredenOdeme) || 0);
  const toplam = kurusa(gelirPayi + cpaPayi + devirOdeme);

  // Asgari odemenin altinda kalan tutar SILINMIYOR, sonraki doneme
  // devrediyor: silmek ortagin kazandigi parayi kaybetmesi olurdu.
  const asgari = Math.max(0, Number(plan.asgariOdeme) || 0);
  const odenecek = toplam >= asgari ? toplam : 0;

  // Zararin sonraki doneme devri: tabanin toplami negatifse o kadar.
  // Plan devri kapatmissa sifirlaniyor.
  const sonrakiDevredenZarar = plan.negatifDevir ? Math.min(0, tabanToplam) : 0;

  return {
    satirlar: satirlar.sort((a, b) => DIKEYLER.indexOf(a.dikey) - DIKEYLER.indexOf(b.dikey)),
    brutGelir: brutToplam,
    yonetimGideri: kurusa(satirlar.reduce((t, s) => t + s.yonetimGideri, 0)),
    netGelir: netToplam,
    hesapTabani: tabanToplam,
    gelirPayi,
    cpaPayi,
    toplam,
    odenecek,
    sonrakiDevredenZarar,
    sonrakiDevredenOdeme: odenecek > 0 ? 0 : toplam,
  };
}

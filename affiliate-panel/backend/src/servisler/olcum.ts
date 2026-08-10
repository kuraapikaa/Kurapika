import { olcumDeposu } from '../depolar/olcumDeposu.js';
import { DIKEYLER, dikeyOku, type Dikey } from './dikey.js';

/**
 * ÖLÇÜM ÇEKİRDEĞİ — protokolden bağımsız.
 *
 * Panelin veri modeli. Lynon'un ya da başka bir sağlayıcının şemasını
 * taklit ETMİYOR: dışarıdan gelen her şey adaptörde bu modele çevrilir.
 *
 * ── Neden GÜNLÜK ANLIK GÖRÜNTÜ saklıyoruz ──
 *
 * Backoffice'ten istek anında bir tarih aralığı özeti çekmek "dün ne
 * oldu" sorusuna cevap verir ama "bu ortak son 30 günde büyüdü mü",
 * "hangi hafta düştü" sorularına ASLA cevap veremez — çünkü geçmiş
 * hiçbir zaman kaydedilmez. Geriye dönük üretilemeyen tek şey budur:
 * bugün yazmazsak o gün sonsuza kadar kayıptır.
 *
 * ── Ölçüm artık DİKEY başına ──
 *
 * Satır kimliği (gün, ortak) değil (gün, ortak, dikey). Casino ve spor
 * bahis geliri ayrı satırlarda duruyor çünkü ayrı oranlarla ödeniyor
 * (bkz. `servisler/dikey.ts`). Dikey vermeyen bağlantıların satırı
 * `bilinmiyor` olarak yazılıyor ve düz orana düşüyor — bugünkü
 * davranış birebir korunuyor.
 *
 * Depolama `depolar/olcumDeposu.ts` içinde: Postgres varsa tablo,
 * yoksa JSON belgesi.
 */

export type {
  OlcumKaynagi,
  OlcumSorgusu,
  OrtakGunlukOlcum,
  YazilacakOlcum,
} from '../depolar/olcumDeposu.js';
import type { OlcumSorgusu, OrtakGunlukOlcum, YazilacakOlcum } from '../depolar/olcumDeposu.js';

/**
 * Ölçümleri yazar. Aynı (gün, ortak, dikey) için tekrar yazmak ÜZERİNE
 * YAZAR.
 *
 * Idempotent olması şart: senkron günde birden çok kez çalışıyor, gün
 * içinde çekilen bir ölçüm gün kapandıktan sonra güncellenmeli.
 * Eklemeli olsaydı her tur rakamları şişirirdi.
 *
 * İTME ÇEKMEYİ EZMEZ. Olay düzeyinde gelen ölçüm, toplam düzeyde
 * çekilenden daha kesin; sonradan çalışan bir çekme turu onu geri
 * götürmemeli.
 */
export async function olcumleriYaz(
  kiraci: string,
  olcumler: YazilacakOlcum[],
  simdi = new Date(),
): Promise<number> {
  if (!olcumler.length) return 0;
  // Dikeysiz gelen satir `bilinmiyor` oluyor: adaptor alani doldurmasa
  // da birincil anahtar eksik kalmasin.
  const normal = olcumler.map((o) => ({ ...o, dikey: dikeyOku(o.dikey) }));
  return olcumDeposu().yaz(kiraci, normal, simdi);
}

export async function olcumleriOku(kiraci: string, sorgu: OlcumSorgusu = {}): Promise<OrtakGunlukOlcum[]> {
  return olcumDeposu().listele(kiraci, sorgu);
}

/** Bir dikeyin dönem içindeki toplamı. */
export interface DikeyOzeti {
  dikey: Dikey;
  gunSayisi: number;
  oyuncuSayisi: number;
  aktifOyuncuSayisi: number;
  yatirim: number;
  cekim: number;
  ggr: number;
  ftdSayisi: number | null;
}

export interface OrtakOzeti {
  ortakAnahtari: string;
  gunSayisi: number;
  oyuncuSayisi: number;
  aktifOyuncuSayisi: number;
  yatirim: number;
  cekim: number;
  ggr: number;
  ftdSayisi: number | null;
  /**
   * Dikey kırılımı. Yalnızca ÖLÇÜMÜ OLAN dikeyler var: spor bahis
   * trafiği getirmeyen bir ortağın özetinde sıfırlı bir spor satırı
   * göstermek, "spor denedi ve kazandırmadı" gibi okunurdu.
   */
  dikeyler: DikeyOzeti[];
  /** Dönem içindeki günlük GGR serisi; panelde eğilim çizmek için. */
  gunlukGgr: Array<{ gun: string; ggr: number }>;
  /** Aynı seri dikey başına; panelde iki katmanlı alan grafiği için. */
  gunlukDikeyGgr: Array<{ gun: string; dikey: Dikey; ggr: number }>;
}

/**
 * Ortak başına dönem özeti.
 *
 * Oyuncu sayıları TOPLANMAZ, en yüksek gün alınır. Günlük ölçümlerdeki
 * oyuncu sayısı bir STOK değeri (o gün kaç oyuncu vardı), akış değeri
 * değil; 30 günü toplamak aynı oyuncuyu 30 kez saymak olurdu. Para
 * alanları akış olduğu için toplanır.
 *
 * ── Dikey kırılımında oyuncu sayısı ──
 *
 * Dikey satırlarındaki `oyuncuSayisi` de en yüksek gün, ama dikeylerin
 * toplamı ortağın toplamına EŞİT DEĞİL ve olmamalı: aynı oyuncu hem
 * casino hem spor oynuyorsa iki satırda da sayılır. Ortak düzeyindeki
 * sayı gün bazında ölçüldüğü için tekilliği korur; dikey satırları
 * "bu dikeyde kaç oyuncu aktifti" sorusuna cevap verir, toplanmak
 * için değil.
 */
export function ozetle(olcumler: OrtakGunlukOlcum[]): OrtakOzeti[] {
  const gruplar = new Map<string, OrtakOzeti>();
  // (ortak|dikey) -> dikey ozeti; ayni Map icinde tutmak ortagin
  // satirini bulmak icin ikinci bir arama gerektirirdi.
  const dikeyGruplari = new Map<string, DikeyOzeti>();
  // Gun basina ortak toplami: ayni gunun iki dikey satiri tek noktaya
  // toplanmali, aksi halde egilim grafiginde ayni gun iki kez cikar.
  const gunToplamlari = new Map<string, number>();

  for (const o of olcumler) {
    const dikey = dikeyOku(o.dikey);

    const mevcut = gruplar.get(o.ortakAnahtari) ?? {
      ortakAnahtari: o.ortakAnahtari,
      gunSayisi: 0,
      oyuncuSayisi: 0,
      aktifOyuncuSayisi: 0,
      yatirim: 0,
      cekim: 0,
      ggr: 0,
      ftdSayisi: null,
      dikeyler: [],
      gunlukGgr: [],
      gunlukDikeyGgr: [],
    };

    mevcut.oyuncuSayisi = Math.max(mevcut.oyuncuSayisi, o.oyuncuSayisi);
    mevcut.aktifOyuncuSayisi = Math.max(mevcut.aktifOyuncuSayisi, o.aktifOyuncuSayisi);
    mevcut.yatirim += o.yatirim;
    mevcut.cekim += o.cekim;
    mevcut.ggr += o.ggr;
    // Hicbir gun olculmediyse `null` kalir -- 0 yazmak "hic ilk yatirim
    // olmadi" demek olurdu, oysa dogrusu "olculmedi".
    if (o.ftdSayisi !== null) mevcut.ftdSayisi = (mevcut.ftdSayisi ?? 0) + o.ftdSayisi;
    mevcut.gunlukDikeyGgr.push({ gun: o.gun, dikey, ggr: o.ggr });

    const gunAnahtari = `${o.ortakAnahtari}|${o.gun}`;
    // gunSayisi ARTIK satir sayisi degil TEKIL GUN sayisi: iki dikeyli
    // bir gun iki satir uretiyor ve eskisi gibi saymak gun sayisini
    // ikiye katlardi.
    if (!gunToplamlari.has(gunAnahtari)) mevcut.gunSayisi += 1;
    gunToplamlari.set(gunAnahtari, (gunToplamlari.get(gunAnahtari) ?? 0) + o.ggr);

    gruplar.set(o.ortakAnahtari, mevcut);

    const dAnahtari = `${o.ortakAnahtari}|${dikey}`;
    const dMevcut = dikeyGruplari.get(dAnahtari) ?? {
      dikey,
      gunSayisi: 0,
      oyuncuSayisi: 0,
      aktifOyuncuSayisi: 0,
      yatirim: 0,
      cekim: 0,
      ggr: 0,
      ftdSayisi: null,
    };
    dMevcut.gunSayisi += 1;
    dMevcut.oyuncuSayisi = Math.max(dMevcut.oyuncuSayisi, o.oyuncuSayisi);
    dMevcut.aktifOyuncuSayisi = Math.max(dMevcut.aktifOyuncuSayisi, o.aktifOyuncuSayisi);
    dMevcut.yatirim += o.yatirim;
    dMevcut.cekim += o.cekim;
    dMevcut.ggr += o.ggr;
    if (o.ftdSayisi !== null) dMevcut.ftdSayisi = (dMevcut.ftdSayisi ?? 0) + o.ftdSayisi;
    dikeyGruplari.set(dAnahtari, dMevcut);
  }

  for (const [anahtar, toplam] of gunToplamlari) {
    const [ortakAnahtari, gun] = anahtar.split('|');
    gruplar.get(ortakAnahtari)?.gunlukGgr.push({ gun, ggr: toplam });
  }

  for (const [anahtar, dikeyOzeti] of dikeyGruplari) {
    const ortakAnahtari = anahtar.slice(0, anahtar.lastIndexOf('|'));
    gruplar.get(ortakAnahtari)?.dikeyler.push(dikeyOzeti);
  }

  for (const ozet of gruplar.values()) {
    ozet.gunlukGgr.sort((a, b) => a.gun.localeCompare(b.gun));
    ozet.gunlukDikeyGgr.sort((a, b) => (a.gun === b.gun
      ? DIKEYLER.indexOf(a.dikey) - DIKEYLER.indexOf(b.dikey)
      : a.gun.localeCompare(b.gun)));
    ozet.dikeyler.sort((a, b) => DIKEYLER.indexOf(a.dikey) - DIKEYLER.indexOf(b.dikey));
  }

  return [...gruplar.values()].sort((a, b) => b.ggr - a.ggr);
}

export async function ortakOzetleri(kiraci: string, sorgu: OlcumSorgusu = {}): Promise<OrtakOzeti[]> {
  return ozetle(await olcumleriOku(kiraci, sorgu));
}

/** Kaydı olan en son gün; senkronun nereden devam edeceğini belirler. */
export async function sonOlculenGun(kiraci: string): Promise<string | null> {
  return olcumDeposu().sonGun(kiraci);
}

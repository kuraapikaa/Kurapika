import { olcumDeposu } from '../depolar/olcumDeposu.js';

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
 * Ölçümleri yazar. Aynı (gün, ortak) için tekrar yazmak ÜZERİNE YAZAR.
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
  return olcumDeposu().yaz(kiraci, olcumler, simdi);
}

export async function olcumleriOku(kiraci: string, sorgu: OlcumSorgusu = {}): Promise<OrtakGunlukOlcum[]> {
  return olcumDeposu().listele(kiraci, sorgu);
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
  /** Dönem içindeki günlük GGR serisi; panelde eğilim çizmek için. */
  gunlukGgr: Array<{ gun: string; ggr: number }>;
}

/**
 * Ortak başına dönem özeti.
 *
 * Oyuncu sayıları TOPLANMAZ, en yüksek gün alınır. Günlük ölçümlerdeki
 * oyuncu sayısı bir STOK değeri (o gün kaç oyuncu vardı), akış değeri
 * değil; 30 günü toplamak aynı oyuncuyu 30 kez saymak olurdu. Para
 * alanları akış olduğu için toplanır.
 */
export function ozetle(olcumler: OrtakGunlukOlcum[]): OrtakOzeti[] {
  const gruplar = new Map<string, OrtakOzeti>();

  for (const o of olcumler) {
    const mevcut = gruplar.get(o.ortakAnahtari) ?? {
      ortakAnahtari: o.ortakAnahtari,
      gunSayisi: 0,
      oyuncuSayisi: 0,
      aktifOyuncuSayisi: 0,
      yatirim: 0,
      cekim: 0,
      ggr: 0,
      ftdSayisi: null,
      gunlukGgr: [],
    };

    mevcut.gunSayisi += 1;
    mevcut.oyuncuSayisi = Math.max(mevcut.oyuncuSayisi, o.oyuncuSayisi);
    mevcut.aktifOyuncuSayisi = Math.max(mevcut.aktifOyuncuSayisi, o.aktifOyuncuSayisi);
    mevcut.yatirim += o.yatirim;
    mevcut.cekim += o.cekim;
    mevcut.ggr += o.ggr;
    // Hicbir gun olculmediyse `null` kalir -- 0 yazmak "hic ilk yatirim
    // olmadi" demek olurdu, oysa dogrusu "olculmedi".
    if (o.ftdSayisi !== null) mevcut.ftdSayisi = (mevcut.ftdSayisi ?? 0) + o.ftdSayisi;
    mevcut.gunlukGgr.push({ gun: o.gun, ggr: o.ggr });

    gruplar.set(o.ortakAnahtari, mevcut);
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

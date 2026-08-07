import { diziOku, kayitOku, oku, yaz } from './depo.js';
import { olcumler as olcumTablosu, tiklamalar as tiklamaTablosu } from './sema.js';
import { kiracilariListele, veritabani } from './veritabani.js';
import type { OrtakGunlukOlcum } from '../depolar/olcumDeposu.js';
import type { Tiklama } from '../depolar/tiklamaDeposu.js';

/**
 * BELGEDEN TABLOYA TAŞIMA — kiracı başına bir kez.
 *
 * Tıklamalar ve ölçümler eskiden `aff_belgeler` içinde birer JSON
 * belgesiydi. Şema değişince kayıtlı veri kendiliğinden taşınmıyor;
 * taşınmazsa panel çalışır ama GEÇMİŞİ BOŞ görünür — mevcut tıklama ve
 * ölçüm geçmişi ekranlardan kaybolurdu.
 *
 * ── Üç ayrı güvenlik ──
 *
 * 1. Taşınan kiracı bir işaretle kaydediliyor; her açılışta 50.000
 *    satır yeniden denenmiyor.
 * 2. Ekleme `ON CONFLICT DO NOTHING`: işaret bir şekilde kaybolsa ve
 *    taşıma tekrar koşsa bile, o sırada yazılmış YENİ veri eski
 *    belgedeki hâliyle geri EZİLMİYOR.
 * 3. Kaynak belgeler SİLİNMİYOR. Taşıma sonrası bir sorun çıkarsa
 *    veri hâlâ duruyor; yer kaybı bu güvenceye değer.
 */

const ISARET_ALANI = 'tasima-durumu';
/** Postgres deyim başına parametre sınırına takılmamak için parçalı ekleme. */
const PARTI = 500;

interface Isaret {
  tiklamalar?: boolean;
  olcumler?: boolean;
}

const cozIsaret = (ham: unknown): Isaret => {
  const kayit = kayitOku(ham);
  return { tiklamalar: kayit.tiklamalar === true, olcumler: kayit.olcumler === true };
};

export interface TasimaSonucu {
  kiraci: string;
  tiklama: number;
  olcum: number;
}

async function* partiler<T>(hepsi: T[]): AsyncGenerator<T[]> {
  for (let i = 0; i < hepsi.length; i += PARTI) yield hepsi.slice(i, i + PARTI);
}

async function tiklamalariTasi(kiraci: string): Promise<number> {
  const vt = veritabani();
  if (!vt) return 0;

  const belge = await oku(kiraci, 'tiklamalar', (ham) => diziOku<Tiklama>(kayitOku(ham).tiklamalar));
  if (!belge.length) return 0;

  let tasinan = 0;
  for await (const parti of partiler(belge)) {
    const satirlar = parti
      // Zamansiz ya da kimliksiz kayit tasinmaz: birincil anahtar
      // olmadan satir yazilamaz, gecersiz zaman ise tum partiyi dusururdu.
      .filter((t) => t.clickId && t.zaman && !Number.isNaN(new Date(t.zaman).getTime()))
      .map((t) => ({
        clickId: t.clickId,
        kiraci,
        ortakAnahtari: t.ortakAnahtari,
        medyaId: t.medyaId ?? null,
        alt: t.alt ?? {},
        ip: t.ip ?? null,
        userAgent: t.userAgent ?? null,
        referrer: t.referrer ?? null,
        zaman: new Date(t.zaman),
      }));
    if (!satirlar.length) continue;
    const eklenen = await vt.insert(tiklamaTablosu).values(satirlar)
      .onConflictDoNothing()
      .returning({ clickId: tiklamaTablosu.clickId });
    tasinan += eklenen.length;
  }
  return tasinan;
}

async function olcumleriTasi(kiraci: string): Promise<number> {
  const vt = veritabani();
  if (!vt) return 0;

  const belge = await oku(kiraci, 'olcumler', (ham) =>
    kayitOku(kayitOku(ham).olcumler) as Record<string, OrtakGunlukOlcum>);
  const kayitlar = Object.values(belge);
  if (!kayitlar.length) return 0;

  let tasinan = 0;
  for await (const parti of partiler(kayitlar)) {
    const satirlar = parti
      .filter((o) => o?.gun && o.ortakAnahtari)
      .map((o) => ({
        kiraci,
        gun: o.gun,
        ortakAnahtari: o.ortakAnahtari,
        oyuncuSayisi: Number(o.oyuncuSayisi) || 0,
        aktifOyuncuSayisi: Number(o.aktifOyuncuSayisi) || 0,
        yatirim: Number(o.yatirim) || 0,
        cekim: Number(o.cekim) || 0,
        ggr: Number(o.ggr) || 0,
        // `null` ile `0` ayri anlamda; `Number(null)` 0 verecegi icin
        // acikca ayirmak gerekiyor.
        ftdSayisi: o.ftdSayisi === null || o.ftdSayisi === undefined ? null : Number(o.ftdSayisi),
        kaynak: o.kaynak === 'itme' ? 'itme' : 'cekme',
        yazildi: o.yazildi && !Number.isNaN(new Date(o.yazildi).getTime()) ? new Date(o.yazildi) : new Date(),
      }));
    if (!satirlar.length) continue;
    const eklenen = await vt.insert(olcumTablosu).values(satirlar)
      .onConflictDoNothing()
      .returning({ gun: olcumTablosu.gun });
    tasinan += eklenen.length;
  }
  return tasinan;
}

/**
 * Taşınmamış her kiracıyı taşır. Veritabanı yoksa hiçbir şey yapmaz —
 * belge modeli zaten çalışmaya devam ediyor.
 */
export async function belgeleriTablolaraTasi(): Promise<TasimaSonucu[]> {
  if (!veritabani()) return [];

  const sonuclar: TasimaSonucu[] = [];
  for (const kiraci of await kiracilariListele()) {
    const isaret = await oku(kiraci, ISARET_ALANI, cozIsaret);
    if (isaret.tiklamalar && isaret.olcumler) continue;

    const tiklama = isaret.tiklamalar ? 0 : await tiklamalariTasi(kiraci);
    const olcum = isaret.olcumler ? 0 : await olcumleriTasi(kiraci);

    await yaz(kiraci, ISARET_ALANI, { tiklamalar: true, olcumler: true });
    if (tiklama || olcum) sonuclar.push({ kiraci, tiklama, olcum });
  }
  return sonuclar;
}

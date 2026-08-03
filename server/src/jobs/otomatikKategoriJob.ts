/**
 * Otomatik oyuncu kategorileme isi.
 *
 * Oneriler `services/oyuncuKategorileme` icinde ve testli. Bu is akisi
 * onerileri periyodik olarak uretir ve BEKLETME SEBEBI OLMAYANLARI
 * uygular.
 *
 * ── Neden yazma varsayilan olarak kapali ──────────────────────────────
 *
 * Kategori YAZMA ucunu henuz gozlemleyemedim: elimde yalnizca kategori
 * LISTELEME yaniti var. `lynonKategoriUygula` uc aday yol/govde deniyor
 * ama hicbiri dogrulanmis degil. Dogrulanmamis bir yazma yolunu her
 * dakika calisan bir ise varsayilan olarak baglamak, en iyi ihtimalle
 * gurultu uretir.
 *
 * Bu yuzden:
 *   • Oneriler HER ZAMAN uretilir ve panelde gorunur.
 *   • Yazma yalnizca `OTOMATIK_KATEGORI=1` ile acilir.
 *
 * Panelin ag sekmesinden bir kategori degistirme istegi alindiginda
 * `kategoriGovdeleri` tek satirda kesinlestirilir ve varsayilan
 * acilabilir.
 */
import { audit } from '../lib/auditLog.js';
import { lynonKategoriOnerileri, lynonKategoriUygula } from '../services/lynonBackofficeService.js';
import type { KategoriOnerisi } from '../services/oyuncuKategorileme.js';

export type OtomatikKategoriSonucu = {
  atlandi?: string;
  oneri: number;
  uygulanabilir: number;
  uygulanan: number;
  hata: number;
};

/** Tek turda en fazla kac yazma yapilir. */
const TUR_LIMITI = Number(process.env.OTOMATIK_KATEGORI_TUR_LIMITI) || 25;

export function yazmaAcikMi(): boolean {
  return process.env.OTOMATIK_KATEGORI === '1';
}

export async function runOtomatikKategoriJob(): Promise<OtomatikKategoriSonucu> {
  const yanit = await lynonKategoriOnerileri({ MaxRows: 500 });
  const oneriler: KategoriOnerisi[] = yanit?.Data?.Oneriler ?? [];
  const uygulanabilir = oneriler.filter((oneri) => !oneri.bekletme);

  const sonuc: OtomatikKategoriSonucu = {
    oneri: oneriler.length,
    uygulanabilir: uygulanabilir.length,
    uygulanan: 0,
    hata: 0,
  };

  if (!yazmaAcikMi()) {
    return { ...sonuc, atlandi: 'Yazma kapalı (OTOMATIK_KATEGORI=1 ile açılır); öneriler panelde.' };
  }

  for (const oneri of uygulanabilir.slice(0, TUR_LIMITI)) {
    try {
      await lynonKategoriUygula(oneri.playerId, oneri.hedefKategoriId);
      sonuc.uygulanan += 1;
      audit('sistem', 'job', 'manual_adjustment', `player:${oneri.playerId}`,
        `Kategori otomatik güncellendi: ${oneri.hedefKategoriAdi} (#${oneri.hedefKategoriId}). ${oneri.gerekce}`);
    } catch (err) {
      sonuc.hata += 1;
      console.error(`[otomatik-kategori] ${oneri.playerId}:`, err instanceof Error ? err.message : err);
    }
  }

  return sonuc;
}

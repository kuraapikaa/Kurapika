import {
  eslesmeDeposu,
  yeniCakismaId,
  type EslesmeCakismasi,
  type EslesmeKaynagi,
  type OyuncuEslesmesi,
} from '../depolar/eslesmeDeposu.js';
import { onayliMi, ortakAnahtarindanBul, type Ortak } from './ortaklar.js';
import { tiklamaBul } from './tiklama.js';

/**
 * OYUNCU ↔ ORTAK EŞLEŞMESİ.
 *
 * Oyuncu ortağın referans linkinden geliyor, site onu Lynon'a kaydediyor,
 * Lynon oyuncu kimliğini döndürüyor. Bu servis o kimliği getiren ortağa
 * bağlıyor. Hakedişin dayanağı bu bağ: bağ yoksa ortak oyuncuyu getirdiğini
 * kanıtlayamaz, yanlışsa parayı yanlış kişi alır.
 *
 * ── İLK KAYIT KAZANIR ──
 *
 * Bir oyuncu ZATEN bir ortağa aitse, sonradan gelen istek onu DEVRALAMAZ.
 * Kural veritabanı kısıtında yaşıyor (bkz. `sema.ts`), burada değil;
 * buradaki iş, sonucu doğru YORUMLAMAK:
 *
 *   - hiç kayıt yoktu           → oluşturuldu
 *   - kayıt vardı, AYNI ortak   → sorun yok, tekrar gelmiş bir bildirim
 *   - kayıt vardı, BAŞKA ortak  → reddedildi ve çakışma olarak yazıldı
 *
 * Ortadaki durumu ayırmak şart: S2S bildirimleri yeniden denenir. Aynı
 * ortağın aynı oyuncuyu tekrar bildirmesini "çakışma" saymak, her ağ
 * hatasını sahtecilik şüphesine çevirirdi.
 */

export class EslesmeHatasi extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'EslesmeHatasi';
  }
}

export type EslesmeDurumu = 'olusturuldu' | 'zaten-ayni-ortak' | 'baska-ortaga-ait';

export interface EslesmeIstegi {
  /** Lynon'un döndürdüğü oyuncu kimliği. */
  lynonOyuncuId: string;
  /**
   * Referans kodu: tıklama kimliği (`clickid`) ya da ortak anahtarı.
   *
   * İkisi de kabul ediliyor çünkü entegrasyonun hangisini taşıyabildiği
   * siteye göre değişiyor. `clickid` varsa tercih edilir: hangi medya ve
   * hangi alt kanaldan gelindiği yalnızca onda var.
   */
  ref: string;
  kaynak?: EslesmeKaynagi;
}

export interface EslesmeSonucu {
  durum: EslesmeDurumu;
  /** Yürürlükteki eşleşme. Reddedilen durumda MEVCUT sahibi gösterir. */
  eslesme: OyuncuEslesmesi;
}

const metin = (deger: unknown): string => (typeof deger === 'string' ? deger.trim() : '');

interface CozulmusRef {
  ortak: Ortak;
  ortakAnahtari: string;
  clickId: string | null;
  medyaId: string | null;
  alt: OyuncuEslesmesi['alt'];
}

/**
 * Ref kodunu ortağa çevirir.
 *
 * Önce tıklama kimliği olarak deneniyor. Tıklama bulunursa ortak bilgisi
 * ORADAN alınıyor; isteğin taşıdığı ortak anahtarına güvenilmiyor, çünkü
 * tıklama sunucunun kendi kaydı, istek ise dışarıdan geliyor.
 */
async function refCoz(kiraci: string, ref: string): Promise<CozulmusRef> {
  const temiz = metin(ref);
  if (!temiz) throw new EslesmeHatasi('ref zorunlu (tıklama kimliği ya da ortak anahtarı).');

  const tiklama = await tiklamaBul(kiraci, temiz);
  const ortakAnahtari = tiklama ? tiklama.ortakAnahtari : temiz;

  const ortak = await ortakAnahtarindanBul(kiraci, ortakAnahtari);
  if (!ortak) throw new EslesmeHatasi(`Ref karşılığı ortak bulunamadı: ${ortakAnahtari}`, 404);

  // Onaysiz ortaga oyuncu baglamak, sonradan "bu trafigin odemesini
  // yapmiyoruz" demeyi imkansiz kilardi; tiklama ucu da ayni kurali
  // uyguluyor.
  if (!onayliMi(ortak)) {
    throw new EslesmeHatasi('Ortak onaylı değil; oyuncu eşleştirilemez.', 403);
  }

  return {
    ortak,
    ortakAnahtari,
    clickId: tiklama ? tiklama.clickId : null,
    medyaId: tiklama ? tiklama.medyaId : null,
    alt: tiklama ? tiklama.alt : {},
  };
}

export async function oyuncuyuEslestir(
  kiraci: string,
  istek: EslesmeIstegi,
  simdi = new Date(),
): Promise<EslesmeSonucu> {
  const lynonOyuncuId = metin(istek.lynonOyuncuId);
  if (!lynonOyuncuId) throw new EslesmeHatasi('lynonOyuncuId zorunlu.');

  const cozulmus = await refCoz(kiraci, istek.ref);
  const depo = eslesmeDeposu();

  const aday: OyuncuEslesmesi = {
    lynonOyuncuId,
    ortakId: cozulmus.ortak.id,
    ortakAnahtari: cozulmus.ortakAnahtari,
    clickId: cozulmus.clickId,
    medyaId: cozulmus.medyaId,
    alt: cozulmus.alt,
    kaynak: istek.kaynak === 'elle' ? 'elle' : 'kayit',
    olusturuldu: simdi.toISOString(),
  };

  const { eklendi, kayitli } = await depo.ekleYokSayarak(kiraci, aday);
  if (eklendi) return { durum: 'olusturuldu', eslesme: kayitli };

  if (kayitli.ortakId === aday.ortakId) {
    // Ayni ortak tekrar bildirdi: yeniden denenen bir S2S cagrisi.
    return { durum: 'zaten-ayni-ortak', eslesme: kayitli };
  }

  const cakisma: EslesmeCakismasi = {
    id: yeniCakismaId(),
    lynonOyuncuId,
    denenenOrtakId: aday.ortakId,
    denenenOrtakAnahtari: aday.ortakAnahtari,
    mevcutOrtakId: kayitli.ortakId,
    zaman: simdi.toISOString(),
  };
  // Cakismayi yazamamak, esleşmeyi reddetmeyi engellememeli: kural zaten
  // uygulandi, burasi yalnizca kayit tutuyor.
  await depo.cakismaYaz(kiraci, cakisma).catch(() => undefined);

  return { durum: 'baska-ortaga-ait', eslesme: kayitli };
}

export async function eslesmeBul(kiraci: string, lynonOyuncuId: string): Promise<OyuncuEslesmesi | null> {
  const temiz = metin(lynonOyuncuId);
  if (!temiz) return null;
  return eslesmeDeposu().bul(kiraci, temiz);
}

export async function eslesmeleriListele(
  kiraci: string,
  sorgu: { ortakId?: string; limit?: number } = {},
): Promise<OyuncuEslesmesi[]> {
  return eslesmeDeposu().listele(kiraci, sorgu);
}

export async function cakismalariListele(kiraci: string, limit = 200): Promise<EslesmeCakismasi[]> {
  return eslesmeDeposu().cakismalariListele(kiraci, limit);
}

export type { EslesmeCakismasi, EslesmeKaynagi, OyuncuEslesmesi };

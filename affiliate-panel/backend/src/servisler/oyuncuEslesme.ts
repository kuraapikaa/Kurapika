import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import {
  eslesmeDeposu,
  yeniCakismaId,
  type EslesmeCakismasi,
  type EslesmeKaynagi,
  type GunlukEslesmeSorgusu,
  type GunlukSayi,
  type OyuncuEslesmesi,
} from '../depolar/eslesmeDeposu.js';
import { oyuncuEslesmeleri, oyuncuGunluk } from '../lib/sema.js';
import { veritabani } from '../lib/veritabani.js';
import { olcumleriYaz } from './olcum.js';
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
  /** Sitenin bildirimde verdiği kullanıcı adı; varsa. */
  kullaniciAdi?: string;
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
  altLinkId: string | null;
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
    altLinkId: tiklama ? tiklama.altLinkId : null,
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
    altLinkId: cozulmus.altLinkId,
    kullaniciAdi: metin(istek.kullaniciAdi) || null,
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

export type YenidenAtamaDurumu = 'olusturuldu' | 'tasindi' | 'zaten-bu-ortakta';

export interface YenidenAtamaSonucu {
  durum: YenidenAtamaDurumu;
  eslesme: OyuncuEslesmesi;
  /** Yalnızca `tasindi` durumunda dolu: geçiş öncesi sahip. */
  oncekiOrtakId: string | null;
}

/**
 * ADMIN GEÇERSİZ KILMASI — `oyuncuyuEslestir`'den bilerek AYRI.
 *
 * `oyuncuyuEslestir`, doğrulanmamış S2S bildirimleri için: "ilk kayıt
 * kazanır" kuralı orada sahtekarlığa karşı bir siper. Bu fonksiyon ise
 * PANELDEN, kimliği doğrulanmış bir admin eylemi için — admin ground
 * truth'u düzeltiyor ("bu oyuncular aslında X ortağına ait", "Y ortağı
 * kapandı, oyuncuları Z'ye devrediyoruz"). O yüzden üzerine YAZMASI
 * doğru davranış; siper burada anlamsız olurdu.
 *
 * Ref her zaman doğrudan ORTAK ANAHTARI (tıklama kimliği değil): toplu
 * geçişte elde tıklama geçmişi yok, yalnızca kullanıcı adı ve hedef
 * ortak var.
 */
export async function oyuncuyuYenidenAta(
  kiraci: string,
  girdi: { lynonOyuncuId: string; ortakAnahtari: string; kullaniciAdi?: string },
  simdi = new Date(),
): Promise<YenidenAtamaSonucu> {
  const lynonOyuncuId = metin(girdi.lynonOyuncuId);
  if (!lynonOyuncuId) throw new EslesmeHatasi('lynonOyuncuId zorunlu.');

  const ortakAnahtari = metin(girdi.ortakAnahtari);
  const ortak = await ortakAnahtarindanBul(kiraci, ortakAnahtari);
  if (!ortak) throw new EslesmeHatasi(`Ref karşılığı ortak bulunamadı: ${ortakAnahtari}`, 404);
  if (!onayliMi(ortak)) {
    throw new EslesmeHatasi('Ortak onaylı değil; oyuncu eşleştirilemez.', 403);
  }

  // Cagiran kullanici adini bilmiyorsa (ornegin admin formundan tekil
  // duzeltme), mevcut kayittaki adi SILMIYORUZ -- zorlaAta diger baglam
  // alanlarini (medyaId, clickId...) bilerek sifirliyor ama kullanici adi
  // baska bir yoldan (S2S bildirimi, toplu gecis) zaten ogrenilmis olabilir.
  const mevcut = await eslesmeDeposu().bul(kiraci, lynonOyuncuId);
  const kullaniciAdi = metin(girdi.kullaniciAdi) || mevcut?.kullaniciAdi || null;

  const aday: OyuncuEslesmesi = {
    lynonOyuncuId,
    ortakId: ortak.id,
    ortakAnahtari,
    clickId: null,
    medyaId: null,
    altLinkId: null,
    kullaniciAdi,
    alt: {},
    kaynak: 'elle',
    olusturuldu: simdi.toISOString(),
  };

  const { oncekiKayit } = await eslesmeDeposu().zorlaAta(kiraci, aday);

  if (!oncekiKayit) return { durum: 'olusturuldu', eslesme: aday, oncekiOrtakId: null };
  if (oncekiKayit.ortakId === ortak.id) return { durum: 'zaten-bu-ortakta', eslesme: aday, oncekiOrtakId: null };
  return { durum: 'tasindi', eslesme: aday, oncekiOrtakId: oncekiKayit.ortakId };
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

/** Gün başına yeni kayıt sayısı; müşteri yolculuğu grafiğinin "kayıt" basamağı. */
export async function eslesmeGunlukSayilar(
  kiraci: string,
  sorgu: GunlukEslesmeSorgusu = {},
): Promise<GunlukSayi[]> {
  return eslesmeDeposu().gunlukSayilar(kiraci, sorgu);
}

export interface AltLinkFinansOzeti {
  altLinkId: string;
  oyuncuSayisi: number;
  yatirim: number;
  cekim: number;
}

/**
 * Alt link başına toplam yatırım/çekim.
 *
 * `oyuncuEslesmeleri.altLinkId` hangi oyuncunun hangi linkten geldiğini
 * söylüyor; `oyuncuGunluk` webhook olaylarından katlanan gerçek tutarları
 * tutuyor (bkz. `isler/olayIsleyici.ts`). İkisini oyuncu kimliğinden
 * birleştirmek alt link bazlı rakamı veriyor.
 *
 * Webhook borusu Postgres'e özel (bkz. `depolar/olayKuyrugu.ts`); veritabanı
 * yoksa rakam UYDURULMUYOR, boş dönüyor.
 */
export async function altLinkFinansOzeti(kiraci: string, ortakId?: string): Promise<AltLinkFinansOzeti[]> {
  const vt = veritabani();
  if (!vt) return [];

  const kosullar = [eq(oyuncuEslesmeleri.kiraci, kiraci), isNotNull(oyuncuEslesmeleri.altLinkId)];
  if (ortakId) kosullar.push(eq(oyuncuEslesmeleri.ortakId, ortakId));

  const satirlar = await vt
    .select({
      altLinkId: oyuncuEslesmeleri.altLinkId,
      // `oyuncuGunluk` gun basina bir satir tutuyor; JOIN oyuncu basina
      // birden cok satira genisliyor, bu yuzden DISTINCT sart -- yoksa
      // oyuncu sayisi gun sayisi kadar sisirdi.
      oyuncuSayisi: sql<number>`count(distinct ${oyuncuEslesmeleri.lynonOyuncuId})::int`,
      yatirim: sql<number>`coalesce(sum(${oyuncuGunluk.yatirim}), 0)`,
      cekim: sql<number>`coalesce(sum(${oyuncuGunluk.cekim}), 0)`,
    })
    .from(oyuncuEslesmeleri)
    .leftJoin(oyuncuGunluk, and(
      eq(oyuncuGunluk.kiraci, oyuncuEslesmeleri.kiraci),
      eq(oyuncuGunluk.oyuncuId, oyuncuEslesmeleri.lynonOyuncuId),
    ))
    .where(and(...kosullar))
    .groupBy(oyuncuEslesmeleri.altLinkId);

  return satirlar
    // `altLinkId IS NOT NULL` kosuluyla suzuldugu icin hep dolu; tur
    // daraltmasi yalnizca TypeScript'in bunu bilmesi icin.
    .filter((s): s is typeof s & { altLinkId: string } => s.altLinkId !== null)
    .map((s) => ({
      altLinkId: s.altLinkId,
      oyuncuSayisi: Number(s.oyuncuSayisi),
      yatirim: Number(s.yatirim),
      cekim: Number(s.cekim),
    }));
}

export interface AltLinkOyuncusu {
  lynonOyuncuId: string;
  /** Backoffice kullanıcı adı; bilinmiyorsa `null` — çağıran taraf o zaman ID'yi gösterir. */
  kullaniciAdi: string | null;
  yatirim: number;
  cekim: number;
  olusturuldu: string;
}

/**
 * Bir alt linkten kayıt olan oyuncuların listesi.
 *
 * "Kaç tıklama" `altLinkOzeti`de var; bu, ondan bir adım ötesi — GERÇEKTEN
 * kayıt olup eşleşen oyuncuları TEK TEK gösteriyor. Ortak "linkim
 * çalıştı mı" sorusunu artık sadece tıklama sayısıyla değil, hangi
 * kullanıcı adının kayıt olduğuyla cevaplayabiliyor.
 */
export async function altLinkOyuncuListesi(kiraci: string, altLinkId: string): Promise<AltLinkOyuncusu[]> {
  const vt = veritabani();
  if (!vt) return [];

  const satirlar = await vt
    .select({
      lynonOyuncuId: oyuncuEslesmeleri.lynonOyuncuId,
      kullaniciAdi: oyuncuEslesmeleri.kullaniciAdi,
      olusturuldu: oyuncuEslesmeleri.olusturuldu,
      yatirim: sql<number>`coalesce(sum(${oyuncuGunluk.yatirim}), 0)`,
      cekim: sql<number>`coalesce(sum(${oyuncuGunluk.cekim}), 0)`,
    })
    .from(oyuncuEslesmeleri)
    .leftJoin(oyuncuGunluk, and(
      eq(oyuncuGunluk.kiraci, oyuncuEslesmeleri.kiraci),
      eq(oyuncuGunluk.oyuncuId, oyuncuEslesmeleri.lynonOyuncuId),
    ))
    .where(and(eq(oyuncuEslesmeleri.kiraci, kiraci), eq(oyuncuEslesmeleri.altLinkId, altLinkId)))
    .groupBy(oyuncuEslesmeleri.lynonOyuncuId, oyuncuEslesmeleri.kullaniciAdi, oyuncuEslesmeleri.olusturuldu)
    .orderBy(desc(oyuncuEslesmeleri.olusturuldu));

  return satirlar.map((s) => ({
    lynonOyuncuId: s.lynonOyuncuId,
    kullaniciAdi: s.kullaniciAdi,
    yatirim: Number(s.yatirim),
    cekim: Number(s.cekim),
    olusturuldu: s.olusturuldu.toISOString(),
  }));
}

export interface OrtakGunlukGelirSonucu {
  yazildiMi: boolean;
  yatirim: number;
  cekim: number;
}

/**
 * Bir günün, bir ortağa ait webhook kaynaklı gelirini hesaplayıp
 * `olcumler`e yazar — Lynon'un günlük RAPORUNA hiç ihtiyaç duymadan.
 *
 * ── Neden gerekli ──
 *
 * `olcumler` şimdiye kadar YALNIZCA Lynon'un backoffice raporundan
 * (`kaynak: 'cekme'`) besleniyordu. O rapor, oyuncuyu ancak Lynon'un
 * KENDİ third-party affiliate kaydından geçmişse bir ortağa bağlıyor —
 * panel bu kayda hiç katılmıyor, dolayısıyla panelin ürettiği HİÇBİR
 * trafik o raporda görünmüyor ve GGR/Yatırım/Çekim boş kalıyor.
 *
 * `oyuncu_gunluk` (webhook'tan) ile `oyuncu_eslesmeleri` (panelin kendi
 * atıf kaydı) birleşimi, Lynon'un BTag'ine hiç bakmadan aynı rakamı
 * üretiyor. Bunu `kaynak: 'itme'` ile yazmak, `olcumDeposu`daki mevcut
 * "itme çekmeyi ezmez" kuralını (bkz. `depolar/olcumDeposu.ts`) —
 * kod zaten vardı, hiçbir çağıran yoktu — devreye sokuyor.
 *
 * ── FTD bilerek `null` ──
 *
 * İlk yatırım defteri (`ilkYatirim.ts`) yalnızca Lynon senkron yolundan
 * besleniyor; onu buradan da beslemek aynı günü iki kez işleyip defteri
 * bozabilir. Bu yol FTD'yi ölçmüyor, "null" bırakıyor — yanlış saymaktan
 * iyi.
 */
export async function ortakGunlukGeliriGuncelle(
  kiraci: string,
  gun: string,
  ortakId: string,
  ortakAnahtari: string,
  simdi = new Date(),
): Promise<OrtakGunlukGelirSonucu> {
  const vt = veritabani();
  if (!vt) return { yazildiMi: false, yatirim: 0, cekim: 0 };

  const satirlar = await vt
    .select({
      oyuncuSayisi: sql<number>`count(distinct ${oyuncuEslesmeleri.lynonOyuncuId})::int`,
      aktifOyuncuSayisi: sql<number>`count(distinct case
        when ${oyuncuGunluk.yatirim} > 0 or ${oyuncuGunluk.cekim} > 0
          or ${oyuncuGunluk.bahis} > 0 or ${oyuncuGunluk.kazanc} > 0
        then ${oyuncuEslesmeleri.lynonOyuncuId}
      end)::int`,
      yatirim: sql<number>`coalesce(sum(${oyuncuGunluk.yatirim}), 0)`,
      cekim: sql<number>`coalesce(sum(${oyuncuGunluk.cekim}), 0)`,
      bahis: sql<number>`coalesce(sum(${oyuncuGunluk.bahis}), 0)`,
      kazanc: sql<number>`coalesce(sum(${oyuncuGunluk.kazanc}), 0)`,
    })
    .from(oyuncuEslesmeleri)
    .innerJoin(oyuncuGunluk, and(
      eq(oyuncuGunluk.kiraci, oyuncuEslesmeleri.kiraci),
      eq(oyuncuGunluk.oyuncuId, oyuncuEslesmeleri.lynonOyuncuId),
      eq(oyuncuGunluk.gun, gun),
    ))
    .where(and(eq(oyuncuEslesmeleri.kiraci, kiraci), eq(oyuncuEslesmeleri.ortakId, ortakId)));

  const s = satirlar[0];
  // O ortagin o gun hic olayi yoksa yazacak bir sey yok; bos satir
  // yazmak "o gun olculdu ama sifirdi" ile "hic bakilmadi" ayrimini
  // kaybettirirdi.
  if (!s || s.oyuncuSayisi === 0) return { yazildiMi: false, yatirim: 0, cekim: 0 };

  const yatirim = Number(s.yatirim);
  const cekim = Number(s.cekim);
  const ggr = Number(s.bahis) - Number(s.kazanc);

  const yazilan = await olcumleriYaz(kiraci, [{
    gun,
    ortakAnahtari,
    oyuncuSayisi: Number(s.oyuncuSayisi),
    aktifOyuncuSayisi: Number(s.aktifOyuncuSayisi),
    yatirim,
    cekim,
    ggr,
    ftdSayisi: null,
    kaynak: 'itme',
  }], simdi);

  return { yazildiMi: yazilan > 0, yatirim, cekim };
}

export type { EslesmeCakismasi, EslesmeKaynagi, GunlukSayi, OyuncuEslesmesi };

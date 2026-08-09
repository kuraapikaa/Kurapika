import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import {
  eslesmeDeposu,
  yeniCakismaId,
  VARSAYILAN_BAGLANTI_ID,
  type EslesmeCakismasi,
  type EslesmeKaynagi,
  type GunlukEslesmeSorgusu,
  type GunlukSayi,
  type OyuncuEslesmesi,
} from '../depolar/eslesmeDeposu.js';
import { oyuncuEslesmeleri, oyuncuGunluk, oyuncuGunlukRapor } from '../lib/sema.js';
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
    // S2S bildirimi hangi Lynon sitesinden geldigini hic soylemiyor (tek
    // paylasilan anahtar, baglanti basina degil) -- bkz. `sema.ts`.
    baglantiId: VARSAYILAN_BAGLANTI_ID,
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
    // Bu yol S2S bildirimi: site kayit aninda cagiriyor, `olusturuldu`
    // zaten Lynon kayit anina cok yakin -- ayrica bir Lynon aramasi
    // gerekmiyor.
    kayitTarihi: null,
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
  girdi: {
    lynonOyuncuId: string;
    ortakAnahtari: string;
    kullaniciAdi?: string;
    kayitTarihi?: string | null;
    /** Hangi Lynon bağlantısından/sitesinden geldiği; bkz. `sema.ts`. */
    baglantiId: string;
  },
  simdi = new Date(),
): Promise<YenidenAtamaSonucu> {
  const lynonOyuncuId = metin(girdi.lynonOyuncuId);
  if (!lynonOyuncuId) throw new EslesmeHatasi('lynonOyuncuId zorunlu.');

  const baglantiId = metin(girdi.baglantiId) || VARSAYILAN_BAGLANTI_ID;

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
  // kayitTarihi de ayni mantikla korunuyor: caginan taraf bu turda Lynon'dan
  // bulamadiysa (adaptor desteklemiyor, alan bos donduyor...) daha once
  // ogrenilmis olan tarihi SILMIYORUZ. Arama AYNI baglantiId'de: baska bir
  // sitede ayni numarali ID varsa o BASKA bir oyuncu, bu satirla ilgisi yok.
  const mevcut = await eslesmeDeposu().bul(kiraci, lynonOyuncuId, baglantiId);
  const kullaniciAdi = metin(girdi.kullaniciAdi) || mevcut?.kullaniciAdi || null;
  const kayitTarihi = girdi.kayitTarihi ?? mevcut?.kayitTarihi ?? null;

  const aday: OyuncuEslesmesi = {
    baglantiId,
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
    kayitTarihi,
  };

  const { oncekiKayit } = await eslesmeDeposu().zorlaAta(kiraci, aday);

  if (!oncekiKayit) return { durum: 'olusturuldu', eslesme: aday, oncekiOrtakId: null };
  if (oncekiKayit.ortakId === ortak.id) return { durum: 'zaten-bu-ortakta', eslesme: aday, oncekiOrtakId: null };
  return { durum: 'tasindi', eslesme: aday, oncekiOrtakId: oncekiKayit.ortakId };
}

export async function eslesmeBul(
  kiraci: string, lynonOyuncuId: string, baglantiId?: string,
): Promise<OyuncuEslesmesi | null> {
  const temiz = metin(lynonOyuncuId);
  if (!temiz) return null;
  return eslesmeDeposu().bul(kiraci, temiz, baglantiId);
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

interface OyuncuFinans {
  yatirim: number;
  cekim: number;
}

/** `oyuncuFinansHaritasi`'nin döndürdüğü haritanın anahtarı; bkz. orada. */
const finansAnahtari = (baglantiId: string, lynonOyuncuId: string): string => `${baglantiId}::${lynonOyuncuId}`;

/**
 * Oyuncu başına yatırım/çekim — İKİ kaynağı birleştirir, BAĞLANTI bazında.
 *
 * `oyuncuGunluk` webhook olaylarından katlanır (bkz. `isler/olayIsleyici.ts`);
 * `oyuncuGunlukRapor` Lynon'un backoffice raporundan (bkz. `gecmisGGR.ts`)
 * gün bazında KESİNLEŞMİŞ rakamlarla dolar. Webhook hiç kurulmamış bir
 * tenant'ta ilki hep boş kalır -- rapor bunun için var.
 *
 * `lynonOyuncuId` yalnızca TEK bir Lynon sitesi içinde benzersiz (bkz.
 * `sema.ts`), bu yüzden dönen harita `baglantiId` ile birlikte
 * anahtarlanıyor -- yoksa iki farklı sitedeki aynı numaralı ID'ye sahip
 * iki FARKLI oyuncunun rakamları toplanır/karışırdı. Webhook'un kendisi
 * siteyi bilmiyor (tek paylaşılan sır), bu yüzden yalnızca `'varsayilan'`
 * bağlantılı satırlar için anlamlı -- diğer bağlantılar yalnızca rapordan
 * besleniyor.
 *
 * İkisi AYRI sorgularla toplanıp burada birleştiriliyor, TEK sorguda iki
 * kez JOIN edilmiyor: `oyuncuGunluk` ve `oyuncuGunlukRapor` ikisi de
 * oyuncu başına birden çok (gün) satırı taşıyor, aynı sorguda ikisine
 * birden JOIN etmek çapraz çarpım üretip toplamları yanlış şişirirdi.
 *
 * Aynı oyuncu için iki kaynak da veri biriktirmişse (webhook kurulmuş VE
 * rapor da çalıştırılmışsa) TOPLANMAZ, büyük olan esas alınır -- ikisi
 * aynı gerçek olayları anlatıyor, toplamak mükerrer sayardı.
 */
async function oyuncuFinansHaritasi(
  vt: NonNullable<ReturnType<typeof veritabani>>,
  kiraci: string,
  satirlar: Array<{ lynonOyuncuId: string; baglantiId: string }>,
): Promise<Map<string, OyuncuFinans>> {
  if (satirlar.length === 0) return new Map();

  const varsayilanIdler = [...new Set(
    satirlar.filter((s) => s.baglantiId === VARSAYILAN_BAGLANTI_ID).map((s) => s.lynonOyuncuId),
  )];
  // Cogu kiracida tek baglanti var; bu, pratikte hep TEK gruba (dolayisiyla
  // tek rapor sorgusuna) daraliyor -- baglanti basina ayri sorgu yalnizca
  // gercekten coklu-site kullanan kiracida coguluyor.
  const baglantiBazindaIdler = new Map<string, Set<string>>();
  for (const s of satirlar) {
    const set = baglantiBazindaIdler.get(s.baglantiId) ?? new Set<string>();
    set.add(s.lynonOyuncuId);
    baglantiBazindaIdler.set(s.baglantiId, set);
  }

  const [webhookSatirlari, raporSatirGruplari] = await Promise.all([
    varsayilanIdler.length === 0 ? [] : vt.select({
      oyuncuId: oyuncuGunluk.oyuncuId,
      yatirim: sql<number>`coalesce(sum(${oyuncuGunluk.yatirim}), 0)`,
      cekim: sql<number>`coalesce(sum(${oyuncuGunluk.cekim}), 0)`,
    })
      .from(oyuncuGunluk)
      .where(and(eq(oyuncuGunluk.kiraci, kiraci), inArray(oyuncuGunluk.oyuncuId, varsayilanIdler)))
      .groupBy(oyuncuGunluk.oyuncuId),
    Promise.all([...baglantiBazindaIdler.entries()].map(async ([baglantiId, idler]) => {
      const satirlar = await vt.select({
        oyuncuId: oyuncuGunlukRapor.oyuncuId,
        yatirim: sql<number>`coalesce(sum(${oyuncuGunlukRapor.yatirim}), 0)`,
        cekim: sql<number>`coalesce(sum(${oyuncuGunlukRapor.cekim}), 0)`,
      })
        .from(oyuncuGunlukRapor)
        .where(and(
          eq(oyuncuGunlukRapor.kiraci, kiraci),
          eq(oyuncuGunlukRapor.baglantiId, baglantiId),
          inArray(oyuncuGunlukRapor.oyuncuId, [...idler]),
        ))
        .groupBy(oyuncuGunlukRapor.oyuncuId);
      return satirlar.map((s) => ({ ...s, baglantiId }));
    })),
  ]);

  const harita = new Map<string, OyuncuFinans>();
  for (const s of webhookSatirlari) {
    harita.set(finansAnahtari(VARSAYILAN_BAGLANTI_ID, s.oyuncuId), { yatirim: Number(s.yatirim), cekim: Number(s.cekim) });
  }
  for (const grup of raporSatirGruplari) {
    for (const s of grup) {
      const anahtar = finansAnahtari(s.baglantiId, s.oyuncuId);
      const mevcut = harita.get(anahtar);
      harita.set(anahtar, {
        yatirim: Math.max(mevcut?.yatirim ?? 0, Number(s.yatirim)),
        cekim: Math.max(mevcut?.cekim ?? 0, Number(s.cekim)),
      });
    }
  }
  return harita;
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
 * söylüyor; oyuncu başına gerçek tutar `oyuncuFinansHaritasi`den geliyor
 * (webhook + rapor, bkz. orada). Veritabanı yoksa rakam UYDURULMUYOR,
 * boş dönüyor.
 */
export async function altLinkFinansOzeti(kiraci: string, ortakId?: string): Promise<AltLinkFinansOzeti[]> {
  const vt = veritabani();
  if (!vt) return [];

  const kosullar = [eq(oyuncuEslesmeleri.kiraci, kiraci), isNotNull(oyuncuEslesmeleri.altLinkId)];
  if (ortakId) kosullar.push(eq(oyuncuEslesmeleri.ortakId, ortakId));

  const satirlar = await vt
    .select({
      altLinkId: oyuncuEslesmeleri.altLinkId,
      lynonOyuncuId: oyuncuEslesmeleri.lynonOyuncuId,
      baglantiId: oyuncuEslesmeleri.baglantiId,
    })
    .from(oyuncuEslesmeleri)
    .where(and(...kosullar));

  const finansHaritasi = await oyuncuFinansHaritasi(vt, kiraci, satirlar);

  const gruplar = new Map<string, { oyuncular: Set<string>; yatirim: number; cekim: number }>();
  for (const s of satirlar) {
    // `isNotNull(altLinkId)` kosuluyla suzuldugu icin hep dolu; tur
    // daraltmasi yalnizca TypeScript'in bunu bilmesi icin.
    if (s.altLinkId === null) continue;
    const anahtar = finansAnahtari(s.baglantiId, s.lynonOyuncuId);
    const grup = gruplar.get(s.altLinkId) ?? { oyuncular: new Set<string>(), yatirim: 0, cekim: 0 };
    if (!grup.oyuncular.has(anahtar)) {
      const finans = finansHaritasi.get(anahtar);
      grup.yatirim += finans?.yatirim ?? 0;
      grup.cekim += finans?.cekim ?? 0;
      grup.oyuncular.add(anahtar);
    }
    gruplar.set(s.altLinkId, grup);
  }

  return [...gruplar.entries()].map(([altLinkId, g]) => ({
    altLinkId,
    oyuncuSayisi: g.oyuncular.size,
    yatirim: g.yatirim,
    cekim: g.cekim,
  }));
}

export interface AltLinkOyuncusu {
  lynonOyuncuId: string;
  /** Backoffice kullanıcı adı; bilinmiyorsa `null` — çağıran taraf o zaman ID'yi gösterir. */
  kullaniciAdi: string | null;
  yatirim: number;
  cekim: number;
  /** Eşleşme kaydımızın oluşturulma anı. Toplu geçişte bu, admin'in geçişi yaptığı andır. */
  olusturuldu: string;
  /** Oyuncunun Lynon'daki GERÇEK kayıt anı; bilinmiyorsa `null` — çağıran taraf `olusturuldu`'ya düşer. */
  kayitTarihi: string | null;
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
      baglantiId: oyuncuEslesmeleri.baglantiId,
      kullaniciAdi: oyuncuEslesmeleri.kullaniciAdi,
      olusturuldu: oyuncuEslesmeleri.olusturuldu,
      kayitTarihi: oyuncuEslesmeleri.kayitTarihi,
    })
    .from(oyuncuEslesmeleri)
    .where(and(eq(oyuncuEslesmeleri.kiraci, kiraci), eq(oyuncuEslesmeleri.altLinkId, altLinkId)))
    .orderBy(desc(oyuncuEslesmeleri.olusturuldu));

  const finansHaritasi = await oyuncuFinansHaritasi(vt, kiraci, satirlar);

  return satirlar.map((s) => {
    const finans = finansHaritasi.get(finansAnahtari(s.baglantiId, s.lynonOyuncuId));
    return {
      lynonOyuncuId: s.lynonOyuncuId,
      kullaniciAdi: s.kullaniciAdi,
      yatirim: finans?.yatirim ?? 0,
      cekim: finans?.cekim ?? 0,
      olusturuldu: s.olusturuldu.toISOString(),
      kayitTarihi: s.kayitTarihi ? s.kayitTarihi.toISOString() : null,
    };
  });
}

/**
 * Bir ortağa eşleşmiş TÜM oyuncuların listesi — alt linkten bağımsız.
 *
 * `altLinkOyuncuListesi`'nin `altLinkId` süzgeci, toplu affiliate
 * geçişiyle (kullanıcı adıyla) taşınan oyuncuları hiç göstermiyordu:
 * `oyuncuyuYenidenAta` bu oyuncularda `altLinkId`'yi kasıtlı olarak
 * `null` bırakıyor (o oyuncunun tıklama geçmişi zaten yok). Ortak,
 * kendisine geçirilen bir oyuncunun kullanıcı adını ve gerçek
 * yatırım/çekim rakamını hiçbir yerde göremiyordu — bu, o boşluğu
 * dolduruyor: `altLinkId` şartı YOK, yalnızca `ortakId`.
 */
export async function ortakOyuncuListesi(kiraci: string, ortakId: string): Promise<AltLinkOyuncusu[]> {
  const vt = veritabani();
  if (!vt) return [];

  const satirlar = await vt
    .select({
      lynonOyuncuId: oyuncuEslesmeleri.lynonOyuncuId,
      baglantiId: oyuncuEslesmeleri.baglantiId,
      kullaniciAdi: oyuncuEslesmeleri.kullaniciAdi,
      olusturuldu: oyuncuEslesmeleri.olusturuldu,
      kayitTarihi: oyuncuEslesmeleri.kayitTarihi,
    })
    .from(oyuncuEslesmeleri)
    .where(and(eq(oyuncuEslesmeleri.kiraci, kiraci), eq(oyuncuEslesmeleri.ortakId, ortakId)))
    .orderBy(desc(oyuncuEslesmeleri.olusturuldu));

  const finansHaritasi = await oyuncuFinansHaritasi(vt, kiraci, satirlar);

  return satirlar.map((s) => {
    const finans = finansHaritasi.get(finansAnahtari(s.baglantiId, s.lynonOyuncuId));
    return {
      lynonOyuncuId: s.lynonOyuncuId,
      kullaniciAdi: s.kullaniciAdi,
      yatirim: finans?.yatirim ?? 0,
      cekim: finans?.cekim ?? 0,
      olusturuldu: s.olusturuldu.toISOString(),
      kayitTarihi: s.kayitTarihi ? s.kayitTarihi.toISOString() : null,
    };
  });
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
    .where(and(
      eq(oyuncuEslesmeleri.kiraci, kiraci),
      eq(oyuncuEslesmeleri.ortakId, ortakId),
      // Webhook siteyi bilmiyor (tek paylasilan sir) -- yalnizca
      // 'varsayilan' baglantili oyunculara ait olabilir; baska turlu
      // farkli bir sitedeki ayni numarali ID'ye sahip oyuncuyla cakisirdi.
      eq(oyuncuEslesmeleri.baglantiId, VARSAYILAN_BAGLANTI_ID),
    ));

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

/**
 * Verilen oyuncuların TÜM webhook günlerini güncel ortaklarına göre
 * yeniden hesaplayıp yazar.
 *
 * ── Neden gerekli ──
 *
 * `ortakGunlukGeliriGuncelle` bir (gün, ortak) çifti için çalışıyor;
 * `olayIsleyici.ts` bunu her webhook turunun SONUNDA, o turda dokunulan
 * günler için çağırıyor. Ama kullanıcı adından toplu affiliate geçişi
 * (`topluAtama.ts`) farklı bir tetikleyici: oyuncu YENİ bir ortağa
 * bağlandığında, o oyuncunun DAHA ÖNCE webhook'tan biriken günleri hâlâ
 * ESKİ ortağın (ya da hiç kimsenin) özetinde duruyor olabilir. Geçiş
 * anında bu fonksiyon çağrılmazsa, hedef ortak transfer edilen oyuncunun
 * geçmiş verisini ancak bir sonraki webhook olayına ya da elle
 * "Geçmiş GGR'yi doldur" çalıştırmasına kadar hiç göremez.
 *
 * ── Neden `oyuncu_gunluk`'tan, Lynon raporundan değil ──
 *
 * Bu, geçmişe dönük Lynon rapor taraması (`gecmisGGR.ts`) DEĞİL — o,
 * dış bir API'ye oyuncu başına ayrı çağrı gerektirdiği için toplu
 * geçişin kendi isteğini yavaşlatır/zaman aşımına sokar. Bu fonksiyon
 * yalnızca PANELİN ZATEN SAHİP OLDUĞU webhook verisini (varsa) hemen
 * doğru ortağa yansıtıyor; Lynon'un geçmiş raporunu istemiyorsa admin
 * ayrıca "Geçmiş GGR'yi doldur"u çalıştırabilir.
 */
export async function oyunculariIcinGelirleriGuncelle(
  kiraci: string,
  lynonOyuncuIdleri: string[],
  simdi = new Date(),
): Promise<{ guncellenenOrtakGunu: number }> {
  const vt = veritabani();
  const oyuncuIdler = [...new Set(lynonOyuncuIdleri.map((id) => metin(id)).filter(Boolean))];
  if (!vt || oyuncuIdler.length === 0) return { guncellenenOrtakGunu: 0 };

  const gunOyuncuSatirlari = await vt
    .selectDistinct({ gun: oyuncuGunluk.gun, oyuncuId: oyuncuGunluk.oyuncuId })
    .from(oyuncuGunluk)
    .where(and(eq(oyuncuGunluk.kiraci, kiraci), inArray(oyuncuGunluk.oyuncuId, oyuncuIdler)));
  if (gunOyuncuSatirlari.length === 0) return { guncellenenOrtakGunu: 0 };

  const eslesmeler = await vt
    .select({
      lynonOyuncuId: oyuncuEslesmeleri.lynonOyuncuId,
      ortakId: oyuncuEslesmeleri.ortakId,
      ortakAnahtari: oyuncuEslesmeleri.ortakAnahtari,
    })
    .from(oyuncuEslesmeleri)
    .where(and(
      eq(oyuncuEslesmeleri.kiraci, kiraci),
      inArray(oyuncuEslesmeleri.lynonOyuncuId, oyuncuIdler),
      // `oyuncu_gunluk` webhook'tan geliyor, webhook siteyi bilmiyor --
      // bu yuzden bu yeniden-dagitim yalnizca 'varsayilan' baglantili
      // oyuncular icin anlamli (bkz. ortakGunlukGeliriGuncelle).
      eq(oyuncuEslesmeleri.baglantiId, VARSAYILAN_BAGLANTI_ID),
    ));
  const oyuncudanOrtaga = new Map(eslesmeler.map((e) => [e.lynonOyuncuId, e]));

  // Ayni (gun, ortak) cifti birden fazla transfer edilen oyuncu
  // uzerinden tekrar tetiklenebilir; her biri zaten TUM ortagi yeniden
  // hesapliyor, tekillestirmek gereksiz tekrari onluyor.
  const gunOrtakCiftleri = new Map<string, { gun: string; ortakId: string; ortakAnahtari: string }>();
  for (const { gun, oyuncuId } of gunOyuncuSatirlari) {
    const eslesme = oyuncudanOrtaga.get(oyuncuId);
    if (!eslesme) continue;
    gunOrtakCiftleri.set(`${gun}|${eslesme.ortakId}`, { gun, ortakId: eslesme.ortakId, ortakAnahtari: eslesme.ortakAnahtari });
  }

  let guncellenenOrtakGunu = 0;
  for (const { gun, ortakId, ortakAnahtari } of gunOrtakCiftleri.values()) {
    // Tek bir (gun, ortak) hesabindaki hata digerlerini durdurmamali.
    await ortakGunlukGeliriGuncelle(kiraci, gun, ortakId, ortakAnahtari, simdi).catch(() => undefined);
    guncellenenOrtakGunu += 1;
  }
  return { guncellenenOrtakGunu };
}

export type { EslesmeCakismasi, EslesmeKaynagi, GunlukSayi, OyuncuEslesmesi };

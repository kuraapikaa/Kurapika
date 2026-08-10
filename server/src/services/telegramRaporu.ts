/**
 * Anlik rapor botu — karar ve bicimleme.
 *
 * Istenen: "Anlik kasa raporu, anlik cekim bildirimi, anlik yatirim
 * bildirimi, anlik correction raporu, anlik bonus raporu atacak bir
 * Telegram botu."
 *
 * Bu dosya Telegram'a istek atmaz, Lynon'a bakmaz, saat okumaz. Yalnizca
 * iki soruyu cevaplar:
 *
 *   1. Bu satirlardan hangileri YENI? (imlec mantigi)
 *   2. Nasil yazilir? (mesaj bicimleri)
 *
 * ── Neden imlec ───────────────────────────────────────────────────────
 *
 * Uclar "son N kayit" donduruyor; her turda hepsi geliyor. Gorulmus
 * kayitlarin listesi tutulmazsa bot ayni yatirimi dakikada bir tekrar
 * bildirir.
 *
 * ── Ilk tur susar ─────────────────────────────────────────────────────
 *
 * Bot ilk kez ayaga kalktiginda gecmisteki yuzlerce kaydi arka arkaya
 * gondermemeli. Bu yuzden akis basina AYRI bir `baslatildi` bayragi var:
 * "gorulen listesi bos" ile "bu akis hic calismadi" ayri seylerdir. Ilki
 * gercek bir bos akis olabilir ve oradaki ilk kayit BILDIRILMELIDIR.
 */

import {
  gorselMesaj, italikIsaretle, kalinIsaretle, kalinSatir, kodIsaretle,
} from './telegramService.js';
import { nottanKaynak, nottanKural, nottanTalep } from './bonusAtamaNotu.js';

export type AkisImleci = {
  /** Bu akis en az bir kez tarandi mi? */
  baslatildi: boolean;
  /** Son gorulen kayit kimlikleri. */
  gorulen: string[];
};

export type RaporImleci = {
  akislar: Record<string, AkisImleci>;
  /** Son kasa ozetinin gonderildigi an (ISO). */
  sonOzet: string | null;
  /** Bir onceki kasa ozeti — periyodik mesajda trend oku icin. */
  sonKasaOzeti: KasaOzeti | null;
  /**
   * Yontem bazinda GUNLUK kasa raporunun en son gonderildigi Turkiye
   * gunu ("YYYY-MM-DD"). Bu rapor kasa ozetinden AYRI, yalnizca 00:00
   * penceresinde bir kez giden kendi takvimini tutar.
   */
  sonKasaYontemGun: string | null;
};

export function bosImlec(): RaporImleci {
  return { akislar: {}, sonOzet: null, sonKasaOzeti: null, sonKasaYontemGun: null };
}

/** Imlecte tutulan azami kimlik sayisi. Uctan gelen sayfadan buyuk olmali. */
export const AZAMI_GORULEN = 600;

/**
 * En fazla kac olay tek tek bildirilir.
 *
 * Kesintiden sonra biriken 300 kaydi tek tek atmak sohbeti kullanilamaz
 * hale getirir; ustu tek satirda ozetlenir.
 */
export const AZAMI_MESAJ = 12;

export type YeniOlaylar<T> = {
  yeniler: T[];
  /** Bildirilmeden ozetlenen kayit sayisi. */
  tasan: number;
  imlec: AkisImleci;
};

/**
 * Yeni kayitlari ayikla ve imleci ilerlet.
 *
 * Kimligi cozulemeyen satir ATLANIR: kimliksiz kaydi "yeni" saymak her
 * turda tekrar bildirmek demektir.
 */
export function yeniOlaylar<T>(
  satirlar: T[] | null | undefined,
  imlec: AkisImleci | undefined,
  kimlik: (satir: T) => string,
  azamiMesaj = AZAMI_MESAJ,
): YeniOlaylar<T> {
  const mevcut = imlec ?? { baslatildi: false, gorulen: [] };
  const gorulenKume = new Set(mevcut.gorulen);

  const kimlikli: Array<{ satir: T; id: string }> = [];
  for (const satir of satirlar ?? []) {
    const id = kimlik(satir);
    if (!id) continue;
    kimlikli.push({ satir, id });
  }

  const tumKimlikler = kimlikli.map((k) => k.id);
  const yeniImlec: AkisImleci = {
    baslatildi: true,
    gorulen: [...new Set([...tumKimlikler, ...mevcut.gorulen])].slice(0, AZAMI_GORULEN),
  };

  // Ilk tur: mevcut durumu ogren, hicbir sey bildirme.
  if (!mevcut.baslatildi) return { yeniler: [], tasan: 0, imlec: yeniImlec };

  const yeniler = kimlikli.filter((k) => !gorulenKume.has(k.id)).map((k) => k.satir);
  if (yeniler.length <= azamiMesaj) return { yeniler, tasan: 0, imlec: yeniImlec };

  return {
    yeniler: yeniler.slice(0, azamiMesaj),
    tasan: yeniler.length - azamiMesaj,
    imlec: yeniImlec,
  };
}

// ─── Bicimleme ───────────────────────────────────────────────────────────

const TL = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });

export function paraYaz(deger: unknown, kur = 'TRY'): string {
  // `Number(null)` ve `Number('')` sifir verir. Olculmemis tutari "0 TRY"
  // diye yazmak, panoda uzun uzun duzelttigimiz yalanin aynisi.
  if (deger === null || deger === undefined || deger === '') return '—';
  const sayi = Number(deger);
  if (!Number.isFinite(sayi)) return '—';
  return `${TL.format(sayi)} ${kur}`;
}

/** "YYYY-MM-DD" (+ isteğe bağlı "HH:MM") -> "GG.AA.YYYY" (" — HH:MM"). */
function gunSaatGoster(gun: string, saat?: string | null): string {
  const [yil, ay, g] = gun.split('-');
  const tarih = yil && ay && g ? `${g}.${ay}.${yil}` : gun;
  return saat ? `${tarih} — ${saat}` : tarih;
}

/** ISO → "03.08.2026 05:12" (Turkiye saati). */
export function saatYaz(iso: unknown): string {
  const t = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(t)) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(t));
}

/** Oyuncu satiri: ad varsa ad, yoksa yalniz kimlik. Kimlik ada terfi etmez. */
export function oyuncuYaz(login: unknown, clientId: unknown): string {
  const ad = String(login ?? '').trim();
  const kimlik = String(clientId ?? '').trim();
  if (ad && kimlik) return `${ad} (${kimlik})`;
  if (ad) return ad;
  return kimlik || 'bilinmeyen oyuncu';
}

type AnyRecord = Record<string, any>;

/** Mesaj basliklarini ayiran ince cizgi; sohbette blok blok okunsun. */
export const AYIRAC = '━━━━━━━━━━━━━━━━━━';

/**
 * Oyuncunun ayni gunku, BU YATIRIM DAHIL kacinci basarili yatirimi ve
 * o ana kadarki gunluk toplami.
 *
 * `gununYatirimlari` o gunun TAM listesi olmali (yalnizca bu oyuncununki
 * degil) — sirali kayit icin diger oyuncularin arasindan suzuyoruz.
 * Satir kendi listede bulunamazsa (kimliksiz / disaridan gelen tekil
 * cagri) null doner — "1. yatirim" diye uydurmak yanlis sinyal verir.
 */
export function gunlukYatirimOzeti(
  gununYatirimlari: AnyRecord[] | null | undefined,
  satir: AnyRecord,
): { sira: number; toplam: number } | null {
  const kimlik = String(satir?.ClientId ?? satir?.userId ?? '');
  if (!kimlik) return null;
  const simdikiId = String(satir?.Id ?? satir?.DocumentId ?? satir?.ReferenceNo ?? '');
  if (!simdikiId) return null;

  const oyuncununYatirimlari = (gununYatirimlari ?? [])
    .filter((y) => String(y?.ClientId ?? y?.userId ?? '') === kimlik)
    .sort((a, b) =>
      Date.parse(String(a?.CreatedLocal ?? a?.createdAt ?? '')) -
      Date.parse(String(b?.CreatedLocal ?? b?.createdAt ?? '')));

  const index = oyuncununYatirimlari.findIndex(
    (y) => String(y?.Id ?? y?.DocumentId ?? y?.ReferenceNo ?? '') === simdikiId,
  );
  if (index === -1) return null;

  const suanaKadar = oyuncununYatirimlari.slice(0, index + 1);
  return {
    sira: suanaKadar.length,
    toplam: suanaKadar.reduce((sum, y) => sum + Number(y?.Amount ?? y?.amount ?? 0), 0),
  };
}

/**
 * `gununYatirimlari` verilirse mesaja "bugünkü N. yatırımı · toplam X"
 * satırı eklenir — operatör aynı gün art arda yatırım yapan oyuncuyu bir
 * bakışta görür. Ek API isteği gerektirmez: akış zaten günün tüm
 * yatırımlarını tek seferde çekiyor, burada yalnızca o listeden okunur.
 */
export function yatirimMesaji(satir: AnyRecord, gununYatirimlari?: AnyRecord[]): string {
  const kisi = recordOf(satir.personalData);
  const ozet = gununYatirimlari ? gunlukYatirimOzeti(gununYatirimlari, satir) : null;
  const kur = satir.CurrencyId ?? satir.currency ?? 'TRY';
  return gorselMesaj([
    kalinSatir('💰 YENİ YATIRIM ✨'),
    AYIRAC,
    `👤 ${oyuncuYaz(satir.ClientLogin ?? kisi.userName, satir.ClientId ?? satir.userId)}`,
    `💵 ${paraYaz(satir.Amount ?? satir.amount, kur)}`,
    // Uc `method` ("Havale") ve `integration` ("HemenOde") olarak ayri
    // doner; ikisi de operatore lazim.
    satir.PaymentSystemName || satir.method
      ? `🏦 ${[satir.method ?? satir.PaymentSystemName, satir.integration].filter(Boolean).join(' · ')}`
      : null,
    kisi.category?.name ? `🏷️ ${kisi.category.name}` : null,
    satir.Balance !== null && satir.Balance !== undefined ? `💼 İşlem sonrası bakiye: ${paraYaz(satir.Balance, kur)}` : null,
    ozet ? `🔢 Bugünkü ${ozet.sira}. yatırımı · günlük toplam ${paraYaz(ozet.toplam, kur)}` : null,
    `🕒 ${saatYaz(satir.CreatedLocal ?? satir.createdAt)}`,
  ]);
}

function recordOf(deger: unknown): AnyRecord {
  return deger && typeof deger === 'object' ? (deger as AnyRecord) : {};
}

/**
 * ISLEM DURUMU.
 *
 * Gozlemlenmis deger: yatirimda `"status": "success"`. Cekim tarafinin
 * sozlugu belgelenmemis, bu yuzden liste GENIS tutuluyor ve taninmayan
 * durum SESSIZCE ELENMIYOR — 'bilinmiyor' olarak isaretlenip ham
 * degeriyle birlikte varsayilan sohbete dusuyor. Bir cekim bildirimini
 * kaybetmek, onu biraz yanlis yere gondermekten kotudur.
 */
const ONAY_DURUMLARI = ['success', 'successful', 'approved', 'completed', 'complete', 'paid', 'done', 'finished'];
const RED_DURUMLARI = ['rejected', 'declined', 'cancelled', 'canceled', 'failed', 'error', 'refused'];
const BEKLEYEN_DURUMLAR = ['pending', 'new', 'waiting', 'processing', 'inprogress', 'in_progress', 'onhold', 'on_hold'];

export type IslemDurumu = 'onay' | 'red' | 'bekliyor' | 'bilinmiyor';

/** Satirin ham durum metni. Alan adi uctan uca degisebiliyor. */
export function hamDurum(satir: AnyRecord): string {
  return String(satir?.DocumentState ?? satir?.status ?? satir?.state ?? satir?.Status ?? '')
    .trim()
    .toLowerCase();
}

export function islemDurumu(satir: AnyRecord): IslemDurumu {
  const durum = hamDurum(satir).replace(/[\s-]/g, '_');
  if (!durum) return 'bilinmiyor';
  if (ONAY_DURUMLARI.includes(durum)) return 'onay';
  if (RED_DURUMLARI.includes(durum)) return 'red';
  if (BEKLEYEN_DURUMLAR.includes(durum)) return 'bekliyor';
  return 'bilinmiyor';
}

/**
 * Yatirim BILDIRILECEK mi?
 *
 * Yalnizca basarili yatirimlar. Bekleyen ya da reddedilen bir yatirimi
 * "YATIRIM" diye bildirmek, kasaya girmemis parayi girmis gostermek olur.
 */
export function bildirilecekYatirimMi(satir: AnyRecord): boolean {
  return islemDurumu(satir) === 'onay';
}

const CEKIM_BASLIGI: Record<IslemDurumu, string> = {
  onay: '✅ ÇEKİM ONAYLANDI 🎉',
  red: '❌ ÇEKİM REDDEDİLDİ',
  bekliyor: '🏧 ÇEKİM TALEBİ',
  bilinmiyor: '🏧 ÇEKİM',
};

export function cekimMesaji(satir: AnyRecord): string {
  const durum = islemDurumu(satir);
  return gorselMesaj([
    kalinSatir(CEKIM_BASLIGI[durum]),
    AYIRAC,
    `👤 ${oyuncuYaz(satir.ClientLogin, satir.ClientId)}`,
    `💸 ${paraYaz(satir.Amount, satir.CurrencyId ?? satir.currency ?? 'TRY')}`,
    satir.PaymentSystemName || satir.method
      ? `🏦 ${[satir.method ?? satir.PaymentSystemName, satir.integration].filter(Boolean).join(' · ')}`
      : null,
    // Durum taninmadiysa ham degeri goster; sessizce yutma.
    durum === 'bilinmiyor' && hamDurum(satir) ? `❔ Durum: ${hamDurum(satir)}` : null,
    `🕒 ${saatYaz(satir.CreatedLocal ?? satir.createdAt)}`,
  ]);
}

/**
 * Cekim olayinin imlec kimligi.
 *
 * Kimlige DURUM da katiliyor: ayni cekim once "bekliyor" sonra "onay"
 * olarak gorulecek ve ikisi AYRI olay. Yalnizca kimlik kullanilsaydi
 * talep bildirilir, onayi hic bildirilmezdi — oysa istenen tam olarak
 * onay ve red bildirimi.
 */
export function cekimOlayKimligi(satir: AnyRecord): string {
  const id = String(satir?.Id ?? satir?.DocumentId ?? satir?.ReferenceNo ?? '');
  if (!id) return '';
  return `${id}:${islemDurumu(satir)}`;
}

export function correctionMesaji(satir: AnyRecord): string {
  const yon = String(satir.CorrectionType ?? '').toLowerCase() === 'debiting' ? 'ÇIKIŞ' : 'GİRİŞ';
  return [
    `⚖️ BAKİYE DÜZELTMESİ · ${yon}`,
    oyuncuYaz(satir.ClientLogin, satir.ClientId),
    paraYaz(satir.Amount, satir.ClientCurrency ?? 'TRY'),
    satir.AccountName ? `Hesap: ${satir.AccountName}` : null,
    satir.Note ? `Not: ${satir.Note}` : null,
    satir.UserName ? `Yapan: ${satir.UserName}` : null,
    saatYaz(satir.CreatedLocal ?? satir.date),
  ].filter(Boolean).join('\n');
}

const DUZELTME_YON_BASLIGI: Record<string, string> = {
  giris: '⚖️ MANUEL BAKİYE EKLEME ⬆️',
  cikis: '⚖️ MANUEL BAKİYE ÇIKARMA ⬇️',
  bilinmiyor: '⚖️ MANUEL DÜZELTME',
};

/**
 * Yapan yoneticinin ayni gunku, BU HAREKET DAHIL kacinci manuel
 * duzeltmesi ve o ana kadarki net toplami (giris - cikis).
 *
 * Ayni yoneticinin gun icinde art arda manuel bakiye hareketi yapmasi —
 * ozellikle notsuz — kotuye kullanim isareti olabilir; bu satir onu
 * denetim ekranina gitmeden Telegram'da gorunur kilar.
 */
export function gunlukYapanOzeti(
  gununDuzeltmeleri: AnyRecord[] | null | undefined,
  satir: AnyRecord,
): { sira: number; netToplam: number } | null {
  const yapan = String(satir?.Yapan ?? '').trim();
  if (!yapan) return null;
  const simdikiId = String(satir?.Id ?? '');
  if (!simdikiId) return null;

  const yapaninIslemleri = (gununDuzeltmeleri ?? [])
    .filter((d) => String(d?.Yapan ?? '').trim() === yapan)
    .sort((a, b) =>
      Date.parse(String(a?.CreatedLocal ?? '')) - Date.parse(String(b?.CreatedLocal ?? '')));

  const index = yapaninIslemleri.findIndex((d) => String(d?.Id ?? '') === simdikiId);
  if (index === -1) return null;

  const suanaKadar = yapaninIslemleri.slice(0, index + 1);
  return {
    sira: suanaKadar.length,
    netToplam: suanaKadar.reduce((sum, d) => sum + Number(d?.NetTutar ?? 0), 0),
  };
}

/**
 * Manuel duzeltme bildirimi.
 *
 * Kritik alan `Yapan`: bu hareketi hangi yonetici yapti. Panelden
 * yapilan islemler denetim kaydina dusuyor ama Lynon arayuzunden elle
 * yapilanlar dusmuyordu; bot bu boslugu anlik olarak kapatiyor.
 *
 * NOTSUZ hareket ayrica isaretleniyor — manuel para hareketinin
 * gerekcesi olmali. `gununDuzeltmeleri` verilirse yapan yoneticinin o
 * gunku hareket sayisi ve net toplami da eklenir (ek istek gerekmez;
 * akis zaten günün tüm kayıtlarını tek seferde çekiyor).
 */
export function manuelDuzeltmeMesaji(satir: AnyRecord, gununDuzeltmeleri?: AnyRecord[]): string {
  const yon = String(satir.Yon ?? 'bilinmiyor');
  const isaret = yon === 'giris' ? '➕' : yon === 'cikis' ? '➖' : '❔';
  const yapanOzeti = gununDuzeltmeleri ? gunlukYapanOzeti(gununDuzeltmeleri, satir) : null;
  return gorselMesaj([
    kalinSatir(DUZELTME_YON_BASLIGI[yon] ?? DUZELTME_YON_BASLIGI.bilinmiyor),
    AYIRAC,
    `👤 ${oyuncuYaz(satir.ClientLogin, satir.ClientId)}`,
    `${isaret} ${paraYaz(satir.Tutar, satir.ParaBirimi ?? 'TRY')}`,
    satir.Hesap ? `🏛️ ${satir.Hesap}` : null,
    satir.Kategori ? `🏷️ ${satir.Kategori}` : null,
    `👮 ${satir.Yapan || 'bilinmiyor'}${yapanOzeti ? ` · bugün ${yapanOzeti.sira}. işlemi (net ${paraYaz(yapanOzeti.netToplam, satir.ParaBirimi ?? 'TRY')})` : ''}`,
    satir.NotAnlamli ? `📝 ${satir.Not}` : '⚠️ Gerekçe notu yok',
    `🕒 ${saatYaz(satir.CreatedLocal)}`,
  ]);
}

/** Durum metnine göre kısa bir onay/red işareti; tanınmayan durum işaretsiz kalır. */
function durumIsareti(durum: string): string {
  const d = durum.toLocaleLowerCase('tr-TR');
  if (/onay|kabul|başarılı|claimed|active/.test(d)) return '✅';
  if (/red|iptal|başarısız|cancel|reject/.test(d)) return '❌';
  if (/bekl|pending/.test(d)) return '⏳';
  return '';
}

/**
 * Bonus atama bildirimi.
 *
 * "Marka", "Kural Kodu", "Kaynak/Talep" `atamaNotu()`'nun ürettiği
 * `Description`/`assignmentReason` metninden geri okunuyor (bkz.
 * `bonusAtamaNotu.ts`) — panel/otomasyon zaten bu bilgiyi Lynon'a o
 * biçimde yazıyordu, burada YENİDEN üretilmiyor. "Segment" (oyuncunun
 * davranış kategorisi) şu an notta taşınmıyor; bir kaynak eklenene
 * kadar bu satır hiç yazılmaz — "bilinmiyor" yazmak yerine hiç
 * göstermemek, olmayan bir veriyi ölçülmüş gibi sunmaktan iyidir.
 */
export function bonusMesaji(satir: AnyRecord): string {
  const not = satir.Description ?? '';
  const kural = nottanKural(not);
  const kaynak = nottanKaynak(not);
  const talep = nottanTalep(not);
  const durum = String(satir.Durum ?? '').trim();
  const segment = satir.Segment ? String(satir.Segment).trim() : '';

  return gorselMesaj([
    kalinSatir('🎁 BONUS TANIMLANDI'),
    AYIRAC,
    '',
    `👤 ${kalinIsaretle('Oyuncu:')} ${kodIsaretle(String(satir.ClientLogin ?? '') || 'bilinmeyen')} (ID: ${kodIsaretle(String(satir.ClientId ?? '—'))})`,
    segment ? `🏷️ ${kalinIsaretle('Segment:')} ${segment}` : null,
    `🏆 ${kalinIsaretle('Bonus:')} ${String(satir.Name ?? 'Bonus')}`,
    satir.TotalPaidAmount ? `💰 ${kalinIsaretle('Değer:')} ${paraYaz(satir.TotalPaidAmount, satir.ClientCurrency ?? 'TRY')}` : null,
    '',
    kalinSatir('⚙️ SİSTEM DETAYLARI'),
    `• ${kalinIsaretle('Marka:')} Narcosbahis`,
    kural ? `• ${kalinIsaretle('Kural Kodu:')} ${kodIsaretle(kural)}` : null,
    (kaynak || talep) ? `• ${kalinIsaretle('Kaynak / Talep:')} ${kaynak || '—'} / ${talep || '—'}` : null,
    durum ? `• ${kalinIsaretle('Durum:')} ${durumIsareti(durum)} ${durum}`.trim() : null,
    '',
    `🕒 ${italikIsaretle(saatYaz(satir.CreatedLocal).replace(' ', ' — '))}`,
  ]);
}

/** Kesintiden sonra biriken kayitlarin ozet satiri. */
export function tasanMesaji(akisAdi: string, tasan: number): string {
  return `… ${akisAdi}: ${tasan} kayıt daha var, tek tek gönderilmedi.`;
}

export type KasaOzeti = {
  gun: string;
  /** Ozet kesildigi an — 20 dakikada bir gelen mesajlar karismasin. */
  saat?: string | null;
  yatirim: number | null;
  cekim: number | null;
  ggr: number | null;
  kar: number | null;
  yeniKayit: number | null;
  yatirimOyuncu: number | null;
  cekimOyuncu: number | null;
  oyuncuBakiyesi: number | null;
  // ── Genisletilmis olculer
  ilkYatirim: number | null;
  yatirimAdedi: number | null;
  bahisAdedi: number | null;
  bahisOyuncu: number | null;
  gercekBahis: number | null;
  gercekKazanc: number | null;
  bonusBakiye: number | null;
  freespinKazanc: number | null;
  bonusOdeme: number | null;
  cashback: number | null;
  /** Bugün en çok oynanan casino oyunları (ciroya göre). Verilmezse bölüm hiç yazılmaz. */
  enCokOynananOyunlar?: Array<{ ad: string; ciro: number }> | null;
};

/** ₺ önekli, virgüllü-ondalık biçim — bu rapora özgü (diğer raporlar "TRY" sonekli TR biçimini kullanır). */
const PARA_EN = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Tam sayı alanlar (oyuncu/işlem sayısı) — aynı ₺ raporunun virgüllü biçimiyle tutarlı. */
const TAM = new Intl.NumberFormat('en-US');

function tlYaz(v: number | null): string {
  return v === null ? '—' : `₺${PARA_EN.format(v)}`;
}

/** İşaretli tutar: pozitif "+₺...", negatif "-₺...". Net/kâr-zarar gibi yönü önemli alanlar için. */
function tlIsaretli(v: number | null): string {
  if (v === null) return '—';
  return `${v >= 0 ? '+' : '-'}${tlYaz(Math.abs(v))}`;
}

/**
 * Onceki ozete gore YUZDE trend oku. Ikisinden biri bilinmiyorsa ya da
 * onceki tam sifirsa (yuzde tanimsiz) BOS DONER — "degisim yok" ile
 * "olculemedi" ayni sey degil, karisik trend okumaktansa hic
 * gostermemek daha dogru.
 */
function yuzdeTrendYaz(simdi: number | null, onceki: number | null | undefined): string {
  if (simdi === null || onceki === null || onceki === undefined || onceki === 0) return '';
  const yuzde = ((simdi - onceki) / Math.abs(onceki)) * 100;
  if (Math.abs(yuzde) < 0.05) return '';
  return ` (${yuzde > 0 ? '▲' : '▼'}%${Math.abs(yuzde).toFixed(1)})`;
}

/**
 * Kar isaretine gore kisa bir kapanis notu.
 *
 * `kar` olculemiyorsa (null) hicbir sey yazilmaz — "kasa iyi gidiyor"
 * gibi bir yorumu uydurmak, olculemeyen bir seyi olculmus gibi
 * gostermek olur.
 */
function kasaKapanisNotu(kar: number | null): string | null {
  if (kar === null) return null;
  return kar >= 0 ? '✨ Bugün kasa lehine gidiyor, harika!' : '👀 Bugün oyuncular önde — takipte kalın.';
}

/**
 * Kasa ozeti.
 *
 * Olculemeyen alan "—" yazilir, sifir DEGIL. Panoda bu ayrimi kurmak
 * icin ayri bir PR gerekti; ayni yalani Telegram'da tekrarlamiyoruz.
 *
 * `onceki` verilirse NET KÂR/ZARAR yaninda bir onceki ozete gore YUZDE
 * degisim gosterilir (20 dakikalik periyotta "yon" bir bakista
 * gorulsun diye). Verilmezse trend satiri hic eklenmez — elle
 * gonderilen tek seferlik ozette (panel butonu) karsilastirilacak
 * "onceki" olmadigi icin uydurulmaz.
 */
export function kasaMesaji(ozet: KasaOzeti, onceki?: KasaOzeti | null): string {
  const y = ozet.yatirim;
  const c = ozet.cekim;
  const net = y === null && c === null ? null : (y ?? 0) - (c ?? 0);

  // Bonus maliyeti: kasadan cikan bonus kalemleri. Bilinmeyen alan
  // toplama katilmaz; hepsi bilinmiyorsa "—".
  const bonusKalemleri = [ozet.freespinKazanc, ozet.bonusOdeme, ozet.cashback];
  const bonusMaliyeti = bonusKalemleri.some((v) => v !== null)
    ? bonusKalemleri.reduce<number>((t, v) => t + (v ?? 0), 0)
    : null;
  const cashbackOdeme = ozet.bonusOdeme === null && ozet.cashback === null
    ? null
    : (ozet.bonusOdeme ?? 0) + (ozet.cashback ?? 0);

  // Net yon isareti: kasaya para girdi mi cikti mi, bir bakista.
  const netIsaret = net === null ? '' : net >= 0 ? ' 🟢' : ' 🔴';
  const karIsaret = ozet.kar === null ? '' : ozet.kar >= 0 ? ' 🟢' : ' 🔴';

  // Elde tutma orani (hold %) — kar / gercek bahis. Standart casino KPI'i;
  // yalnizca ikisi de olculebildiyse hesaplanir. Negatifse (oyuncular
  // kazandi) uyari isareti eklenir -- operator bunu bir bakista gormeli.
  const holdOrani = ozet.kar !== null && ozet.gercekBahis
    ? (ozet.kar / ozet.gercekBahis) * 100
    : null;
  const holdUyari = holdOrani !== null && holdOrani < 0 ? ' ⚠️' : '';

  const satirlar = [
    kalinSatir('📊 KASA ÖZET RAPORU'),
    `📅 ${italikIsaretle(gunSaatGoster(ozet.gun, ozet.saat))}`,
    AYIRAC,
    '',
    kalinSatir('💵 FİNANS & NAKİT AKIŞI'),
    `▫️ ${kalinIsaretle('Yatırım:')} ${tlYaz(y)}${ozet.yatirimOyuncu !== null ? ` (${ozet.yatirimOyuncu} oyuncu)` : ''}`,
    `▫️ ${kalinIsaretle('Çekim:')} ${tlYaz(c)}${ozet.cekimOyuncu !== null ? ` (${ozet.cekimOyuncu} oyuncu)` : ''}`,
    `▫️ ${kalinIsaretle('Net Kasa Akışı:')} ${tlIsaretli(net)}${netIsaret}`,
    '',
    kalinSatir('🎰 OYUN PERFORMANSI'),
    `▫️ ${kalinIsaretle('Ciro (Turnover):')} ${tlYaz(ozet.gercekBahis)}${ozet.bahisAdedi !== null ? ` (${TAM.format(ozet.bahisAdedi)} Bahis)` : ''}`,
    `▫️ ${kalinIsaretle('Ödenen Kazanç:')} ${tlYaz(ozet.gercekKazanc)}`,
    `▫️ ${kalinIsaretle('GGR (Brüt Gelir):')} ${tlYaz(ozet.ggr)}`,
    `▫️ ${kalinIsaretle('Net Kâr / Zarar:')} ${tlIsaretli(ozet.kar)}${karIsaret}${yuzdeTrendYaz(ozet.kar, onceki?.kar)}`,
    `▫️ ${kalinIsaretle('Elde Tutma (Hold):')} ${holdOrani === null ? '—' : `%${holdOrani.toFixed(1)}`}${holdUyari}`,
    ozet.enCokOynananOyunlar && ozet.enCokOynananOyunlar.length > 0
      ? [
        '',
        kalinIsaretle('🏆 En Çok Oynanan Oyunlar:'),
        ...ozet.enCokOynananOyunlar.map((o) => `• ${o.ad} — ${tlYaz(o.ciro)}`),
      ].join('\n')
      : null,
    '',
    kalinSatir('🎁 BONUS MALİYETİ'),
    `▫️ ${kalinIsaretle('Toplam Bonus:')} ${tlYaz(bonusMaliyeti)}`,
    `└ ${italikIsaretle(`Freespin: ${tlYaz(ozet.freespinKazanc)} | Cashback / Ödeme: ${tlYaz(cashbackOdeme)}`)}`,
    '',
    kalinSatir('👥 OYUNCU & BAKİYE'),
    `▫️ ${kalinIsaretle('Yeni Kayıt:')} ${ozet.yeniKayit === null ? '—' : TAM.format(ozet.yeniKayit)} | ${kalinIsaretle('FTD (İlk Yatırım):')} ${ozet.ilkYatirim === null ? '—' : TAM.format(ozet.ilkYatirim)}`,
    `▫️ ${kalinIsaretle('Aktif Bahisçi:')} ${ozet.bahisOyuncu === null ? '—' : TAM.format(ozet.bahisOyuncu)} Oyuncu`,
    `▫️ ${kalinIsaretle('Kullanıcı Bakiyeleri:')} ${tlYaz(ozet.oyuncuBakiyesi)} (Gerçek) | ${tlYaz(ozet.bonusBakiye)} (Bonus)`,
    kasaKapanisNotu(ozet.kar) ? '' : null,
    kasaKapanisNotu(ozet.kar) ? `${italikIsaretle(kasaKapanisNotu(ozet.kar)!)}` : null,
  ];

  return gorselMesaj(satirlar);
}

/** Ozet gonderme zamani geldi mi? */
export function ozetZamaniMi(sonOzet: string | null, aralikMs: number, simdi = Date.now()): boolean {
  if (aralikMs <= 0) return false;
  if (!sonOzet) return true;
  const t = Date.parse(sonOzet);
  if (!Number.isFinite(t)) return true;
  return simdi - t >= aralikMs;
}

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
};

export function bosImlec(): RaporImleci {
  return { akislar: {}, sonOzet: null };
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

export function yatirimMesaji(satir: AnyRecord): string {
  const kisi = recordOf(satir.personalData);
  return [
    '💰 YATIRIM',
    AYIRAC,
    `👤 ${oyuncuYaz(satir.ClientLogin ?? kisi.userName, satir.ClientId ?? satir.userId)}`,
    `💵 ${paraYaz(satir.Amount ?? satir.amount, satir.CurrencyId ?? satir.currency ?? 'TRY')}`,
    // Uc `method` ("Havale") ve `integration` ("HemenOde") olarak ayri
    // doner; ikisi de operatore lazim.
    satir.PaymentSystemName || satir.method
      ? `🏦 ${[satir.method ?? satir.PaymentSystemName, satir.integration].filter(Boolean).join(' · ')}`
      : null,
    kisi.category?.name ? `🏷️ ${kisi.category.name}` : null,
    `🕒 ${saatYaz(satir.CreatedLocal ?? satir.createdAt)}`,
  ].filter(Boolean).join('\n');
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
  onay: '✅ ÇEKİM ONAYLANDI',
  red: '❌ ÇEKİM REDDEDİLDİ',
  bekliyor: '🏧 ÇEKİM TALEBİ',
  bilinmiyor: '🏧 ÇEKİM',
};

export function cekimMesaji(satir: AnyRecord): string {
  const durum = islemDurumu(satir);
  return [
    CEKIM_BASLIGI[durum],
    AYIRAC,
    `👤 ${oyuncuYaz(satir.ClientLogin, satir.ClientId)}`,
    `💸 ${paraYaz(satir.Amount, satir.CurrencyId ?? satir.currency ?? 'TRY')}`,
    satir.PaymentSystemName || satir.method
      ? `🏦 ${[satir.method ?? satir.PaymentSystemName, satir.integration].filter(Boolean).join(' · ')}`
      : null,
    // Durum taninmadiysa ham degeri goster; sessizce yutma.
    durum === 'bilinmiyor' && hamDurum(satir) ? `❔ Durum: ${hamDurum(satir)}` : null,
    `🕒 ${saatYaz(satir.CreatedLocal ?? satir.createdAt)}`,
  ].filter(Boolean).join('\n');
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
  giris: '⚖️ MANUEL BAKİYE EKLEME',
  cikis: '⚖️ MANUEL BAKİYE ÇIKARMA',
  bilinmiyor: '⚖️ MANUEL DÜZELTME',
};

/**
 * Manuel duzeltme bildirimi.
 *
 * Kritik alan `Yapan`: bu hareketi hangi yonetici yapti. Panelden
 * yapilan islemler denetim kaydina dusuyor ama Lynon arayuzunden elle
 * yapilanlar dusmuyordu; bot bu boslugu anlik olarak kapatiyor.
 *
 * NOTSUZ hareket ayrica isaretleniyor — manuel para hareketinin
 * gerekcesi olmali.
 */
export function manuelDuzeltmeMesaji(satir: AnyRecord): string {
  const yon = String(satir.Yon ?? 'bilinmiyor');
  const isaret = yon === 'giris' ? '➕' : yon === 'cikis' ? '➖' : '❔';
  return [
    DUZELTME_YON_BASLIGI[yon] ?? DUZELTME_YON_BASLIGI.bilinmiyor,
    AYIRAC,
    `👤 ${oyuncuYaz(satir.ClientLogin, satir.ClientId)}`,
    `${isaret} ${paraYaz(satir.Tutar, satir.ParaBirimi ?? 'TRY')}`,
    satir.Hesap ? `🏛️ ${satir.Hesap}` : null,
    satir.Kategori ? `🏷️ ${satir.Kategori}` : null,
    `👮 ${satir.Yapan || 'bilinmiyor'}`,
    satir.NotAnlamli ? `📝 ${satir.Not}` : '⚠️ Gerekçe notu yok',
    `🕒 ${saatYaz(satir.CreatedLocal)}`,
  ].filter(Boolean).join('\n');
}

export function bonusMesaji(satir: AnyRecord): string {
  return [
    '🎁 BONUS VERİLDİ',
    AYIRAC,
    `👤 ${oyuncuYaz(satir.ClientLogin, satir.ClientId)}`,
    `🏆 ${String(satir.Name ?? 'Bonus')}`,
    satir.TotalPaidAmount ? `💵 Ödenen: ${paraYaz(satir.TotalPaidAmount, satir.ClientCurrency ?? 'TRY')}` : null,
    satir.Kategori ? `🏷️ ${satir.Kategori}` : null,
    satir.Durum ? `📌 ${satir.Durum}` : null,
    satir.Description ? `📝 ${satir.Description}` : null,
    `🕒 ${saatYaz(satir.CreatedLocal)}`,
  ].filter(Boolean).join('\n');
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
};

/**
 * Kasa ozeti.
 *
 * Olculemeyen alan "—" yazilir, sifir DEGIL. Panoda bu ayrimi kurmak
 * icin ayri bir PR gerekti; ayni yalani Telegram'da tekrarlamiyoruz.
 */
export function kasaMesaji(ozet: KasaOzeti): string {
  const y = ozet.yatirim;
  const c = ozet.cekim;
  const net = y === null && c === null ? null : (y ?? 0) - (c ?? 0);
  const sayi = (v: number | null) => (v === null ? '—' : TL.format(v));
  const p = (v: number | null) => (v === null ? '—' : paraYaz(v));

  // Bonus maliyeti: kasadan cikan bonus kalemleri. Bilinmeyen alan
  // toplama katilmaz; hepsi bilinmiyorsa "—".
  const bonusKalemleri = [ozet.freespinKazanc, ozet.bonusOdeme, ozet.cashback];
  const bonusMaliyeti = bonusKalemleri.some((v) => v !== null)
    ? bonusKalemleri.reduce<number>((t, v) => t + (v ?? 0), 0)
    : null;

  // Net yon isareti: kasaya para girdi mi cikti mi, bir bakista.
  const netIsaret = net === null ? '' : net >= 0 ? ' 🟢' : ' 🔴';

  const satirlar = [
    `📊 KASA ÖZETİ · ${ozet.gun}${ozet.saat ? ` · ${ozet.saat}` : ''}`,
    AYIRAC,
    '💰 PARA',
    `  ⬇️ Yatırım:  ${p(y)}${ozet.yatirimOyuncu !== null ? ` · ${ozet.yatirimOyuncu} oyuncu` : ''}${ozet.yatirimAdedi !== null ? ` · ${ozet.yatirimAdedi} işlem` : ''}`,
    `  ⬆️ Çekim:    ${p(c)}${ozet.cekimOyuncu !== null ? ` · ${ozet.cekimOyuncu} oyuncu` : ''}`,
    `  ⚖️ Net:      ${p(net)}${netIsaret}`,
    '',
    '🎰 OYUN',
    `  GGR:      ${p(ozet.ggr)}`,
    `  Kâr:      ${p(ozet.kar)}`,
    `  Bahis:    ${p(ozet.gercekBahis)}${ozet.bahisAdedi !== null ? ` · ${sayi(ozet.bahisAdedi)} bahis` : ''}`,
    `  Kazanç:   ${p(ozet.gercekKazanc)}`,
    '',
    '🎁 BONUS',
    `  Maliyet:  ${p(bonusMaliyeti)}`,
    `  Freespin: ${p(ozet.freespinKazanc)}`,
    `  Ödeme:    ${p(ozet.bonusOdeme)}`,
    `  Cashback: ${p(ozet.cashback)}`,
    '',
    '👥 OYUNCU',
    `  Yeni kayıt:     ${sayi(ozet.yeniKayit)}`,
    `  İlk yatırım:    ${sayi(ozet.ilkYatirim)}`,
    `  Bahis yapan:    ${sayi(ozet.bahisOyuncu)}`,
    `  Gerçek bakiye:  ${p(ozet.oyuncuBakiyesi)}`,
    `  Bonus bakiye:   ${p(ozet.bonusBakiye)}`,
  ];

  return satirlar.join('\n');
}

/** Ozet gonderme zamani geldi mi? */
export function ozetZamaniMi(sonOzet: string | null, aralikMs: number, simdi = Date.now()): boolean {
  if (aralikMs <= 0) return false;
  if (!sonOzet) return true;
  const t = Date.parse(sonOzet);
  if (!Number.isFinite(t)) return true;
  return simdi - t >= aralikMs;
}

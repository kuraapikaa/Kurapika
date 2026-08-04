/**
 * Cekim talebi degerlendirmesi.
 *
 * Telegram'a dusen cekim bildirimi tek basina karar verdirmiyordu:
 * operator tutari goruyor ama oyuncunun kim oldugunu gormuyordu. Bu
 * modul bildirime karar icin gereken baglami ekler ve bir kurali
 * otomatiklestirir.
 *
 * ── Gunde uc cekim kurali ─────────────────────────────────────────────
 *
 * "1 gun icinde 3 cekimi olanlarin otomatik reddedilmesi." Sayim
 * TURKIYE gunune gore yapilir ve YALNIZCA ayni oyuncunun cekimleri
 * sayilir. Reddedilmis talepler de sayiya girer: kural "kac kez talep
 * acti" sorusunu oluyor, "kac kez para aldi" sorusunu degil.
 *
 * Karar burada verilir, uygulanmaz. Otomatik ret gercek para hareketini
 * durduran bir islem; is akisi bunu ayri bir yerde ve acik bir bayrakla
 * calistiriyor.
 */

type AnyRecord = Record<string, any>;

import { istanbulDateKey } from '../lib/istanbulGunu.js';
import { gorselMesaj, kalinSatir } from './telegramService.js';

/** Bir gunde bu sayiya ULASAN talep otomatik reddedilir. */
export const GUNLUK_CEKIM_ESIGI = Number(process.env.GUNLUK_CEKIM_ESIGI) || 3;

/**
 * Oyuncunun o gun actigi cekim talebi sayisi.
 *
 * `haricTut` degerlendirilen talebin kendisini disarida birakmak icin:
 * "bu talepten ONCE kac tane vardi" sorusunu sorabilmek gerekiyor.
 */
export function gunlukCekimSayisi(
  cekimler: AnyRecord[] | null | undefined,
  playerId: unknown,
  gun: string,
  haricTut?: unknown,
): number {
  const kimlik = String(playerId ?? '');
  if (!kimlik) return 0;
  const haric = haricTut === undefined || haricTut === null ? null : String(haricTut);

  return (cekimler ?? []).filter((satir) => {
    if (String(satir?.ClientId ?? satir?.userId ?? '') !== kimlik) return false;
    if (haric !== null && String(satir?.Id ?? satir?.id ?? '') === haric) return false;
    return istanbulDateKey(String(satir?.CreatedLocal ?? satir?.createdAt ?? '')) === gun;
  }).length;
}

export type OtomatikRedKarari =
  | { reddet: true; neden: string; gunlukSayi: number }
  | { reddet: false; neden: string; gunlukSayi: number };

/**
 * Bu talep otomatik reddedilmeli mi?
 *
 * `gunlukSayi` bu talep DAHIL toplam sayidir. Esige ULASILDIGINDA
 * reddedilir: esik 3 ise gunun ucuncu talebi reddedilir.
 */
export function otomatikRedKarari(gunlukSayi: number, esik = GUNLUK_CEKIM_ESIGI): OtomatikRedKarari {
  if (!Number.isFinite(esik) || esik <= 0) {
    return { reddet: false, neden: 'Günlük çekim eşiği tanımlı değil.', gunlukSayi };
  }
  if (gunlukSayi >= esik) {
    return {
      reddet: true,
      neden: `Aynı gün ${gunlukSayi}. çekim talebi (eşik ${esik}).`,
      gunlukSayi,
    };
  }
  return { reddet: false, neden: `Aynı gün ${gunlukSayi}. talep; eşik ${esik}.`, gunlukSayi };
}

export type OyuncuNotu = {
  id?: unknown;
  text?: unknown;
  noteType?: unknown;
  noteCreatedUserEmail?: unknown;
  createdAt?: unknown;
};

/**
 * Notlarda RISK isareti var mi?
 *
 * Not tipleri sitede tanimli: VIP, High Risk, Manual, Affiliate, Call,
 * Risk. Operatorun cekim onaylarken ilk bakmasi gereken sey bu.
 */
const RISK_NOT_TIPLERI = ['high risk', 'risk'];

export function riskNotuVarMi(notlar: OyuncuNotu[] | null | undefined): boolean {
  return (notlar ?? []).some((not) =>
    RISK_NOT_TIPLERI.includes(String(not?.noteType ?? '').trim().toLowerCase()),
  );
}

export function vipNotuVarMi(notlar: OyuncuNotu[] | null | undefined): boolean {
  return (notlar ?? []).some((not) => String(not?.noteType ?? '').trim().toLowerCase() === 'vip');
}

/**
 * Son yatirimdan SONRA alinan bonuslar.
 *
 * Cekim degerlendirmesinde kritik soru: oyuncu bu parayi bonusla mi
 * yapti? Son yatirim zamani bilinmiyorsa BOS liste doner — "bonus yok"
 * demek degil, "olculemedi" demek; cagiran bu ayrimi gostermeli.
 */
export function sonYatirimdanSonrakiBonuslar(
  bonuslar: AnyRecord[] | null | undefined,
  sonYatirimZamani: string | null | undefined,
): AnyRecord[] {
  const t = Date.parse(String(sonYatirimZamani ?? ''));
  if (!Number.isFinite(t)) return [];
  return (bonuslar ?? []).filter((bonus) => {
    const bt = Date.parse(String(bonus?.CreatedLocal ?? bonus?.assignedDate ?? ''));
    return Number.isFinite(bt) && bt >= t;
  });
}

function sayiyaCevir(deger: unknown): number {
  const n = Number(deger);
  return Number.isFinite(n) ? n : 0;
}

/** Casino islem satirlarindan (tip='bet') son yatirim sonrasi cevrim toplami. */
export function casinoCevrimToplami(rows: AnyRecord[] | null | undefined): number {
  return (rows ?? [])
    .filter((row) => String(row?.type ?? '').toLowerCase() === 'bet')
    .reduce((sum, row) => sum + Math.abs(sayiyaCevir(row?.amount)), 0);
}

/** Spor bahis satirlarindan son yatirim sonrasi cevrim toplami. */
export function sporCevrimToplami(rows: AnyRecord[] | null | undefined): number {
  return (rows ?? []).reduce(
    (sum, row) => sum + Math.abs(sayiyaCevir(row?.amount ?? row?.stake ?? row?.betAmount)),
    0,
  );
}

/**
 * Casino bahis satirlarindan (tip='bet') en cok oynanan oyunlar —
 * bahis ADEDINE gore siralanir, ciro degil; "hangi oyunu en cok
 * denedi" sorusu bahis sayisiyla cevaplanir, tek buyuk bahisli bir
 * oyun listeyi yanlis yone cekmesin.
 */
export function enCokOynananOyunlar(
  rows: AnyRecord[] | null | undefined,
  azami = 3,
): Array<{ ad: string; adet: number; bahis: number }> {
  const kova = new Map<string, { ad: string; adet: number; bahis: number }>();
  for (const row of rows ?? []) {
    if (String(row?.type ?? '').toLowerCase() !== 'bet') continue;
    const ad = String(row?.gameName ?? row?.game?.name ?? '').trim();
    if (!ad) continue;
    const mevcut = kova.get(ad) ?? { ad, adet: 0, bahis: 0 };
    mevcut.adet += 1;
    mevcut.bahis += Math.abs(sayiyaCevir(row?.amount));
    kova.set(ad, mevcut);
  }
  return [...kova.values()].sort((a, b) => b.adet - a.adet).slice(0, azami);
}

/**
 * Zaman sirasina bakilmaksizin en son atanan/kullanilan bonus.
 *
 * `sonYatirimBonuslari`dan farkli: o liste son YATIRIMDAN SONRAKI
 * bonuslarla sinirli. Bu, oyuncunun genel gecmisindeki EN SON bonus —
 * yatirimla iliskili olsun olmasin.
 */
export function sonKullanilanBonusSec(
  bonuslar: AnyRecord[] | null | undefined,
): { ad: string; tutar: number | null; tarih: string | null; durum: string | null } | null {
  let en: AnyRecord | null = null;
  let enZaman = -Infinity;
  for (const bonus of bonuslar ?? []) {
    const t = Date.parse(String(bonus?.CreatedLocal ?? bonus?.assignedDate ?? ''));
    if (Number.isFinite(t) && t > enZaman) {
      enZaman = t;
      en = bonus;
    }
  }
  if (!en) return null;
  const tutar = Number(en.Amount ?? en.payout);
  return {
    ad: String(en.Name ?? en.bonusName ?? en.templateName ?? 'Bonus'),
    tutar: Number.isFinite(tutar) ? tutar : null,
    tarih: (en.CreatedLocal ?? en.assignedDate ?? null) as string | null,
    durum: en.ResultType ?? en.status ?? null,
  };
}

export type CekimBaglami = {
  playerId: number;
  login: string;
  tutar: number;
  paraBirimi: string;
  /** Cekim talebinin olusturuldugu odeme yontemi ("Havale · HemenOde"). */
  yontem: string | null;
  /** Bu talep dahil, ayni gunku talep sayisi. */
  gunlukCekim: number;
  /** Kasa acisindan kar/zarar; negatifse oyuncu onde. */
  netKarZarar: number | null;
  toplamYatirim: number | null;
  toplamCekim: number | null;
  bakiye: number | null;
  sonYatirimTutari: number | null;
  sonYatirimZamani: string | null;
  sonCekimZamani: string | null;
  /** Son yatirimdan sonra alinan bonuslar. */
  sonYatirimBonuslari: Array<{ ad: string; tutar: number | null }>;
  /** Bonus gecmisi olculebildi mi? */
  bonusOlculdu: boolean;
  notlar: OyuncuNotu[];
  otomatikRed: OtomatikRedKarari;
  // ── Hesap bilgisi
  kayitTarihi: string | null;
  telefonDogrulandi: boolean | null;
  epostaDogrulandi: boolean | null;
  kimlikDogrulandi: boolean | null;
  kategori: string | null;
  // ── Oyun kirilimi (oyuncu pano ucundan)
  yatirimAdedi: number | null;
  cekimAdedi: number | null;
  bonusBakiye: number | null;
  casinoBahis: number | null;
  casinoGgr: number | null;
  sporBahis: number | null;
  sporGgr: number | null;
  /** Freespin + bonus kazanci + odeme + cashback. */
  bonusKaynakliKazanc: number | null;
  /** Hic yatirim yapmadan bakiye biriktirmis mi? */
  yatirimsizBakiye: boolean;
  /** Son yatirimdan SONRA yapilan casino bahis toplami (cevrim). */
  casinoCevrimSonYatirim: number | null;
  /** Son yatirimdan SONRA yapilan spor bahis toplami (cevrim). */
  sporCevrimSonYatirim: number | null;
  /** Zaman sirasina bakilmaksizin en son atanan/kullanilan bonus. */
  sonKullanilanBonus: { ad: string; tutar: number | null; tarih: string | null; durum: string | null } | null;
  /** Son yatirimdan sonra en cok oynanan casino oyunlari, bahis adedine gore. */
  enCokOynananOyunlar: Array<{ ad: string; adet: number; bahis: number }>;
};

function paraYaz(deger: number | null, kur = 'TRY'): string {
  if (deger === null || !Number.isFinite(deger)) return '—';
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(deger)} ${kur}`;
}

function saatYaz(iso: unknown): string {
  const t = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(t)) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(t));
}

/** Gun sayisi — "3 gün önce" gibi okunabilir yas bilgisi. */
function gunFarki(iso: string | null, simdi: number): number | null {
  const t = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(t)) return null;
  return Math.floor((simdi - t) / 86_400_000);
}

function yasYaz(iso: string | null, simdi: number): string {
  const gun = gunFarki(iso, simdi);
  if (gun === null) return saatYaz(iso);
  if (gun === 0) return `${saatYaz(iso)} (bugün)`;
  if (gun === 1) return `${saatYaz(iso)} (dün)`;
  return `${saatYaz(iso)} (${gun} gün önce)`;
}

/** Üç durumlu onay işareti: evet / hayır / ölçülemedi. */
function onayYaz(deger: boolean | null): string {
  if (deger === null) return '❔ bilinmiyor';
  return deger ? '✅' : '❌';
}

/**
 * Zenginlestirilmis cekim bildirimi.
 *
 * Operatorun karar icin bakacagi her sey tek mesajda, BOLUMLENMIS ve
 * emojili: once uyarilar, sonra hesap, para, oyun, bonus ve notlar.
 * Sirasi bilincli — riskli bir sey varsa ilk ekranda gorunmeli, telefon
 * icin asagi kaydirmak gerekmemeli.
 *
 * Olculemeyen alan "—" ya da "bilinmiyor" yazilir; sifir DEGIL. Bir
 * cekim kararinda "0 TL yatirim" ile "yatirim okunamadi" tamamen farkli
 * iki durum.
 */
export function cekimBaglamMesaji(baslik: string, b: CekimBaglami, simdi = Date.now()): string {
  const kazanc = b.netKarZarar === null ? null : -b.netKarZarar;
  const satirlar: string[] = [
    kalinSatir(baslik),
    '━━━━━━━━━━━━━━━━━━',
    `👤 ${b.login || '(ad yok)'} · ${b.playerId}`,
    `💸 ${paraYaz(b.tutar, b.paraBirimi)}`,
    b.yontem ? `🏦 ${b.yontem}` : null,
    // Toplam yatirim/cekim EN USTTE de tekrar edilir — 💰 PARA bolumune
    // kaydirmadan, karar verirken ilk bakista gorunsun diye.
    `📈 Toplam yatırım: ${paraYaz(b.toplamYatirim)} · Toplam çekim: ${paraYaz(b.toplamCekim)}`,
  ].filter((satir): satir is string => satir !== null);

  // ── Uyarilar en uste; riskli bir sey varsa kaydirmadan gorunmeli.
  const uyarilar: string[] = [];
  if (b.otomatikRed.reddet) uyarilar.push(`⛔ ${b.otomatikRed.neden}`);
  if (riskNotuVarMi(b.notlar)) uyarilar.push('🚨 Profilde RİSK notu var');
  if (b.yatirimsizBakiye) uyarilar.push('🎁 Hiç yatırım yok — bakiye bonustan');
  if (b.telefonDogrulandi === false) uyarilar.push('📵 Telefon doğrulanmamış');
  if (vipNotuVarMi(b.notlar)) uyarilar.push('⭐ VIP oyuncu');
  if (uyarilar.length > 0) satirlar.push('', ...uyarilar);

  // ── Hesap
  satirlar.push(
    '',
    kalinSatir('🪪 HESAP'),
    `  Kayıt:    ${b.kayitTarihi ? yasYaz(b.kayitTarihi, simdi) : '—'}`,
    `  Telefon:  ${onayYaz(b.telefonDogrulandi)}   E-posta: ${onayYaz(b.epostaDogrulandi)}   Kimlik: ${onayYaz(b.kimlikDogrulandi)}`,
    `  Kategori: ${b.kategori || '—'}`,
  );

  // ── Para
  satirlar.push(
    '',
    kalinSatir('💰 PARA'),
    `  Bakiye:   ${paraYaz(b.bakiye)}${b.bonusBakiye ? ` (+${paraYaz(b.bonusBakiye)} bonus)` : ''}`,
    `  Yatırım:  ${paraYaz(b.toplamYatirim)}${b.yatirimAdedi !== null ? ` · ${b.yatirimAdedi} işlem` : ''}`,
    `  Çekim:    ${paraYaz(b.toplamCekim)}${b.cekimAdedi !== null ? ` · ${b.cekimAdedi} işlem` : ''}`,
    kazanc === null
      ? '  Kasaya karşı: —'
      : `  Kasaya karşı: oyuncu ${kazanc >= 0 ? '🔴 önde' : '🟢 geride'} ${paraYaz(Math.abs(kazanc))}`,
    `  Son yatırım: ${b.sonYatirimZamani ? `${paraYaz(b.sonYatirimTutari)} · ${yasYaz(b.sonYatirimZamani, simdi)}` : '— (hiç yatırım yok)'}`,
    `  Son çekim:   ${b.sonCekimZamani ? yasYaz(b.sonCekimZamani, simdi) : '— (ilk çekim)'}`,
    `  Bugünkü talep: ${b.gunlukCekim}`,
  );

  // ── Oyun kirilimi; casino ile spor ayri, cunku risk deseni farkli.
  if (b.casinoBahis !== null || b.sporBahis !== null) {
    satirlar.push(
      '',
      kalinSatir('🎰 OYUN'),
      `  Casino: ${paraYaz(b.casinoBahis)} bahis · GGR ${paraYaz(b.casinoGgr)}`,
      `  Spor:   ${paraYaz(b.sporBahis)} bahis · GGR ${paraYaz(b.sporGgr)}`,
    );
    if (b.casinoCevrimSonYatirim !== null || b.sporCevrimSonYatirim !== null) {
      const toplamCevrim = (b.casinoCevrimSonYatirim ?? 0) + (b.sporCevrimSonYatirim ?? 0);
      satirlar.push(
        `  Son yatırımdan sonra çevrim: ${paraYaz(toplamCevrim)} (casino ${paraYaz(b.casinoCevrimSonYatirim)} · spor ${paraYaz(b.sporCevrimSonYatirim)})`,
      );
    }
    if (b.enCokOynananOyunlar.length > 0) {
      const liste = b.enCokOynananOyunlar.map((oyun) => `${oyun.ad} (${oyun.adet})`).join(', ');
      satirlar.push(`  Son yatırımdan sonra en çok oynanan: ${liste}`);
    }
  }

  // ── Bonus. "Yok" ile "olculemedi" ayri seyler.
  satirlar.push('', kalinSatir('🎁 BONUS'));
  if (b.bonusKaynakliKazanc !== null) {
    satirlar.push(`  Bonustan kazanç: ${paraYaz(b.bonusKaynakliKazanc)}`);
  }
  satirlar.push(
    b.sonKullanilanBonus
      ? `  Son kullanılan bonus: ${b.sonKullanilanBonus.ad}${b.sonKullanilanBonus.tutar ? ` (${paraYaz(b.sonKullanilanBonus.tutar)})` : ''}${b.sonKullanilanBonus.durum ? ` · ${b.sonKullanilanBonus.durum}` : ''}${b.sonKullanilanBonus.tarih ? ` · ${yasYaz(b.sonKullanilanBonus.tarih, simdi)}` : ''}`
      : '  Son kullanılan bonus: —',
  );
  if (!b.bonusOlculdu) {
    satirlar.push('  Son yatırım sonrası: ölçülemedi');
  } else if (b.sonYatirimBonuslari.length === 0) {
    satirlar.push('  Son yatırım sonrası: bonus yok');
  } else {
    satirlar.push(`  Son yatırım sonrası ${b.sonYatirimBonuslari.length} bonus:`);
    for (const bonus of b.sonYatirimBonuslari.slice(0, 6)) {
      satirlar.push(`    • ${bonus.ad}${bonus.tutar ? ` (${paraYaz(bonus.tutar)})` : ''}`);
    }
    if (b.sonYatirimBonuslari.length > 6) {
      satirlar.push(`    • … ${b.sonYatirimBonuslari.length - 6} bonus daha`);
    }
  }

  // ── Notlar
  satirlar.push('', kalinSatir('📝 NOTLAR'));
  if (b.notlar.length > 0) {
    for (const not of b.notlar.slice(0, 5)) {
      satirlar.push(`  • [${String(not.noteType ?? '—')}] ${String(not.text ?? '')} — ${String(not.noteCreatedUserEmail ?? '')}`);
    }
    if (b.notlar.length > 5) satirlar.push(`  • … ${b.notlar.length - 5} not daha`);
  } else {
    satirlar.push('  Profil notu yok.');
  }

  return gorselMesaj(satirlar);
}

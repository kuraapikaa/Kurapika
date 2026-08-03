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

export type CekimBaglami = {
  playerId: number;
  login: string;
  tutar: number;
  paraBirimi: string;
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

/**
 * Zenginlestirilmis cekim bildirimi.
 *
 * Operatorun karar icin bakacagi her sey tek mesajda: kim, ne kadar,
 * kasaya karsi durumu, son yatirimi, o yatirimdan sonra aldigi
 * bonuslar, son cekimi, profil notlari ve gunluk talep sayisi.
 *
 * Olculemeyen alan "—" yazilir, sifir DEGIL.
 */
export function cekimBaglamMesaji(baslik: string, b: CekimBaglami): string {
  const kazanc = b.netKarZarar === null ? null : -b.netKarZarar;
  const satirlar: Array<string | null> = [
    baslik,
    `${b.login || '(ad yok)'} (${b.playerId})`,
    `Tutar: ${paraYaz(b.tutar, b.paraBirimi)}`,
    '',
  ];

  if (riskNotuVarMi(b.notlar)) satirlar.push('🚨 PROFİLDE RİSK NOTU VAR');
  if (vipNotuVarMi(b.notlar)) satirlar.push('⭐ VIP');
  if (b.otomatikRed.reddet) satirlar.push(`⛔ ${b.otomatikRed.neden}`);
  if (riskNotuVarMi(b.notlar) || vipNotuVarMi(b.notlar) || b.otomatikRed.reddet) satirlar.push('');

  satirlar.push(
    `Bakiye: ${paraYaz(b.bakiye)}`,
    `Toplam yatırım: ${paraYaz(b.toplamYatirim)}`,
    `Toplam çekim: ${paraYaz(b.toplamCekim)}`,
    kazanc === null ? 'Kasaya karşı: —' : `Kasaya karşı: oyuncu ${kazanc >= 0 ? 'önde' : 'geride'} ${paraYaz(Math.abs(kazanc))}`,
    '',
    `Son yatırım: ${paraYaz(b.sonYatirimTutari)} · ${saatYaz(b.sonYatirimZamani)}`,
    `Son çekim: ${saatYaz(b.sonCekimZamani)}`,
    `Bugünkü talep: ${b.gunlukCekim}`,
  );

  // "Bonus yok" ile "bonus olculemedi" ayri seyler.
  if (!b.bonusOlculdu) {
    satirlar.push('', 'Son yatırım sonrası bonus: ölçülemedi');
  } else if (b.sonYatirimBonuslari.length === 0) {
    satirlar.push('', 'Son yatırım sonrası bonus: yok');
  } else {
    satirlar.push('', `Son yatırım sonrası ${b.sonYatirimBonuslari.length} bonus:`);
    for (const bonus of b.sonYatirimBonuslari.slice(0, 6)) {
      satirlar.push(`  • ${bonus.ad}${bonus.tutar ? ` (${paraYaz(bonus.tutar)})` : ''}`);
    }
    if (b.sonYatirimBonuslari.length > 6) {
      satirlar.push(`  • … ${b.sonYatirimBonuslari.length - 6} bonus daha`);
    }
  }

  if (b.notlar.length > 0) {
    satirlar.push('', 'Profil notları:');
    for (const not of b.notlar.slice(0, 5)) {
      satirlar.push(`  • [${String(not.noteType ?? '—')}] ${String(not.text ?? '')} — ${String(not.noteCreatedUserEmail ?? '')}`);
    }
    if (b.notlar.length > 5) satirlar.push(`  • … ${b.notlar.length - 5} not daha`);
  } else {
    satirlar.push('', 'Profil notu yok.');
  }

  return satirlar.filter((s) => s !== null).join('\n');
}

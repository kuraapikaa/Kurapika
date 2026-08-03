/**
 * Manuel bakiye duzeltmeleri raporu.
 *
 * ── Neden ayri bir rapor ──────────────────────────────────────────────
 *
 *   GET /api/platform/api/v1.0/CorrectionHistory/sites/{siteId}
 *
 * Bu uc, panelin baska hicbir yerinde olmayan bir alan tasiyor:
 * `userName` — duzeltmeyi YAPAN yonetici. Panelin kendi denetim kaydi
 * yalnizca PANELDEN yapilan islemleri goruyor; Lynon arayuzunden elle
 * yapilan bakiye eklemeleri oraya hic dusmuyor. Kasadan para cikaran
 * ikinci bir yol vardi ve panelde gorunmuyordu.
 *
 * ── Hesap turu onemli ─────────────────────────────────────────────────
 *
 * `accountName` her zaman ana hesap degil: gozlemlenen ornek
 * `PlayerUnusedBalance`. Ana bakiyeye para eklemek ile kullanilmayan
 * bakiyeye eklemek AYNI SEY DEGIL; tutari toplarken hesap turunu
 * kaybetmek raporu yaniltir.
 *
 * ── Notsuz duzeltme ───────────────────────────────────────────────────
 *
 * Gozlemlenen not: `"info sarp "`. Manuel para hareketinin gerekcesi
 * denetlenebilir olmali; bos ya da anlamsiz kisa notlar ayrica
 * sayiliyor. Bu bir suclama degil, kapanmasi gereken bir kayit boslugu.
 */
import { istanbulDateKey } from '../lib/istanbulGunu.js';

type AnyRecord = Record<string, any>;

export type HamDuzeltme = {
  id?: unknown;
  playerId?: unknown;
  accountName?: unknown;
  updateBalanceType?: unknown;
  amount?: unknown;
  currency?: unknown;
  userName?: unknown;
  createdAt?: unknown;
  note?: unknown;
  category?: { categoryName?: unknown } | null;
};

/** Kimlik → oyuncu adi. Bulunamayan kimlik icin kayit OLMAMALI. */
export type OyuncuAdlari = Map<string, { login?: string | null; adSoyad?: string | null }>;

export type DuzeltmeYonu = 'giris' | 'cikis' | 'bilinmiyor';

/**
 * Duzeltmenin yonu.
 *
 * Bilinmeyen tur `'bilinmiyor'` doner ve tutar hicbir toplama katilmaz.
 * Yonu bilinmeyen bir hareketi "giris" saymak, kasa raporunu sessizce
 * yanlislar.
 */
export function duzeltmeYonu(updateBalanceType: unknown): DuzeltmeYonu {
  const tur = String(updateBalanceType ?? '').trim().toLowerCase();
  if (tur === 'crediting' || tur === 'credit' || tur === 'increase') return 'giris';
  if (tur === 'debiting' || tur === 'debit' || tur === 'decrease') return 'cikis';
  return 'bilinmiyor';
}

function sayi(deger: unknown): number {
  if (deger === null || deger === undefined || deger === '') return 0;
  const n = Number(String(deger).replace(/[^\d.,+-]/g, '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function metin(deger: unknown): string {
  return String(deger ?? '').trim();
}

/** Notu anlamli sayilmasi icin gereken en az karakter. */
export const ANLAMLI_NOT_UZUNLUGU = 4;

export function notAnlamliMi(not: unknown): boolean {
  return metin(not).length >= ANLAMLI_NOT_UZUNLUGU;
}

export type DuzeltmeSatiri = {
  Id: number;
  ClientId: number;
  ClientLogin: string;
  Hesap: string;
  Yon: DuzeltmeYonu;
  Tutar: number;
  /** Yone gore isaretli tutar; toplamlar bunu kullanir. */
  NetTutar: number;
  ParaBirimi: string;
  Yapan: string;
  Not: string;
  NotAnlamli: boolean;
  Kategori: string | null;
  CreatedLocal: string | null;
};

export function duzeltmeSatiri(ham: HamDuzeltme, adlar?: OyuncuAdlari): DuzeltmeSatiri {
  const playerId = metin(ham?.playerId);
  const oyuncu = adlar?.get(playerId);
  const yon = duzeltmeYonu(ham?.updateBalanceType);
  const tutar = Math.abs(sayi(ham?.amount));

  return {
    Id: sayi(ham?.id),
    ClientId: sayi(playerId),
    // Ad bulunamadiysa BOS kalir; kimlik ada terfi ettirilmez.
    ClientLogin: oyuncu?.login ?? '',
    Hesap: metin(ham?.accountName) || 'Bilinmiyor',
    Yon: yon,
    Tutar: tutar,
    // Yonu bilinmeyen hareket toplama katilmaz.
    NetTutar: yon === 'giris' ? tutar : yon === 'cikis' ? -tutar : 0,
    ParaBirimi: metin(ham?.currency) || 'TRY',
    Yapan: metin(ham?.userName) || 'Bilinmiyor',
    Not: metin(ham?.note),
    NotAnlamli: notAnlamliMi(ham?.note),
    Kategori: metin(ham?.category?.categoryName) || null,
    CreatedLocal: (ham?.createdAt as string | null) ?? null,
  };
}

/** Turkiye gunune gore aralik suzgeci. Tarihi cozulemeyen satir DUSER. */
export function tarihAraligindakiDuzeltmeler(
  kayitlar: HamDuzeltme[] | null | undefined,
  aralik: { startDate?: string | null; endDate?: string | null },
): HamDuzeltme[] {
  const { startDate, endDate } = aralik;
  if (!startDate && !endDate) return [...(kayitlar ?? [])];
  return (kayitlar ?? []).filter((kayit) => {
    const gun = istanbulDateKey(String(kayit?.createdAt ?? ''));
    if (!gun) return false;
    if (startDate && gun < startDate) return false;
    if (endDate && gun > endDate) return false;
    return true;
  });
}

export type YapanOzeti = {
  yapan: string;
  adet: number;
  giris: number;
  cikis: number;
  net: number;
  notsuz: number;
};

/**
 * Yonetici bazinda ozet.
 *
 * "Bu ay kim ne kadar elle bakiye ekledi" sorusunun tek satirlik cevabi.
 * Notsuz islem sayisi ayrica tasiniyor.
 */
export function yapanBazindaOzet(satirlar: DuzeltmeSatiri[] | null | undefined): YapanOzeti[] {
  const kova = new Map<string, YapanOzeti>();
  for (const satir of satirlar ?? []) {
    const yapan = satir?.Yapan || 'Bilinmiyor';
    const mevcut = kova.get(yapan) ?? { yapan, adet: 0, giris: 0, cikis: 0, net: 0, notsuz: 0 };
    mevcut.adet += 1;
    if (satir.Yon === 'giris') mevcut.giris += satir.Tutar;
    if (satir.Yon === 'cikis') mevcut.cikis += satir.Tutar;
    mevcut.net += satir.NetTutar;
    if (!satir.NotAnlamli) mevcut.notsuz += 1;
    kova.set(yapan, mevcut);
  }
  return [...kova.values()].sort((a, b) => b.giris - a.giris);
}

export type HesapOzeti = { hesap: string; adet: number; giris: number; cikis: number; net: number };

/**
 * Hesap turu bazinda ozet.
 *
 * `PlayerAccount` ile `PlayerUnusedBalance` ayni kalem degil; tek bir
 * toplam ikisini birbirine karistirir.
 */
export function hesapBazindaOzet(satirlar: DuzeltmeSatiri[] | null | undefined): HesapOzeti[] {
  const kova = new Map<string, HesapOzeti>();
  for (const satir of satirlar ?? []) {
    const hesap = satir?.Hesap || 'Bilinmiyor';
    const mevcut = kova.get(hesap) ?? { hesap, adet: 0, giris: 0, cikis: 0, net: 0 };
    mevcut.adet += 1;
    if (satir.Yon === 'giris') mevcut.giris += satir.Tutar;
    if (satir.Yon === 'cikis') mevcut.cikis += satir.Tutar;
    mevcut.net += satir.NetTutar;
    kova.set(hesap, mevcut);
  }
  return [...kova.values()].sort((a, b) => b.adet - a.adet);
}

export type DuzeltmeToplami = {
  adet: number;
  giris: number;
  cikis: number;
  net: number;
  notsuz: number;
  yonuBilinmeyen: number;
  oyuncuSayisi: number;
};

export function duzeltmeToplami(satirlar: DuzeltmeSatiri[] | null | undefined): DuzeltmeToplami {
  const liste = satirlar ?? [];
  const oyuncular = new Set<number>();
  let giris = 0;
  let cikis = 0;
  let notsuz = 0;
  let yonuBilinmeyen = 0;

  for (const satir of liste) {
    if (satir.Yon === 'giris') giris += satir.Tutar;
    else if (satir.Yon === 'cikis') cikis += satir.Tutar;
    else yonuBilinmeyen += 1;
    if (!satir.NotAnlamli) notsuz += 1;
    if (satir.ClientId) oyuncular.add(satir.ClientId);
  }

  return {
    adet: liste.length,
    giris,
    cikis,
    net: giris - cikis,
    notsuz,
    yonuBilinmeyen,
    oyuncuSayisi: oyuncular.size,
  };
}

/** Ekranda ve botta ayni siralama: en yeni once. */
export function tarihineGoreSirala(satirlar: DuzeltmeSatiri[]): DuzeltmeSatiri[] {
  return [...satirlar].sort((a, b) =>
    String(b.CreatedLocal ?? '').localeCompare(String(a.CreatedLocal ?? '')),
  );
}

export type { AnyRecord };

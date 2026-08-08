import { randomBytes } from 'crypto';
import { degistir, kayitOku, oku } from '../lib/depo.js';
import { coz, maskele, sifrele, sifrelemeHazirMi } from '../lib/sifre.js';

/**
 * LYNON WEBHOOK PAYLAŞILAN SIRRI.
 *
 * ── Neden ÖZET değil ŞİFRELİ ──
 *
 * S2S anahtarı yalnızca karşılaştırılıyor, bu yüzden özeti yetiyor.
 * Webhook sırrıyla HMAC HESAPLIYORUZ; asıl değere ihtiyaç var, tek yön
 * bir özet işe yaramaz. Bu yüzden AES-256-GCM ile şifreli duruyor
 * (`AFF_SECRET_KEY`) ve düz metin hiçbir yerde yazılı kalmıyor.
 *
 * Sonuç olarak bu sır, panel veritabanı sızsa bile şifreleme anahtarı
 * olmadan kullanılamaz.
 */

const ALAN = 'webhook-sirri';

interface SirBelgesi {
  sifreli: string | null;
  guncellendi: string | null;
}

const cozBelge = (ham: unknown): SirBelgesi => {
  const kayit = kayitOku(ham);
  return {
    sifreli: typeof kayit.sifreli === 'string' ? kayit.sifreli : null,
    guncellendi: typeof kayit.guncellendi === 'string' ? kayit.guncellendi : null,
  };
};

export interface SirDurumu {
  kuruluMu: boolean;
  /** Yalnızca son karakterler; tam değer HİÇBİR uçtan dönmüyor. */
  maskeli: string | null;
  guncellendi: string | null;
}

export async function sirDurumu(kiraci: string): Promise<SirDurumu> {
  const belge = await oku<SirBelgesi>(kiraci, ALAN, cozBelge);
  const duz = belge.sifreli ? coz(belge.sifreli) : null;
  return {
    kuruluMu: Boolean(belge.sifreli),
    maskeli: duz ? maskele(duz) : null,
    guncellendi: belge.guncellendi,
  };
}

/** HMAC hesaplamak için; yalnızca sunucu içinde kullanılır. */
export async function sirriOku(kiraci: string): Promise<string | null> {
  const belge = await oku<SirBelgesi>(kiraci, ALAN, cozBelge);
  if (!belge.sifreli) return null;
  return coz(belge.sifreli);
}

export async function sirriYaz(kiraci: string, duz: string, simdi = new Date()): Promise<void> {
  const temiz = String(duz ?? '').trim();
  if (temiz.length < 16) {
    throw new Error('Webhook sırrı en az 16 karakter olmalı.');
  }
  if (!sifrelemeHazirMi()) {
    // Sifrelenemeyen bir sir duz metin olarak yazilirdi; yazmamak dogru
    // olan. Panel bu durumda webhook'u kabul etmiyor.
    throw new Error('AFF_SECRET_KEY tanımlı değil; webhook sırrı saklanamaz.');
  }
  const sifreliDeger = sifrele(temiz);
  await degistir<SirBelgesi, void>(kiraci, ALAN, cozBelge, (belge) => {
    belge.sifreli = sifreliDeger;
    belge.guncellendi = simdi.toISOString();
  });
}

/** Lynon tarafına verilmek üzere yeni sır üretir; düz metin bir kez döner. */
export async function sirUret(kiraci: string, simdi = new Date()): Promise<string> {
  const duz = randomBytes(32).toString('base64url');
  await sirriYaz(kiraci, duz, simdi);
  return duz;
}

export async function sirriSil(kiraci: string): Promise<void> {
  await degistir<SirBelgesi, void>(kiraci, ALAN, cozBelge, (belge) => {
    belge.sifreli = null;
    belge.guncellendi = null;
  });
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { safeTenantKey } from '../lib/tenant.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';

/**
 * Affiliate (is ortagi) hesaplari.
 *
 * Ortaklik basvurusu zaten aliniyordu (forms.ts partnershipRequests) ama
 * onaylanan basvurunun karsiliginda hicbir sey olusmuyordu: ortak kendi
 * performansini goremiyor, komisyonu elle hesaplaniyordu. Bu servis
 * basvuru ile BTag arasindaki bagi kuruyor.
 *
 * Depolama tenant basina TEK dokuman. Ortak sayisi oyuncu sayisi degil —
 * onlarca mertebesinde; ortak basina ayri dokuman liste ekranini N istege
 * dondururdu. [[crmService]] ile ayni gerekce.
 *
 * GUVENLIK: bu dosya kimlik dogrulama verisi tutuyor. passwordHash disari
 * hicbir yolla sizmamali; kamuya donen her yerde hesapGorunum() kullanilir.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AFFILIATE_DIR = path.join(__dirname, '..', 'data', 'affiliate');

/**
 * Komisyon modelleri.
 *
 * revshare  net gelirin yuzdesi (surekli)
 * cpa       donusen oyuncu basina sabit tutar
 * hibrit    ikisi birden — dusuk revshare + dusuk CPA
 */
export const KOMISYON_MODELLERI = ['revshare', 'cpa', 'hibrit'] as const;
export type KomisyonModeli = (typeof KOMISYON_MODELLERI)[number];

export const HESAP_DURUMLARI = ['aktif', 'beklemede', 'askida'] as const;
export type HesapDurumu = (typeof HESAP_DURUMLARI)[number];

export type AffiliateHesap = {
  id: string;
  /** Lynon raporlarindaki BTag. Ortagin tum verisi buna baglaniyor. */
  bTag: string;
  ad: string;
  email: string;
  passwordHash: string;
  komisyonModeli: KomisyonModeli;
  /** revshare/hibrit icin yuzde (0-100). */
  revsharePayi: number;
  /** cpa/hibrit icin donusen oyuncu basina TRY. */
  cpaTutari: number;
  durum: HesapDurumu;
  /** Hangi ortaklik basvurusundan olustu (varsa). */
  basvuruId?: string;
  not?: string;
  createdAt: string;
  sonGiris?: string;
};

/** Disari donen gorunum — passwordHash ASLA yok. */
export type AffiliateHesapGorunum = Omit<AffiliateHesap, 'passwordHash'>;

type AffiliateDokuman = { hesaplar: AffiliateHesap[] };

export function ensureAffiliateDir(): void {
  fs.mkdirSync(AFFILIATE_DIR, { recursive: true });
}

function affiliatePath(tenantKey: string): string {
  return path.join(AFFILIATE_DIR, `${safeTenantKey(tenantKey)}.json`);
}

async function oku(tenantKey: string): Promise<AffiliateDokuman> {
  const data = await readStoredDocument<AffiliateDokuman>({
    tenantKey: safeTenantKey(tenantKey),
    namespace: 'affiliate-hesaplar',
    filePath: affiliatePath(tenantKey),
    fallback: () => ({ hesaplar: [] }),
  });
  return { hesaplar: Array.isArray(data?.hesaplar) ? data.hesaplar : [] };
}

async function yaz(tenantKey: string, dokuman: AffiliateDokuman): Promise<void> {
  ensureAffiliateDir();
  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: 'affiliate-hesaplar', filePath: affiliatePath(tenantKey) },
    dokuman,
  );
}

/** passwordHash'i ayiklar. Disari donen her yol bundan gecmeli. */
export function hesapGorunum(hesap: AffiliateHesap): AffiliateHesapGorunum {
  const { passwordHash: _atilan, ...gorunum } = hesap;
  return gorunum;
}

/** E-posta karsilastirmasi buyuk/kucuk harf ve bosluk duyarsiz. */
export function epostaAnahtari(email: string): string {
  return String(email ?? '').trim().toLocaleLowerCase('en-US');
}

/** BTag karsilastirmasi da duyarsiz; Lynon bazen farkli kasada donduruyor. */
export function bTagAnahtari(bTag: string): string {
  return String(bTag ?? '').trim().toLocaleLowerCase('en-US');
}

export async function hesaplar(tenantKey = 'default'): Promise<AffiliateHesapGorunum[]> {
  const { hesaplar: liste } = await oku(tenantKey);
  return liste.map(hesapGorunum);
}

/**
 * Girise aday hesabi dondurur — passwordHash DAHIL.
 *
 * Yalnizca kimlik dogrulama yolundan cagrilmali; sonucu dogrudan yanita
 * koymak parola hash'ini disari sizdirir.
 */
export async function hesapBulKimlikIcin(
  email: string,
  tenantKey = 'default',
): Promise<AffiliateHesap | undefined> {
  const anahtar = epostaAnahtari(email);
  if (!anahtar) return undefined;
  const { hesaplar: liste } = await oku(tenantKey);
  return liste.find((h) => epostaAnahtari(h.email) === anahtar);
}

export async function hesapBulId(id: string, tenantKey = 'default'): Promise<AffiliateHesapGorunum | undefined> {
  const { hesaplar: liste } = await oku(tenantKey);
  const bulunan = liste.find((h) => h.id === id);
  return bulunan ? hesapGorunum(bulunan) : undefined;
}

export type YeniHesapGirdisi = {
  bTag: string;
  ad: string;
  email: string;
  passwordHash: string;
  komisyonModeli?: KomisyonModeli;
  revsharePayi?: number;
  cpaTutari?: number;
  durum?: HesapDurumu;
  basvuruId?: string;
  not?: string;
};

export class AffiliateHesapHatasi extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
    this.name = 'AffiliateHesapHatasi';
  }
}

export async function hesapEkle(girdi: YeniHesapGirdisi, tenantKey = 'default'): Promise<AffiliateHesapGorunum> {
  const email = String(girdi.email ?? '').trim();
  const bTag = String(girdi.bTag ?? '').trim();
  const ad = String(girdi.ad ?? '').trim();
  if (!email) throw new AffiliateHesapHatasi('E-posta zorunludur.');
  if (!bTag) throw new AffiliateHesapHatasi('BTag zorunludur.');
  if (!ad) throw new AffiliateHesapHatasi('Ortak adı zorunludur.');
  if (!girdi.passwordHash) throw new AffiliateHesapHatasi('Parola zorunludur.');

  const dokuman = await oku(tenantKey);
  // E-posta ve BTag benzersiz olmali: ayni BTag iki hesaba baglanirsa
  // komisyon iki kez odenir.
  if (dokuman.hesaplar.some((h) => epostaAnahtari(h.email) === epostaAnahtari(email))) {
    throw new AffiliateHesapHatasi('Bu e-posta ile kayıtlı bir ortak zaten var.', 409);
  }
  if (dokuman.hesaplar.some((h) => bTagAnahtari(h.bTag) === bTagAnahtari(bTag))) {
    throw new AffiliateHesapHatasi('Bu BTag başka bir ortağa bağlı.', 409);
  }

  const hesap: AffiliateHesap = {
    id: randomUUID(),
    bTag,
    ad,
    email,
    passwordHash: girdi.passwordHash,
    komisyonModeli: KOMISYON_MODELLERI.includes(girdi.komisyonModeli as KomisyonModeli)
      ? (girdi.komisyonModeli as KomisyonModeli)
      : 'revshare',
    revsharePayi: sayiAralikta(girdi.revsharePayi, 0, 100, 25),
    cpaTutari: sayiAralikta(girdi.cpaTutari, 0, Number.MAX_SAFE_INTEGER, 0),
    durum: HESAP_DURUMLARI.includes(girdi.durum as HesapDurumu) ? (girdi.durum as HesapDurumu) : 'aktif',
    basvuruId: girdi.basvuruId,
    not: girdi.not,
    createdAt: new Date().toISOString(),
  };

  dokuman.hesaplar.unshift(hesap);
  await yaz(tenantKey, dokuman);
  return hesapGorunum(hesap);
}

export type HesapGuncelleme = Partial<
  Pick<AffiliateHesap, 'ad' | 'bTag' | 'komisyonModeli' | 'revsharePayi' | 'cpaTutari' | 'durum' | 'not' | 'passwordHash'>
>;

export async function hesapGuncelle(
  id: string,
  degisiklik: HesapGuncelleme,
  tenantKey = 'default',
): Promise<AffiliateHesapGorunum> {
  const dokuman = await oku(tenantKey);
  const idx = dokuman.hesaplar.findIndex((h) => h.id === id);
  if (idx < 0) throw new AffiliateHesapHatasi('Ortak bulunamadı.', 404);

  const mevcut = dokuman.hesaplar[idx];

  if (degisiklik.bTag != null) {
    const yeniBTag = String(degisiklik.bTag).trim();
    if (!yeniBTag) throw new AffiliateHesapHatasi('BTag boş olamaz.');
    const cakisma = dokuman.hesaplar.some(
      (h) => h.id !== id && bTagAnahtari(h.bTag) === bTagAnahtari(yeniBTag),
    );
    if (cakisma) throw new AffiliateHesapHatasi('Bu BTag başka bir ortağa bağlı.', 409);
    mevcut.bTag = yeniBTag;
  }

  if (degisiklik.ad != null) mevcut.ad = String(degisiklik.ad).trim() || mevcut.ad;
  if (degisiklik.not != null) mevcut.not = String(degisiklik.not);
  if (degisiklik.passwordHash) mevcut.passwordHash = degisiklik.passwordHash;
  if (KOMISYON_MODELLERI.includes(degisiklik.komisyonModeli as KomisyonModeli)) {
    mevcut.komisyonModeli = degisiklik.komisyonModeli as KomisyonModeli;
  }
  if (HESAP_DURUMLARI.includes(degisiklik.durum as HesapDurumu)) {
    mevcut.durum = degisiklik.durum as HesapDurumu;
  }
  if (degisiklik.revsharePayi != null) mevcut.revsharePayi = sayiAralikta(degisiklik.revsharePayi, 0, 100, mevcut.revsharePayi);
  if (degisiklik.cpaTutari != null) {
    mevcut.cpaTutari = sayiAralikta(degisiklik.cpaTutari, 0, Number.MAX_SAFE_INTEGER, mevcut.cpaTutari);
  }

  dokuman.hesaplar[idx] = mevcut;
  await yaz(tenantKey, dokuman);
  return hesapGorunum(mevcut);
}

export async function hesapSil(id: string, tenantKey = 'default'): Promise<void> {
  const dokuman = await oku(tenantKey);
  const kalan = dokuman.hesaplar.filter((h) => h.id !== id);
  if (kalan.length === dokuman.hesaplar.length) throw new AffiliateHesapHatasi('Ortak bulunamadı.', 404);
  dokuman.hesaplar = kalan;
  await yaz(tenantKey, dokuman);
}

export async function sonGirisIsle(id: string, tenantKey = 'default'): Promise<void> {
  const dokuman = await oku(tenantKey);
  const hesap = dokuman.hesaplar.find((h) => h.id === id);
  if (!hesap) return;
  hesap.sonGiris = new Date().toISOString();
  await yaz(tenantKey, dokuman);
}

function sayiAralikta(deger: unknown, alt: number, ust: number, varsayilan: number): number {
  const n = Number(deger);
  if (!Number.isFinite(n)) return varsayilan;
  return Math.min(ust, Math.max(alt, n));
}

// ─── Komisyon ────────────────────────────────────────────────────────────────

export type KomisyonGirdisi = {
  komisyonModeli: KomisyonModeli;
  revsharePayi: number;
  cpaTutari: number;
};

export type KomisyonSonucu = {
  revshare: number;
  cpa: number;
  toplam: number;
  aciklama: string;
};

/**
 * Ortagin hakedisi.
 *
 * NEGATIF NET GELIR SIFIRA KIRPILIR: kasa o ay zarar ettiyse ortaktan para
 * talep edilmiyor, komisyon 0 oluyor. Kirpilmasaydi negatif komisyon
 * toplamlara karisir ve odeme raporu anlamsizlasirdi.
 *
 * Saf fonksiyon: bu sayilar odeme kararini etkiliyor, sessizce kaymamali.
 */
export function komisyonHesapla(
  netGelir: number,
  donusenOyuncu: number,
  girdi: KomisyonGirdisi,
): KomisyonSonucu {
  const gelir = Number.isFinite(netGelir) ? Math.max(0, netGelir) : 0;
  const oyuncu = Number.isFinite(donusenOyuncu) ? Math.max(0, donusenOyuncu) : 0;
  const pay = sayiAralikta(girdi.revsharePayi, 0, 100, 0);
  const cpaBirim = sayiAralikta(girdi.cpaTutari, 0, Number.MAX_SAFE_INTEGER, 0);

  const revshareUygular = girdi.komisyonModeli === 'revshare' || girdi.komisyonModeli === 'hibrit';
  const cpaUygular = girdi.komisyonModeli === 'cpa' || girdi.komisyonModeli === 'hibrit';

  const revshare = revshareUygular ? (gelir * pay) / 100 : 0;
  const cpa = cpaUygular ? oyuncu * cpaBirim : 0;

  const parcalar: string[] = [];
  if (revshareUygular) parcalar.push(`net gelir ${gelir.toFixed(2)} × %${pay} = ${revshare.toFixed(2)}`);
  if (cpaUygular) parcalar.push(`${oyuncu} dönüşen oyuncu × ${cpaBirim.toFixed(2)} = ${cpa.toFixed(2)}`);

  return {
    revshare,
    cpa,
    toplam: revshare + cpa,
    aciklama: parcalar.join(' + ') || 'Komisyon modeli tanımsız.',
  };
}

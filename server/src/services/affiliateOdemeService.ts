import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { safeTenantKey } from '../lib/tenant.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';

/**
 * Affiliate odeme kayitlari.
 *
 * Hakedis hesaplaniyordu ama "odendi mi" hicbir yerde tutulmuyordu.
 * Sonuc: ayni donem iki kez odenebiliyor ya da hic odenmeden atlanabiliyor,
 * ve ortak "gecen ay ne aldim" sorusunu sorunca cevap yoktu.
 *
 * Kayitlar tenant basina tek dokumanda; odeme hacmi dusuk (ortak sayisi x
 * donem sayisi). [[affiliateAccountService]] ile ayni gerekce.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ODEME_DIR = path.join(__dirname, '..', 'data', 'affiliate-odeme');

export const ODEME_DURUMLARI = ['bekliyor', 'odendi', 'iptal'] as const;
export type OdemeDurumu = (typeof ODEME_DURUMLARI)[number];

export type AffiliateOdeme = {
  id: string;
  ortakId: string;
  bTag: string;
  /** Donem etiketi: "2026-07" ya da "2026-07-01/2026-07-31". */
  donem: string;
  donemBaslangic: string;
  donemBitis: string;
  /** Hesaplandigi andaki tutar; sonradan rapor degisse bile SABIT kalir. */
  tutar: number;
  /** Hesaplamanin dayandigi sayilar — sonradan denetlenebilsin. */
  netGelir: number;
  aktifOyuncu: number;
  komisyonModeli: string;
  revsharePayi: number;
  cpaTutari: number;
  durum: OdemeDurumu;
  not?: string;
  /** Kaydi olusturan panel kullanicisi. */
  olusturan: string;
  createdAt: string;
  odenmeTarihi?: string;
  odeyen?: string;
};

type OdemeDokuman = { odemeler: AffiliateOdeme[] };

export class AffiliateOdemeHatasi extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
    this.name = 'AffiliateOdemeHatasi';
  }
}

function odemePath(tenantKey: string): string {
  return path.join(ODEME_DIR, `${safeTenantKey(tenantKey)}.json`);
}

async function oku(tenantKey: string): Promise<OdemeDokuman> {
  const data = await readStoredDocument<OdemeDokuman>({
    tenantKey: safeTenantKey(tenantKey),
    namespace: 'affiliate-odeme',
    filePath: odemePath(tenantKey),
    fallback: () => ({ odemeler: [] }),
  });
  return { odemeler: Array.isArray(data?.odemeler) ? data.odemeler : [] };
}

async function yaz(tenantKey: string, dokuman: OdemeDokuman): Promise<void> {
  fs.mkdirSync(ODEME_DIR, { recursive: true });
  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: 'affiliate-odeme', filePath: odemePath(tenantKey) },
    dokuman,
  );
}

/** Ayni ortak + ayni donem icin iptal edilmemis kayit var mi? */
export function cakisanKayit(
  odemeler: AffiliateOdeme[],
  ortakId: string,
  donem: string,
): AffiliateOdeme | undefined {
  return odemeler.find((o) => o.ortakId === ortakId && o.donem === donem && o.durum !== 'iptal');
}

export type YeniOdeme = {
  ortakId: string;
  bTag: string;
  donem: string;
  donemBaslangic: string;
  donemBitis: string;
  tutar: number;
  netGelir: number;
  aktifOyuncu: number;
  komisyonModeli: string;
  revsharePayi: number;
  cpaTutari: number;
  not?: string;
  olusturan: string;
};

export async function odemeKaydet(girdi: YeniOdeme, tenantKey = 'default'): Promise<AffiliateOdeme> {
  if (!girdi.ortakId) throw new AffiliateOdemeHatasi('Ortak seçilmedi.');
  if (!girdi.donem) throw new AffiliateOdemeHatasi('Dönem zorunludur.');
  const tutar = Number(girdi.tutar);
  if (!Number.isFinite(tutar) || tutar < 0) throw new AffiliateOdemeHatasi('Geçersiz tutar.');

  const dokuman = await oku(tenantKey);

  // MUKERRER ODEME KORUMASI: ayni donem iki kez odenmesin.
  // Iptal edilmis kayit engel degil — yanlis girilen kayit iptal edilip
  // yeniden olusturulabilmeli.
  const cakisma = cakisanKayit(dokuman.odemeler, girdi.ortakId, girdi.donem);
  if (cakisma) {
    throw new AffiliateOdemeHatasi(
      `Bu ortak için ${girdi.donem} dönemi zaten kayıtlı (${cakisma.durum}).`,
      409,
    );
  }

  const kayit: AffiliateOdeme = {
    id: randomUUID(),
    ortakId: girdi.ortakId,
    bTag: String(girdi.bTag ?? ''),
    donem: girdi.donem,
    donemBaslangic: girdi.donemBaslangic,
    donemBitis: girdi.donemBitis,
    // Tutar ve dayanaklari SABITLENIYOR: rapor sonradan degisse bile
    // odenen tutarin gerekcesi kayitta kalmali.
    tutar,
    netGelir: Number(girdi.netGelir) || 0,
    aktifOyuncu: Number(girdi.aktifOyuncu) || 0,
    komisyonModeli: String(girdi.komisyonModeli ?? ''),
    revsharePayi: Number(girdi.revsharePayi) || 0,
    cpaTutari: Number(girdi.cpaTutari) || 0,
    durum: 'bekliyor',
    not: girdi.not,
    olusturan: girdi.olusturan,
    createdAt: new Date().toISOString(),
  };

  dokuman.odemeler.unshift(kayit);
  await yaz(tenantKey, dokuman);
  return kayit;
}

export async function odemeDurumGuncelle(
  id: string,
  durum: OdemeDurumu,
  kullanici: string,
  tenantKey = 'default',
): Promise<AffiliateOdeme> {
  if (!ODEME_DURUMLARI.includes(durum)) throw new AffiliateOdemeHatasi('Geçersiz durum.');

  const dokuman = await oku(tenantKey);
  const kayit = dokuman.odemeler.find((o) => o.id === id);
  if (!kayit) throw new AffiliateOdemeHatasi('Ödeme kaydı bulunamadı.', 404);

  // "odendi" -> baska duruma geciste odeme bilgisi temizlenir; aksi halde
  // iptal edilmis bir kayit hala odenmis gibi raporlanirdi.
  if (durum === 'odendi') {
    kayit.odenmeTarihi = new Date().toISOString();
    kayit.odeyen = kullanici;
  } else {
    delete kayit.odenmeTarihi;
    delete kayit.odeyen;
  }
  kayit.durum = durum;

  await yaz(tenantKey, dokuman);
  return kayit;
}

export async function odemeler(tenantKey = 'default', ortakId?: string): Promise<AffiliateOdeme[]> {
  const { odemeler: liste } = await oku(tenantKey);
  return ortakId ? liste.filter((o) => o.ortakId === ortakId) : liste;
}

/** Ortak basina odenmis toplam — portal ve rapor icin. */
export function odenmisToplam(liste: AffiliateOdeme[]): number {
  return liste.filter((o) => o.durum === 'odendi').reduce((t, o) => t + o.tutar, 0);
}

export function bekleyenToplam(liste: AffiliateOdeme[]): number {
  return liste.filter((o) => o.durum === 'bekliyor').reduce((t, o) => t + o.tutar, 0);
}

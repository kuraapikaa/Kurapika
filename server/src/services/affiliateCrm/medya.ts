import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { safeTenantKey } from '../../lib/tenant.js';
import { readStoredDocument, writeStoredDocument } from '../../lib/documentStore.js';
import { izlemeLinki, type AltParametre } from './izleme.js';

/**
 * MEDYA YÖNETİMİ.
 *
 * Ortağa verilen kreatifler: banner, metin linki, video, landing sayfası.
 * Her medyanın kendi kimliği var ve izleme linkine gömülüyor; böylece
 * "hangi banner dönüştürdü" sorusu cevaplanabiliyor. Bugüne kadar
 * ortağın elinde yalnızca BTag vardı, yani bütün kreatifler tek bir
 * torbaya düşüyordu.
 *
 * Medya İÇERİĞİ burada saklanmıyor, yalnızca adresi. Banner dosyalarını
 * bu depoya koymak, JSON tabanlı belge deposunu megabaytlarca ikili
 * veriyle şişirir ve her okumada tamamını belleğe alırdı.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERI_DIZINI = path.join(__dirname, '..', '..', 'data', 'affiliate-medya');

export type MedyaTuru = 'banner' | 'metin' | 'video' | 'landing';
export const MEDYA_TURLERI: MedyaTuru[] = ['banner', 'metin', 'video', 'landing'];

export interface Medya {
  id: string;
  ad: string;
  tur: MedyaTuru;
  /** Kreatifin kendi adresi (banner görseli, video). Landing'de boş olabilir. */
  varlikUrl: string | null;
  /** Tıklayanın gideceği adres; izleme parametreleri buraya eklenir. */
  hedefUrl: string;
  /** Banner ölçüsü, örn. `300x250`. */
  olcu: string | null;
  aktif: boolean;
  /** Yalnızca bu ortaklara açık; boşsa herkese açık. */
  ortakBTaglari: string[];
  not: string | null;
  createdAt: string;
  updatedAt: string;
}

type Depo = { version: 1; medyalar: Medya[] };
const bosDepo = (): Depo => ({ version: 1, medyalar: [] });

export class MedyaHatasi extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'MedyaHatasi';
  }
}

function depoYolu(tenantKey: string): string {
  return path.join(VERI_DIZINI, `${safeTenantKey(tenantKey)}.json`);
}

async function depoOku(tenantKey: string): Promise<Depo> {
  const kayit = await readStoredDocument<Partial<Depo>>({
    tenantKey: safeTenantKey(tenantKey),
    namespace: 'affiliate-medya',
    filePath: depoYolu(tenantKey),
    fallback: bosDepo,
  });
  return { version: 1, medyalar: Array.isArray(kayit.medyalar) ? kayit.medyalar : [] };
}

async function depoYaz(tenantKey: string, depo: Depo): Promise<void> {
  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: 'affiliate-medya', filePath: depoYolu(tenantKey) },
    depo,
  );
}

const metin = (deger: unknown): string => (typeof deger === 'string' ? deger.trim() : '');

function httpUrlDogrula(deger: string, alan: string): string {
  let url: URL;
  try {
    url = new URL(deger);
  } catch {
    throw new MedyaHatasi(`${alan} geçerli bir adres değil.`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new MedyaHatasi(`${alan} yalnızca http/https olabilir.`);
  }
  return url.toString();
}

export interface MedyaGirdisi {
  ad?: string;
  tur?: string;
  varlikUrl?: string;
  hedefUrl?: string;
  olcu?: string;
  aktif?: boolean;
  ortakBTaglari?: string[];
  not?: string;
}

export async function medyaOlustur(tenantKey: string, girdi: MedyaGirdisi, simdi = new Date()): Promise<Medya> {
  const ad = metin(girdi.ad);
  if (!ad) throw new MedyaHatasi('ad zorunlu.');
  const tur = metin(girdi.tur) as MedyaTuru;
  if (!MEDYA_TURLERI.includes(tur)) {
    throw new MedyaHatasi(`tur şunlardan biri olmalı: ${MEDYA_TURLERI.join(', ')}`);
  }
  const hedefUrl = httpUrlDogrula(metin(girdi.hedefUrl), 'hedefUrl');
  const varlikUrl = metin(girdi.varlikUrl) ? httpUrlDogrula(metin(girdi.varlikUrl), 'varlikUrl') : null;
  // Banner'in gorseli olmadan ortagin yayinlayacagi bir sey yok; sessizce
  // kabul etmek, panelde "hazir" gorunen ama kullanilamayan kayit uretir.
  if (tur === 'banner' && !varlikUrl) throw new MedyaHatasi('banner için varlikUrl zorunlu.');

  const depo = await depoOku(tenantKey);
  const medya: Medya = {
    id: randomUUID(),
    ad,
    tur,
    varlikUrl,
    hedefUrl,
    olcu: metin(girdi.olcu) || null,
    aktif: girdi.aktif !== false,
    ortakBTaglari: Array.isArray(girdi.ortakBTaglari) ? girdi.ortakBTaglari.map(metin).filter(Boolean) : [],
    not: metin(girdi.not) || null,
    createdAt: simdi.toISOString(),
    updatedAt: simdi.toISOString(),
  };
  depo.medyalar.push(medya);
  await depoYaz(tenantKey, depo);
  return medya;
}

export async function medyaGuncelle(
  tenantKey: string,
  id: string,
  girdi: MedyaGirdisi,
  simdi = new Date(),
): Promise<Medya> {
  const depo = await depoOku(tenantKey);
  const medya = depo.medyalar.find((m) => m.id === id);
  if (!medya) throw new MedyaHatasi('Medya bulunamadı.', 404);

  if (girdi.ad !== undefined) {
    const ad = metin(girdi.ad);
    if (!ad) throw new MedyaHatasi('ad boş olamaz.');
    medya.ad = ad;
  }
  if (girdi.hedefUrl !== undefined) medya.hedefUrl = httpUrlDogrula(metin(girdi.hedefUrl), 'hedefUrl');
  if (girdi.varlikUrl !== undefined) {
    medya.varlikUrl = metin(girdi.varlikUrl) ? httpUrlDogrula(metin(girdi.varlikUrl), 'varlikUrl') : null;
  }
  if (girdi.olcu !== undefined) medya.olcu = metin(girdi.olcu) || null;
  if (typeof girdi.aktif === 'boolean') medya.aktif = girdi.aktif;
  if (girdi.ortakBTaglari !== undefined) {
    medya.ortakBTaglari = Array.isArray(girdi.ortakBTaglari) ? girdi.ortakBTaglari.map(metin).filter(Boolean) : [];
  }
  if (girdi.not !== undefined) medya.not = metin(girdi.not) || null;
  if (medya.tur === 'banner' && !medya.varlikUrl) throw new MedyaHatasi('banner için varlikUrl zorunlu.');

  medya.updatedAt = simdi.toISOString();
  await depoYaz(tenantKey, depo);
  return medya;
}

export async function medyaSil(tenantKey: string, id: string): Promise<void> {
  const depo = await depoOku(tenantKey);
  const once = depo.medyalar.length;
  depo.medyalar = depo.medyalar.filter((m) => m.id !== id);
  if (depo.medyalar.length === once) throw new MedyaHatasi('Medya bulunamadı.', 404);
  await depoYaz(tenantKey, depo);
}

/**
 * Ortağa görünen medyalar.
 *
 * Kısıtlı bir medya yalnızca listesindeki ortağa görünür. `bTag`
 * verilmezse (yönetici görünümü) hepsi döner — ama pasif olanlar da
 * dahil, çünkü yönetici onları düzenleyebilmeli.
 */
export async function medyalariListele(tenantKey: string, bTag?: string): Promise<Medya[]> {
  const depo = await depoOku(tenantKey);
  if (!bTag) return depo.medyalar;
  return depo.medyalar.filter(
    (m) => m.aktif && (m.ortakBTaglari.length === 0 || m.ortakBTaglari.includes(bTag)),
  );
}

/**
 * Ortağa özel izleme linki üretir.
 *
 * Erişim burada da kontrol ediliyor: yalnızca listeyi filtrelemek,
 * kimliği bilen bir ortağın kısıtlı medyanın linkini yine de
 * üretebilmesi demek olurdu.
 */
export async function medyaIzlemeLinki(
  tenantKey: string,
  medyaId: string,
  bTag: string,
  alt?: Partial<Record<AltParametre, string>>,
): Promise<string> {
  const depo = await depoOku(tenantKey);
  const medya = depo.medyalar.find((m) => m.id === medyaId);
  if (!medya) throw new MedyaHatasi('Medya bulunamadı.', 404);
  if (!medya.aktif) throw new MedyaHatasi('Medya pasif.', 409);
  if (medya.ortakBTaglari.length > 0 && !medya.ortakBTaglari.includes(bTag)) {
    throw new MedyaHatasi('Bu medya bu ortağa açık değil.', 403);
  }
  return izlemeLinki(medya.hedefUrl, { bTag, medyaId: medya.id, alt });
}

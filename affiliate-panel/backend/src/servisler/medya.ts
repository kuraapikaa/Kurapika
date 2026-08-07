import { randomUUID } from 'crypto';
import { degistir, diziOku, kayitOku, oku } from '../lib/depo.js';
import { izlemeLinki, type AltParametre } from './izleme.js';

/**
 * MEDYA YÖNETİMİ.
 *
 * Ortağa verilen kreatifler: banner, metin linki, video, landing
 * sayfası. Her medyanın kendi kimliği var ve izleme linkine gömülüyor;
 * böylece "hangi banner dönüştürdü" sorusu cevaplanabiliyor. Yalnızca
 * izleme anahtarı olsaydı bütün kreatifler tek bir torbaya düşerdi.
 *
 * Medya İÇERİĞİ burada saklanmıyor, yalnızca adresi. Banner
 * dosyalarını belge deposuna koymak, her okumada megabaytlarca ikili
 * veriyi belleğe almak olurdu.
 */

const ALAN = 'medya';

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
  ortakAnahtarlari: string[];
  not: string | null;
  createdAt: string;
  updatedAt: string;
}

type Depo = { version: 1; medyalar: Medya[] };
const cozDepo = (ham: unknown): Depo => ({ version: 1, medyalar: diziOku<Medya>(kayitOku(ham).medyalar) });

export class MedyaHatasi extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'MedyaHatasi';
  }
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
  ortakAnahtarlari?: string[];
  not?: string;
}

const anahtarListesi = (ham: unknown): string[] =>
  Array.isArray(ham) ? ham.map(metin).filter(Boolean) : [];

export async function medyaOlustur(kiraci: string, girdi: MedyaGirdisi, simdi = new Date()): Promise<Medya> {
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

  const medya: Medya = {
    id: randomUUID(),
    ad,
    tur,
    varlikUrl,
    hedefUrl,
    olcu: metin(girdi.olcu) || null,
    aktif: girdi.aktif !== false,
    ortakAnahtarlari: anahtarListesi(girdi.ortakAnahtarlari),
    not: metin(girdi.not) || null,
    createdAt: simdi.toISOString(),
    updatedAt: simdi.toISOString(),
  };

  return degistir<Depo, Medya>(kiraci, ALAN, cozDepo, (depo) => {
    depo.medyalar.push(medya);
    return medya;
  });
}

export async function medyaGuncelle(
  kiraci: string,
  id: string,
  girdi: MedyaGirdisi,
  simdi = new Date(),
): Promise<Medya> {
  return degistir<Depo, Medya>(kiraci, ALAN, cozDepo, (depo) => {
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
    if (girdi.ortakAnahtarlari !== undefined) medya.ortakAnahtarlari = anahtarListesi(girdi.ortakAnahtarlari);
    if (girdi.not !== undefined) medya.not = metin(girdi.not) || null;
    if (medya.tur === 'banner' && !medya.varlikUrl) throw new MedyaHatasi('banner için varlikUrl zorunlu.');

    medya.updatedAt = simdi.toISOString();
    return medya;
  });
}

export async function medyaSil(kiraci: string, id: string): Promise<void> {
  await degistir<Depo, void>(kiraci, ALAN, cozDepo, (depo) => {
    const once = depo.medyalar.length;
    depo.medyalar = depo.medyalar.filter((m) => m.id !== id);
    if (depo.medyalar.length === once) throw new MedyaHatasi('Medya bulunamadı.', 404);
  });
}

export async function medyaBul(kiraci: string, id: string): Promise<Medya | null> {
  const depo = await oku<Depo>(kiraci, ALAN, cozDepo);
  return depo.medyalar.find((m) => m.id === id) ?? null;
}

/**
 * Ortağa görünen medyalar.
 *
 * Kısıtlı bir medya yalnızca listesindeki ortağa görünür.
 * `ortakAnahtari` verilmezse (yönetici görünümü) hepsi döner — pasif
 * olanlar dahil, çünkü yönetici onları düzenleyebilmeli.
 */
export async function medyalariListele(kiraci: string, ortakAnahtari?: string): Promise<Medya[]> {
  const depo = await oku<Depo>(kiraci, ALAN, cozDepo);
  if (!ortakAnahtari) return depo.medyalar;
  return depo.medyalar.filter(
    (m) => m.aktif && (m.ortakAnahtarlari.length === 0 || m.ortakAnahtarlari.includes(ortakAnahtari)),
  );
}

/**
 * Ortağa özel izleme linki üretir.
 *
 * Erişim BURADA da kontrol ediliyor: yalnızca listeyi filtrelemek,
 * kimliği bilen bir ortağın kısıtlı medyanın linkini yine de
 * üretebilmesi demek olurdu.
 */
export async function medyaIzlemeLinki(
  kiraci: string,
  medyaId: string,
  ortakAnahtari: string,
  alt?: Partial<Record<AltParametre, string>>,
): Promise<string> {
  const medya = await medyaBul(kiraci, medyaId);
  if (!medya) throw new MedyaHatasi('Medya bulunamadı.', 404);
  if (!medya.aktif) throw new MedyaHatasi('Medya pasif.', 409);
  if (medya.ortakAnahtarlari.length > 0 && !medya.ortakAnahtarlari.includes(ortakAnahtari)) {
    throw new MedyaHatasi('Bu medya bu ortağa açık değil.', 403);
  }
  return izlemeLinki(medya.hedefUrl, { ortakAnahtari, medyaId: medya.id, alt });
}

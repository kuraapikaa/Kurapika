import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { safeTenantKey } from '../../lib/tenant.js';
import { readStoredDocument, writeStoredDocument } from '../../lib/documentStore.js';
import { altParametreleriTemizle, izlemeLinki, type AltParametre } from './izleme.js';

/**
 * TIKLAMA KAYDI — izleme döngüsünün kapanan halkası.
 *
 * İzleme linki üretiliyordu ve gelen parametreleri çözecek kod vardı,
 * ama tıklamayı KARŞILAYAN uç yoktu: link → (boşluk) → dönüşüm. Bu
 * modül aradaki boşluğu dolduruyor; `clickId` burada doğuyor ve
 * postback'in `{clickid}` makrosu ancak bununla dolabiliyor.
 *
 * ── ATRİBÜSYONUN GERÇEK SINIRI ──
 *
 * Oyuncu tıkladıktan sonra BİZİM alan adımızdan ÇIKIP kumar sitesine
 * gidiyor. Bizim koyduğumuz çerez orada okunamaz. Bu yüzden `clickId`
 * hedef adrese sorgu parametresi olarak EKLENİYOR; taşınmasının tek
 * yolu bu. Çerez yine de bırakılıyor ama yalnızca iniş sayfası kendi
 * alan adımızdaysa işe yarar.
 *
 * Oyuncu-ortak eşleşmesinin asıl kaynağı Lynon'un BTag'i olmaya devam
 * ediyor; `clickId` onun üstüne KANAL kırılımı ekliyor (hangi banner,
 * hangi alt kanal).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERI_DIZINI = path.join(__dirname, '..', '..', 'data', 'affiliate-tiklama');

/** Kayıt sınırsız büyümesin; en yeniler tutulur. */
const KAYIT_SINIRI = Math.max(1000, Number(process.env.TIKLAMA_KAYIT_SINIRI) || 50_000);

export const TIKLAMA_CEREZI = 'aff_click';

export interface Tiklama {
  clickId: string;
  bTag: string;
  medyaId: string | null;
  alt: Partial<Record<AltParametre, string>>;
  /** Kaba konum/bot ayıklaması için; kimlik olarak KULLANILMAZ. */
  ip: string | null;
  userAgent: string | null;
  referrer: string | null;
  zaman: string;
}

type Depo = { version: 1; tiklamalar: Tiklama[] };
const bosDepo = (): Depo => ({ version: 1, tiklamalar: [] });

function depoYolu(tenantKey: string): string {
  return path.join(VERI_DIZINI, `${safeTenantKey(tenantKey)}.json`);
}

async function depoOku(tenantKey: string): Promise<Depo> {
  const kayit = await readStoredDocument<Partial<Depo>>({
    tenantKey: safeTenantKey(tenantKey),
    namespace: 'affiliate-tiklama',
    filePath: depoYolu(tenantKey),
    fallback: bosDepo,
  });
  return { version: 1, tiklamalar: Array.isArray(kayit.tiklamalar) ? kayit.tiklamalar : [] };
}

async function depoYaz(tenantKey: string, depo: Depo): Promise<void> {
  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: 'affiliate-tiklama', filePath: depoYolu(tenantKey) },
    depo,
  );
}

const metin = (deger: unknown): string => (typeof deger === 'string' ? deger.trim() : '');

export interface TiklamaGirdisi {
  bTag: string;
  medyaId?: string | null;
  sorgu?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
}

export async function tiklamaKaydet(
  tenantKey: string,
  girdi: TiklamaGirdisi,
  simdi = new Date(),
): Promise<Tiklama> {
  const bTag = metin(girdi.bTag);
  if (!bTag) throw new Error('bTag zorunlu.');

  const tiklama: Tiklama = {
    clickId: randomUUID(),
    bTag,
    medyaId: metin(girdi.medyaId) || null,
    alt: altParametreleriTemizle(girdi.sorgu),
    ip: metin(girdi.ip) || null,
    // Uzun bir user-agent kaydi sisirir; teshis icin bas kismi yeter.
    userAgent: metin(girdi.userAgent).slice(0, 200) || null,
    referrer: metin(girdi.referrer).slice(0, 300) || null,
    zaman: simdi.toISOString(),
  };

  const depo = await depoOku(tenantKey);
  depo.tiklamalar.push(tiklama);
  if (depo.tiklamalar.length > KAYIT_SINIRI) depo.tiklamalar = depo.tiklamalar.slice(-KAYIT_SINIRI);
  await depoYaz(tenantKey, depo);
  return tiklama;
}

/**
 * Tıklamanın yönlendirileceği adres.
 *
 * AÇIK YÖNLENDİRME KORUMASI: hedef adres YALNIZCA sunucuda kayıtlı
 * medyadan alınır, istekten ASLA. Kullanıcının verdiği bir adrese
 * yönlendirmek, bizim alan adımızı oltalama bağlantısı taşıyıcısına
 * çevirirdi — bağlantı bize ait göründüğü için de en ikna edicisinden.
 *
 * `clickId` hedefe ekleniyor: oyuncu bizim alan adımızdan çıktığı için
 * çerezle taşımak mümkün değil.
 */
export function yonlendirmeAdresi(hedefUrl: string, tiklama: Tiklama): string {
  const url = new URL(izlemeLinki(hedefUrl, {
    bTag: tiklama.bTag,
    ...(tiklama.medyaId ? { medyaId: tiklama.medyaId } : {}),
    alt: tiklama.alt,
  }));
  url.searchParams.set('clickid', tiklama.clickId);
  return url.toString();
}

export interface TiklamaSorgusu {
  bTag?: string;
  medyaId?: string;
  start?: string;
  end?: string;
  limit?: number;
}

export async function tiklamalariListele(tenantKey: string, sorgu: TiklamaSorgusu = {}): Promise<Tiklama[]> {
  const depo = await depoOku(tenantKey);
  const limit = Math.min(1000, Math.max(1, Number(sorgu.limit) || 200));
  return depo.tiklamalar
    .filter((t) => {
      if (sorgu.bTag && t.bTag !== sorgu.bTag) return false;
      if (sorgu.medyaId && t.medyaId !== sorgu.medyaId) return false;
      if (sorgu.start && t.zaman < new Date(sorgu.start).toISOString()) return false;
      if (sorgu.end) {
        const son = new Date(sorgu.end);
        son.setUTCHours(23, 59, 59, 999);
        if (t.zaman > son.toISOString()) return false;
      }
      return true;
    })
    .slice(-limit)
    .reverse();
}

export async function tiklamaBul(tenantKey: string, clickId: string): Promise<Tiklama | null> {
  if (!clickId) return null;
  const depo = await depoOku(tenantKey);
  return depo.tiklamalar.find((t) => t.clickId === clickId) ?? null;
}

export interface TiklamaOzeti {
  bTag: string;
  toplam: number;
  /** Medya kimliğine göre kırılım; hangi kreatif çalışıyor. */
  medyaBazinda: Array<{ medyaId: string | null; sayi: number }>;
  /** Alt kanal kırılımı; ortağın kendi etiketlemesi. */
  altBazinda: Array<{ anahtar: string; deger: string; sayi: number }>;
}

export async function tiklamaOzeti(tenantKey: string, sorgu: TiklamaSorgusu = {}): Promise<TiklamaOzeti[]> {
  const tiklamalar = await tiklamalariListele(tenantKey, { ...sorgu, limit: 1000 });
  const gruplar = new Map<string, { medya: Map<string, number>; alt: Map<string, number>; toplam: number }>();

  for (const t of tiklamalar) {
    const grup = gruplar.get(t.bTag) ?? { medya: new Map(), alt: new Map(), toplam: 0 };
    grup.toplam += 1;
    const medyaAnahtari = t.medyaId ?? '';
    grup.medya.set(medyaAnahtari, (grup.medya.get(medyaAnahtari) ?? 0) + 1);
    for (const [anahtar, deger] of Object.entries(t.alt)) {
      if (!deger) continue;
      // Anahtar JSON: ayrac karakteri kullanmak, degerin icinde o
      // karakter gectiginde geri okumayi bozardi.
      const bilesik = JSON.stringify([anahtar, deger]);
      grup.alt.set(bilesik, (grup.alt.get(bilesik) ?? 0) + 1);
    }
    gruplar.set(t.bTag, grup);
  }

  return [...gruplar.entries()]
    .map(([bTag, g]) => ({
      bTag,
      toplam: g.toplam,
      medyaBazinda: [...g.medya.entries()]
        .map(([medyaId, sayi]) => ({ medyaId: medyaId || null, sayi }))
        .sort((a, b) => b.sayi - a.sayi),
      altBazinda: [...g.alt.entries()]
        .map(([bilesik, sayi]) => {
          const [anahtar, deger] = JSON.parse(bilesik) as [string, string];
          return { anahtar, deger, sayi };
        })
        .sort((a, b) => b.sayi - a.sayi),
    }))
    .sort((a, b) => b.toplam - a.toplam);
}

import path from 'path';
import { fileURLToPath } from 'url';
import { safeTenantKey } from '../../lib/tenant.js';
import { readStoredDocument, writeStoredDocument } from '../../lib/documentStore.js';

/**
 * ÇOK KADEMELİ ORTAK YAPISI (sub-affiliate).
 *
 * Bir ortak başka ortakları sisteme getirebilir ve getirdiklerinin
 * kazancından pay alır. Bugüne kadar model düzdü: her ortak yalnızca
 * kendi trafiğinden kazanıyordu.
 *
 * ── Neden ayrı bir depo ──
 *
 * `affiliateAccountService` ortağın kimlik ve komisyon verisini tutuyor.
 * Hiyerarşi oraya bir `ustBTag` alanı olarak eklenebilirdi ama kademe
 * kuralları (hangi seviyede kaç yüzde) ortaktan bağımsız bir politika;
 * ikisini aynı kayda sıkıştırmak, komisyon oranını değiştirmek için
 * ortak kaydını düzenlemeyi zorunlu kılardı.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERI_DIZINI = path.join(__dirname, '..', '..', 'data', 'affiliate-kademe');

/** Varsayılan: 1. seviye üst ortak %5, 2. seviye %2. */
export const VARSAYILAN_KADEME_YUZDELERI = [5, 2];

export interface KademeBagi {
  /** Alt ortağın BTag'i. */
  bTag: string;
  /** Onu getiren üst ortağın BTag'i. */
  ustBTag: string;
  createdAt: string;
}

type Depo = {
  version: 1;
  baglar: KademeBagi[];
  /** Seviye başına yüzde; dizinin uzunluğu kademe derinliğini belirler. */
  kademeYuzdeleri: number[];
};

const bosDepo = (): Depo => ({ version: 1, baglar: [], kademeYuzdeleri: [...VARSAYILAN_KADEME_YUZDELERI] });

export class KademeHatasi extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'KademeHatasi';
  }
}

function depoYolu(tenantKey: string): string {
  return path.join(VERI_DIZINI, `${safeTenantKey(tenantKey)}.json`);
}

async function depoOku(tenantKey: string): Promise<Depo> {
  const kayit = await readStoredDocument<Partial<Depo>>({
    tenantKey: safeTenantKey(tenantKey),
    namespace: 'affiliate-kademe',
    filePath: depoYolu(tenantKey),
    fallback: bosDepo,
  });
  return {
    version: 1,
    baglar: Array.isArray(kayit.baglar) ? kayit.baglar : [],
    kademeYuzdeleri: Array.isArray(kayit.kademeYuzdeleri) && kayit.kademeYuzdeleri.length
      ? kayit.kademeYuzdeleri.map(Number).filter((n) => Number.isFinite(n) && n >= 0)
      : [...VARSAYILAN_KADEME_YUZDELERI],
  };
}

async function depoYaz(tenantKey: string, depo: Depo): Promise<void> {
  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: 'affiliate-kademe', filePath: depoYolu(tenantKey) },
    depo,
  );
}

/**
 * Bir ortağın üst zinciri; en yakın üstten başlayarak.
 *
 * DÖNGÜYE KARŞI KORUMALI. Veri bozulsa bile (elle düzenleme, kısmi
 * geri yükleme) sonsuz döngüye girmez: görülen her düğüm işaretleniyor.
 * Bu fonksiyon komisyon dağıtımında çağrıldığı için bir döngü, isteği
 * süresiz kilitler ve tüm paneli düşürürdü.
 */
export function ustZincir(baglar: KademeBagi[], bTag: string, enFazlaSeviye: number): string[] {
  const ustHaritasi = new Map(baglar.map((b) => [b.bTag, b.ustBTag]));
  const zincir: string[] = [];
  const gorulen = new Set<string>([bTag]);

  let mevcut = bTag;
  while (zincir.length < enFazlaSeviye) {
    const ust = ustHaritasi.get(mevcut);
    if (!ust || gorulen.has(ust)) break;
    zincir.push(ust);
    gorulen.add(ust);
    mevcut = ust;
  }
  return zincir;
}

/** Bağ eklemek bir döngü yaratır mı? */
export function donguYaratirMi(baglar: KademeBagi[], bTag: string, ustBTag: string): boolean {
  if (bTag === ustBTag) return true;
  // Yeni ustun kendi zincirinde alt ortak varsa dongu olusur.
  const ustHaritasi = new Map(baglar.map((b) => [b.bTag, b.ustBTag]));
  const gorulen = new Set<string>();
  let mevcut: string | undefined = ustBTag;
  while (mevcut && !gorulen.has(mevcut)) {
    if (mevcut === bTag) return true;
    gorulen.add(mevcut);
    mevcut = ustHaritasi.get(mevcut);
  }
  return false;
}

export async function kademeBagiKur(tenantKey: string, bTag: string, ustBTag: string, simdi = new Date()): Promise<KademeBagi> {
  const alt = String(bTag ?? '').trim();
  const ust = String(ustBTag ?? '').trim();
  if (!alt || !ust) throw new KademeHatasi('bTag ve ustBTag zorunlu.');

  const depo = await depoOku(tenantKey);
  if (donguYaratirMi(depo.baglar, alt, ust)) {
    throw new KademeHatasi('Bu bağ bir döngü yaratır; ortak kendi üstünün üstü olamaz.', 409);
  }

  const mevcut = depo.baglar.find((b) => b.bTag === alt);
  if (mevcut) {
    mevcut.ustBTag = ust;
  } else {
    depo.baglar.push({ bTag: alt, ustBTag: ust, createdAt: simdi.toISOString() });
  }
  await depoYaz(tenantKey, depo);
  return depo.baglar.find((b) => b.bTag === alt) as KademeBagi;
}

export async function kademeBagiKaldir(tenantKey: string, bTag: string): Promise<void> {
  const depo = await depoOku(tenantKey);
  depo.baglar = depo.baglar.filter((b) => b.bTag !== bTag);
  await depoYaz(tenantKey, depo);
}

export async function kademeYuzdeleriniAyarla(tenantKey: string, yuzdeler: number[]): Promise<number[]> {
  const temiz = (Array.isArray(yuzdeler) ? yuzdeler : []).map(Number).filter((n) => Number.isFinite(n) && n >= 0);
  if (!temiz.length) throw new KademeHatasi('En az bir seviye yüzdesi gerekli.');
  // Ust kademelerin toplami alt ortagin kendi kazancini gecemez; gecerse
  // her donusum zarar yazar ve bu ancak ay sonunda fark edilir.
  const toplam = temiz.reduce((t, n) => t + n, 0);
  if (toplam >= 100) throw new KademeHatasi('Kademe yüzdelerinin toplamı %100 veya üzeri olamaz.');

  const depo = await depoOku(tenantKey);
  depo.kademeYuzdeleri = temiz;
  await depoYaz(tenantKey, depo);
  return temiz;
}

export interface KademePayi {
  ustBTag: string;
  /** 1 = doğrudan üst ortak. */
  seviye: number;
  yuzde: number;
  tutar: number;
}

/**
 * Bir ortağın kazancından üst kademelere düşen payları hesaplar.
 *
 * Pay alt ortağın kazancından KESİLMEZ, üstüne eklenir — bu bir
 * pazarlama gideri, alt ortağın gelirinden yapılan bir kesinti değil.
 * Tersi olsaydı alt ortak, kendisini kimin getirdiğine bağlı olarak
 * farklı kazanırdı ve bunu ona açıklamak mümkün olmazdı.
 */
export function kademePaylariHesapla(
  baglar: KademeBagi[],
  kademeYuzdeleri: number[],
  bTag: string,
  ortakKazanci: number,
): KademePayi[] {
  if (!Number.isFinite(ortakKazanci) || ortakKazanci <= 0) return [];
  const zincir = ustZincir(baglar, bTag, kademeYuzdeleri.length);
  return zincir.map((ustBTag, indeks) => {
    const yuzde = kademeYuzdeleri[indeks] ?? 0;
    return {
      ustBTag,
      seviye: indeks + 1,
      yuzde,
      // Kurusa yuvarlama: kayan nokta artiklari odeme kayitlarinda
      // 0.30000000000000004 gibi degerler birakiyordu.
      tutar: Math.round(ortakKazanci * (yuzde / 100) * 100) / 100,
    };
  }).filter((p) => p.tutar > 0);
}

export async function kademeDurumu(tenantKey: string) {
  const depo = await depoOku(tenantKey);
  return { baglar: depo.baglar, kademeYuzdeleri: depo.kademeYuzdeleri };
}

/** Bir ortağın doğrudan alt ortakları. */
export async function altOrtaklar(tenantKey: string, ustBTag: string): Promise<string[]> {
  const depo = await depoOku(tenantKey);
  return depo.baglar.filter((b) => b.ustBTag === ustBTag).map((b) => b.bTag);
}

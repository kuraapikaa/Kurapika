import { randomUUID } from 'crypto';
import { lookup } from 'dns/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { safeTenantKey } from '../../lib/tenant.js';
import { readStoredDocument, writeStoredDocument } from '../../lib/documentStore.js';
import { makrolariUygula, sablondakiMakrolar, type MakroDegerleri } from './izleme.js';

/**
 * S2S POSTBACK GÖNDERİMİ.
 *
 * Ortak kendi izleme sisteminin URL şablonunu veriyor; bir dönüşüm
 * olduğunda o adrese sunucudan sunucuya haber veriyoruz. Ortağın
 * kampanyayı kendi tarafında optimize edebilmesinin tek yolu bu.
 *
 * ── EN BÜYÜK RİSK: SSRF ──
 *
 * Adresi ORTAK yazıyor ve isteği BİZİM sunucumuz atıyor. Hiçbir kontrol
 * olmasaydı ortak `http://169.254.169.254/latest/meta-data/` yazarak
 * bulut sağlayıcının kimlik uçlarına, ya da `http://localhost:5432`
 * yazarak iç ağdaki veritabanına bizim adımıza istek attırabilirdi.
 * Bu yüzden:
 *
 *   - Yalnızca https (http, ortağın izleme verisini de açıkta bırakır)
 *   - Adres ÇÖZÜMLENİP dönen IP kontrol ediliyor; yalnızca alan adına
 *     bakmak yetmez, saldırgan kendi alan adını 127.0.0.1'e yöneltebilir
 *   - Özel, geri döngü, bağlantı-yerel ve ayrılmış aralıklar yasak
 *   - Yönlendirme İZLENMİYOR: izin verilen bir adres, engelli bir adrese
 *     yönlendirerek kontrolü aşabilirdi
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERI_DIZINI = path.join(__dirname, '..', '..', 'data', 'affiliate-postback');

const ZAMAN_ASIMI_MS = Number(process.env.POSTBACK_TIMEOUT_MS) || 8000;
const EN_FAZLA_DENEME = Math.max(1, Number(process.env.POSTBACK_MAX_DENEME) || 3);
/** Kayıt sınırsız büyümesin; en yeniler tutulur. */
const KAYIT_SINIRI = 2000;

export type PostbackOlayi = 'kayit' | 'ilk-yatirim' | 'yatirim' | 'onaylanan-komisyon';
export const POSTBACK_OLAYLARI: PostbackOlayi[] = ['kayit', 'ilk-yatirim', 'yatirim', 'onaylanan-komisyon'];

export interface PostbackAyari {
  bTag: string;
  /** Makro içeren URL şablonu. */
  sablon: string;
  /** Hangi olaylarda gönderilecek. Boşsa hiç gönderilmez. */
  olaylar: PostbackOlayi[];
  aktif: boolean;
  updatedAt: string;
}

export interface PostbackKaydi {
  id: string;
  bTag: string;
  olay: PostbackOlayi;
  url: string;
  durum: 'basarili' | 'basarisiz' | 'engellendi';
  httpDurum: number | null;
  deneme: number;
  mesaj: string | null;
  gonderildi: string;
}

type Depo = { version: 1; ayarlar: PostbackAyari[]; kayitlar: PostbackKaydi[] };
const bosDepo = (): Depo => ({ version: 1, ayarlar: [], kayitlar: [] });

export class PostbackHatasi extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'PostbackHatasi';
  }
}

function depoYolu(tenantKey: string): string {
  return path.join(VERI_DIZINI, `${safeTenantKey(tenantKey)}.json`);
}

async function depoOku(tenantKey: string): Promise<Depo> {
  const kayit = await readStoredDocument<Partial<Depo>>({
    tenantKey: safeTenantKey(tenantKey),
    namespace: 'affiliate-postback',
    filePath: depoYolu(tenantKey),
    fallback: bosDepo,
  });
  return {
    version: 1,
    ayarlar: Array.isArray(kayit.ayarlar) ? kayit.ayarlar : [],
    kayitlar: Array.isArray(kayit.kayitlar) ? kayit.kayitlar : [],
  };
}

async function depoYaz(tenantKey: string, depo: Depo): Promise<void> {
  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: 'affiliate-postback', filePath: depoYolu(tenantKey) },
    depo,
  );
}

/**
 * IP genel internete mi ait?
 *
 * Özel/ayrılmış aralıklar reddediliyor. IPv6'da IPv4 eşlemeli adresler
 * (`::ffff:127.0.0.1`) ayrıca ele alınıyor — yalnızca metin olarak
 * bakmak bu biçimi kaçırır ve geri döngüye çıkış verirdi.
 */
export function genelIpMi(ip: string): boolean {
  const adres = String(ip ?? '').trim().toLowerCase();
  if (!adres) return false;

  const ipv4Eslemeli = adres.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const hedef = ipv4Eslemeli ? ipv4Eslemeli[1] : adres;

  if (/^\d+\.\d+\.\d+\.\d+$/.test(hedef)) {
    const p = hedef.split('.').map(Number);
    if (p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
    const [a, b] = p;
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 169 && b === 254) return false;          // baglanti-yerel, bulut meta-veri
    if (a === 172 && b >= 16 && b <= 31) return false;  // ozel
    if (a === 192 && b === 168) return false;           // ozel
    if (a === 100 && b >= 64 && b <= 127) return false; // tasiyici NAT
    if (a === 192 && b === 0) return false;             // ayrilmis
    if (a >= 224) return false;                          // coklu yayin / ayrilmis
    return true;
  }

  // IPv6
  if (hedef === '::' || hedef === '::1') return false;
  if (hedef.startsWith('fe80')) return false;            // baglanti-yerel
  if (/^f[cd]/.test(hedef)) return false;                // benzersiz yerel
  if (hedef.startsWith('ff')) return false;              // coklu yayin
  return hedef.includes(':');
}

/** Şablonu doğrular; kaydetmeden önce panelde hata göstermek için. */
export function sablonuDogrula(sablon: string): { url: URL; makrolar: string[] } {
  const ham = String(sablon ?? '').trim();
  if (!ham) throw new PostbackHatasi('sablon zorunlu.');
  // Makrolar ornek degerle doldurulup dogrulaniyor: `{clickid}` iceren
  // ham metin gecerli bir URL olmayabilir.
  const ornek = makrolariUygula(ham, Object.fromEntries(sablondakiMakrolar(ham).map((m) => [m, 'x'])));
  let url: URL;
  try {
    url = new URL(ornek);
  } catch {
    throw new PostbackHatasi('sablon geçerli bir adres üretmiyor.');
  }
  if (url.protocol !== 'https:') {
    throw new PostbackHatasi('Postback adresi yalnızca https olabilir.');
  }
  return { url, makrolar: sablondakiMakrolar(ham) };
}

export async function postbackAyarla(
  tenantKey: string,
  girdi: { bTag?: string; sablon?: string; olaylar?: string[]; aktif?: boolean },
  simdi = new Date(),
): Promise<PostbackAyari> {
  const bTag = String(girdi.bTag ?? '').trim();
  if (!bTag) throw new PostbackHatasi('bTag zorunlu.');
  sablonuDogrula(String(girdi.sablon ?? ''));

  const olaylar = (Array.isArray(girdi.olaylar) ? girdi.olaylar : [])
    .map((o) => String(o).trim())
    .filter((o): o is PostbackOlayi => (POSTBACK_OLAYLARI as string[]).includes(o));
  if (!olaylar.length) throw new PostbackHatasi(`En az bir olay seçilmeli: ${POSTBACK_OLAYLARI.join(', ')}`);

  const depo = await depoOku(tenantKey);
  const ayar: PostbackAyari = {
    bTag,
    sablon: String(girdi.sablon).trim(),
    olaylar,
    aktif: girdi.aktif !== false,
    updatedAt: simdi.toISOString(),
  };
  const indeks = depo.ayarlar.findIndex((a) => a.bTag === bTag);
  if (indeks >= 0) depo.ayarlar[indeks] = ayar;
  else depo.ayarlar.push(ayar);
  await depoYaz(tenantKey, depo);
  return ayar;
}

export async function postbackAyarlari(tenantKey: string): Promise<PostbackAyari[]> {
  return (await depoOku(tenantKey)).ayarlar;
}

export async function postbackKayitlari(tenantKey: string, bTag?: string): Promise<PostbackKaydi[]> {
  const depo = await depoOku(tenantKey);
  const kayitlar = bTag ? depo.kayitlar.filter((k) => k.bTag === bTag) : depo.kayitlar;
  return [...kayitlar].reverse();
}

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Adresin hedefi genel internette mi; SSRF kapısı. */
async function adresGuvenliMi(url: URL): Promise<{ guvenli: boolean; sebep?: string }> {
  if (url.protocol !== 'https:') return { guvenli: false, sebep: 'Yalnızca https destekleniyor.' };
  try {
    const cozumler = await lookup(url.hostname, { all: true });
    if (!cozumler.length) return { guvenli: false, sebep: 'Alan adı çözümlenemedi.' };
    // TEK BIR ozel IP yeter: cok kayitli bir alan adinin bir kaydini ic
    // aga yoneltmek klasik bir atlatma yontemi.
    const ozel = cozumler.find((c) => !genelIpMi(c.address));
    if (ozel) return { guvenli: false, sebep: `Adres iç ağa çözümleniyor (${ozel.address}).` };
    return { guvenli: true };
  } catch (hata) {
    return { guvenli: false, sebep: hata instanceof Error ? hata.message : 'Alan adı çözümlenemedi.' };
  }
}

/**
 * Bir olay için ortağın postback'ini gönderir.
 *
 * Gönderim HİÇBİR ZAMAN çağıranı düşürmez: postback bir yan etki,
 * dönüşümün kendisi değil. Ortağın sunucusu kapalı diye bizim
 * komisyon kaydımızın yazılmaması orantısız olurdu.
 */
export async function postbackGonder(
  tenantKey: string,
  bTag: string,
  olay: PostbackOlayi,
  degerler: MakroDegerleri,
  simdi = new Date(),
): Promise<PostbackKaydi | null> {
  const depo = await depoOku(tenantKey);
  const ayar = depo.ayarlar.find((a) => a.bTag === bTag);
  if (!ayar || !ayar.aktif || !ayar.olaylar.includes(olay)) return null;

  const hedefMetin = makrolariUygula(ayar.sablon, { ...degerler, event: olay, btag: bTag });
  const kayitYaz = async (kayit: PostbackKaydi) => {
    depo.kayitlar.push(kayit);
    if (depo.kayitlar.length > KAYIT_SINIRI) depo.kayitlar = depo.kayitlar.slice(-KAYIT_SINIRI);
    await depoYaz(tenantKey, depo);
    return kayit;
  };

  let url: URL;
  try {
    url = new URL(hedefMetin);
  } catch {
    return kayitYaz({
      id: randomUUID(), bTag, olay, url: hedefMetin, durum: 'engellendi',
      httpDurum: null, deneme: 0, mesaj: 'Şablon geçerli bir adres üretmedi.', gonderildi: simdi.toISOString(),
    });
  }

  const guvenlik = await adresGuvenliMi(url);
  if (!guvenlik.guvenli) {
    return kayitYaz({
      id: randomUUID(), bTag, olay, url: url.toString(), durum: 'engellendi',
      httpDurum: null, deneme: 0, mesaj: guvenlik.sebep ?? 'Adres engellendi.', gonderildi: simdi.toISOString(),
    });
  }

  let sonDurum: number | null = null;
  let sonMesaj: string | null = null;

  for (let deneme = 1; deneme <= EN_FAZLA_DENEME; deneme += 1) {
    const kontrol = new AbortController();
    const zamanlayici = setTimeout(() => kontrol.abort(), ZAMAN_ASIMI_MS);
    try {
      const yanit = await fetch(url.toString(), {
        method: 'GET',
        signal: kontrol.signal,
        // Yonlendirme IZLENMIYOR: izin verilen bir adres, engelli bir
        // adrese yonlendirerek SSRF kontrolunu asabilirdi.
        redirect: 'manual',
        headers: { 'User-Agent': 'BugsAffiliate/1.0 (+postback)' },
      });
      sonDurum = yanit.status;
      if (yanit.ok) {
        return kayitYaz({
          id: randomUUID(), bTag, olay, url: url.toString(), durum: 'basarili',
          httpDurum: yanit.status, deneme, mesaj: null, gonderildi: simdi.toISOString(),
        });
      }
      sonMesaj = `HTTP ${yanit.status}`;
      // 4xx kalici: ortagin sablonu ya da kimligi yanlis, tekrar denemek
      // yalnizca gurultu uretir.
      if (yanit.status >= 400 && yanit.status < 500) break;
    } catch (hata) {
      sonMesaj = hata instanceof Error ? hata.message : String(hata);
    } finally {
      clearTimeout(zamanlayici);
    }
    if (deneme < EN_FAZLA_DENEME) await bekle(500 * deneme);
  }

  return kayitYaz({
    id: randomUUID(), bTag, olay, url: url.toString(), durum: 'basarisiz',
    httpDurum: sonDurum, deneme: EN_FAZLA_DENEME, mesaj: sonMesaj, gonderildi: simdi.toISOString(),
  });
}

import { randomUUID } from 'crypto';
import { lookup } from 'dns/promises';
import { degistir, diziOku, kayitOku, oku } from '../lib/depo.js';
import { makrolariUygula, sablondakiMakrolar, type MakroDegerleri } from './izleme.js';

/**
 * S2S POSTBACK GÖNDERİMİ.
 *
 * Ortak kendi izleme sisteminin adres şablonunu veriyor; bir dönüşüm
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

const ALAN = 'postback';

const ZAMAN_ASIMI_MS = Number(process.env.POSTBACK_TIMEOUT_MS) || 8000;
const EN_FAZLA_DENEME = Math.max(1, Number(process.env.POSTBACK_MAX_DENEME) || 3);
/** Kayıt sınırsız büyümesin; en yeniler tutulur. */
const KAYIT_SINIRI = 2000;

export type PostbackOlayi = 'tiklama' | 'kayit' | 'ilk-yatirim' | 'yatirim' | 'onaylanan-komisyon';
export const POSTBACK_OLAYLARI: PostbackOlayi[] = [
  'tiklama', 'kayit', 'ilk-yatirim', 'yatirim', 'onaylanan-komisyon',
];

export interface PostbackAyari {
  ortakAnahtari: string;
  /** Makro içeren adres şablonu. */
  sablon: string;
  /** Hangi olaylarda gönderilecek. Boşsa hiç gönderilmez. */
  olaylar: PostbackOlayi[];
  aktif: boolean;
  updatedAt: string;
}

export interface PostbackKaydi {
  id: string;
  ortakAnahtari: string;
  olay: PostbackOlayi;
  url: string;
  durum: 'basarili' | 'basarisiz' | 'engellendi';
  httpDurum: number | null;
  deneme: number;
  mesaj: string | null;
  gonderildi: string;
}

type Depo = { version: 1; ayarlar: PostbackAyari[]; kayitlar: PostbackKaydi[] };

const cozDepo = (ham: unknown): Depo => {
  const kayit = kayitOku(ham);
  return {
    version: 1,
    ayarlar: diziOku<PostbackAyari>(kayit.ayarlar),
    kayitlar: diziOku<PostbackKaydi>(kayit.kayitlar),
  };
};

export class PostbackHatasi extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'PostbackHatasi';
  }
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
    if (a === 169 && b === 254) return false;           // baglanti-yerel, bulut meta-veri
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
  // ham metin gecerli bir adres olmayabilir.
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
  kiraci: string,
  girdi: { ortakAnahtari?: string; sablon?: string; olaylar?: string[]; aktif?: boolean },
  simdi = new Date(),
): Promise<PostbackAyari> {
  const ortakAnahtari = String(girdi.ortakAnahtari ?? '').trim();
  if (!ortakAnahtari) throw new PostbackHatasi('ortakAnahtari zorunlu.');
  sablonuDogrula(String(girdi.sablon ?? ''));

  const olaylar = (Array.isArray(girdi.olaylar) ? girdi.olaylar : [])
    .map((o) => String(o).trim())
    .filter((o): o is PostbackOlayi => (POSTBACK_OLAYLARI as string[]).includes(o));
  if (!olaylar.length) throw new PostbackHatasi(`En az bir olay seçilmeli: ${POSTBACK_OLAYLARI.join(', ')}`);

  const ayar: PostbackAyari = {
    ortakAnahtari,
    sablon: String(girdi.sablon).trim(),
    olaylar,
    aktif: girdi.aktif !== false,
    updatedAt: simdi.toISOString(),
  };

  return degistir<Depo, PostbackAyari>(kiraci, ALAN, cozDepo, (depo) => {
    const indeks = depo.ayarlar.findIndex((a) => a.ortakAnahtari === ortakAnahtari);
    if (indeks >= 0) depo.ayarlar[indeks] = ayar;
    else depo.ayarlar.push(ayar);
    return ayar;
  });
}

export async function postbackAyariSil(kiraci: string, ortakAnahtari: string): Promise<void> {
  await degistir<Depo, void>(kiraci, ALAN, cozDepo, (depo) => {
    depo.ayarlar = depo.ayarlar.filter((a) => a.ortakAnahtari !== ortakAnahtari);
  });
}

export async function postbackAyarlari(kiraci: string): Promise<PostbackAyari[]> {
  return (await oku<Depo>(kiraci, ALAN, cozDepo)).ayarlar;
}

export async function postbackKayitlari(kiraci: string, ortakAnahtari?: string): Promise<PostbackKaydi[]> {
  const depo = await oku<Depo>(kiraci, ALAN, cozDepo);
  const kayitlar = ortakAnahtari ? depo.kayitlar.filter((k) => k.ortakAnahtari === ortakAnahtari) : depo.kayitlar;
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

async function kayitYaz(kiraci: string, kayit: PostbackKaydi): Promise<PostbackKaydi> {
  return degistir<Depo, PostbackKaydi>(kiraci, ALAN, cozDepo, (depo) => {
    depo.kayitlar.push(kayit);
    if (depo.kayitlar.length > KAYIT_SINIRI) depo.kayitlar = depo.kayitlar.slice(-KAYIT_SINIRI);
    return kayit;
  });
}

/**
 * Bir olay için ortağın postback'ini gönderir.
 *
 * Gönderim HİÇBİR ZAMAN çağıranı düşürmez: postback bir yan etki,
 * dönüşümün kendisi değil. Ortağın sunucusu kapalı diye bizim komisyon
 * kaydımızın yazılmaması orantısız olurdu.
 */
export async function postbackGonder(
  kiraci: string,
  ortakAnahtari: string,
  olay: PostbackOlayi,
  degerler: MakroDegerleri,
  simdi = new Date(),
): Promise<PostbackKaydi | null> {
  const ayar = (await postbackAyarlari(kiraci)).find((a) => a.ortakAnahtari === ortakAnahtari);
  if (!ayar || !ayar.aktif || !ayar.olaylar.includes(olay)) return null;

  const hedefMetin = makrolariUygula(ayar.sablon, { ...degerler, event: olay, btag: ortakAnahtari });
  const temel = { id: randomUUID(), ortakAnahtari, olay, gonderildi: simdi.toISOString() };

  let url: URL;
  try {
    url = new URL(hedefMetin);
  } catch {
    return kayitYaz(kiraci, {
      ...temel, url: hedefMetin, durum: 'engellendi',
      httpDurum: null, deneme: 0, mesaj: 'Şablon geçerli bir adres üretmedi.',
    });
  }

  const guvenlik = await adresGuvenliMi(url);
  if (!guvenlik.guvenli) {
    return kayitYaz(kiraci, {
      ...temel, url: url.toString(), durum: 'engellendi',
      httpDurum: null, deneme: 0, mesaj: guvenlik.sebep ?? 'Adres engellendi.',
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
        return kayitYaz(kiraci, {
          ...temel, url: url.toString(), durum: 'basarili',
          httpDurum: yanit.status, deneme, mesaj: null,
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

  return kayitYaz(kiraci, {
    ...temel, url: url.toString(), durum: 'basarisiz',
    httpDurum: sonDurum, deneme: EN_FAZLA_DENEME, mesaj: sonMesaj,
  });
}

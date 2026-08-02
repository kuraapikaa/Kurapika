/**
 * API TRAFIK KAYDI — panelin kendi "Network" sekmesi.
 *
 * ── Neden ─────────────────────────────────────────────────────────────
 *
 * Panelde `LynonApiDocs` adinda elle yazilmis bir uc listesi vardi:
 * ornek govdeler ve ornek yanitlar KODA GOMULUYDU. Gercek trafigi
 * gormek icin tarayicinin Network sekmesini acip istekleri tek tek
 * kopyalamak gerekiyordu — bu panelde tesbit edilen para sizintilarinin
 * cogu tam olarak boyle tesbit edildi.
 *
 * Bu modul trafigi kaynaginda kaydeder:
 *   - GIDEN: panel -> Lynon / BetConstruct / Telegram (global fetch sarmali)
 *   - GELEN: tarayici -> panel API (Fastify kancalari)
 *
 * Her kayit tarayicidaki dort sekmenin karsiligini tasir:
 *   Headers  -> istekBasliklari + yanitBasliklari + method/url/durum
 *   Payload  -> istekGovdesi (+ sorgu dizesi)
 *   Response -> yanitGovdesi (ham)
 *   Preview  -> yanitGovdesi JSON ise istemci agac olarak cizer
 *
 * ── Gizlilik ──────────────────────────────────────────────────────────
 *
 * Bu bir CANLI KUMAR PANELI: yanit govdeleri oyuncu kimligi, bakiye ve
 * odeme bilgisi tasiyor. Bu yuzden:
 *
 *   1. Govdeler VARSAYILAN OLARAK KAYDEDILMEZ. Yalnizca metaveri
 *      (yon, method, url, durum, sure) ve TEMIZLENMIS basliklar tutulur.
 *   2. Govde kaydi admin tarafindan acikca "kurulur" (arm) ve kendi
 *      kendine suresi dolar. Acik unutulamaz.
 *   3. Kimlik tasiyan basliklar ve govde alanlari maskelenir.
 *   4. Hicbir sey diske yazilmaz; yalnizca bellekte halka tampon.
 */

/** Bellekte tutulan azami kayit. Halka tampon: eskiler dusulur. */
const HALKA_BOYU = 300;

/** Govde basina azami karakter. Buyuk raporlar belligi doldurmasin. */
const AZAMI_GOVDE = 32 * 1024;

/** Govde yakalama bir kez kurulunca ne kadar acik kalir. */
export const YAKALAMA_SURESI_MS = 30 * 60 * 1000;

/**
 * Degeri tamamen maskelenen baslik adlari.
 *
 * `cookie` ve `authentication` burada olmazsa Lynon oturum cerezi ve
 * BetConstruct token'i kayda duz metin girer.
 */
const GIZLI_BASLIKLAR = new Set([
  'authorization',
  'authentication',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-token-update-secret',
  'x-telegram-bot-api-secret-token',
  'x-api-key',
]);

/** Govde icinde maskelenen alan adlari. */
const GIZLI_ALAN = /(password|parola|şifre|sifre|token|secret|otp|apikey|api_key|authorization|cookie|sessionid)/i;

export type TrafikYonu = 'giden' | 'gelen';

export type TrafikKaydi = {
  id: number;
  yon: TrafikYonu;
  method: string;
  url: string;
  /** Sorgu dizesi ayri tutulur; Payload sekmesi bunu da gosterir. */
  sorgu: Record<string, string>;
  durum: number | null;
  /** Milisaniye. */
  sure: number;
  zaman: string;
  istekBasliklari: Record<string, string>;
  yanitBasliklari: Record<string, string>;
  istekGovdesi: string | null;
  yanitGovdesi: string | null;
  /** Govde kaydi kapaliyken true; istemci bunu acikca gosterir. */
  govdelerAtlandi: boolean;
  hata: string | null;
};

const halka: TrafikKaydi[] = [];
let siradakiId = 1;

/** Govde yakalamanin acik kaldigi ana kadar (epoch ms). */
let yakalamaBitis = 0;

export function govdeYakalamaAcikMi(simdi = Date.now()): boolean {
  return yakalamaBitis > simdi;
}

/** Govde yakalamayi kurar; sure sonunda kendiliginden kapanir. */
export function govdeYakalamaKur(sureMs = YAKALAMA_SURESI_MS, simdi = Date.now()): number {
  const sure = Math.max(0, Math.min(sureMs, YAKALAMA_SURESI_MS));
  yakalamaBitis = simdi + sure;
  return yakalamaBitis;
}

export function govdeYakalamaKapat(): void {
  yakalamaBitis = 0;
}

export function yakalamaDurumu(simdi = Date.now()): { acik: boolean; kalanMs: number } {
  const kalan = Math.max(0, yakalamaBitis - simdi);
  return { acik: kalan > 0, kalanMs: kalan };
}

/** Basliklari temizler: gizli olanlarin degeri maskelenir. */
export function basliklariTemizle(kaynak: unknown): Record<string, string> {
  const sonuc: Record<string, string> = {};
  if (!kaynak || typeof kaynak !== 'object') return sonuc;

  const girisler: Array<[string, unknown]> =
    typeof (kaynak as Headers).forEach === 'function' && typeof (kaynak as Headers).get === 'function'
      ? (() => {
          const toplanan: Array<[string, unknown]> = [];
          (kaynak as Headers).forEach((deger, ad) => toplanan.push([ad, deger]));
          return toplanan;
        })()
      : Object.entries(kaynak as Record<string, unknown>);

  for (const [ad, deger] of girisler) {
    const kucuk = String(ad).toLowerCase();
    if (GIZLI_BASLIKLAR.has(kucuk)) {
      sonuc[kucuk] = '***';
      continue;
    }
    sonuc[kucuk] = Array.isArray(deger) ? deger.join(', ') : String(deger ?? '');
  }
  return sonuc;
}

/**
 * Govdeyi temizler ve kirpar.
 *
 * JSON ise alan adlarina bakip parola/token benzeri degerleri maskeler.
 * JSON degilse oldugu gibi (kirpilmis) tutulur.
 */
export function govdeyiTemizle(govde: unknown): string | null {
  if (govde == null) return null;
  const ham = typeof govde === 'string' ? govde : safeStringify(govde);
  if (ham === '') return null;

  let cikti = ham;
  try {
    cikti = JSON.stringify(maskele(JSON.parse(ham)), null, 2);
  } catch {
    // JSON degil; duz metin olarak birak.
  }

  return cikti.length > AZAMI_GOVDE
    ? `${cikti.slice(0, AZAMI_GOVDE)}\n\n… [${cikti.length - AZAMI_GOVDE} karakter kırpıldı]`
    : cikti;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(value);
  }
}

function maskele(deger: unknown): unknown {
  if (Array.isArray(deger)) return deger.map(maskele);
  if (deger && typeof deger === 'object') {
    const sonuc: Record<string, unknown> = {};
    for (const [ad, ic] of Object.entries(deger as Record<string, unknown>)) {
      sonuc[ad] = GIZLI_ALAN.test(ad) ? '***' : maskele(ic);
    }
    return sonuc;
  }
  return deger;
}

/**
 * Yuzde kodlamasini cozer.
 *
 * `new URL(...).pathname` ASCII disi karakterleri kodluyor: `/api/İşlemler`
 * -> `/api/%C4%B0%C5%9Flemler`. Kodlu hali hem ekranda okunmaz hem de
 * Turkce arama hicbir zaman eslesmez.
 */
function yuzdeCoz(deger: string): string {
  try {
    return decodeURIComponent(deger);
  } catch {
    return deger;
  }
}

/** URL'i yol ve sorgu olarak ayirir; ayrıştırılamayan URL çökmez. */
export function urlAyir(url: string): { yol: string; sorgu: Record<string, string> } {
  try {
    const cozulmus = new URL(url, 'http://yerel');
    const sorgu: Record<string, string> = {};
    cozulmus.searchParams.forEach((deger, ad) => {
      sorgu[ad] = GIZLI_ALAN.test(ad) ? '***' : deger;
    });
    const koken = cozulmus.origin === 'http://yerel' ? '' : cozulmus.origin;
    return { yol: `${koken}${yuzdeCoz(cozulmus.pathname)}`, sorgu };
  } catch {
    return { yol: String(url ?? ''), sorgu: {} };
  }
}

export type KayitGirdisi = Omit<TrafikKaydi, 'id' | 'zaman' | 'govdelerAtlandi' | 'sorgu' | 'url'> & {
  url: string;
};

/** Kaydi halkaya ekler ve olusan kaydi doner. */
export function kaydet(girdi: KayitGirdisi, simdi = Date.now()): TrafikKaydi {
  const yakala = govdeYakalamaAcikMi(simdi);
  const { yol, sorgu } = urlAyir(girdi.url);

  const kayit: TrafikKaydi = {
    id: siradakiId++,
    yon: girdi.yon,
    method: String(girdi.method ?? 'GET').toUpperCase(),
    url: yol,
    sorgu,
    durum: girdi.durum ?? null,
    sure: Math.max(0, Math.round(girdi.sure ?? 0)),
    zaman: new Date(simdi).toISOString(),
    istekBasliklari: girdi.istekBasliklari ?? {},
    yanitBasliklari: girdi.yanitBasliklari ?? {},
    istekGovdesi: yakala ? girdi.istekGovdesi ?? null : null,
    yanitGovdesi: yakala ? girdi.yanitGovdesi ?? null : null,
    govdelerAtlandi: !yakala,
    hata: girdi.hata ?? null,
  };

  halka.push(kayit);
  if (halka.length > HALKA_BOYU) halka.splice(0, halka.length - HALKA_BOYU);
  return kayit;
}

export type TrafikFiltresi = {
  yon?: TrafikYonu;
  /** Yol/method icinde aranan metin. */
  arama?: string;
  /** Yalnizca hatali yanitlar (durum >= 400 ya da hata dolu). */
  yalnizHatali?: boolean;
  limit?: number;
};

/** Kayitlari yeniden eskiye doner. */
export function kayitlar(filtre: TrafikFiltresi = {}): TrafikKaydi[] {
  const arama = String(filtre.arama ?? '').trim().toLocaleLowerCase('tr-TR');
  const limit = Math.max(1, Math.min(HALKA_BOYU, Number(filtre.limit) || HALKA_BOYU));

  const sonuc = halka.filter((kayit) => {
    if (filtre.yon && kayit.yon !== filtre.yon) return false;
    if (filtre.yalnizHatali && !(kayit.hata || (kayit.durum ?? 0) >= 400)) return false;
    if (arama && !`${kayit.method} ${kayit.url}`.toLocaleLowerCase('tr-TR').includes(arama)) return false;
    return true;
  });

  return sonuc.slice(-limit).reverse();
}

export function kaydiGetir(id: number): TrafikKaydi | undefined {
  return halka.find((kayit) => kayit.id === id);
}

export function temizle(): void {
  halka.length = 0;
}

/**
 * Ucler icin ozet: her yol+method icin cagri sayisi, hata sayisi, ortalama
 * sure ve son cagri. "Panelde hangi ucler var" sorusunun canli cevabi.
 */
export type UcOzeti = {
  yon: TrafikYonu;
  method: string;
  url: string;
  cagri: number;
  hata: number;
  ortalamaSure: number;
  sonCagri: string;
  sonDurum: number | null;
};

export function ucOzetleri(): UcOzeti[] {
  const harita = new Map<string, UcOzeti & { toplamSure: number }>();

  for (const kayit of halka) {
    const anahtar = `${kayit.yon} ${kayit.method} ${kayit.url}`;
    const mevcut = harita.get(anahtar) ?? {
      yon: kayit.yon,
      method: kayit.method,
      url: kayit.url,
      cagri: 0,
      hata: 0,
      ortalamaSure: 0,
      toplamSure: 0,
      sonCagri: kayit.zaman,
      sonDurum: kayit.durum,
    };
    mevcut.cagri += 1;
    mevcut.toplamSure += kayit.sure;
    if (kayit.hata || (kayit.durum ?? 0) >= 400) mevcut.hata += 1;
    if (kayit.zaman >= mevcut.sonCagri) {
      mevcut.sonCagri = kayit.zaman;
      mevcut.sonDurum = kayit.durum;
    }
    harita.set(anahtar, mevcut);
  }

  return [...harita.values()]
    .map(({ toplamSure, ...ozet }) => ({
      ...ozet,
      ortalamaSure: ozet.cagri > 0 ? Math.round(toplamSure / ozet.cagri) : 0,
    }))
    .sort((a, b) => b.cagri - a.cagri);
}

// ─── Kayitli uc katalogu (Fastify onRoute) ──────────────────────────────

export type KatalogSatiri = { method: string; url: string };

const katalog: KatalogSatiri[] = [];

/** Fastify `onRoute` kancasindan cagrilir. */
export function ucKaydet(method: string | string[], url: string): void {
  const metotlar = Array.isArray(method) ? method : [method];
  for (const m of metotlar) {
    const satir = { method: String(m).toUpperCase(), url: String(url) };
    if (!katalog.some((k) => k.method === satir.method && k.url === satir.url)) katalog.push(satir);
  }
}

/** Panelin KENDI ucları — cagrilmis olsun olmasin hepsi. */
export function ucKatalogu(): KatalogSatiri[] {
  return [...katalog].sort((a, b) => a.url.localeCompare(b.url, 'tr') || a.method.localeCompare(b.method));
}

// ─── Otomatik tarama plani ──────────────────────────────────────────────

/**
 * TARAMA GUVENLIGI.
 *
 * Tarama, katalogdaki uclari sirayla cagirip trafigi doldurur. Bu panelde
 * POST/PUT/DELETE ucları BONUS VERIYOR, BAKIYE DUZELTIYOR ve CEKIM
 * SONUCLANDIRIYOR. Bir tarama bunlari cagirirsa gercek para hareketi
 * yaratir.
 *
 * Bu yuzden kural tek yonlu: YALNIZCA GET taranir. Liste "guvenli
 * saydiklarim" degil, "mutasyon ihtimali olmayan metot" uzerine kurulu;
 * yeni bir uc eklendiginde varsayilan olarak taramaya GIRMEZ.
 */
const TARANABILIR_METOTLAR = new Set(['GET', 'HEAD']);

/** Yol parametresi iceren rotalar deger olmadan cagrilamaz. */
const PARAMETRELI = /[:*]/;

/** Tarama uclarinin kendisi taranmaz; kendini besleyen dongu olur. */
const TARAMA_DISI = /^\/api\/admin\/api-trafik/;

export type TaramaSatiri =
  | { taranabilir: true; method: string; url: string }
  | { taranabilir: false; method: string; url: string; neden: string };

/**
 * Katalogdaki her ucu siniflandirir.
 *
 * Atlananlar da doner — "neden taranmadi" sorusu ekranda yanitlanabilsin
 * diye. Sessizce dusurmek, kapsamin eksik oldugunu gizler.
 */
export function taramaPlani(): TaramaSatiri[] {
  return ucKatalogu().map((satir) => {
    if (!TARANABILIR_METOTLAR.has(satir.method)) {
      return {
        taranabilir: false,
        ...satir,
        neden: 'Veri değiştirebilir (bonus/bakiye/çekim) — tarama yalnızca GET çağırır.',
      };
    }
    if (TARAMA_DISI.test(satir.url)) {
      return { taranabilir: false, ...satir, neden: 'Trafik ekranının kendi ucu.' };
    }
    if (PARAMETRELI.test(satir.url)) {
      return { taranabilir: false, ...satir, neden: 'Yol parametresi gerekiyor; örnek değer verilmeli.' };
    }
    return { taranabilir: true, ...satir };
  });
}

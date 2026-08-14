/**
 * PANELİ HANGİ SİTELER IFRAME OLARAK GÖMEBİLİR?
 *
 * ── Sorun ─────────────────────────────────────────────────────────────
 *
 * Panel ana sitede iframe olarak çalışıyor ve ana sitenin adresi düzenli
 * olarak dönüyor (narcosbahis484.com → narcosbahis485.com → ...).
 * `FRAME_ANCESTORS` sabit bir liste olduğu için her dönüşte tarayıcı
 * çerçeveyi reddediyor ve panel bağlanmıyor; elle güncelleyip yeniden
 * dağıtmak gerekiyordu.
 *
 * ── Neden basit bir joker yetmiyor ────────────────────────────────────
 *
 * CSP `frame-ancestors` alan adının ORTASINDA joker kabul etmez.
 * `https://narcosbahis*.com` GEÇERSİZ bir kaynak ifadesidir; yalnızca
 * `https://*.example.com` (alt alan adı) desteklenir. Dolayısıyla dönen
 * numarayı statik bir direktifle ifade etmek mümkün değil.
 *
 * ── Çözüm ─────────────────────────────────────────────────────────────
 *
 * Direktif isteğe göre üretilir: gömen sayfanın origin'i `Referer`'dan
 * okunur, yapılandırılmış kalıplara karşı doğrulanır ve YALNIZCA eşleşirse
 * direktife eklenir.
 *
 * Bu güvenliği zayıflatmaz:
 *   - Kuralı uygulayan taraf tarayıcıdır; biz yalnızca izin verilen
 *     listeyi bildiririz.
 *   - Saldırgan kurbanın tarayıcısına sahte `Referer` gönderttiremez.
 *   - Referer yoksa ya da eşleşmezse liste yalnızca `'self'` + sabit
 *     listedir; yani KAPALI tarafa düşer.
 */

/** Origin dışında bir şey (yol, sorgu) taşımayan, şema+host[+port] biçimi. */
const ORIGIN_BICIMI = /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i;

/**
 * Tek bir joker kalıbını düzenli ifadeye çevirir.
 *
 * Desteklenen biçimler:
 *   https://narcosbahis*.com   -> etiket İÇİNDE joker; nokta EŞLEŞMEZ,
 *                                 yani evil.narcosbahis1.com kabul edilmez
 *   https://*.narcosbahis.vip  -> alt alan adı jokeri (bir veya daha fazla)
 *
 * Şema her zaman birebir eşleşir; `http` kalıbı `https` isteğini kabul
 * etmez.
 */
function kalipToRegex(kalip: string): RegExp | null {
  const temiz = kalip.trim();
  if (!temiz) return null;

  // Tek başına joker ya da şemasız joker fazla geniş; sessizce reddedilir.
  if (temiz === '*' || temiz === 'https://*' || temiz === 'http://*') return null;
  if (!/^https?:\/\//i.test(temiz)) return null;

  const kacir = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Alt alan adı jokeri: "https://*.ornek.com"
  const altAlan = temiz.match(/^(https?:\/\/)\*\.(.+)$/i);
  if (altAlan) {
    const [, sema, kalan] = altAlan;
    return new RegExp(`^${kacir(sema)}([a-z0-9-]+\\.)+${kacir(kalan)}$`, 'i');
  }

  // Etiket içi joker: "https://narcosbahis*.com"
  // `*` yalnızca nokta İÇERMEYEN karakterlere karşılık gelir.
  const govde = temiz.split('*').map(kacir).join('[a-z0-9-]*');
  return new RegExp(`^${govde}$`, 'i');
}

/** Aday origin, kalıplardan herhangi birine uyuyor mu? */
export function cerceveAtasiUyuyorMu(aday: string, kaliplar: string[]): boolean {
  if (!ORIGIN_BICIMI.test(aday)) return false;
  return kaliplar.some((k) => {
    const re = kalipToRegex(k);
    return re ? re.test(aday) : false;
  });
}

/** Boşluk ya da virgülle ayrılmış ortam değişkenini listeye çevirir. */
export function listeyiAyristir(deger: string | undefined): string[] {
  return (deger ?? '').split(/[\s,]+/).map((v) => v.trim()).filter(Boolean);
}

/** `Referer` başlığından origin çıkarır. Başlık yoksa/bozuksa null. */
export function refererOrigini(referer: string | undefined): string | null {
  if (!referer) return null;
  try {
    const u = new URL(referer);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.origin;
  } catch {
    return null;
  }
}

/**
 * Bu istek için `frame-ancestors` direktifini üretir.
 *
 * `'self'` her zaman ilk sırada; sabit liste her zaman dahil. Kalıba uyan
 * gömen origin varsa o da eklenir (yinelenmez).
 */
export function cerceveAtasiDirektifi(secenekler: {
  sabitler: string[];
  kaliplar: string[];
  referer?: string;
}): string[] {
  const { sabitler, kaliplar, referer } = secenekler;
  const direktif = ["'self'", ...sabitler];

  const aday = refererOrigini(referer);
  if (aday && cerceveAtasiUyuyorMu(aday, kaliplar) && !direktif.includes(aday)) {
    direktif.push(aday);
  }

  return direktif;
}

/**
 * Panel herhangi bir dış siteye gömülebilir mi?
 *
 * X-Frame-Options ve Cross-Origin-Resource-Policy kararları buna bakar:
 * XFO tek origin kabul eder ve eski tarayıcılarda frame-ancestors'ı ezer,
 * bu yüzden gömme amaçlanıyorsa kapatılmalı.
 */
export function gomulebilirMi(sabitler: string[], kaliplar: string[]): boolean {
  return sabitler.length > 0 || kaliplar.length > 0;
}

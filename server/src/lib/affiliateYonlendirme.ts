import type { FastifyInstance } from 'fastify';

/**
 * ESKI AFFILIATE ADRESLERI -> BUGS AFFILIATE.
 *
 * Ortaklik yonetimi ve ortak paneli bu panelden kaldirildi. Ortaklara ve
 * ekibe DAGITILMIS baglantilar var (`/ortak-paneli`, `/ortak.html`);
 * onlari 404'e dusurmek, ortagin panele girememesi demek.
 *
 * ── Neden 302, 301 degil ──
 *
 * Hedef adres ortam degiskeninden geliyor ve ortama gore degisiyor. 301
 * tarayicida KALICI olarak onbellege giriyor; yanlis bir deger bir kez
 * yayilirsa kullanicinin tarayicisindan geri almak imkansiza yakin.
 * Bu blogun kendisi eski kodda 301'di ve hedefi sabitti; artik degil.
 *
 * Kayit `if (isProduction)` blogunun icinde oldugu icin ayri bir
 * fonksiyona cikarildi: boylece test, uretim moduna (ve Redis'e) ihtiyac
 * duymadan rotalari dogrulayabiliyor.
 */

export const VARSAYILAN_YONETIM_URL = 'https://affiliate.narcosbahis.vip';
export const VARSAYILAN_ORTAK_URL = 'https://ortak.narcosbahis.vip';

/** Eski ortak paneli adresleri; ikisi de ortakların elinde. */
export const ESKI_ORTAK_YOLLARI = ['/ortak-paneli', '/ortak.html'] as const;

export interface YonlendirmeAdresleri {
  yonetim: string;
  ortak: string;
}

export function yonlendirmeAdresleri(
  ortam: NodeJS.ProcessEnv = process.env,
): YonlendirmeAdresleri {
  const temiz = (deger: unknown, varsayilan: string): string => {
    const metin = String(deger ?? '').trim();
    return metin || varsayilan;
  };
  return {
    yonetim: temiz(ortam.AFFILIATE_YONETIM_URL, VARSAYILAN_YONETIM_URL),
    ortak: temiz(ortam.AFFILIATE_ORTAK_URL, VARSAYILAN_ORTAK_URL),
  };
}

export function affiliateYonlendirmeleriKur(
  app: FastifyInstance,
  adresler: YonlendirmeAdresleri = yonlendirmeAdresleri(),
): void {
  app.get('/affiliate-paneli', async (_istek, yanit) => yanit.redirect(adresler.yonetim, 302));
  for (const yol of ESKI_ORTAK_YOLLARI) {
    app.get(yol, async (_istek, yanit) => yanit.redirect(adresler.ortak, 302));
  }
}

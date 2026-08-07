import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import {
  affiliateYonlendirmeleriKur,
  ESKI_ORTAK_YOLLARI,
  VARSAYILAN_ORTAK_URL,
  VARSAYILAN_YONETIM_URL,
  yonlendirmeAdresleri,
} from './affiliateYonlendirme.js';

/**
 * Bu yollar ORTAKLARIN ELINDE.
 *
 * Ortaklik yonetimi panelden kaldirildi; kaldirma sirasinda bu
 * yonlendirmelerin dusmesi, ortagin panele hic giremeyecegi anlamina
 * gelir ve kimse bize haber vermez -- ortak sadece bir daha girmez.
 */

const kur = async (ortam?: NodeJS.ProcessEnv) => {
  const app = Fastify();
  affiliateYonlendirmeleriKur(app, ortam ? yonlendirmeAdresleri(ortam) : undefined);
  await app.ready();
  return app;
};

describe('affiliate yonlendirmeleri', () => {
  it('eski ortak paneli adreslerini yeni portala gonderir', async () => {
    const app = await kur({} as NodeJS.ProcessEnv);
    for (const yol of ESKI_ORTAK_YOLLARI) {
      const yanit = await app.inject({ method: 'GET', url: yol });
      expect(yanit.statusCode, `${yol} yonlendirmedi`).toBe(302);
      expect(yanit.headers.location).toBe(VARSAYILAN_ORTAK_URL);
    }
    await app.close();
  });

  it('yonetim kisayolu affiliate paneline gider', async () => {
    const app = await kur({} as NodeJS.ProcessEnv);
    const yanit = await app.inject({ method: 'GET', url: '/affiliate-paneli' });
    expect(yanit.statusCode).toBe(302);
    expect(yanit.headers.location).toBe(VARSAYILAN_YONETIM_URL);
    await app.close();
  });

  it('adresler ortam degiskeniyle degistirilebilir', async () => {
    const app = await kur({
      AFFILIATE_YONETIM_URL: 'https://yonetim.ornek.test',
      AFFILIATE_ORTAK_URL: 'https://ortak.ornek.test',
    } as NodeJS.ProcessEnv);

    expect((await app.inject({ method: 'GET', url: '/affiliate-paneli' })).headers.location)
      .toBe('https://yonetim.ornek.test');
    expect((await app.inject({ method: 'GET', url: '/ortak-paneli' })).headers.location)
      .toBe('https://ortak.ornek.test');
    await app.close();
  });

  /**
   * Bos bir degisken, "ayarlanmamis" ile ayni sayilmali. Aksi halde
   * yonlendirme bos bir Location basligiyla doner ve tarayici hicbir yere
   * gitmez -- 404'ten daha kotu, cunku hata da gorunmez.
   */
  it('bos ortam degiskeni varsayilana duser', async () => {
    const app = await kur({ AFFILIATE_ORTAK_URL: '   ' } as NodeJS.ProcessEnv);
    const yanit = await app.inject({ method: 'GET', url: '/ortak.html' });
    expect(yanit.headers.location).toBe(VARSAYILAN_ORTAK_URL);
    await app.close();
  });

  /** 301 tarayicida kalici onbellege girer; adres degisebildigi icin yasak. */
  it('kalici yonlendirme KULLANMAZ', async () => {
    const app = await kur({} as NodeJS.ProcessEnv);
    for (const yol of [...ESKI_ORTAK_YOLLARI, '/affiliate-paneli']) {
      expect((await app.inject({ method: 'GET', url: yol })).statusCode).not.toBe(301);
    }
    await app.close();
  });
});

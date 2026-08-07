import type { FastifyInstance, FastifyReply } from 'fastify';
import { jetonUret, OTURUM_CEREZI, yoneticiGirisi } from '../kimlik/oturum.js';
import { ortakGirisi, ortakOlustur } from '../servisler/ortaklar.js';

/**
 * GİRİŞ / ÇIKIŞ ve ORTAK BAŞVURUSU.
 *
 * Çerez `httpOnly` ve `sameSite: 'lax'`. `lax` bilinçli: tıklama ucu
 * başka sitelerden geliyor ve `strict` olsaydı ortak, kendi sitesindeki
 * bir linkten panele geldiğinde oturumu düşmüş görünürdü. `lax` üst
 * düzey gezinmede çerezi taşıyor, çapraz site POST'unda taşımıyor.
 */

function cerezYaz(yanit: FastifyReply, jeton: string): void {
  yanit.setCookie(OTURUM_CEREZI, jeton, {
    httpOnly: true,
    sameSite: 'lax',
    // Uretimde her zaman `secure`. Yerel gelistirmede http uzerinden
    // calisiliyor ve `secure` cerezi tarayici hic gondermez.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

export async function oturumRotalari(app: FastifyInstance): Promise<void> {
  app.get('/', async (istek) => {
    if (!istek.oturum) return { girisli: false };
    return {
      girisli: true,
      rol: istek.oturum.rol,
      ad: istek.oturum.ad,
      kiraci: istek.oturum.kiraci,
      ortakAnahtari: istek.oturum.ortakAnahtari ?? null,
    };
  });

  app.post('/yonetici', async (istek, yanit) => {
    const govde = (istek.body ?? {}) as { kullanici?: string; parola?: string };
    const { ad } = yoneticiGirisi(String(govde.kullanici ?? ''), String(govde.parola ?? ''));
    cerezYaz(yanit, jetonUret({ rol: 'yonetici', kiraci: istek.kiraci, ad }));
    return { girisli: true, rol: 'yonetici', ad, kiraci: istek.kiraci };
  });

  app.post('/ortak', async (istek, yanit) => {
    const govde = (istek.body ?? {}) as { eposta?: string; parola?: string };
    const ortak = await ortakGirisi(istek.kiraci, String(govde.eposta ?? ''), String(govde.parola ?? ''));
    cerezYaz(yanit, jetonUret({
      rol: 'ortak',
      kiraci: istek.kiraci,
      ortakId: ortak.id,
      ortakAnahtari: ortak.ortakAnahtari,
      ad: ortak.ad,
    }));
    return { girisli: true, rol: 'ortak', ad: ortak.ad, durum: ortak.durum, ortakAnahtari: ortak.ortakAnahtari };
  });

  app.post('/cikis', async (_istek, yanit) => {
    yanit.clearCookie(OTURUM_CEREZI, { path: '/' });
    return { girisli: false };
  });

  /**
   * ORTAK BAŞVURUSU — açık uç.
   *
   * Başvuru her zaman `bekliyor` durumunda açılıyor; gövdeden gelen
   * `durum` alanı YOK SAYILIYOR. Kabul etseydik, herkes kendini
   * onaylanmış ortak olarak kaydedip anında izleme linki üretebilirdi.
   */
  app.post('/basvuru', async (istek, yanit) => {
    const govde = (istek.body ?? {}) as Record<string, unknown>;
    // Basvuruda parola ZORUNLU: parolasiz kayit, sonradan giris yapamayan
    // ve yoneticinin elle parola atamasi gereken olu bir kayit uretirdi.
    if (!String(govde.parola ?? '')) {
      yanit.status(400);
      return { hata: 'parola zorunlu.' };
    }
    const ortak = await ortakOlustur(istek.kiraci, {
      ad: String(govde.ad ?? ''),
      eposta: String(govde.eposta ?? ''),
      parola: String(govde.parola ?? ''),
      ortakAnahtari: String(govde.ortakAnahtari ?? ''),
      trafikKaynagi: String(govde.trafikKaynagi ?? ''),
      odemeYontemi: String(govde.odemeYontemi ?? ''),
      odemeDetayi: String(govde.odemeDetayi ?? ''),
      basvuru: govde.basvuru,
      durum: 'bekliyor',
    });
    yanit.status(201);
    return { alindi: true, durum: ortak.durum, ad: ortak.ad };
  });
}

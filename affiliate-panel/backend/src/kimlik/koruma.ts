import type { FastifyReply, FastifyRequest } from 'fastify';
import type { OturumVerisi } from './oturum.js';

/**
 * ROL KAPILARI.
 *
 * `app.ts` yerine ayrı bir dosyada: rotalar `app`'i, `app` da rotaları
 * içe aktarıyor. Kapıları `app.ts` içinde bırakmak döngüsel bir bağımlılık
 * kurardı ve ESM'de böyle bir döngü, yükleme sırasına göre tanımsız
 * fonksiyona dönüşebiliyor.
 *
 * `null` dönüş = yanıt zaten gönderildi, rota devam etmemeli. Rotanın
 * kendi kontrolünü yazmasına bırakmak, bir yerde unutulduğunda o ucun
 * kimliksiz açık kalması demek olurdu.
 */

export function yoneticiZorunlu(istek: FastifyRequest, yanit: FastifyReply): OturumVerisi | null {
  if (istek.oturum?.rol !== 'yonetici') {
    yanit.status(401).send({ hata: 'Yönetici girişi gerekli.' });
    return null;
  }
  return istek.oturum;
}

export function ortakZorunlu(
  istek: FastifyRequest,
  yanit: FastifyReply,
): (OturumVerisi & { ortakAnahtari: string }) | null {
  const oturum = istek.oturum;
  if (oturum?.rol !== 'ortak' || !oturum.ortakAnahtari) {
    yanit.status(401).send({ hata: 'Ortak girişi gerekli.' });
    return null;
  }
  return oturum as OturumVerisi & { ortakAnahtari: string };
}

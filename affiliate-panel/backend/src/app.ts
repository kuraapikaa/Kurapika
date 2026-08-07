import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { guvenliKiraciAnahtari, varsayilanKiraci } from './lib/kiraci.js';
import { jetonCoz, OTURUM_CEREZI, type OturumVerisi } from './kimlik/oturum.js';
import { oturumRotalari } from './rotalar/oturum.js';
import { portalRotalari } from './rotalar/portal.js';
import { tiklamaRotalari } from './rotalar/tiklamaUcu.js';
import { yonetimRotalari } from './rotalar/yonetim.js';

declare module 'fastify' {
  interface FastifyRequest {
    kiraci: string;
    oturum: OturumVerisi | null;
  }
}

/**
 * Kiracı çözümü.
 *
 * Sırayla: oturumun İÇİNDEKİ kiracı → `x-kiraci` başlığı → alt alan adı
 * → varsayılan.
 *
 * Oturumdaki değer ÖNCE geliyor ve başlıkla ezilemiyor. Aksi hâlde
 * geçerli bir oturuma sahip biri, başlığı değiştirerek başka bir
 * kiracının verisine erişirdi — çok kiracılı bir panelde en kolay
 * yapılan ve en pahalıya patlayan hata.
 */
function kiraciCoz(istek: FastifyRequest, oturum: OturumVerisi | null): string {
  if (oturum) return oturum.kiraci;

  const baslik = String(istek.headers['x-kiraci'] ?? '').trim();
  if (baslik) return guvenliKiraciAnahtari(baslik);

  const sunucu = String(istek.headers.host ?? '').split(':')[0];
  const parcalar = sunucu.split('.');
  if (parcalar.length > 2 && parcalar[0] !== 'www') return guvenliKiraciAnahtari(parcalar[0]);

  return varsayilanKiraci();
}

interface HataGovdesi {
  statusCode?: number;
  message?: string;
}

export function hataDurumu(hata: unknown): number {
  const kayit = hata as HataGovdesi;
  const durum = Number(kayit?.statusCode);
  return Number.isInteger(durum) && durum >= 400 && durum < 600 ? durum : 500;
}

export async function uygulamaKur(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL || 'info' },
    trustProxy: true,
    bodyLimit: 1024 * 1024,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: Number(process.env.AFF_RATE_LIMIT) || 300,
    timeWindow: '1 minute',
    // Tiklama ucu bir reklam trafigi ucu; panel hizlariyla ayni sinira
    // sokmak, basarili bir kampanyayi kendi elimizle kesmek olurdu.
    allowList: () => false,
  });

  const kokenler = String(process.env.AFF_CORS_ORIGIN || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  await app.register(cors, {
    origin: kokenler.length ? kokenler : false,
    credentials: true,
  });

  app.decorateRequest('kiraci', '');
  app.decorateRequest('oturum', null);

  app.addHook('onRequest', async (istek) => {
    const oturum = jetonCoz(istek.cookies?.[OTURUM_CEREZI]);
    istek.oturum = oturum;
    istek.kiraci = kiraciCoz(istek, oturum);
  });

  app.setErrorHandler((hata, istek, yanit) => {
    const durum = hataDurumu(hata);
    if (durum >= 500) istek.log.error({ hata }, 'İstek hatası');
    // 5xx'te ic mesaj DISARI VERILMIYOR: yigin izi ve ic adresler
    // sizabiliyor. 4xx kullaniciya yonelik ve bilerek aciklayici.
    yanit.status(durum).send({
      hata: durum >= 500 ? 'Sunucu hatası.' : (hata as HataGovdesi).message || 'Geçersiz istek.',
    });
  });

  app.get('/saglik', async () => ({ durum: 'ayakta', zaman: new Date().toISOString() }));

  await app.register(oturumRotalari, { prefix: '/api/oturum' });
  await app.register(yonetimRotalari, { prefix: '/api/yonetim' });
  await app.register(portalRotalari, { prefix: '/api/portal' });
  await app.register(tiklamaRotalari);

  return app;
}

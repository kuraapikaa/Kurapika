/**
 * Trafik kaydini calisan sisteme baglar.
 *
 * GIDEN trafik icin tek bir yerden giriliyor: global `fetch` sarmalanir.
 * Alternatif her cagri yerini tek tek degistirmekti — kodda 35 ayri
 * `fetch(` var ve yenisi eklendiginde kayда girmezdi. Sarmal, Lynon'u
 * (lynonAuth.lynonRequest), BetConstruct'i ve Telegram'i ayrim yapmadan
 * kapsar.
 *
 * GELEN trafik Fastify kancalariyla alinir.
 */
import type { FastifyInstance } from 'fastify';
import {
  basliklariTemizle,
  govdeYakalamaAcikMi,
  govdeyiTemizle,
  kaydet,
  ucKaydet,
} from './apiTrafik.js';

/** Govdesi okunmaya deger icerik turleri. Ikili yanitlar kopyalanmaz. */
const METIN_TURU = /^(application\/(json|.*\+json|xml|x-www-form-urlencoded)|text\/)/i;

function metinYaniti(basliklar: Record<string, string>): boolean {
  return METIN_TURU.test(basliklar['content-type'] ?? '');
}

let fetchSarmalandi = false;

/**
 * Global fetch'i bir kez sarmalar.
 *
 * Yanit govdesi YALNIZCA yakalama aciksa ve icerik metin turundeyse
 * okunur; okuma her zaman `clone()` uzerinden yapilir, boylece cagiran
 * taraf govdeyi bozulmamis alir.
 */
export function gidenTrafigiKaydet(): void {
  if (fetchSarmalandi) return;
  fetchSarmalandi = true;

  const asilFetch = globalThis.fetch;

  globalThis.fetch = async function kayitliFetch(girdi: any, secenekler?: any): Promise<Response> {
    const baslangic = Date.now();
    const url = typeof girdi === 'string' ? girdi : girdi?.url ?? String(girdi);
    const method = String(secenekler?.method ?? girdi?.method ?? 'GET').toUpperCase();
    const istekBasliklari = basliklariTemizle(secenekler?.headers ?? girdi?.headers);
    const istekGovdesi = govdeYakalamaAcikMi() ? govdeyiTemizle(secenekler?.body) : null;

    try {
      const yanit = await asilFetch(girdi, secenekler);
      const yanitBasliklari = basliklariTemizle(yanit.headers);

      let yanitGovdesi: string | null = null;
      if (govdeYakalamaAcikMi() && metinYaniti(yanitBasliklari)) {
        try {
          yanitGovdesi = govdeyiTemizle(await yanit.clone().text());
        } catch {
          // Govde okunamadiysa kayit metaveriyle devam eder; cagiran
          // tarafin yaniti hicbir kosulda etkilenmemeli.
          yanitGovdesi = null;
        }
      }

      kaydet({
        yon: 'giden',
        method,
        url,
        durum: yanit.status,
        sure: Date.now() - baslangic,
        istekBasliklari,
        yanitBasliklari,
        istekGovdesi,
        yanitGovdesi,
        hata: null,
      });

      return yanit;
    } catch (err) {
      kaydet({
        yon: 'giden',
        method,
        url,
        durum: null,
        sure: Date.now() - baslangic,
        istekBasliklari,
        yanitBasliklari: {},
        istekGovdesi,
        yanitGovdesi: null,
        hata: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  } as typeof fetch;
}

/** Kayit uclarinin kendisi kayda girmesin; sonsuz gurultu olur. */
const ATLA = /^\/api\/admin\/api-trafik/;

/**
 * Gelen istekleri ve panelin kendi uc katalogunu kaydeder.
 *
 * `onRoute` her kayitli yolu toplar — boylece katalog HIC CAGRILMAMIS
 * uclari da icerir; "paneldeki butun uclar" sorusunun tam cevabi ancak
 * boyle verilebilir.
 */
export function gelenTrafigiKaydet(app: FastifyInstance): void {
  app.addHook('onRoute', (route) => {
    ucKaydet(route.method as string | string[], route.url);
  });

  app.addHook('onRequest', async (request: any) => {
    request.trafikBaslangic = Date.now();
  });

  app.addHook('onSend', async (request: any, reply, payload) => {
    if (govdeYakalamaAcikMi() && typeof payload === 'string') {
      request.trafikYanitGovdesi = payload;
    }
    return payload;
  });

  app.addHook('onResponse', async (request: any, reply) => {
    const yol = String(request.url ?? '');
    if (ATLA.test(yol)) return;

    kaydet({
      yon: 'gelen',
      method: String(request.method ?? 'GET'),
      url: yol,
      durum: reply.statusCode,
      sure: Date.now() - (request.trafikBaslangic ?? Date.now()),
      istekBasliklari: basliklariTemizle(request.headers),
      yanitBasliklari: basliklariTemizle(
        typeof reply.getHeaders === 'function' ? reply.getHeaders() : {},
      ),
      istekGovdesi: govdeYakalamaAcikMi() ? govdeyiTemizle(request.body) : null,
      yanitGovdesi: govdeYakalamaAcikMi() ? govdeyiTemizle(request.trafikYanitGovdesi) : null,
      hata: null,
    });
  });
}

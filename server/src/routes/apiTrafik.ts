/**
 * API trafik uclari — panelin kendi Network sekmesini besler.
 *
 * Hepsi YALNIZCA admin. Kayitlar oyuncu kimligi ve odeme verisi
 * tasiyabiliyor; operator rolu bunlari gormemeli.
 */
import type { FastifyInstance } from 'fastify';
import { belgelenmisMi, belgelenmisYollar } from '../lib/belgelenmisUclar.js';
import {
  gidenUcOzetleri,
  govdeYakalamaKapat,
  govdeYakalamaKur,
  kaydiGetir,
  kayitlar,
  taramaPlani,
  temizle,
  ucKatalogu,
  ucOzetleri,
  yakalamaDurumu,
  YAKALAMA_SURESI_MS,
  type TrafikYonu,
} from '../lib/apiTrafik.js';
import { audit } from '../lib/auditLog.js';

function adminMi(request: any): boolean {
  return request.session?.user?.role === 'admin';
}

export async function apiTrafikRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (request: any, reply) => {
    if (!adminMi(request)) {
      return reply.status(403).send({ ok: false, message: 'Bu ekran yalnızca admin rolüne açık.' });
    }
  });

  /** Kayit listesi + uc ozetleri + yakalama durumu. */
  app.get('/admin/api-trafik', async (request: any, reply) => {
    const { yon, arama, yalnizHatali, limit } = request.query ?? {};
    return reply.send({
      ok: true,
      data: {
        yakalama: yakalamaDurumu(),
        azamiYakalamaMs: YAKALAMA_SURESI_MS,
        kayitlar: kayitlar({
          yon: yon === 'giden' || yon === 'gelen' ? (yon as TrafikYonu) : undefined,
          arama: arama ? String(arama) : undefined,
          yalnizHatali: String(yalnizHatali ?? '') === 'true',
          limit: limit ? Number(limit) : undefined,
        }),
        ozetler: ucOzetleri(),
      },
    });
  });

  /**
   * Panelin KENDI uc katalogu.
   *
   * `onRoute` ile toplandigi icin hic cagrilmamis uclari da icerir;
   * gozlenen giden ucler ayrica ozetlerden gelir.
   */
  app.get('/admin/api-trafik/katalog', async (_request, reply) => {
    const ozetler = ucOzetleri();
    const gozlenenGiden = ozetler.filter((o) => o.yon === 'giden');
    const panelUclari = ucKatalogu().map((satir) => {
      const gozlem = ozetler.find(
        (o) => o.yon === 'gelen' && o.method === satir.method && o.url === satir.url,
      );
      return { ...satir, cagri: gozlem?.cagri ?? 0, sonDurum: gozlem?.sonDurum ?? null };
    });

    return reply.send({
      ok: true,
      data: {
        panelUclari,
        gidenUcler: gozlenenGiden,
        toplam: { panel: panelUclari.length, giden: gozlenenGiden.length },
      },
    });
  });

  /**
   * Otomatik tarama plani.
   *
   * Taramayi SUNUCU yapmiyor: plani doner, cagrilari tarayici kendi
   * oturumuyla yapar. Sebep tek degil —
   *   1. Sunucu tarafindan cagirmak oturum/cerez taklidi gerektirirdi;
   *      yetki sinirlarini asan bir yol acmak istemedim.
   *   2. Tarayicidan gidince istekler GERCEK trafik olur: gelen kayit da,
   *      onun tetikledigi giden Lynon cagrilari da kendiliginden dusar.
   */
  app.get('/admin/api-trafik/tarama-plani', async (_request, reply) => {
    const plan = taramaPlani();
    return reply.send({
      ok: true,
      data: {
        satirlar: plan,
        toplam: {
          taranabilir: plan.filter((s) => s.taranabilir).length,
          atlanan: plan.filter((s) => !s.taranabilir).length,
        },
      },
    });
  });

  /**
   * BELGESIZ UCLER — `LynonApiDocs`'ta karsiligi olmayan giden ucler.
   *
   * Her satir son GERCEK kaydina baglanir; istemci o kaydi cekip
   * Request URL / payload / preview / response'u gosterir. Elle yazilmis
   * ornek govdeler yerine gozlenen trafik.
   *
   * POST'lar DAHIL. Bunlari cagirmiyoruz — panel normal kullanilirken
   * gecen trafigi kaydediyoruz. Bu yuzden bonus atama, bakiye duzeltme
   * gibi mutasyon uclarinin gercek govdesi de belgeye girebiliyor;
   * otomatik taramanin guvenle yapamayacagi sey tam olarak buydu.
   */
  app.get('/admin/api-trafik/belgesiz', async (_request, reply) => {
    const hepsi = gidenUcOzetleri();
    const belgesiz = hepsi.filter((uc) => !belgelenmisMi(uc.sablon));
    const belgeli = hepsi.filter((uc) => belgelenmisMi(uc.sablon));

    return reply.send({
      ok: true,
      data: {
        belgesiz,
        belgeli,
        yakalama: yakalamaDurumu(),
        toplam: {
          gozlenen: hepsi.length,
          belgesiz: belgesiz.length,
          belgeli: belgeli.length,
          belgelenmisYol: belgelenmisYollar().length,
          // Govdesi olmayan satirlar: o uc yakalama kapaliyken gecmis.
          govdesiz: belgesiz.filter((uc) => !uc.govdeVar).length,
        },
      },
    });
  });

  /** Tek kaydin tamami — dort sekmenin verisi. */
  app.get('/admin/api-trafik/:id', async (request: any, reply) => {
    const kayit = kaydiGetir(Number(request.params?.id));
    if (!kayit) return reply.status(404).send({ ok: false, message: 'Kayıt bulunamadı veya halkadan düştü.' });
    return reply.send({ ok: true, data: kayit });
  });

  /**
   * Govde yakalamayi acar/kapatir.
   *
   * Govdeler oyuncu verisi tasidigi icin varsayilan KAPALI ve acildiginda
   * kendiliginden suresi doluyor. Denetim kaydina yaziliyor.
   */
  app.post('/admin/api-trafik/yakalama', async (request: any, reply) => {
    const kullanici = request.session?.user?.username ?? 'admin';
    const ac = request.body?.ac !== false;

    if (!ac) {
      govdeYakalamaKapat();
      audit(kullanici, 'admin', 'api_trafik_yakalama', '-', 'kapatıldı');
      return reply.send({ ok: true, data: yakalamaDurumu() });
    }

    const sureMs = Number(request.body?.sureMs);
    const bitis = govdeYakalamaKur(Number.isFinite(sureMs) && sureMs > 0 ? sureMs : YAKALAMA_SURESI_MS);
    audit(kullanici, 'admin', 'api_trafik_yakalama', '-', `açıldı, bitiş ${new Date(bitis).toISOString()}`);
    return reply.send({ ok: true, data: yakalamaDurumu() });
  });

  /** Tamponu bosaltir. */
  app.delete('/admin/api-trafik', async (request: any, reply) => {
    temizle();
    audit(request.session?.user?.username ?? 'admin', 'admin', 'api_trafik_temizle', '-', 'tampon boşaltıldı');
    return reply.send({ ok: true });
  });
}

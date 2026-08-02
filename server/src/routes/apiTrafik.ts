/**
 * API trafik uclari — panelin kendi Network sekmesini besler.
 *
 * Hepsi YALNIZCA admin. Kayitlar oyuncu kimligi ve odeme verisi
 * tasiyabiliyor; operator rolu bunlari gormemeli.
 */
import type { FastifyInstance } from 'fastify';
import {
  govdeYakalamaKapat,
  govdeYakalamaKur,
  kaydiGetir,
  kayitlar,
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

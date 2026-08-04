import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { resolveTenantKeyForRequest } from '../lib/tenant.js';
import {
  bugscrmBaglantisiniTestEt,
  bugscrmPostbackKaydet,
  bugscrmYapilandirilmisMi,
  readBugscrmKayitlari,
  type BugscrmOlayTuru,
} from '../services/bugscrmService.js';

const GECERLI_OLAY_TURLERI: BugscrmOlayTuru[] = ['tiklama', 'kayit', 'yatirim', 'ozel'];

function sayiyaCevir(deger: unknown): number | null {
  if (deger === null || deger === undefined || deger === '') return null;
  const n = Number(deger);
  return Number.isFinite(n) ? n : null;
}

export async function bugscrmRoutes(app: FastifyInstance) {
  /**
   * BugsCRM'in tıklama/dönüşüm bildirdiği postback (S2S).
   *
   * Panel oturumu OLAMAZ — BugsCRM'in kendi sunucusu çağırıyor. Tek
   * koruma paylaşılan sır: Telegram webhook'unda kullanılan aynı desen
   * (bkz. `games.ts` `/telegram/webhook`). Sır tanımlı değilse ucu açık
   * bırakmak yerine kapatılır.
   */
  app.post('/bugscrm/postback', async (request: any, reply) => {
    if (!config.bugscrm.webhookSecret) {
      request.log.error('[bugscrm] BUGSCRM_WEBHOOK_SECRET tanımlı değil; postback kapalı.');
      return reply.status(503).send({ ok: false });
    }
    const saglanan = request.headers['x-bugscrm-secret'];
    if (saglanan !== config.bugscrm.webhookSecret) {
      request.log.warn('[bugscrm] Postback secret eşleşmedi; istek reddedildi.');
      return reply.status(401).send({ ok: false });
    }

    const govde = request.body ?? {};
    const clickId = String(govde.clickId ?? govde.click_id ?? '').trim();
    if (!clickId) return reply.status(400).send({ ok: false, message: 'clickId gerekli.' });

    const olayTuruHam = String(govde.olayTuru ?? govde.event ?? govde.eventType ?? 'ozel').trim().toLowerCase();
    const olayTuru: BugscrmOlayTuru = (GECERLI_OLAY_TURLERI as string[]).includes(olayTuruHam)
      ? (olayTuruHam as BugscrmOlayTuru)
      : 'ozel';

    const tenantKey = await resolveTenantKeyForRequest(request);
    const kayitlar = await bugscrmPostbackKaydet(tenantKey, {
      clickId,
      subId: govde.subId ?? govde.sub_id ?? null,
      olayTuru,
      playerLogin: govde.playerLogin ?? govde.player_login ?? govde.login ?? null,
      tutar: sayiyaCevir(govde.amount ?? govde.tutar),
      paraBirimi: govde.currency ?? govde.paraBirimi ?? null,
      ham: govde,
    });

    return reply.send({ ok: true, toplamKayit: kayitlar.length });
  });

  /** Admin: bağlantı durumu ve yapılandırma özeti (sır DEĞERLERİ değil, yalnızca varlığı). */
  app.get('/admin/bugscrm/durum', async (request, reply) => {
    const session = request.session as any;
    if (!session?.user) return reply.status(401).send({ HasError: true, AlertMessage: 'Oturum bulunamadı.' });
    return reply.send({
      HasError: false,
      Data: {
        etkin: config.bugscrm.enabled,
        yapilandirildi: bugscrmYapilandirilmisMi(),
        endpointUrl: config.bugscrm.endpointUrl || null,
        productId: config.bugscrm.productId || null,
        apiKeyTanimli: Boolean(config.bugscrm.apiKey),
        webhookSecretTanimli: Boolean(config.bugscrm.webhookSecret),
      },
    });
  });

  /** Admin: bağlantıyı canlı test et. */
  app.post('/admin/bugscrm/test-baglanti', async (request, reply) => {
    const session = request.session as any;
    if (!session?.user) return reply.status(401).send({ HasError: true, AlertMessage: 'Oturum bulunamadı.' });
    const sonuc = await bugscrmBaglantisiniTestEt();
    return reply.send({ HasError: !sonuc.ok, AlertMessage: sonuc.ok ? undefined : sonuc.mesaj, Data: sonuc });
  });

  /** Admin: son tıklama/dönüşüm kayıtları. */
  app.get('/admin/bugscrm/kayitlar', async (request: any, reply) => {
    const session = request.session as any;
    if (!session?.user) return reply.status(401).send({ HasError: true, AlertMessage: 'Oturum bulunamadı.' });
    const tenantKey = await resolveTenantKeyForRequest(request);
    const kayitlar = await readBugscrmKayitlari(tenantKey);
    const azami = Math.min(Number(request.query?.limit) || 100, 500);
    return reply.send({ HasError: false, Data: kayitlar.slice(0, azami) });
  });
}

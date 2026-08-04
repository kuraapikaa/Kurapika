import type { FastifyInstance } from 'fastify';
import { clearLynonSession, ensureLynonSession, getLynonAuthStatus, lynonRequest } from '../lib/lynonAuth.js';
import { audit } from '../lib/auditLog.js';
import { config } from '../config.js';
import { ensureTelegramWebhook, sendTelegramMessage } from '../services/telegramService.js';
import {
  lynonActiveWheels,
  lynonBackofficeSettings,
  lynonBonusBlocks,
  lynonBonusDefinitions,
  lynonBonusRequests,
  lynonCasinoOperations,
  lynonCorrectionHistory,
  lynonDashboardSummary,
  lynonDavranisKategorileriniOlustur,
  lynonDeposits,
  lynonDictionaries,
  lynonErrorResponse,
  lynonGridLayout,
  lynonKategoriOnerileri,
  lynonKategoriUygula,
  lynonKycDocuments,
  lynonManuelDuzeltmeler,
  lynonMutabakat,
  lynonAylikKapanisMutabakati,
  lynonYontemBazindaKasa,
  lynonAnlikOyuncuBakiyesi,
  mutabakatManuelKalemiEkle,
  mutabakatManuelKalemiSil,
  lynonMe,
  lynonPaymentTransactions,
  lynonPaymentCounts,
  lynonPaymentMethods,
  lynonPlayerAccounts,
  lynonPlayerCategories,
  lynonPlayerDetail,
  lynonPlayerKpi,
  lynonPlayerRestrictions,
  lynonPlayers,
  lynonSetPlayerRestriction,
  lynonPromoCodes,
  lynonReportByName,
  lynonReportCatalog,
  lynonSite,
  lynonSites,
  lynonSportBets,
  lynonWithdrawalRequests,
} from '../services/lynonBackofficeService.js';

function sendError(reply: any, error: unknown) {
  const { status, body } = lynonErrorResponse(error);
  return reply.status(status).send(body);
}

export async function lynonRoutes(app: FastifyInstance) {
  app.get('/lynon/status', async (_request, reply) => {
    return reply.send({ ok: true, ...getLynonAuthStatus() });
  });

  app.post('/lynon/session/refresh', async (_request, reply) => {
    try {
      clearLynonSession();
      await ensureLynonSession();
      return reply.send({ ok: true, ...getLynonAuthStatus() });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/lynon/me', async (_request, reply) => {
    try {
      return reply.send(await lynonMe());
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/lynon/sites', async (_request, reply) => {
    try {
      return reply.send(await lynonSites());
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/lynon/site', async (_request, reply) => {
    try {
      return reply.send(await lynonSite());
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/lynon/settings', async (_request, reply) => {
    try {
      return reply.send(await lynonBackofficeSettings());
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get<{ Params: { tableKey: string } }>('/lynon/grid-layout/:tableKey', async (request, reply) => {
    try {
      return reply.send(await lynonGridLayout(request.params.tableKey));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/lynon/dictionaries', async (_request, reply) => {
    try {
      return reply.send(await lynonDictionaries());
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get<{ Querystring: { startDate?: string; endDate?: string } }>('/lynon/dashboard', async (request, reply) => {
    try {
      const startDate = request.query.startDate ?? new Date().toISOString().slice(0, 10);
      const endDate = request.query.endDate ?? startDate;
      return reply.send(await lynonDashboardSummary(startDate, endDate));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post<{ Body?: Record<string, unknown> }>('/lynon/players', async (request, reply) => {
    try {
      return reply.send(await lynonPlayers(request.body ?? {}));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get<{ Params: { userId: string } }>('/lynon/players/:userId', async (request, reply) => {
    try {
      return reply.send(await lynonPlayerDetail(request.params.userId));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get<{ Params: { userId: string } }>('/lynon/players/:userId/accounts', async (request, reply) => {
    try {
      return reply.send(await lynonPlayerAccounts(request.params.userId));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get<{ Params: { userId: string } }>('/lynon/players/:userId/kpi', async (request, reply) => {
    try {
      return reply.send(await lynonPlayerKpi(request.params.userId));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post<{ Body?: Record<string, unknown> }>('/lynon/payment-transactions', async (request, reply) => {
    try {
      return reply.send({ HasError: false, Data: await lynonPaymentTransactions(request.body ?? {}) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/lynon/payment-counts', async (_request, reply) => {
    try {
      return reply.send(await lynonPaymentCounts());
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/lynon/payment-methods', async (_request, reply) => {
    try {
      return reply.send(await lynonPaymentMethods());
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post<{ Body?: Record<string, unknown> }>('/lynon/deposits', async (request, reply) => {
    try {
      return reply.send(await lynonDeposits(request.body ?? {}));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post<{ Body?: Record<string, unknown> }>('/lynon/withdrawals', async (request, reply) => {
    try {
      return reply.send(await lynonWithdrawalRequests(request.body ?? {}));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/lynon/bonus-definitions', async (_request, reply) => {
    try {
      return reply.send(await lynonBonusDefinitions());
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/lynon/bonus-requests', async (_request, reply) => {
    try {
      return reply.send(await lynonBonusRequests());
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/lynon/bonus-blocks', async (_request, reply) => {
    try {
      return reply.send(await lynonBonusBlocks());
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/lynon/promocodes', async (_request, reply) => {
    try {
      return reply.send(await lynonPromoCodes());
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/lynon/wheels/active', async (_request, reply) => {
    try {
      return reply.send(await lynonActiveWheels());
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/lynon/player-categories', async (_request, reply) => {
    try {
      return reply.send(await lynonPlayerCategories());
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/lynon/kyc/documents', async (_request, reply) => {
    try {
      return reply.send(await lynonKycDocuments());
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post<{ Body?: Record<string, unknown> }>('/lynon/corrections', async (request, reply) => {
    try {
      return reply.send(await lynonCorrectionHistory(request.body ?? {}));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/lynon/reports/catalog', async (_request, reply) => {
    try {
      return reply.send({ HasError: false, Data: await lynonReportCatalog() });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get<{ Querystring: { name: string; startDate?: string; endDate?: string; currency?: string } }>('/lynon/reports/by-name', async (request, reply) => {
    try {
      if (!request.query.name) return reply.status(400).send({ HasError: true, AlertMessage: 'name gerekli' });
      return reply.send(await lynonReportByName(request.query.name, request.query));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get<{ Querystring: { startDate?: string; endDate?: string; userId?: string } }>('/lynon/casino-operations', async (request, reply) => {
    try {
      return reply.send({
        HasError: false,
        Data: await lynonCasinoOperations({
          startDate: request.query.startDate,
          endDate: request.query.endDate,
          userId: request.query.userId,
        }),
      });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get<{ Querystring: { startDate?: string; endDate?: string; userId?: string } }>('/lynon/sport-bets', async (request, reply) => {
    try {
      return reply.send({
        HasError: false,
        Data: await lynonSportBets({
          startDate: request.query.startDate,
          endDate: request.query.endDate,
          userId: request.query.userId,
        }),
      });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  /**
   * Manuel bakiye düzeltmeleri raporu.
   *
   * Panelin kendi denetim kaydı yalnızca PANELDEN yapılan işlemleri
   * görüyor. Lynon arayüzünden elle yapılan bakiye eklemeleri oraya hiç
   * düşmüyordu — kasadan para çıkaran ikinci bir yol vardı ve panelde
   * görünmüyordu. Bu uç `userName` alanıyla o boşluğu kapatıyor.
   */
  app.post<{ Body?: { startDate?: string; endDate?: string } }>(
    '/lynon/manuel-duzeltmeler',
    async (request, reply) => {
      try {
        return reply.send(await lynonManuelDuzeltmeler(request.body ?? {}));
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  // ─── Aylık mutabakat ───────────────────────────────────────────────────

  /** Ayın başından bugüne mutabakat: ödeme yöntemi kırılımı + elle eklenenler. */
  app.post<{ Body?: { bugun?: string } }>('/lynon/mutabakat', async (request, reply) => {
    try {
      return reply.send(await lynonMutabakat(request.body ?? {}));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  /** Kapanmış bir ayın KESİN toplamı. `ay` verilmezse bir önceki ay. */
  app.post<{ Body?: { ay?: string } }>('/lynon/mutabakat/kapanis', async (request, reply) => {
    try {
      return reply.send(await lynonAylikKapanisMutabakati(request.body ?? {}));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  /**
   * Elle yatırım/çekim kalemi ekle.
   *
   * Rapor yalnızca ödeme sağlayıcılarından geçen parayı görüyor; elden
   * yapılan havaleler ve dengeleme kalemleri buradan giriliyor ve
   * mutabakatta AYRI gösteriliyor.
   *
   * `yontem` verilirse (rapordaki "Entegrasyon · Yöntem" anahtarıyla
   * aynı biçimde) kalem o satıra işlenir — sağlayıcının bildirdiği
   * tutar bir yöntemde eksik/yanlışsa düzeltme orada görünür. Boş
   * bırakılırsa kalem genel kabul edilir, hiçbir satırı değiştirmez.
   */
  app.post<{ Body: { gun?: string; tur?: string; tutar?: number; aciklama?: string; yontem?: string } }>(
    '/lynon/mutabakat/kalem',
    async (request, reply) => {
      const kullanici = (request.session as any)?.user;
      const { gun, tur, tutar, aciklama, yontem } = request.body ?? {};
      try {
        const kalem = await mutabakatManuelKalemiEkle({
          gun: String(gun ?? ''),
          tur: tur === 'cekim' ? 'cekim' : 'yatirim',
          tutar: Number(tutar),
          aciklama: String(aciklama ?? ''),
          ekleyen: kullanici?.username ?? 'bilinmeyen',
          yontem: yontem ? String(yontem) : null,
        });
        audit(kullanici?.username ?? 'bilinmeyen', kullanici?.role ?? '-', 'manual_adjustment',
          'mutabakat', `Mutabakata elle ${kalem.tur} eklendi: ${kalem.tutar} TRY (${kalem.gun})${kalem.yontem ? ` · ${kalem.yontem}` : ''} — ${kalem.aciklama}`);
        return reply.send({ HasError: false, Data: kalem });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  app.delete<{ Params: { id: string } }>('/lynon/mutabakat/kalem/:id', async (request, reply) => {
    const kullanici = (request.session as any)?.user;
    try {
      const silindi = await mutabakatManuelKalemiSil(request.params.id);
      if (!silindi) return reply.status(404).send({ HasError: true, AlertMessage: 'Kalem bulunamadı.' });
      audit(kullanici?.username ?? 'bilinmeyen', kullanici?.role ?? '-', 'manual_adjustment',
        'mutabakat', `Mutabakat kalemi silindi: ${request.params.id}`);
      return reply.send({ HasError: false });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  /** Mutabakatı şimdi Telegram'a gönder. `ay` verilirse o ayın KAPANIŞ raporu gider. */
  app.post<{ Body?: { ay?: string } }>('/lynon/mutabakat/gonder', async (request, reply) => {
    try {
      const { mutabakatiSimdiGonder } = await import('../jobs/mutabakatJob.js');
      await mutabakatiSimdiGonder('default', request.body?.ay);
      return reply.send({ HasError: false, AlertMessage: 'Mutabakat gönderildi.' });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // ─── Otomatik oyuncu kategorileme ──────────────────────────────────────

  /**
   * Kategori önerileri.
   *
   * Eşikler kod içine gömülmez; sitenin kendi kategori açıklamalarından
   * ("[500.000 TL ve üzeri]") okunur. Öneriler risk ve aktiviteyle
   * birlikte döner; kritik riskli oyuncular `bekletme` ile işaretlenir.
   */
  app.post<{ Body?: { MaxRows?: number; enrichLimit?: number } }>(
    '/lynon/oyuncu-kategorileme',
    async (request, reply) => {
      try {
        return reply.send(await lynonKategoriOnerileri(request.body ?? {}));
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  /**
   * Davranış kategorilerini oluştur: High Risk, Bonus Avcısı, VIP Üye, Aktif Üye.
   *
   * İdempotent — sitede aynı adla kategori varsa atlanır. Bu kontrol
   * olmadan düğmeye ikinci basış kopya üretirdi.
   */
  app.post('/lynon/oyuncu-kategorileme/kategorileri-olustur', async (request, reply) => {
    const kullanici = (request.session as any)?.user;
    try {
      const sonuc = await lynonDavranisKategorileriniOlustur();
      const olusturulan = sonuc?.Data?.Olusturulan ?? [];
      if (olusturulan.length > 0) {
        audit(kullanici?.username ?? 'bilinmeyen', kullanici?.role ?? '-', 'manual_adjustment',
          'kategoriler', `Davranış kategorileri oluşturuldu: ${olusturulan.map((o: any) => o.ad).join(', ')}`);
      }
      return reply.send(sonuc);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  /**
   * Öneriyi uygula.
   *
   * `bekletme` sebebi olan öneri buradan da geçebilir — ama bunu bir
   * OPERATÖR yapar ve denetime düşer. Otomatik iş akışı bekletilenlere
   * dokunmaz.
   */
  app.post<{ Body: { playerId?: number; kategoriId?: number } }>(
    '/lynon/oyuncu-kategorileme/uygula',
    async (request, reply) => {
      const playerId = Number(request.body?.playerId);
      const kategoriId = Number(request.body?.kategoriId);
      if (!Number.isFinite(playerId) || !Number.isFinite(kategoriId)) {
        return reply.status(400).send({ HasError: true, AlertMessage: 'playerId ve kategoriId gerekli.' });
      }
      const kullanici = (request.session as any)?.user;
      try {
        const sonuc = await lynonKategoriUygula(playerId, kategoriId);
        audit(kullanici?.username ?? 'bilinmeyen', kullanici?.role ?? '-', 'manual_adjustment',
          `player:${playerId}`, `Oyuncu kategorisi ${kategoriId} olarak güncellendi.`);
        return reply.send(sonuc);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  // ─── Bahis/çekim kısıtları ─────────────────────────────────────────────

  app.get<{ Params: { userId: string } }>('/lynon/oyuncu-kisitlari/:userId', async (request, reply) => {
    try {
      return reply.send({ HasError: false, Data: await lynonPlayerRestrictions(request.params.userId) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  /**
   * Kısıt aç/kapat.
   *
   * Yalnızca `casinoBet` ve `sportsBet`; çekim ve yatırım bu yoldan
   * kapatılamaz (bkz. `hedefBakiyeKilidi.IZINLI_KISITLAR`).
   */
  app.post<{ Params: { userId: string }; Body: { restriction?: string; isRestricted?: boolean; note?: string } }>(
    '/lynon/oyuncu-kisitlari/:userId',
    async (request, reply) => {
      const { restriction, isRestricted, note } = request.body ?? {};
      if (!restriction || typeof isRestricted !== 'boolean') {
        return reply.status(400).send({ HasError: true, AlertMessage: 'restriction ve isRestricted gerekli.' });
      }
      const kullanici = (request.session as any)?.user;
      try {
        const sonuc = await lynonSetPlayerRestriction({
          userId: request.params.userId,
          restriction,
          isRestricted,
          note: String(note ?? '').slice(0, 50) || 'Panel',
        });
        audit(kullanici?.username ?? 'bilinmeyen', kullanici?.role ?? '-', 'manual_adjustment',
          `player:${request.params.userId}`,
          `${restriction} kısıtı ${isRestricted ? 'açıldı' : 'kaldırıldı'}.`);
        return reply.send({ HasError: false, Data: sonuc });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  /** Hedef bakiye taramasını elle çalıştır. */
  app.post('/lynon/hedef-bakiye/tara', async (_request, reply) => {
    try {
      const { runHedefBakiyeJob } = await import('../jobs/hedefBakiyeJob.js');
      return reply.send({ HasError: false, Data: await runHedefBakiyeJob() });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  /** Kasa özetini şimdi Telegram'a gönder. */
  app.post('/lynon/telegram-rapor/ozet', async (_request, reply) => {
    try {
      const { telegramKasaOzetiGonder } = await import('../jobs/telegramRaporJob.js');
      await telegramKasaOzetiGonder();
      return reply.send({ HasError: false, AlertMessage: 'Kasa özeti gönderildi.' });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  /** Yöntem bazında GÜNLÜK kasa raporunu şimdi Telegram'a gönder. */
  app.post('/lynon/telegram-rapor/yontem-kasa', async (_request, reply) => {
    const chatId = config.telegram.raporChatIdleri.kasaYontem || config.telegram.raporChatIdleri.kasa || config.telegram.raporChatId;
    if (!chatId) return reply.status(400).send({ HasError: true, AlertMessage: 'Kasa sohbeti tanımlı değil.' });
    try {
      const yanit = await lynonYontemBazindaKasa({});
      await sendTelegramMessage(chatId, String(yanit?.Data?.Mesaj ?? ''), { html: true });
      return reply.send({ HasError: false, AlertMessage: 'Yöntem bazında kasa raporu gönderildi.' });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  /** Anlık oyuncu bakiye özetini şimdi Telegram'a gönder. */
  app.post('/lynon/telegram-rapor/oyuncu-bakiyesi', async (_request, reply) => {
    if (!config.telegram.bakiyeOzetiChatId) {
      return reply.status(400).send({ HasError: true, AlertMessage: 'TELEGRAM_CHAT_BAKIYE tanımlı değil.' });
    }
    try {
      const yanit = await lynonAnlikOyuncuBakiyesi({});
      await sendTelegramMessage(config.telegram.bakiyeOzetiChatId, String(yanit?.Data?.Mesaj ?? ''), { html: true });
      return reply.send({ HasError: false, AlertMessage: 'Oyuncu bakiye özeti gönderildi.' });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  /**
   * Telegram webhook'u yeniden kaydet.
   *
   * `callback_query` unutulmus bir eski kayit ust uste bindiginde cekim
   * butonlari hicbir sey yapmaz — sessizce. Redeploy beklemeden buradan
   * duzeltilebilir.
   */
  app.post('/lynon/telegram-rapor/webhook-yenile', async (_request, reply) => {
    if (!config.telegram.webhookUrl) {
      return reply.status(400).send({ HasError: true, AlertMessage: 'TELEGRAM_WEBHOOK_URL tanımlı değil.' });
    }
    try {
      await ensureTelegramWebhook();
      return reply.send({ HasError: false, AlertMessage: 'Webhook yeniden kaydedildi.' });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get<{ Querystring: { path: string } }>('/lynon/raw', async (request, reply) => {
    try {
      if (!request.query.path?.startsWith('/api/')) {
        return reply.status(400).send({ HasError: true, AlertMessage: 'path /api/ ile başlamalı.' });
      }
      return reply.send(await lynonRequest(request.query.path));
    } catch (err) {
      return sendError(reply, err);
    }
  });
}

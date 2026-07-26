import type { FastifyInstance } from 'fastify';
import { clearLynonSession, ensureLynonSession, getLynonAuthStatus, lynonRequest } from '../lib/lynonAuth.js';
import {
  lynonActiveWheels,
  lynonBackofficeSettings,
  lynonBonusBlocks,
  lynonBonusDefinitions,
  lynonBonusRequests,
  lynonCasinoOperations,
  lynonCorrectionHistory,
  lynonDashboardSummary,
  lynonDeposits,
  lynonDictionaries,
  lynonErrorResponse,
  lynonGridLayout,
  lynonKycDocuments,
  lynonMe,
  lynonPaymentTransactions,
  lynonPaymentCounts,
  lynonPaymentMethods,
  lynonPlayerAccounts,
  lynonPlayerCategories,
  lynonPlayerDetail,
  lynonPlayerKpi,
  lynonPlayers,
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

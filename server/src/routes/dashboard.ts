import type { FastifyInstance, FastifyRequest } from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import type { Config } from '../config.js';
import { validateDateRange } from '../lib/validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMOTIONS_JSON_PATH = path.join(__dirname, '..', '..', 'promotions-data.json');
import { getDashboardToken, getBackofficeToken } from '../lib/authStore.js';
import { proxyDashboard, proxyPostToUrl, proxyDashboardPost, proxyBonusPost, proxyFreeBetPost, proxyClientsPost, proxyRegistrationStats, proxyClientsByIP, proxyWithdrawalPost, proxyDepositsPost, proxyBetReportPost, proxyBetSelectionsPost, proxyClientKpi, proxyClientNotes, proxyClientBonuses, proxyClientTransactions, proxyDetailedReport, fetchBackofficeClientTransactions, proxyClientTurnoversPaging, proxyChargeBonus, proxyManualAdjustment, proxySmsSend, proxyTournamentReportPost, DASHBOARD_HEADERS, BACKOFFICE_HEADERS } from '../lib/proxy.js';
import { getAllPromosNormalized } from '../services/promosService.js';
import { churnListesi, type ChurnGirdisi } from '../services/churnScoreService.js';
import { temasEkle, oyuncuTemaslari, sonTemaslar, sonTemasHaritasi, temasOzeti, ensureCrmDir } from '../services/crmService.js';
import { affiliateMetrikleri } from '../services/affiliateMetrics.js';
import { oyuncuRaporu, siralamaOlustur, type SiralamaMetrigi } from '../services/oyuncuRaporService.js';
import { readTournamentSettings, writeTournamentSettings } from '../services/turnuvaAyarService.js';
import { evaluateForAccount, evaluateWithdrawalRules, evaluateRiskAnalysis, evaluateWagerSummary, evaluateBonusRules, refreshRules, getRulesForTenant } from '../services/withdrawalEngine.js';
import { buildAccountSnapshotFromClientId } from '../services/accountSnapshotService.js';
import { assignmentValuesForPromoSpec, getRules, saveRules, type RulesConfig } from '../services/rulesService.js';
import { istekKimligi, oyuncuVerisineErisebilir } from '../lib/istekKimligi.js';
import { getPromoOverrides, setPromoOverride } from '../services/promoOverridesService.js';
import { detectOppositeBetting, getPlayedGameNames } from '../services/oppositeBettingService.js';
import { getSameIPClientsCount } from '../services/sameIPCheckService.js';
import { writeAudit, readLastAutoRun } from '../models/withdrawalAudit.js';
import { buildBonusControlReportCsv } from '../services/bonusControlReportService.js';
import { analyzeTransactionAnomalies } from '../services/transactionAnomalyService.js';
import { identifyMultiAccountClusters, calculateTrustScore, generateBusinessInsights } from '../services/intelligenceService.js';
import { resolveTenantKeyForRequest, resolveTenantKeyFromHost, safeTenantKey } from '../lib/tenant.js';
import { bonusDenetimAciklamasi } from '../services/bonusDenetimAciklamasi.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';
import { findNarcosBonusByCampaignTitle, NARCOS_BONUSES } from '../lib/narcosBonusCatalog.js';
import { buildPromoRuleState, resolvePromoTitle } from '../lib/promoCatalog.js';
import { bonusBlacklisteEkle, bonusBlacklisteMi, bonusBlacklistindenCikar, readBonusBlacklist } from '../services/bonusBlacklistService.js';
import {
  isLynonConfigured,
  lynonBetReport,
  lynonBonusDefinitions,
  lynonClientBetHistory,
  lynonClientBonuses,
  lynonClientBonusReport,
  lynonClientCasinoHistory,
  lynonClientDetailedReport,
  lynonClientNotes,
  lynonClientTransactions,
  lynonClientTurnoverPaging,
  lynonClientsByIp,
  lynonDashboardSummary,
  lynonAffiliateSummary,
  lynonDeposits,
  lynonErrorResponse,
  lynonFindPlayerByLogin,
  lynonPartnerProfit,
  lynonPlayerActivity,
  lynonPlayerKpi,
  lynonPlayers,
  lynonProviderReport,
  lynonRegistrationStats,
  lynonRegistrationStatsDetails,
  lynonSiteBetHistory,
  lynonSportbookOverview,
  lynonTopCasinoGames,
  lynonTopSports,
  lynonWithdrawalRequests,
  lynonResolveWithdrawal,
  lynonBetSelections,
  lynonCampaigns,
  lynonCampaign,
  lynonCampaignBonuses,
  lynonTemplate,
  lynonBonusBlocks,
  lynonUpdateCampaign,
  lynonUpdateCampaignBonus,
  lynonAssignCampaignToPlayer,
  lynonOperationalKpi,
  lynonBuildBonusEligibilitySnapshot,
  lynonAdjustPlayerMainAccount,
} from '../services/lynonBackofficeService.js';

const dateBodySchema = {
  type: 'object',
  required: ['startDate', 'endDate'],
  properties: {
    startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
  },
} as const;

export async function dashboardRoutes(fastify: FastifyInstance, opts: { config: Config }) {
  const { config } = opts;
  const { api } = config;

  function hasLegacyAuth(): boolean {
    return Boolean(getBackofficeToken() || getDashboardToken() || api.backofficeAuthToken || api.authToken);
  }

  function shouldUseLynon(request: FastifyRequest): boolean {
    return isLynonConfigured() && (request.session as any)?.user?.dataProvider !== 'betconstruct';
  }

  function warnLynonFallback(request: FastifyRequest, label: string, err: unknown): void {
    const error = err as Error & { status?: number };
    request.log.warn({ status: error.status, message: error.message }, `Lynon ${label} failed; falling back to legacy API`);
  }

  function sendLynonError(reply: any, err: unknown) {
    const { status, body } = lynonErrorResponse(err);
    return reply.status(status).send(body);
  }

  fastify.post<{ Body?: { startDate?: string; endDate?: string; currency?: string } }>('/narcos-kpi', async (request, reply) => {
    if (!shouldUseLynon(request)) {
      return reply.status(409).send({ HasError: true, AlertMessage: 'Narcos KPI raporları için Lynon bağlantısı gerekli.' });
    }
    try {
      const body = request.body ?? {};
      return reply.send(await lynonOperationalKpi({
        startDate: body.startDate,
        endDate: body.endDate,
        currency: body.currency ?? 'TRY',
      }));
    } catch (err) {
      return sendLynonError(reply, err);
    }
  });
  async function getTenantKeyForAdmin(request: any): Promise<string> {
    return resolveTenantKeyForRequest(request);
  }


  async function proxyGetPartnerBonuses(token: string) {
    const url = 'https://backofficewebadmin.betconstruct.com/api/tr/Client/GetPartnerBonuses';
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...BACKOFFICE_HEADERS, authentication: token.trim(), 'Content-Type': 'application/json;charset=UTF-8' },
      body: JSON.stringify({
        PartnerId: 18773823,
        IsBonusDetailsIncluded: true,
        IsDeleted: false,
        IsDisabled: false
      })
    });
    return res.json();
  }

  async function proxyGetFreeBetBonuses(token: string) {
    const url = `${config.freebetApi.baseUrl.replace(/\/$/, '')}/${config.freebetApi.path.replace(/^\//, '')}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...BACKOFFICE_HEADERS, authentication: token.trim(), 'Content-Type': 'application/json;charset=UTF-8' },
      body: JSON.stringify({})
    });
    return res.json();
  }

  fastify.post<{ Body: { startDate: string; endDate: string } }>(
    '/summary',
    { schema: { body: dateBodySchema } },
    async (request, reply) => {
      const { startDate, endDate } = request.body ?? {};
      const validation = validateDateRange(startDate, endDate, api.maxDateRangeDays);
      if (!validation.ok) {
        return reply.status(400).send({ HasError: true, AlertMessage: validation.message });
      }

      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonDashboardSummary(startDate, endDate));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'summary', err);
        }
      }

      const dbToken = getDashboardToken();
      const boToken = getBackofficeToken();

      try {
        // 1. Dashboard Summary fetch
        const prefix = (api as any).dashboardPathPrefix ?? 'api/tr/Dashboard';
        const q = new URLSearchParams({ startDate, endDate }).toString();
        const summaryUrl = `${api.baseUrl.replace(/\/$/, '')}/${prefix.replace(/^\//, '')}/GetSummary?${q}`;

        const summaryRes = await fetch(summaryUrl, {
          headers: { ...DASHBOARD_HEADERS, authentication: dbToken.trim(), 'Content-Type': 'application/json' }
        });
        const summaryData = await summaryRes.json() as any;

        // 2. Fetch Live Totals from GetClients if balances are -1
        if (summaryData.Data && (summaryData.Data.PlayersBalance === -1 || summaryData.Data.PlayersBonusBalance === -1) && boToken) {
          try {
            const clientsUrl = `${config.clientsApi.baseUrl.replace(/\/$/, '')}/${config.clientsApi.path.replace(/^\//, '')}`;
            const clientsRes = await fetch(clientsUrl, {
              method: 'POST',
              headers: { ...BACKOFFICE_HEADERS, authentication: boToken.trim(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ MaxRows: 0, SkeepRows: 0 })
            });
            const clientsData = await clientsRes.json() as any;

            if (clientsData?.Data) {
              const liveBalance = clientsData.Data.TotalBalance != null ? Number(clientsData.Data.TotalBalance) : -1;
              const liveBonus = clientsData.Data.TotalBonusBalance != null ? Number(clientsData.Data.TotalBonusBalance) : -1;

              if (liveBalance !== -1) summaryData.Data.PlayersBalance = liveBalance;
              if (liveBonus !== -1) summaryData.Data.PlayersBonusBalance = liveBonus;
            }
          } catch (e) {
            request.log.warn({ err: e }, 'Summary fix: GetClients fallback failed');
          }
        }

        return reply.send(summaryData);
      } catch (err) {
        request.log.error({ err }, 'Summary fix error');
        const q = new URLSearchParams({ startDate, endDate }).toString();
        return proxyDashboard(request, reply, `GetSummary?${q}`, api);
      }
    }
  );

  /** Partner Profit API GET ile çalışıyor (backoffice ile aynı). POST denemek için DASHBOARD_PARTNER_PROFIT_POST=1 */
  const usePartnerProfitPost = process.env.DASHBOARD_PARTNER_PROFIT_POST === '1' || process.env.DASHBOARD_PARTNER_PROFIT_POST === 'true';

  /** GetPartnerProfit API’de yok; özet veri GetPartnerProfitDetails ile aynı yapıda. Aynı endpoint kullanılıyor. */
  fastify.post<{ Body: { startDate: string; endDate: string } }>(
    '/partner-profit',
    { schema: { body: dateBodySchema } },
    async (request, reply) => {
      const { startDate, endDate } = request.body ?? {};
      const validation = validateDateRange(startDate, endDate, api.maxDateRangeDays);
      if (!validation.ok) {
        return reply.status(400).send({ HasError: true, AlertMessage: validation.message });
      }
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonPartnerProfit(startDate, endDate));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'partner-profit', err);
        }
      }
      if (usePartnerProfitPost && api.partnerProfitUrl) {
        return proxyPostToUrl(request, reply, api.partnerProfitUrl, api, { startDate, endDate });
      }
      if (usePartnerProfitPost) {
        return proxyDashboardPost(request, reply, 'GetPartnerProfit', api, { startDate, endDate }, api.partnerProfitPathPrefix);
      }
      const q = new URLSearchParams({ startDate, endDate }).toString();
      return proxyDashboard(request, reply, `GetPartnerProfitDetails?${q}`, api);
    }
  );

  fastify.post<{ Body: { startDate: string; endDate: string } }>(
    '/partner-profit-details',
    { schema: { body: dateBodySchema } },
    async (request, reply) => {
      const { startDate, endDate } = request.body ?? {};
      const validation = validateDateRange(startDate, endDate, api.maxDateRangeDays);
      if (!validation.ok) {
        return reply.status(400).send({ HasError: true, AlertMessage: validation.message });
      }
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonPartnerProfit(startDate, endDate));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'partner-profit-details', err);
        }
      }
      if (usePartnerProfitPost) {
        if (api.partnerProfitDetailsUrl) {
          return proxyPostToUrl(request, reply, api.partnerProfitDetailsUrl, api, {
            startDate,
            endDate,
            ordertype: 'true',
            topRecordsCount: '1000',
          });
        }
        return proxyDashboardPost(request, reply, 'GetPartnerProfitDetails', api, {
          startDate,
          endDate,
          ordertype: 'true',
          topRecordsCount: '1000',
        }, api.partnerProfitPathPrefix);
      }
      const q = new URLSearchParams({
        startDate,
        endDate,
        ordertype: 'true',
        topRecordsCount: '1000'
      }).toString();
      return proxyDashboard(request, reply, `GetPartnerProfitDetails?${q}`, api);
    }
  );

  fastify.post<{ Body: { startDate: string; endDate: string } }>(
    '/affiliate-summary',
    { schema: { body: dateBodySchema } },
    async (request, reply) => {
      const { startDate, endDate } = request.body ?? {};
      const validation = validateDateRange(startDate, endDate, api.maxDateRangeDays);
      if (!validation.ok) return reply.status(400).send({ HasError: true, AlertMessage: validation.message });
      if (!shouldUseLynon(request)) {
        return reply.status(409).send({ HasError: true, AlertMessage: 'Affiliate özeti için Lynon bağlantısı gerekli.' });
      }
      try {
        const ozet = await lynonAffiliateSummary(startDate, endDate);
        // Ham toplamlar zaten geliyordu; ekranin ihtiyaci olan oranlar
        // (net pozisyon, oyuncu basi gelir, gelir payi, cekim orani) burada
        // turetiliyor. Istemcide hesaplansa her ekran kendi yorumunu yapardi.
        const satirlar = ((ozet as any)?.Data?.Objects ?? []) as any[];
        const { satirlar: zengin, toplam } = affiliateMetrikleri(satirlar);
        return reply.send({
          ...(ozet as any),
          Data: { ...(ozet as any).Data, Objects: zengin, Toplam: toplam },
        });
      } catch (err) {
        return sendLynonError(reply, err);
      }
    },
  );
  fastify.post<{
    Body: { startDate: string; endDate: string; topRecordsCount?: string; ordertype?: string };
  }>(
    '/top-sports',
    {
      schema: {
        body: {
          ...dateBodySchema,
          properties: {
            ...dateBodySchema.properties,
            topRecordsCount: { type: 'string', default: '5' },
            ordertype: { type: 'string', default: 'true' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body ?? {};
      const { startDate, endDate, topRecordsCount = '5', ordertype = 'true' } = body;
      const validation = validateDateRange(startDate, endDate, api.maxDateRangeDays);
      if (!validation.ok) {
        return reply.status(400).send({ HasError: true, AlertMessage: validation.message });
      }
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonTopSports(startDate, endDate, Number(topRecordsCount) || 5));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'top-sports', err);
        }
      }
      const q = new URLSearchParams({
        startDate,
        endDate,
        topRecordsCount,
        ordertype,
      }).toString();
      return proxyDashboard(request, reply, `GetTopSports?${q}`, api);
    }
  );

  fastify.post<{
    Body: { startDate: string; endDate: string; topRecordsCount?: string; ordertype?: string };
  }>(
    '/top-casino-games',
    {
      schema: {
        body: {
          ...dateBodySchema,
          properties: {
            ...dateBodySchema.properties,
            topRecordsCount: { type: 'string', default: '5' },
            ordertype: { type: 'string', default: 'true' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body ?? {};
      const { startDate, endDate, topRecordsCount = '5', ordertype = 'true' } = body;
      const validation = validateDateRange(startDate, endDate, api.maxDateRangeDays);
      if (!validation.ok) {
        return reply.status(400).send({ HasError: true, AlertMessage: validation.message });
      }
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonTopCasinoGames(startDate, endDate, Number(topRecordsCount) || 5));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'top-casino-games', err);
        }
      }
      const q = new URLSearchParams({
        startDate,
        endDate,
        topRecordsCount,
        ordertype,
      }).toString();
      return proxyDashboard(request, reply, `GetTopCasinoGames?${q}`, api);
    }
  );

  fastify.post<{ Body: { startDate: string; endDate: string } }>(
    '/sportbook-overview',
    { schema: { body: dateBodySchema } },
    async (request, reply) => {
      const { startDate, endDate } = request.body ?? {};
      const validation = validateDateRange(startDate, endDate, api.maxDateRangeDays);
      if (!validation.ok) {
        return reply.status(400).send({ HasError: true, AlertMessage: validation.message });
      }
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonSportbookOverview(startDate, endDate));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'sportbook-overview', err);
        }
      }
      const q = new URLSearchParams({ startDate, endDate }).toString();
      return proxyDashboard(request, reply, `GetSportBookOverview?${q}`, api);
    }
  );

  fastify.post<{ Body?: Record<string, unknown> }>(
    '/bonuses',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonBonusDefinitions());
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'bonuses', err);
        }
      }
      return proxyBonusPost(request, reply, config.bonusApi, getBackofficeToken());
    }
  );

  fastify.post<{ Body?: Record<string, unknown> }>(
    '/freebet-bonuses',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          const bonuses = await lynonBonusDefinitions();
          const all = Array.isArray(bonuses.Result) ? bonuses.Result : [];
          const freebets = all.filter((bonus: any) => bonus?.IsFreeBet === true);
          return reply.send({
            HasError: false,
            AlertMessage: null,
            Data: { Count: freebets.length, Objects: freebets },
          });
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'freebet-bonuses', err);
        }
      }
      return proxyFreeBetPost(request, reply, config.freebetApi, getBackofficeToken());
    }
  );

  /** Structured promo list (from fetch-promos-details script). Used by Bonus Kuralları and otomatik çekim. */
  fastify.get('/promos/list', async (request, reply) => {
    if (!existsSync(PROMOTIONS_JSON_PATH)) {
      return reply.status(404).send({ HasError: true, AlertMessage: 'promotions-data.json not found. Run: npm run fetch-promos-details' });
    }
    try {
      const raw = await readFile(PROMOTIONS_JSON_PATH, 'utf-8');
      const data = JSON.parse(raw) as { fetchedAt?: string; source?: string; count?: number; promotions?: unknown[] };
      return reply.send({ HasError: false, Data: { promotions: data.promotions ?? [], fetchedAt: data.fetchedAt, source: data.source } });
    } catch (err) {
      request.log.error({ err }, 'promos/list read error');
      return reply.status(500).send({ HasError: true, AlertMessage: (err as Error).message });
    }
  });

  /**
   * Public: Auto-bonus promos list (synced with RulesManager).
   */
  const normalizeTitleForKey = (s: string): string =>
    String(s ?? '')
      .toLowerCase()
      .replace(/%/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  /**
   * Public: Auto-bonus promos list (Dynamic from Backoffice).
   * - Fetches live bonuses from BetConstruct Backoffice.
   * - Applies per-tenant rules (blocking disabled promos).
   * - Applies per-tenant overrides (custom title/image from Admin panel).
   * - Supports both ID-based and Title-based rule mapping.
   */
  /**
   * Kural Merkezi'ndeki NAKIT bonuslari promosyon satirina cevirir.
   *
   * Nakit bonuslarin Lynon kampanya karsiligi YOK (partnerBonusId yok);
   * platform katalogundan hicbir zaman gelmezler. Bu yuzden kural
   * tanimindan uretiliyorlar.
   *
   * Onceden yalnizca eski (BetConstruct) dalda uretiliyorlardi. Lynon
   * dali erken donduğu icin canlida hic gorunmuyorlardi: Kural
   * Merkezi'nde aktif isaretlenen kayip bonusu, 4. yatirim hediyesi ve
   * Carsamba Happy Days bonus talep ekraninda listelenmiyordu.
   */
  function sanalNakitBonuslar(
    rules: { PROMO_SPECS?: Record<string, unknown>; PROMO_TITLE_SPECS?: Record<string, unknown> } | undefined,
    overrides: any,
    mevcutIdler: Set<string>,
  ): any[] {
    const tumKurallar = [
      ...Object.entries(rules?.PROMO_SPECS ?? {}),
      ...Object.entries(rules?.PROMO_TITLE_SPECS ?? {}),
    ];
    const sonuc: any[] = [];
    const eklenen = new Set<string>();

    for (const [key, spec] of tumKurallar) {
      const kural = spec as Record<string, any>;
      if (kural?.type !== 'cash') continue;
      if (kural?.enabled === false) continue;
      // Ayni kural hem PROMO_SPECS hem PROMO_TITLE_SPECS'te olabilir.
      if (eklenen.has(key) || mevcutIdler.has(String(key))) continue;
      eklenen.add(key);

      const o = overrides?.byExternalId?.[key];
      sonuc.push({
        id: key,
        promoTitle: o?.title || kural.title || key,
        image: o?.image || '',
        detailHtml: o?.detailHtml || '',
        rules: { externalId: key, ...kural, enabled: true },
        backofficeId: key,
        isVirtual: true,
        tags: ['Nakit'],
      });
    }
    return sonuc;
  }

  fastify.get<{ Querystring: { includeUnconfigured?: string } }>('/promos/auto', async (request, reply) => {
    try {
      const tenantKey = await resolveTenantKeyFromHost(request as any);
      const rules = await getRules(tenantKey);
      const overrides = await getPromoOverrides(tenantKey);
      const token = getBackofficeToken();

      if (shouldUseLynon(request)) {
        try {
          const catalog = await lynonBonusDefinitions();
          const catalogRows = Array.isArray(catalog.Result) ? catalog.Result : [];
          const specs = rules?.PROMO_SPECS ?? {};
          const titleSpecs = rules?.PROMO_TITLE_SPECS ?? {};
          const findRule = (campaignId: unknown, title: string) => {
            const direct = specs[String(campaignId)];
            if (direct) return direct;
            const linked = Object.values(specs).find((spec: any) => String(spec.partnerBonusId ?? '') === String(campaignId));
            if (linked) return linked;
            const normalized = normalizeTitleForKey(title);
            if (titleSpecs[normalized]) return titleSpecs[normalized];
            return Object.entries(titleSpecs).find(([key]) => {
              const ruleTitle = normalizeTitleForKey(key);
              return ruleTitle && (normalized.includes(ruleTitle) || ruleTitle.includes(normalized));
            })?.[1] as any;
          };
          const includeUnconfigured = request.query.includeUnconfigured === 'true';
          const promotions = catalogRows
            .filter((campaign: any) => Number.isInteger(Number(campaign.PartnerBonusId)) && Number(campaign.PartnerBonusId) > 0 && campaign.IsDeleted !== true)
            .map((campaign: any) => {
              const campaignId = Number(campaign.PartnerBonusId);
              const title = String(campaign.Name ?? campaign.systemName ?? `Bonus ${campaignId}`);
              const spec = findRule(campaignId, title);
              const definition = findNarcosBonusByCampaignTitle(title);
              const override = overrides?.byExternalId?.[String(campaignId)];
              const isCampaignActive = campaign.IsDisabled !== true;
              const hasRule = Boolean(spec);
              const isConfigured = hasRule && (spec as any).enabled !== false && isCampaignActive;
              if (!includeUnconfigured && !isConfigured) return null;
              const inferredTitle = override?.title?.trim() || definition?.title || title;
              const ruleState = buildPromoRuleState(spec as Record<string, any> | undefined, {
                externalId: campaignId,
                partnerBonusId: campaignId,
                lynonCampaignId: campaignId,
                lynonSystemName: campaign.systemName ?? null,
                lynonCampaignActive: isCampaignActive,
                narcosBonusKey: definition?.key ?? null,
                narcosBonusCategory: definition?.category ?? campaign.BonusCategory ?? 'Lynon',
              });
              return {
                id: campaignId,
                promoTitle: resolvePromoTitle({ promoTitle: inferredTitle, title, Name: title, systemName: campaign.systemName }, 'Bonus'),
                image: override?.image?.trim() || definition?.image || '',
                detailHtml: override?.detailHtml?.trim() || definition?.detailHtml || '',
                rules: {
                  ...(definition?.rules ?? {}),
                  ...ruleState,
                  enabled: isConfigured,
                  requiresConfiguration: !hasRule,
                  campaignActive: isCampaignActive,
                },
                backofficeId: campaignId,
                isFreebet: Boolean(campaign.IsFreeBet),
                tags: definition?.tags ?? [String(campaign.BonusCategory ?? 'Lynon Kampanyası')],
              };
            })
            .filter(Boolean);

          // Nakit bonuslar Lynon katalogunda yok; kural tanimindan eklenir.
          const sanallar = sanalNakitBonuslar(
            rules,
            overrides,
            new Set(promotions.map((promo: any) => String(promo?.id))),
          );

          return reply.send({
            HasError: false,
            Data: {
              promotions: [...promotions, ...sanallar],
              fetchedAt: new Date().toISOString(),
              source: 'Lynon Bonus Engine V2 + Bonus Kuralları (site 137)',
              dataCompleteness: catalog.DataCompleteness,
            },
          });        } catch (err) {
          request.log.error({ err }, 'promos/auto Lynon campaign fetch error');
          return sendLynonError(reply, err);
        }
      }

      // 1. Fetch live partner + freebet bonuses
      const [partnerRes, freebetRes] = await Promise.all([
        proxyGetPartnerBonuses(token),
        proxyGetFreeBetBonuses(token)
      ]);

      const partnerPromos = Array.isArray(partnerRes?.Data) ? partnerRes.Data : [];
      const freebetPromos = Array.isArray(freebetRes?.Result) ? freebetRes.Result.map((fb: any) => ({ ...fb, Id: fb.Id, Name: fb.Name })) : [];
      const rawPromos = [...partnerPromos, ...freebetPromos];

      console.log(`[promos/auto] Raw promos from BC: ${rawPromos.length}`);
      const specs = rules?.PROMO_SPECS ?? {};
      const titleSpecs = rules?.PROMO_TITLE_SPECS ?? {};

      // 2. Map and Merge with Overrides - ONLY show promos that are in Rule Engine
      const promotions = rawPromos.map((p: any) => {
        const extId = String(p.Id);
        const name = p.Name ?? p.title ?? p.systemName ?? 'Bonus';

        // Match by ID or by Normalized Title (fuzzy)
        let spec = specs[extId];
        if (!spec) {
          const n = normalizeTitleForKey(name);
          spec = titleSpecs[n];
          if (!spec) {
            // Fuzzy search in titleSpecs
            for (const [tKey, tSpec] of Object.entries(titleSpecs)) {
              if (n.includes(normalizeTitleForKey(tKey)) || normalizeTitleForKey(tKey).includes(n)) {
                spec = tSpec;
                break;
              }
            }
          }
        }

        const o = overrides?.byExternalId?.[extId];
        const ruleState = buildPromoRuleState(spec as Record<string, any> | undefined, {
          externalId: p.Id,
          ...(p.DepositDefinition || {}),
          ...(p.FreeSpinDefinition || {})
        });
        const enabled = ruleState.enabled !== false;
        if (!enabled) return null;

        return {
          id: p.Id,
          promoTitle: resolvePromoTitle({ promoTitle: o?.title, title: name, Name: name, name, systemName: p.systemName }, name || 'Bonus'),
          image: o?.image != null && String(o.image).trim() !== '' ? o.image : '',
          detailHtml: o?.detailHtml != null && String(o.detailHtml).trim() !== '' ? o.detailHtml : '',
          rules: ruleState,
          backofficeId: p.Id,
          tags: []
        };
      }).filter(Boolean);

      // 3. Nakit bonuslar — Lynon daliyla ayni yardimci.
      const virtualPromos = sanalNakitBonuslar(
        rules,
        overrides,
        new Set(promotions.map((promo: any) => String(promo?.id))),
      );

      const catalogPromotions = NARCOS_BONUSES.map((bonus, index) => ({
        id: bonus.templateId ?? 1000 + index,
        promoTitle: bonus.title,
        image: '',
        detailHtml: bonus.detailHtml,
        rules: {
          enabled: true,
          requiresConfiguration: false,
          externalId: bonus.templateId ?? 1000 + index,
          narcosBonusKey: bonus.key,
          narcosBonusCategory: bonus.category,
          ...bonus.rules,
          assignmentValues: bonus.rules?.assignmentValues ?? {},
        },
        backofficeId: bonus.templateId ?? 1000 + index,
        tags: bonus.tags,
      }));
      const mergedPromotions = [...promotions, ...virtualPromos, ...catalogPromotions.filter((promo) => ![...promotions, ...virtualPromos].some((existing: any) => String(existing.id) === String(promo.id) || existing.promoTitle === promo.promoTitle))];

      return reply.send({
        HasError: false,
        Data: {
          promotions: mergedPromotions,
          fetchedAt: new Date().toISOString(),
          source: 'System + Live BC API'
        },
      });
    } catch (err) {
      request.log.error({ err }, 'promos/auto dynamic fetch error');
      return reply.status(500).send({ HasError: true, AlertMessage: (err as Error).message });
    }
  });

  fastify.get('/promos/remote', async (request, reply) => {
    const target = process.env.PROMOS_REMOTE_URL;
    if (!target) {
      return reply.status(404).send({ HasError: true, AlertMessage: 'Remote promos source is not configured' });
    }
    const controller = new AbortController();
    const timeoutMs = 20000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(target, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          Referer: new URL(target).origin,
        },
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        return reply.status(res.status).send({ HasError: true, AlertMessage: `Remote fetch failed: ${res.status}` });
      }
      let text = await res.text();
      text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
      try {
        const { JSDOM } = await import('jsdom');
        const dom = new JSDOM(text);
        const doc = dom.window.document;
        ['[role="dialog"]', '.modal', '.fancybox-content', '.promo-modal', '.promo-popup', '.popup'].forEach((s) => {
          doc.querySelectorAll(s).forEach((n) => n.remove());
        });
        const phrases = [
          'Bonustan Nasıl Yararlanabilirim',
          'Bonus Çevrim Şartı Nedir',
          'Bonus Çevirim Şartı Nedir',
          'Bonus Genel Kuralları',
        ];
        phrases.forEach((phrase) => {
          Array.from(doc.querySelectorAll('*'))
            .filter((el) => el.textContent && el.textContent.includes(phrase))
            .forEach((node) => {
              const container = (node as Element).closest('section, div, li, article') || node.parentElement;
              if (container) container.remove();
              else node.remove();
            });
        });
        Array.from(doc.querySelectorAll('[class]')).forEach((el) => {
          const cls = (el as Element).className;
          if (typeof cls === 'string' && /(accordion|faq|collapse|panel|toggle|accordion-item)/i.test(cls)) {
            el.remove();
          }
        });
        text = doc.body.innerHTML;
      } catch {
        // keep text with scripts already stripped
      }
      return reply.type('text/html').send(text);
    } catch (err) {
      clearTimeout(timeoutId);
      const error = err as Error & { name?: string };
      if (error.name === 'AbortError') {
        return reply.status(504).send({ HasError: true, AlertMessage: 'Remote fetch timed out' });
      }
      request.log.error({ err: error }, 'promos/remote fetch error');
      return reply.status(502).send({ HasError: true, AlertMessage: error.message || 'Fetch failed' });
    }
  });

  fastify.post<{ Body?: Record<string, unknown> }>(
    '/clients',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonPlayers(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'clients', err);
        }
      }
      return proxyClientsPost(request, reply, config.clientsApi, getBackofficeToken());
    }
  );

  fastify.post<{ Body?: Record<string, unknown> }>(
    '/withdrawal-requests',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonWithdrawalRequests(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'withdrawal-requests', err);
        }
      }
      return proxyWithdrawalPost(request, reply, config.withdrawalApi, getBackofficeToken());
    }
  );

  fastify.post<{ Params: { transactionId: string }; Body: { status: 'rejected' | 'approved'; amount: number; actualAmount?: number } }>(
    '/admin/withdrawals/:transactionId/resolve',
    async (request, reply) => {
      const session = request.session as any;
      const user = session?.user;
      if (!user) return reply.status(401).send({ HasError: true, AlertMessage: 'Yetkisiz' });
      if (!shouldUseLynon(request)) {
        return reply.status(501).send({ HasError: true, AlertMessage: 'Bu işlem yalnızca Lynon modunda desteklenir.' });
      }

      const { transactionId } = request.params;
      const { status, amount, actualAmount } = request.body ?? ({} as any);
      if (!transactionId || !['rejected', 'approved'].includes(status) || !Number.isFinite(Number(amount))) {
        return reply.status(400).send({ HasError: true, AlertMessage: 'Geçerli transactionId, status ve amount gerekli.' });
      }

      try {
        const result = await lynonResolveWithdrawal({
          transactionId,
          status,
          amount: Number(amount),
          actualAmount: Number(actualAmount ?? (status === 'rejected' ? 0 : amount)),
        });
        const { audit } = await import('../lib/auditLog.js');
        audit(user.username ?? 'system', user.role ?? 'admin', 'withdrawal_resolve', String(transactionId), `status=${status} amount=${amount}`);
        return reply.send({ HasError: false, AlertMessage: status === 'rejected' ? 'Çekim talebi reddedildi.' : 'Çekim talebi onaylandı.', Data: result });
      } catch (err) {
        return sendLynonError(reply, err);
      }
    }
  );

  fastify.post<{ Body?: Record<string, unknown> }>(
    '/deposits',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonDeposits(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'deposits', err);
        }
      }
      return proxyDepositsPost(request, reply, config.depositsApi, getBackofficeToken());
    }
  );

  fastify.post<{ Body?: Record<string, unknown> }>(
    '/bet-report',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonBetReport(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'bet-report', err);
        }
      }
      return proxyBetReportPost(request, reply, config.betReportApi, getBackofficeToken());
    }
  );

  fastify.post<{ Body?: Record<string, unknown> }>(
    '/bet-selections',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonBetSelections(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'bet-selections', err);
        }
      }
      return proxyBetSelectionsPost(request, reply, config.betSelectionsApi, getBackofficeToken());
    }
  );

  fastify.get<{ Querystring: { id: string } }>(
    '/client-kpi',
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonPlayerKpi(request.query.id));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'client-kpi', err);
        }
      }
      return proxyClientKpi(request, reply, config.clientKpiApi, getBackofficeToken());
    }
  );

  fastify.post<{ Body?: Record<string, unknown> }>(
    '/client-notes',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonClientNotes(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'client-notes', err);
        }
      }
      return proxyClientNotes(request, reply, config.clientNoteApi, getBackofficeToken());
    }
  );

  fastify.post<{ Body?: Record<string, unknown> }>(
    '/client-bonuses',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonClientBonuses(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'client-bonuses', err);
        }
      }
      return proxyClientBonuses(request, reply, config.clientBonusesApi, getBackofficeToken());
    }
  );

  fastify.post<{ Body?: Record<string, unknown> }>(
    '/clients-by-ip',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      const ip = (request.body as any)?.LoginIP;
      request.log.info({ ip }, 'ClientsByIP request received');
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonClientsByIp(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'clients-by-ip', err);
        }
      }
      return proxyClientsByIP(request, reply, config.clientsByIPApi, getBackofficeToken());
    }
  );

  fastify.post<{ Body?: Record<string, unknown> }>(
    '/client-transactions',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonClientTransactions(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'client-transactions', err);
        }
      }
      return proxyClientTransactions(request, reply, config.clientTransactionsApi, getBackofficeToken());
    }
  );
  fastify.post<{ Body?: Record<string, unknown> }>(
    '/client-profile-transactions',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonClientTransactions(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'client-profile-transactions', err);
        }
      }
      return proxyClientTransactions(request, reply, config.clientProfileTransactionsApi, getBackofficeToken());
    }
  );

  /** İşlem anomali analizi: tarih aralığındaki işlemleri çeker, anomali tespiti yapar. */
  function toLocalDateTime(ymd: string, time: string): string {
    const [y, m, d] = ymd.split('-');
    if (!d) return `${ymd} - ${time}`;
    const yy = y?.length === 4 ? y.slice(-2) : y ?? '';
    return `${d}-${m}-${yy} - ${time}`;
  }
  fastify.post<{ Body: { startDate?: string; endDate?: string } }>(
    '/analytics/transaction-anomalies',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          },
        },
      },
    },
    async (request, reply) => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const startDate = request.body?.startDate ?? fmt(start);
      const endDate = request.body?.endDate ?? fmt(end);
      const token = getBackofficeToken();
      if (!token) {
        return reply.status(401).send({ HasError: true, AlertMessage: 'AUTH_TOKEN yok', anomalies: [], summary: null });
      }
      const body = {
        ClientId: '',
        AmountFrom: '',
        AmountTo: '',
        CashDeskId: null,
        ClientLogin: '',
        CurrencyId: '',
        DefaultCurrencyId: 'TRY',
        ExternalId: '',
        FromCreatedDateLocal: toLocalDateTime(startDate, '00:00:00'),
        ToCreatedDateLocal: toLocalDateTime(endDate, '23:59:59'),
        Id: '',
        IsTest: null,
        MaxRows: 2000,
        PaymentSystemId: null,
        SkeepRows: 0,
        TypeId: '',
        UserName: '',
        OrderedItem: 1,
        IsOrderedDesc: true,
      };
      const data = await fetchBackofficeClientTransactions(config.clientTransactionsApi, token, body);
      if (data.HasError || !data.Data?.Objects) {
        return reply.status(400).send({
          HasError: true,
          AlertMessage: data.AlertMessage ?? 'İşlem verisi alınamadı',
          anomalies: [],
          summary: null,
        });
      }
      const objects = data.Data.Objects as import('../services/transactionAnomalyService.js').TransactionRecord[];
      const report = analyzeTransactionAnomalies(objects, { from: startDate, to: endDate });
      return reply.send({ HasError: false, ...report });
    }
  );

  // Admin: Generate withdrawal checklist (read-only prototype).
  // Accepts either account (manual JSON) or clientId (fetches KPI, bonuses, client from backoffice).
  fastify.post<{ Body?: Record<string, unknown> }>(
    '/admin/withdrawal/check',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            account: { type: 'object' },
            clientId: { type: 'number' },
            force: { type: 'boolean', default: false },
            requestIban: { type: 'string' },
            withdrawalDateLocal: { type: 'string', description: 'Otomatik çekimdeki çekim talebinin tarihi (analizin baz alındığı yatırım için)' },
          },
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      const body = request.body ?? {};
      let account = body.account as Record<string, unknown> | undefined;
      const clientId = typeof body.clientId === 'number' ? body.clientId : undefined;
      const force = Boolean(body.force);

      const documentTypeIds = Array.isArray(body.documentTypeIds)
        ? (body.documentTypeIds as number[]).filter((n) => typeof n === 'number')
        : undefined;

      if (clientId != null) {
        const token = getBackofficeToken();
        if (shouldUseLynon(request)) {
          try {
            const detailed = await lynonClientDetailedReport({ ClientId: clientId });
            const kpi = detailed.Data?.Kpi ?? {};
            const client = detailed.Data?.Client ?? {};
            account = {
              id: clientId,
              username: client.Login ?? client.userName ?? String(clientId),
              balance: kpi.Balance ?? client.Balance ?? 0,
              currency: kpi.CurrencyId ?? client.CurrencyId ?? 'TRY',
              totalDeposits: kpi.DepositAmount ?? 0,
              totalWithdrawals: kpi.WithdrawalAmount ?? 0,
              bonuses: [],
              transactions: [],
              rawClient: client,
              rawKpi: kpi,
              rawAccounts: detailed.Data?.Accounts ?? [],
            };
          } catch (err) {
            request.log.error({ err, clientId }, 'lynon account snapshot error');
            return sendLynonError(reply, err);
          }
        }
        if (!token) {
          if (!account) return reply.status(401).send({ HasError: true, AlertMessage: 'Backoffice token yok.' });
        } else {
          const withdrawalDateLocal =
            body.withdrawalDateLocal != null ? String(body.withdrawalDateLocal).trim() || undefined : undefined;
          try {
            account = (await buildAccountSnapshotFromClientId(clientId, config, token, {
              documentTypeIds,
              withdrawalDateLocal,
            })) as unknown as Record<string, unknown>;
          } catch (err) {
            request.log.error({ err, clientId }, 'account snapshot error');
            return reply.status(502).send({
              HasError: true,
              AlertMessage: (err as Error).message || 'Müşteri verileri alınamadı.',
            });
          }
        }
      }

      if (!account) {
        return reply.status(400).send({
          HasError: true,
          AlertMessage: 'Lütfen account nesnesi veya clientId gönderin.',
        });
      }
      if (body.requestIban != null && String(body.requestIban).trim() !== '') {
        account.requestIban = String(body.requestIban).trim();
      }
      if (clientId != null) {
        const token = getBackofficeToken();
        if (token) {
          try {
            account.oppositeBettingDetected = await detectOppositeBetting(clientId, config, token);
          } catch {
            account.oppositeBettingDetected = false;
          }
          try {
            account.playedGameNames = await getPlayedGameNames(clientId, config, token);
          } catch {
            account.playedGameNames = [];
          }
          try {
            const ipCheck = await getSameIPClientsCount(clientId, config, token);
            account.clientLoginIP = ipCheck.clientLoginIP ?? undefined;
            account.sameIPClientsCount = ipCheck.sameIPClientsCount;
          } catch {
            account.sameIPClientsCount = 0;
          }
        }
      }
      try {
        const tenantKey = await getTenantKeyForAdmin(request as any);
        const specs = await getRulesForTenant(tenantKey);
        const promos = await getAllPromosNormalized(force);
        const checklists = promos.map((p) => evaluateForAccount(account as any, p, specs));
        const withdrawalRulesCheck = evaluateWithdrawalRules(account as any, specs);
        const riskAnalysis = evaluateRiskAnalysis(account as any, specs);
        const wagerSummary = evaluateWagerSummary(account as any, specs);
        const bonusRules = evaluateBonusRules(account as any, specs);
        await writeAudit({
          timestamp: new Date().toISOString(),
          action: 'check',
          accountId: (() => {
            const v = account['id'] ?? account['ClientId'];
            return typeof v === 'number' || typeof v === 'string' ? v : undefined;
          })(),
          payload: {
            resultsCount: checklists.length,
            fromClientId: clientId != null,
            withdrawalRulesOk: withdrawalRulesCheck.overallOk,
            riskOk: riskAnalysis.overallOk,
            wagerOk: wagerSummary.overallOk,
            bonusRulesOk: bonusRules.overallOk,
          },
        });
        return reply.send({
          HasError: false,
          Data: {
            account,
            checklists,
            withdrawalRulesCheck,
            riskAnalysis,
            wagerSummary,
            bonusRules,
          },
        });
      } catch (err) {
        request.log.error({ err }, 'withdrawal check error');
        const msg = err instanceof Error ? err.message : String(err);
        return reply.status(500).send({ HasError: true, AlertMessage: `Sunucu hatası: ${msg}` });
      }
    }
  );

  // Admin: Bonus uygulama kontrol raporu (CSV) – otomatik oluştur, indir
  fastify.get('/admin/bonus-control-report', async (request, reply) => {
    try {
      const promos = await getAllPromosNormalized(true);
      const csv = buildBonusControlReportCsv(promos);
      const date = new Date().toISOString().slice(0, 10);
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="bonus-uygulama-kontrol-raporu-${date}.csv"`)
        .send(csv);
    } catch (err) {
      request.log.error({ err }, 'bonus control report error');
      return reply.status(500).send({ HasError: true, AlertMessage: 'Rapor oluşturulamadı.' });
    }
  });

  // Admin: Son otomatik çekim kontrolü durumu
  fastify.get('/admin/withdrawal/auto-status', async (_request, reply) => {
    try {
      const result = await readLastAutoRun();
      return reply.send({ HasError: false, Data: result });
    } catch (err) {
      return reply.status(500).send({ HasError: true, AlertMessage: 'Durum okunamadı.' });
    }
  });

  // Admin: Execute withdrawal (prototype — simulated, audited)
  fastify.post<{ Body?: Record<string, unknown> }>(
    '/admin/withdrawal/execute',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            account: { type: 'object' },
            promoId: { type: 'number' },
            simulate: { type: 'boolean', default: true },
          },
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      const body = request.body ?? {};
      const account = body.account as Record<string, unknown> | undefined;
      const promoId = typeof body.promoId === 'number' ? body.promoId : undefined;
      const simulate = body.simulate !== false;
      if (!account || !promoId) {
        return reply.status(400).send({ HasError: true, AlertMessage: 'account ve promoId gerekli.' });
      }
      try {
        // In prototype we only simulate execution and write audit
        const outcome = {
          simulated: simulate,
          executedAt: new Date().toISOString(),
          txId: simulate ? null : `SIM-${Date.now()}`,
        };
        await writeAudit({
          timestamp: new Date().toISOString(),
          action: 'execute',
          accountId: (() => {
            const v = account['id'] ?? account['ClientId'];
            return typeof v === 'number' || typeof v === 'string' ? v : undefined;
          })(),
          promoId,
          payload: { simulate },
          outcome,
        });
        return reply.send({ HasError: false, Data: outcome });
      } catch (err) {
        request.log.error({ err }, 'withdrawal execute error');
        return reply.status(500).send({ HasError: true, AlertMessage: 'Sunucu hatası: execute.' });
      }
    }
  );
  fastify.post<{ Body?: Record<string, unknown> }>(
    '/client-detailed-report',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonClientDetailedReport(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'client-detailed-report', err);
        }
      }
      return proxyDetailedReport(request, reply, config.detailedReportApi, getBackofficeToken());
    }
  );

  fastify.post<{ Body?: Record<string, unknown> }>(
    '/client-turnover-paging',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonClientTurnoverPaging(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'client-turnover-paging', err);
        }
      }
      return proxyClientTurnoversPaging(request, reply, config.clientTurnoversApi, getBackofficeToken());
    }
  );

  fastify.post<{ Body?: Record<string, unknown> }>(
    '/client-bet-history',
    {
      schema: { body: { type: 'object', additionalProperties: true } }
    },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonClientBetHistory(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'client-bet-history', err);
        }
      }
      const token = getBackofficeToken();
      if (!token) return reply.status(401).send({ HasError: true, AlertMessage: 'AUTH_TOKEN yok' });

      const url = 'https://backofficewebadmin.betconstruct.com/api/tr/Report/GetBetReport';
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://backoffice.betconstruct.com',
            'Referer': 'https://backoffice.betconstruct.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
            'authentication': token.trim(),
            'Content-Type': 'application/json;charset=UTF-8'
          },
          body: JSON.stringify(request.body ?? {})
        });
        const data = await response.json();
        return reply.status(response.status).send(data);
      } catch (err) {
        request.log.error({ err }, 'proxyBetHistory error');
        return reply.status(502).send({ HasError: true, AlertMessage: 'API isteği başarısız' });
      }
    }
  );

  fastify.post<{ Body?: Record<string, unknown> }>(
    '/site-bet-history',
    {
      schema: { body: { type: 'object', additionalProperties: true } }
    },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonSiteBetHistory(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'site-bet-history', err);
        }
      }
      const token = getBackofficeToken();
      if (!token) return reply.status(401).send({ HasError: true, AlertMessage: 'AUTH_TOKEN yok' });

      const url = 'https://backofficewebadmin.betconstruct.com/api/tr/Report/GetBetReport';
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://backoffice.betconstruct.com',
            'Referer': 'https://backoffice.betconstruct.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
            'authentication': token.trim(),
            'Content-Type': 'application/json;charset=UTF-8'
          },
          body: JSON.stringify(request.body ?? {})
        });
        const data = await response.json();
        return reply.status(response.status).send(data);
      } catch (err) {
        request.log.error({ err }, 'proxyBetHistory error');
        return reply.status(502).send({ HasError: true, AlertMessage: 'API isteği başarısız' });
      }
    }
  );

  fastify.post<{ Body?: Record<string, unknown> }>(
    '/client-casino-history',
    {
      schema: { body: { type: 'object', additionalProperties: true } }
    },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonClientCasinoHistory(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'client-casino-history', err);
        }
      }
      const token = getBackofficeToken();
      if (!token) return reply.status(401).send({ HasError: true, AlertMessage: 'AUTH_TOKEN yok' });

      const url = 'https://backofficewebadmin.betconstruct.com/api/tr/Casino/GetBetHistory';
      request.log.info({ url }, 'Calling Casino History API');
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://backoffice.betconstruct.com',
            'Referer': 'https://backoffice.betconstruct.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
            'authentication': token.trim(),
            'Content-Type': 'application/json;charset=UTF-8'
          },
          body: JSON.stringify(request.body ?? {})
        });
        const data = await response.json();
        return reply.status(response.status).send(data);
      } catch (err) {
        request.log.error({ err }, 'proxyCasinoHistory error');
        return reply.status(502).send({ HasError: true, AlertMessage: 'API isteği başarısız' });
      }
    }
  );

  fastify.post<{ Body?: Record<string, unknown> }>(
    '/client-bonus-report',
    {
      schema: { body: { type: 'object', additionalProperties: true } }
    },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonClientBonusReport(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'client-bonus-report', err);
        }
      }
      const token = getBackofficeToken();
      if (!token) return reply.status(401).send({ HasError: true, AlertMessage: 'AUTH_TOKEN yok' });

      const url = 'https://backofficewebadmin.betconstruct.com/api/tr/Report/GetClientBonusReport';
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://backoffice.betconstruct.com',
            'Referer': 'https://backoffice.betconstruct.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
            'authentication': token.trim(),
            'Content-Type': 'application/json;charset=UTF-8'
          },
          body: JSON.stringify(request.body ?? {})
        });
        const data = await response.json();
        return reply.status(response.status).send(data);
      } catch (err) {
        request.log.error({ err }, 'proxyClientBonusReport error');
        return reply.status(502).send({ HasError: true, AlertMessage: 'API isteği başarısız' });
      }
    }
  );

  fastify.post<{ Body?: Record<string, unknown> }>(
    '/client-bet-selections-history',
    {
      schema: { body: { type: 'object', additionalProperties: true } }
    },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonBetSelections(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'client-bet-selections-history', err);
        }
      }
      const token = getBackofficeToken();
      if (!token) return reply.status(401).send({ HasError: true, AlertMessage: 'AUTH_TOKEN yok' });

      const url = 'https://backofficewebadmin.betconstruct.com/api/tr/Sport/GetBetSelections';
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://backoffice.betconstruct.com',
            'Referer': 'https://backoffice.betconstruct.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
            'authentication': token.trim(),
            'Content-Type': 'application/json;charset=UTF-8'
          },
          body: JSON.stringify(request.body ?? {})
        });
        const data = await response.json();
        return reply.status(response.status).send(data);
      } catch (err) {
        request.log.error({ err }, 'proxyBetSelectionsHistory error');
        return reply.status(502).send({ HasError: true, AlertMessage: 'API isteği başarısız' });
      }
    }
  );
  fastify.post<{ Body?: Record<string, unknown> }>(
    '/registration-stats',
    { schema: { body: { type: 'object', additionalProperties: true } } },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonRegistrationStats(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'registration-stats', err);
        }
      }
      const token = getBackofficeToken();
      return proxyRegistrationStats(request, reply, config.registrationStatsApi, token || config.api.backofficeAuthToken);
    }
  );

  fastify.post<{ Body?: Record<string, unknown> }>(
    '/registration-stats-details',
    { schema: { body: { type: 'object', additionalProperties: true } } },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonRegistrationStatsDetails(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'registration-stats-details', err);
        }
      }
      const token = getBackofficeToken();
      return proxyRegistrationStats(request, reply, config.registrationStatsDetailsApi, token || config.api.backofficeAuthToken);
    }
  );

  fastify.post<{ Body?: Record<string, unknown> }>(
    '/provider-report',
    { schema: { body: { type: 'object', additionalProperties: true } } },
    async (request, reply) => {
      if (shouldUseLynon(request)) {
        try {
          return reply.send(await lynonProviderReport(request.body ?? {}));
        } catch (err) {
          if (!hasLegacyAuth()) return sendLynonError(reply, err);
          warnLynonFallback(request, 'provider-report', err);
        }
      }
      const token = getBackofficeToken();
      if (!token) return reply.status(401).send({ HasError: true, AlertMessage: 'AUTH_TOKEN yok' });

      const url = 'https://rgs-webadminapi.betconstruct.com/api/Reporting/GetReportByPartnerDetailed';
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://backoffice.betconstruct.com',
            'Referer': 'https://backoffice.betconstruct.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
            'authentication': token.trim(),
            'Content-Type': 'application/json;charset=UTF-8'
          },
          body: JSON.stringify(request.body ?? {})
        });
        const data = await response.json();
        return reply.status(response.status).send(data);
      } catch (err) {
        request.log.error({ err }, 'proxyProviderReport error');
        return reply.status(502).send({ HasError: true, AlertMessage: 'API isteği başarısız' });
      }
    }
  );

  // Basic in-memory cache for player snapshots to prevent rate-limits
  const playerSnapshotCache: Record<string, { ts: number; data: any }> = {};
  const SNAPSHOT_CACHE_TTL = 60 * 1000; // 1 minute
  // A successful eligibility check grants one short-lived, one-time assignment permit.
  // This prevents direct /charge calls from bypassing player and bonus rules.
  const validatedBonusAssignments = new Map<string, { expiresAt: number }>();
  const BONUS_ASSIGNMENT_PERMIT_TTL = 2 * 60 * 1000;
  const bonusAssignmentPermitKey = (tenantKey: string, username: string, clientId: number | string, bonusId: number | string) =>
    `${tenantKey}:${username}:${clientId}:${bonusId}`;
  const resolveBonusRule = (rules: RulesConfig, bonusId: number | string | undefined) => {
    if (bonusId == null) return null;
    const requestedId = String(bonusId);
    const direct = rules.PROMO_SPECS[requestedId];
    if (direct) return { key: requestedId, spec: direct };
    const linked = [
      ...Object.entries(rules.PROMO_SPECS),
      ...Object.entries(rules.PROMO_TITLE_SPECS),
    ].find(([, spec]) => String(spec.partnerBonusId ?? '') === requestedId);
    return linked ? { key: linked[0], spec: linked[1] } : null;
  };
  const hasCompleteEligibilityData = (account: any) => {
    const completeness = account?.dataCompleteness;
    return completeness && Object.values(completeness).every(Boolean);
  };

  // Admin: Bonus ekleme öncesi kontrol (kullanıcı adına göre)
  fastify.post<{ Body: { login: string; bonusId?: number; bonusName?: string } }>(
    '/admin/bonus/check-player',
    async (request, reply) => {
      const { login, bonusId, bonusName } = request.body;
      if (!login) return reply.status(400).send({ HasError: true, AlertMessage: 'Login gerekli' });

      /**
       * KIMLIK KONTROLU.
       *
       * Bu uc hem panel operatoru hem oyuncu tarafindan cagrilabiliyor
       * (authGuard BONUS_PANEL_PATHS). Onceden `login` yalnizca istek
       * govdesinden okunuyordu; bir oyuncu oturumu baska bir oyuncunun
       * kullanici adini gonderip o kisinin bakiyesini, yatirim gecmisini,
       * dogrulama durumunu, son giris IP'sini, operator notlarini ve risk
       * analizini okuyabiliyordu.
       *
       * Operator herkesi gorebilir; oyuncu yalnizca kendini.
       */
      const kimlik = istekKimligi(request);
      if (!oyuncuVerisineErisebilir(kimlik, login)) {
        request.log.warn(
          { istekSahibi: kimlik?.kimlik ?? 'bilinmiyor', hedef: login },
          'Baska oyuncunun bonus uygunluk verisi istendi; reddedildi.',
        );
        return reply.status(403).send({
          HasError: true,
          AlertMessage: 'Yalnızca kendi hesabınız için sorgulama yapabilirsiniz.',
        });
      }

      // Bonus talebinden men edilmis mi? Hesap kilitli degil, oyuncu siteyi
      // normal kullanabiliyor — yalnizca bonus/cark/kazi-kazan taleplerinden
      // disarida. Bu kontrol Lynon'a hic gitmeden en basta yapiliyor.
      const blacklistTenantKey = await getTenantKeyForAdmin(request as any);
      const blacklistKaydi = await bonusBlacklisteMi(blacklistTenantKey, login);
      if (blacklistKaydi) {
        return reply.send({
          HasError: false,
          Data: {
            account: null,
            withdrawalRulesCheck: null,
            riskAnalysis: null,
            bonusRules: null,
            specificBonusCheck: {
              overallOk: false,
              items: [{ id: 'bonus-blacklist', ok: false, label: blacklistKaydi.neden ? `Bonus taleplerinden men edildi: ${blacklistKaydi.neden}` : 'Bu hesap bonus taleplerinden men edilmiştir.' }],
            },
          },
        });
      }

      const token = getBackofficeToken();
      if (shouldUseLynon(request)) {
        try {
          const account = await lynonBuildBonusEligibilitySnapshot({ login });
          const tenantKey = blacklistTenantKey;
          const specs = await getRulesForTenant(tenantKey);
          const resolvedRule = resolveBonusRule(specs, bonusId);
          const spec = resolvedRule?.spec ?? null;
          const requestedRuleType = String(spec?.type ?? 'partner').toLocaleLowerCase('tr-TR');
          const missingPartnerBonusId = !['cash', 'nakit', 'wheel'].includes(requestedRuleType) && !String(spec?.partnerBonusId ?? '').trim();
          const specificBonusCheck = !spec
            ? { overallOk: false, items: [{ id: 'missing-rule', ok: false, label: 'Bu kampanya için zorunlu kural tanımı bulunamadı.' }] }
            : spec.enabled === false
              ? { overallOk: false, items: [{ id: 'disabled-rule', ok: false, label: 'Bu kampanya bonus taleplerinde pasif durumda.' }] }
              : missingPartnerBonusId
                ? { overallOk: false, items: [{ id: 'missing-partner-bonus-id', ok: false, label: 'Partner Bonus ID eksik; bonus ataması güvenli biçimde durduruldu.' }] }
                : await evaluateForAccount(account as any, { id: bonusId, title: bonusName || String(bonusId), kuralAnahtari: resolvedRule?.key, ...spec } as any, specs, tenantKey, 'bonus');
          if (bonusId && specificBonusCheck.overallOk && hasCompleteEligibilityData(account)) {
            // Izin anahtari, charge ile AYNI kimlik dizesini kullanmali.
            // Onceden burada 'anonymous', charge'da 'system' uretiliyordu;
            // anahtarlar eslesmedigi icin oyuncu oturumu bonus atamasini
            // tamamlayamiyordu — tasarim degil, tesadufi bir engeldi.
            const permitKey = bonusAssignmentPermitKey(tenantKey, kimlik!.kimlik, account.ClientId, bonusId);
            validatedBonusAssignments.set(permitKey, { expiresAt: Date.now() + BONUS_ASSIGNMENT_PERMIT_TTL });
          }
          return reply.send({
            HasError: false,
            Data: {
              account,
              withdrawalRulesCheck: evaluateWithdrawalRules(account as any, specs),
              riskAnalysis: evaluateRiskAnalysis(account as any, specs),
              bonusRules: evaluateBonusRules(account as any, specs),
              specificBonusCheck,
            },
          });
        } catch (err) {
          return sendLynonError(reply, err);
        }
      }
      if (!token) return reply.status(401).send({ HasError: true, AlertMessage: 'Token yok' });

      try {
        // 1. Oyuncuyu bul
        const clientsRes = await fetchPost(config.clientsApi.baseUrl, config.clientsApi.path, {
          Login: login,
          MaxRows: 1,
          SkeepRows: 0,
        }, token) as any;

        const client = clientsRes.Data?.Objects?.[0];
        if (!client) return reply.status(404).send({ HasError: true, AlertMessage: 'Oyuncu bulunamadı' });

        const clientId = Number(client.Id);

        // 2. Snapshot oluştur (KPI, Bonuslar, İşlemler) - With cache to prevent 403
        const cacheKey = `snapshot_${clientId}`;
        const cachedSnapshot = playerSnapshotCache[cacheKey];
        let account: any;

        if (cachedSnapshot && (Date.now() - cachedSnapshot.ts) < SNAPSHOT_CACHE_TTL) {
          account = cachedSnapshot.data;
        } else {
          try {
            account = await buildAccountSnapshotFromClientId(clientId, config, token);
            playerSnapshotCache[cacheKey] = { ts: Date.now(), data: account };
          } catch (snapshotErr: any) {
            request.log.error(snapshotErr, `Snapshot build error for client ${clientId}`);
            return reply.send({
              HasError: true,
              AlertMessage: `Hesap verileri alınamadı (403/Limit). Lütfen 1 dk sonra tekrar deneyin.`
            });
          }
        }

        // 3. Genel Kontrolleri çalıştır
        const withdrawalRulesCheck = evaluateWithdrawalRules(account as any);
        const riskAnalysis = evaluateRiskAnalysis(account as any);
        const tenantKey = await getTenantKeyForAdmin(request as any);
        const specs = await getRulesForTenant(tenantKey);
        const bonusRules = evaluateBonusRules(account as any, specs);

        // 4. Spesifik Bonus Kontrolü (Seçilen bonus varsa)
        let specificBonusCheck = null;
        if (bonusId || bonusName) {
          const { readFileSync, existsSync } = await import('fs');
          const { join } = await import('path');
          const promosDataPath = join(process.cwd(), 'promotions-data.json');

          let promo: any = null;

          // A) Önce Kural Merkezindeki (specs) tanımlara bak
          const specById = bonusId ? specs.PROMO_SPECS[String(bonusId)] : null;
          let specByTitle = null;
          if (bonusName) {
            const n = bonusName.toLowerCase().replace(/%/g, '').replace(/\s+/g, ' ').trim();
            specByTitle = specs.PROMO_TITLE_SPECS[n];
            if (!specByTitle) {
               for (const [tKey, tSpec] of Object.entries(specs.PROMO_TITLE_SPECS)) {
                  if (n.includes(tKey) || tKey.includes(n)) { specByTitle = tSpec; break; }
               }
            }
          }
          const activeSpec = specById || specByTitle;

          // B) promotions-data.json'dan ek verileri getir (image, detailHtml vb.)
          if (existsSync(promosDataPath)) {
            try {
              const promosRaw = readFileSync(promosDataPath, 'utf-8');
              const promosJson = JSON.parse(promosRaw);
              promo = promosJson.promotions?.find((p: any) =>
                (bonusId && String(p.id) === String(bonusId)) ||
                (bonusName && p.title.toLowerCase().trim() === bonusName.toLowerCase().trim()) ||
                (bonusName && bonusName.toLowerCase().includes(p.title.toLowerCase().trim()))
              );
            } catch (e) { console.error('Error reading promos data:', e); }
          }

          // C) Eğer kural merkezinde varsa ama json'da yoksa, sanal bir promo nesnesi oluştur
          if (!promo && activeSpec) {
            promo = {
              id: bonusId || 0,
              title: bonusName || (activeSpec as any).title || 'Bonus',
              rules: activeSpec
            };
          }

          if (promo) {
             specificBonusCheck = await evaluateForAccount(account as any, {
                id: promo.id || bonusId || 0,
                title: promo.title || bonusName,
                ...(promo.rules || activeSpec || {}),
                raw: promo.conditions?.join('\n') || ''
             } as any, specs, tenantKey, 'bonus');
          }
        }

        return reply.send({
          HasError: false,
          Data: {
            account,
            withdrawalRulesCheck,
            riskAnalysis,
            bonusRules,
            specificBonusCheck
          }
        });
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ HasError: true, AlertMessage: (err as Error).message });
      }
    }
  );

  // Admin: bonus blacklist listesi.
  fastify.get('/admin/bonus/blacklist', async (request, reply) => {
    const session = request.session as any;
    if (!session?.user) return reply.status(401).send({ HasError: true, AlertMessage: 'Oturum bulunamadı.' });
    const tenantKey = await getTenantKeyForAdmin(request as any);
    const kayitlar = await readBonusBlacklist(tenantKey);
    return reply.send({ HasError: false, Data: kayitlar });
  });

  // Admin: bir oyuncuyu bonus talebinden men et.
  fastify.post<{ Body: { login: string; neden?: string } }>('/admin/bonus/blacklist', async (request, reply) => {
    const session = request.session as any;
    const user = session?.user;
    if (!user) return reply.status(401).send({ HasError: true, AlertMessage: 'Oturum bulunamadı.' });
    const { login, neden } = request.body ?? {};
    if (!login || !String(login).trim()) return reply.status(400).send({ HasError: true, AlertMessage: 'Kullanıcı adı gerekli.' });
    const tenantKey = await getTenantKeyForAdmin(request as any);
    const kayitlar = await bonusBlacklisteEkle(tenantKey, login, user.username ?? 'admin', neden);
    const { audit } = await import('../lib/auditLog.js');
    audit(user.username ?? 'admin', 'admin', 'bonus_blacklist_ekle', `login:${login}`, neden ? `Bonus talebinden men edildi: ${neden}` : 'Bonus talebinden men edildi.');
    return reply.send({ HasError: false, Data: kayitlar });
  });

  // Admin: bir oyuncuyu bonus blacklist'inden çıkar.
  fastify.delete<{ Params: { login: string } }>('/admin/bonus/blacklist/:login', async (request, reply) => {
    const session = request.session as any;
    const user = session?.user;
    if (!user) return reply.status(401).send({ HasError: true, AlertMessage: 'Oturum bulunamadı.' });
    const tenantKey = await getTenantKeyForAdmin(request as any);
    const kayitlar = await bonusBlacklistindenCikar(tenantKey, request.params.login);
    const { audit } = await import('../lib/auditLog.js');
    audit(user.username ?? 'admin', 'admin', 'bonus_blacklist_cikar', `login:${request.params.login}`, 'Bonus blacklistinden çıkarıldı.');
    return reply.send({ HasError: false, Data: kayitlar });
  });

  // Admin: Bonus Ekle (Charge Bonus)
  fastify.post<{ Body: { ClientId: number; BonusId: number; Amount?: number; AssignmentValues?: Record<string, unknown> } }>(
    '/admin/bonus/charge',
    async (request, reply) => {
      const session = request.session as any;
      const user = session?.user;
      // Denetim kaydi icin gorunen ad; izin anahtari icin AYRI ve
      // belirlenimli kimlik kullanilir (bkz. chargeKimligi).
      const username = user?.username ?? 'system';
      const role = user?.role ?? 'admin';
      const chargeKimligi = istekKimligi(request);
      const { ClientId, BonusId, Amount = 0 } = request.body;

      if (shouldUseLynon(request)) {
        try {
          if (!Number.isFinite(Number(ClientId)) || !Number.isFinite(Number(BonusId))) {
            return reply.status(400).send({ HasError: true, AlertMessage: 'Geçerli oyuncu ve kampanya bilgisi gerekli.' });
          }
          const tenantKey = await getTenantKeyForAdmin(request as any);
          if (!chargeKimligi) {
            return reply.status(401).send({ HasError: true, AlertMessage: 'Oturum bulunamadı.' });
          }
          const permitKey = bonusAssignmentPermitKey(tenantKey, chargeKimligi.kimlik, ClientId, BonusId);
          const permit = validatedBonusAssignments.get(permitKey);
          if (!permit || permit.expiresAt < Date.now()) {
            validatedBonusAssignments.delete(permitKey);
            return reply.status(409).send({
              HasError: true,
              AlertMessage: 'Bonus eklenemedi: önce güncel uygunluk kontrolü yapılmalı ve tüm kurallar sağlanmalı.',
            });
          }
          // İzin dış yazmadan önce tüketilir ve canlı verilerle ikinci kez kontrol edilir.
          validatedBonusAssignments.delete(permitKey);
          const rules = await getRulesForTenant(tenantKey);
          const resolvedRule = resolveBonusRule(rules, BonusId);
          const spec = resolvedRule?.spec;
          if (!spec || spec.enabled === false) {
            return reply.status(409).send({
              HasError: true,
              AlertMessage: 'Bonus eklenemedi: kampanyanın aktif ve eksiksiz bir uygunluk kuralı yok.',
            });
          }
          const configuredRuleType = String(spec.type ?? 'partner').toLocaleLowerCase('tr-TR');
          const ruleType = ['cash', 'nakit'].includes(configuredRuleType) ? 'cash' : 'partner';
          const partnerBonusId = Number(spec.partnerBonusId);
          if (ruleType === 'partner' && (!Number.isInteger(partnerBonusId) || partnerBonusId <= 0)) {
            return reply.status(409).send({
              HasError: true,
              AlertMessage: 'Bonus eklenemedi: Partner Bonus ID eksik veya geçersiz.',
            });
          }

          const currentAccount = await lynonBuildBonusEligibilitySnapshot({ playerId: ClientId });
          if (!hasCompleteEligibilityData(currentAccount)) {
            return reply.status(502).send({
              HasError: true,
              AlertMessage: 'Lynon kampanya, spor, casino veya finans verilerinden biri tamamlanamadı; işlem durduruldu.',
            });
          }
          const currentCheck = await evaluateForAccount(currentAccount as any, {
            id: Number(BonusId),
            title: (spec as any).title || String(BonusId),
            // Mukerrer kontrolu notu bu anahtarla ariyor; asagida not da
            // bununla yaziliyor. Ikisi ayrilirsa kontrol kor kalir.
            kuralAnahtari: resolvedRule?.key ?? String(BonusId),
            ...spec,
          } as any, rules, tenantKey, 'bonus');
          if (!currentCheck.overallOk) {
            const reasons = currentCheck.items.filter((item) => !item.ok).map((item) => item.reason || item.label);
            return reply.status(409).send({
              HasError: true,
              AlertMessage: `Bonus uygunluğu değişti: ${reasons.join(' | ')}`,
              Data: { specificBonusCheck: currentCheck },
            });
          }

          const calculatedAmount = Number(currentCheck.calculatedAmount ?? 0);
          const effectiveAmount = calculatedAmount > 0 ? calculatedAmount : Number(Amount);
          const { audit } = await import('../lib/auditLog.js');
          if (ruleType === 'cash') {
            if (!Number.isFinite(effectiveAmount) || effectiveAmount <= 0) {
              return reply.status(422).send({ HasError: true, AlertMessage: 'Nakit bonus tutarı pozitif olmalıdır.' });
            }

            /**
             * MUKERRER KORUMASI.
             *
             * Nakit bonus bakiye duzeltmesi olarak yaziliyor; Lynon'un bonus
             * listesinde gorunmuyor. Bu yolda "bugun verildi mi" diye bakan
             * HICBIR kontrol yoktu — ertesi gun isinde vardi (cashAlreadyCredited),
             * oyuncuya acik charge yolunda yoktu.
             *
             * Sonuc: oyuncu bonusu aliyor, kaybediyor, bakiye tekrar esigin
             * altina dusuyor ve ayni bonusu tekrar aliyordu. Her turda yeni
             * bir correction; oyuncu defalarca bedava bakiye kazaniyordu.
             *
             * Kural allowSameDayRepeat ile acikca izin vermedikce ayni kural
             * ayni oyuncuya gunde bir kez verilir.
             */
            const kuralAnahtari = String(resolvedRule?.key ?? BonusId);
            if ((spec as { allowSameDayRepeat?: boolean }).allowSameDayRepeat !== true) {
              const { bugunVerilmisMi, nakitKullanimlari } = await import('../services/nakitBonusGecmisi.js');
              const gunBaslangici = Date.now() - 24 * 60 * 60 * 1000;
              const kullanimlar = nakitKullanimlari(
                ((currentAccount as unknown as { balanceCorrections?: unknown }).balanceCorrections ?? []) as never,
              );
              if (bugunVerilmisMi(kullanimlar, kuralAnahtari, gunBaslangici)) {
                request.log.warn(
                  { ClientId, kuralAnahtari },
                  'Nakit bonus mukerrer talep engellendi.',
                );
                return reply.status(409).send({
                  HasError: true,
                  AlertMessage: 'Bu bonus bu oyuncuya son 24 saatte zaten tanımlanmış.',
                });
              }
            }

            const result = await lynonAdjustPlayerMainAccount({
              playerId: ClientId,
              amount: effectiveAmount,
              correctionType: 'crediting',
              // Not bicimi SABIT: `Bonus <kuralAnahtari> / <kullanici>`.
              // nakitBonusGecmisi bu bicimden kural anahtarini cikariyor;
              // degistirilirse mukerrer korumasi kor kalir.
              note: `Bonus ${kuralAnahtari} / ${username}`.slice(0, 50),
            });
            // Denetim kaydi artik bonusun KENDISINI anlatiyor: adi, turu,
            // tutarin nereden geldigi ve hangi yatirima karsilik verildigi.
            audit(username, role, 'bonus_charge_as_cash', String(ClientId), bonusDenetimAciklamasi({
              tur: 'nakit',
              baslik: (spec as { title?: unknown })?.title,
              kuralAnahtari: kuralAnahtari,
              tutar: effectiveAmount,
              tutarKaynagi: calculatedAmount > 0 ? 'kural' : 'elle',
              yatirimId: (currentAccount as { lastDeposit?: { id?: unknown } })?.lastDeposit?.id,
              yatirimTutari: (currentAccount as { lastDeposit?: { amount?: unknown } })?.lastDeposit?.amount,
            }));
            return reply.send({
              HasError: false,
              AlertType: 'success',
              AlertMessage: 'Nakit bonus Player Main hesabına crediting düzeltmesi olarak işlendi.',
              Data: result,
              lynon: true,
            });
          }

          const suppliedValues = request.body.AssignmentValues ?? {};
          const ruleAssignmentValues = assignmentValuesForPromoSpec(spec);
          const assignmentValues = {
            ...suppliedValues,
            ...ruleAssignmentValues,
            ...(effectiveAmount > 0 && suppliedValues.BonusMoneyAmount == null && ruleAssignmentValues.BonusMoneyAmount == null ? { BonusMoneyAmount: effectiveAmount } : {}),
          };
          const { atamaNotu } = await import('../services/bonusAtamaNotu.js');
          const result = await lynonAssignCampaignToPlayer({
            campaignId: partnerBonusId,
            playerId: ClientId,
            // Not artik kural, talep eden, yatirim ve tutari tasiyor;
            // "bu bonus neden verilmis" sorusu koda bakmadan yanitlanabilsin.
            assignmentReason: atamaNotu({
              kaynak: 'panel',
              kuralAnahtari: resolvedRule?.key ?? BonusId,
              baslik: (spec as { title?: unknown })?.title,
              talepEden: username,
              yatirimId: (currentAccount as { lastDeposit?: { id?: unknown } })?.lastDeposit?.id,
              yatirimTutari: (currentAccount as { lastDeposit?: { amount?: unknown } })?.lastDeposit?.amount,
              tutar: effectiveAmount,
            }),
            assignmentValues,
          });
          audit(username, role, 'lynon_campaign_assignment', String(ClientId), bonusDenetimAciklamasi({
            tur: 'kampanya',
            baslik: (spec as { title?: unknown })?.title,
            kuralAnahtari: resolvedRule?.key ?? BonusId,
            kampanyaId: partnerBonusId,
            tutar: effectiveAmount,
            tutarKaynagi: calculatedAmount > 0 ? 'kural' : 'elle',
            yatirimId: (currentAccount as { lastDeposit?: { id?: unknown } })?.lastDeposit?.id,
            yatirimTutari: (currentAccount as { lastDeposit?: { amount?: unknown } })?.lastDeposit?.amount,
          }));
          return reply.send({ HasError: false, AlertType: 'success', AlertMessage: 'Bonus talebi Lynon Backoffice’e işlendi.', Data: result, lynon: true });
        } catch (err) {
          const response = lynonErrorResponse(err);
          request.log.warn({ err, ClientId, BonusId }, 'Lynon bonus assignment rejected');
          return reply.status(response.status).send(response.body);
        }
      }

      // Kural Kontrolü: Eğer bu bonus "cash" (nakit) olarak tanımlandıysa manual adjustment'a pasla
      try {
          const tenantKey = await resolveTenantKeyFromHost(request as any);
          const rules = await getRules(tenantKey);
          const strId = String(BonusId);
          let spec = rules?.PROMO_SPECS?.[strId];

          if (!spec && rules?.PROMO_TITLE_SPECS) {
              // Check by title key or search in title specs
              for (const [tKey, tSpec] of Object.entries(rules.PROMO_TITLE_SPECS)) {
                  if (tKey === strId || (tSpec as any).partnerBonusId === strId) {
                      spec = tSpec;
                      break;
                  }
              }
          }

          if (spec && spec.enabled !== false) {
              const token = getBackofficeToken();
              if (token) {
                  try {
                      request.log.info({ ClientId, BonusId }, 'Running rule enforcement check before charge');
                      const account = await buildAccountSnapshotFromClientId(ClientId, config, token);
                      const checkRes = await evaluateForAccount(account as any, {
                          id: Number(strId) || (spec as any).partnerBonusId || 0,
                          title: (spec as any).title || strId,
                      } as any, rules, tenantKey, 'bonus');

                      if (!checkRes.overallOk) {
                          const reasons = checkRes.items.filter(i => !i.ok).map(i => i.label);
                          request.log.warn({ ClientId, BonusId, reasons }, 'Rule violation detected. Blocking charge.');
                          return reply.send({
                              HasError: true,
                              AlertMessage: `Kural İhlali: ${reasons.join(', ')}`,
                              ErrorDescription: `Bu oyuncu seçili bonusun şartlarını sağlamıyor: ${reasons.join(' | ')}`
                          });
                      }
                  } catch (snapshotErr) {
                      request.log.error(snapshotErr, 'Rule check snapshot building failed; charge blocked');
                      return reply.status(502).send({
                          HasError: true,
                          AlertMessage: 'Hesap ve uygunluk verileri doğrulanamadığı için bonus ekleme güvenli biçimde durduruldu.',
                      });
                  }
              }
          }

          if (spec?.type === 'cash') {
              request.log.info({ BonusId, ClientId }, 'Bonus type is CASH, redirecting to manual adjustment');
              // Request body'yi manual adjustment formatına uyarla
              (request.body as any).Amount = Amount;
              (request.body as any).Info = `Bonus Rule Adjustment: ${BonusId}`;
              (request.body as any).DocTypeInt = 3; // Depozit/Adjustment

              const result = await proxyManualAdjustment(request as any, reply, getBackofficeToken());
              const { audit } = await import('../lib/auditLog.js');
              audit(username, role, 'bonus_charge_as_cash', String(ClientId), bonusDenetimAciklamasi({
                tur: 'nakit',
                kuralAnahtari: BonusId,
                tutar: Amount,
                tutarKaynagi: 'elle',
              }));
              return result;
          }
      } catch (err) {
          request.log.error(err, 'Bonus charge rule check failed');
          return reply.status(502).send({
              HasError: true,
              AlertMessage: 'Bonus uygunluk denetimi tamamlanamadığı için işlem durduruldu.',
          });
      }

      const result = await proxyChargeBonus(request as any, reply, config.bonusApi, getBackofficeToken());

      // Log audit
      const { audit } = await import('../lib/auditLog.js');
      audit(username, role, 'bonus_charge', String(ClientId), `BonusId: ${BonusId}, Amount: ${Amount}`);

      return result;
    }
  );

  // Admin: Nakit Ekleme (Manual Adjustment)
  fastify.post<{ Body: {
    ClientId: number;
    Amount: number;
    Info?: string;
    DocTypeInt?: number;
    CorrectionType?: 'crediting' | 'debiting';
    correctionType?: 'crediting' | 'debiting';
  } }>(
    '/admin/manual-adjustment',
    async (request, reply) => {
      const session = request.session as any;
      const user = session?.user;
      const username = user?.username ?? 'system';
      const role = user?.role ?? 'admin';
      const { ClientId, Amount, Info } = request.body;

      if (shouldUseLynon(request)) {
        const correctionType = request.body.CorrectionType ?? request.body.correctionType;
        if (correctionType !== 'crediting' && correctionType !== 'debiting') {
          return reply.status(422).send({
            HasError: true,
            AlertMessage: 'Correction type seçimi zorunludur: crediting veya debiting.',
          });
        }
        try {
          const note = String(Info ?? `Panel ${correctionType} / ${username}`).trim().slice(0, 50);
          const result = await lynonAdjustPlayerMainAccount({
            playerId: ClientId,
            amount: Number(Amount),
            correctionType,
            note,
          });
          const { audit } = await import('../lib/auditLog.js');
          /**
           * Nakit ekleme/cikarma da bonus denetimiyle AYNI dilde yazilir.
           *
           * Onceden burada "Amount: 500, Info: ..." gibi ham bir satir
           * vardi; kampanya atamalari ise `bonusDenetimAciklamasi` ile
           * okunabilir cumleler yaziyordu. Ayni denetim listesinde iki
           * ayri dil, kaydi taramayi zorlastiriyordu.
           */
          audit(username, role, 'manual_adjustment', String(ClientId), bonusDenetimAciklamasi({
            tur: 'nakit',
            kaynak: `panel · ${correctionType === 'crediting' ? 'bakiye ekleme' : 'bakiye çıkarma'}`,
            baslik: note,
            tutar: Amount,
            tutarKaynagi: 'elle',
            sonuc: 'basarili',
          }));
          return reply.send({
            HasError: false,
            AlertType: 'success',
            AlertMessage: correctionType === 'crediting'
              ? 'Player Main hesabına düzeltme üst işlendi.'
              : 'Player Main hesabına düzeltme alt işlendi.',
            Data: result,
            lynon: true,
          });
        } catch (err) {
          return sendLynonError(reply, err);
        }
      }

      const result = await proxyManualAdjustment(request as any, reply, getBackofficeToken());
      const { audit } = await import('../lib/auditLog.js');
      audit(username, role, 'manual_adjustment', String(ClientId), `Amount: ${Amount}, Info: ${Info || 'Nakit Ekleme'}`);
      return result;
    }
  );
  // Admin: Partner Bonus Listesini Getir
  /**
   * CRM / churn listesi — skorlanmis oyuncular.
   *
   * Onceki ChurnPrevention ekrani bunu TARAYICIDA yapiyordu: once oyuncu
   * listesi, sonra her oyuncu icin ayri KPI istegi (useQueries). 20 satir =
   * 20 paralel istek. Burada tek Lynon cagrisi yetiyor, cunku oyuncu listesi
   * skorlama icin gereken alanlarin hepsini zaten donuyor.
   */
  fastify.post<{
    Body: { page?: number; countPerPage?: number; minSkor?: number; segment?: string; query?: string };
  }>('/admin/crm/churn', async (request, reply) => {
    if (!shouldUseLynon(request)) {
      return reply.status(409).send({ HasError: true, AlertMessage: 'CRM için Lynon bağlantısı gerekli.' });
    }
    const body = request.body ?? {};
    const page = Math.max(1, Number(body.page) || 1);
    const countPerPage = Math.min(200, Math.max(10, Number(body.countPerPage) || 50));

    try {
      const liste = await lynonPlayers({ page, countPerPage, query: body.query });
      const satirlar = ((liste as any)?.Data?.Objects ?? []) as Array<Record<string, unknown>>;

      const girdiler = satirlar.map((row) => ({
        id: row.Id,
        login: row.Login,
        kategori: row.CategoryName ?? null,
        lastLoginDate: (row.LastLoginLocalDate as string) ?? null,
        registrationDate: (row.CreatedLocalDate as string) ?? null,
        totalDeposits: Number(row.TotalDeposit ?? 0),
        totalWithdrawals: Number(row.TotalWithdraw ?? 0),
        balance: Number(row.Balance ?? 0),
        isLocked: row.IsLocked === true,
      })) satisfies Array<ChurnGirdisi & Record<string, unknown>>;

      let skorlu = churnListesi(girdiler);

      const minSkor = Number(body.minSkor);
      if (Number.isFinite(minSkor) && minSkor > 0) {
        skorlu = skorlu.filter((row) => row.churn.skor >= minSkor);
      }
      if (body.segment) {
        skorlu = skorlu.filter((row) => row.churn.segment === body.segment);
      }

      // Ozet: ekranin ust seridi bunu tek bakista gostersin.
      const ozet = {
        toplam: skorlu.length,
        kritik: skorlu.filter((r) => r.churn.seviye === 'kritik').length,
        yuksek: skorlu.filter((r) => r.churn.seviye === 'yuksek').length,
        riskAltindakiDeger: skorlu
          .filter((r) => r.churn.seviye === 'kritik' || r.churn.seviye === 'yuksek')
          .reduce((toplam, r) => toplam + Math.max(0, r.churn.deger), 0),
      };

      // Son temas: "bu oyuncu zaten dun arandi" bilgisi olmadan ayni kisi
      // tekrar tekrar aranir. Tek dokuman okumasi, satir basina istek degil.
      const temasHaritasi = await sonTemasHaritasi(
        await getTenantKeyForAdmin(request as any),
        skorlu.map((r) => String(r.login ?? '')),
      ).catch(() => ({} as Record<string, { createdAt: string; tur: string; sonuc: string }>));

      const zenginlestirilmis = skorlu.map((row) => ({
        ...row,
        sonTemas: temasHaritasi[String(row.login ?? '').trim().toLocaleLowerCase('tr-TR')] ?? null,
      }));

      return reply.send({ HasError: false, Data: { players: zenginlestirilmis, ozet, page, countPerPage } });
    } catch (err) {
      return sendLynonError(reply, err);
    }
  });

  /** Bir oyuncunun temas gecmisi. */
  fastify.get<{ Params: { login: string } }>('/admin/crm/temas/:login', async (request, reply) => {
    const tenantKey = await getTenantKeyForAdmin(request as any);
    try {
      ensureCrmDir();
      const temaslar = await oyuncuTemaslari(tenantKey, request.params.login);
      return reply.send({ HasError: false, Data: { temaslar } });
    } catch (err) {
      return reply.status(500).send({ HasError: true, AlertMessage: (err as Error).message });
    }
  });

  /** Yeni temas kaydi. Kim yaptigi oturumdan alinir, gövdeden DEGIL. */
  fastify.post<{
    Body: { login: string; tur?: string; sonuc?: string; not?: string };
  }>('/admin/crm/temas', async (request, reply) => {
    const user = (request.session as any)?.user;
    if (!user?.username) return reply.status(401).send({ HasError: true, AlertMessage: 'Oturum gerekli.' });

    const tenantKey = await getTenantKeyForAdmin(request as any);
    try {
      ensureCrmDir();
      const temas = await temasEkle(tenantKey, { ...request.body, yapan: user.username });
      const { audit } = await import('../lib/auditLog.js');
      audit(user.username, user.role, 'crm_temas', temas.login, `${temas.tur}/${temas.sonuc}`);
      return reply.send({ HasError: false, Data: { temas } });
    } catch (err) {
      return reply.status(400).send({ HasError: true, AlertMessage: (err as Error).message });
    }
  });

  /** Son temaslar + ozet: CRM ekraninin gunluk gorunumu. */
  fastify.get('/admin/crm/gunluk', async (request, reply) => {
    const tenantKey = await getTenantKeyForAdmin(request as any);
    try {
      ensureCrmDir();
      const temaslar = await sonTemaslar(tenantKey, 200);
      return reply.send({ HasError: false, Data: { temaslar, ozet: temasOzeti(temaslar) } });
    } catch (err) {
      return reply.status(500).send({ HasError: true, AlertMessage: (err as Error).message });
    }
  });

  /**
   * Ertesi gun bonusunu KURU calistirir — hicbir sey yazmaz.
   *
   * Is yalnizca Turkiye saatiyle 00:15-00:19 arasinda calisiyor. O 5 dakikalik
   * pencere disinda "neden eklenmedi" sorusunu cevaplamanin yolu yoktu; kural
   * degistirip ertesi geceye kadar beklemek gerekiyordu.
   *
   * Bu uc isin ayni kapilarindan gecer ve her birinin sonucunu doner.
   * Zaman penceresi ve idempotency KASITLI atlanir: "su anda calissaydi ne
   * olurdu" sorusunu cevapliyoruz.
   */
  fastify.post<{ Body: { playerId?: string | number } }>(
    '/admin/bonus/next-day/dry-run',
    async (request, reply) => {
      const playerId = request.body?.playerId;
      if (playerId == null || String(playerId).trim() === '') {
        return reply.status(400).send({ HasError: true, AlertMessage: 'playerId gerekli.' });
      }
      try {
        const { nextDayBonusKuruCalistir } = await import('../jobs/nextDayBonusJob.js');
        const sonuc = await nextDayBonusKuruCalistir(playerId);
        return reply.send({ HasError: false, Data: sonuc });
      } catch (err) {
        request.log.warn({ err, playerId }, 'Ertesi gun kuru calistirma basarisiz.');
        return sendLynonError(reply, err);
      }
    },
  );

  fastify.post('/admin/bonus/partner-list', async (request, reply) => {
    if (shouldUseLynon(request)) {
      try {
        return reply.send(await lynonBonusDefinitions());
      } catch (err) {
        if (!hasLegacyAuth()) return sendLynonError(reply, err);
        warnLynonFallback(request, 'partner-bonus-list', err);
      }
    }
    const { proxyGetPartnerBonuses } = await import('../lib/proxy.js');
    return proxyGetPartnerBonuses(request as any, reply, getBackofficeToken());
  });


  fastify.get<{ Params: { campaignId: string } }>('/admin/bonus/lynon-campaign/:campaignId', async (request, reply) => {
    const campaignId = Number(request.params.campaignId);
    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      return reply.status(400).send({ HasError: true, AlertMessage: 'Geçerli campaignId gerekli.' });
    }
    try {
      const [campaign, bonuses, blocksResult] = await Promise.all([
        lynonCampaign(campaignId),
        lynonCampaignBonuses(campaignId),
        lynonBonusBlocks().catch(() => ({ Data: { Objects: [] } })),
      ]);
      const templateIds = Array.from(new Set(bonuses.map((bonus: any) => Number(bonus.templateId)).filter(Number.isFinite)));
      const templateResults = await Promise.allSettled(templateIds.map((templateId) => lynonTemplate(templateId)));
      const templates = templateResults
        .filter((result): result is PromiseFulfilledResult<Record<string, any>> => result.status === 'fulfilled')
        .map((result) => result.value);
      return reply.send({
        HasError: false,
        Data: {
          campaign,
          bonuses,
          templates,
          blocks: (blocksResult as any)?.Data?.Objects ?? [],
        },
      });
    } catch (err) {
      return sendLynonError(reply, err);
    }
  });

  fastify.put<{
    Params: { campaignId: string };
    Body: { campaign?: Record<string, unknown>; bonuses?: Array<Record<string, unknown>> };
  }>('/admin/bonus/lynon-campaign/:campaignId', async (request, reply) => {
    const campaignId = Number(request.params.campaignId);
    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      return reply.status(400).send({ HasError: true, AlertMessage: 'Geçerli campaignId gerekli.' });
    }

    const pickEditable = (source: Record<string, unknown>, fields: string[]) =>
      Object.fromEntries(fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));

    try {
      const campaignInput = pickEditable(request.body?.campaign ?? {}, [
        'systemName', 'nameTranslations', 'expirationToClaimInDays', 'supportedCurrencies',
        'configurationCurrency', 'maxAssigneeCount', 'startDate', 'endDate',
      ]);
      if (Object.keys(campaignInput).length > 0) {
        await lynonUpdateCampaign(campaignId, campaignInput);
      }

      const updatedBonuses: Record<string, any>[] = [];
      for (const bonus of Array.isArray(request.body?.bonuses) ? request.body.bonuses : []) {
        const bonusId = Number(bonus.id ?? bonus.Id);
        if (!Number.isInteger(bonusId) || bonusId <= 0) continue;
        const bonusInput = pickEditable(bonus, [
          'templateId', 'systemName', 'systemDescription', 'nameTranslations',
          'descriptionTranslations', 'activeBonusExpirationInDays', 'assignmentLimits',
          'blocksConfiguration',
        ]);
        if (Object.keys(bonusInput).length > 0) {
          updatedBonuses.push(await lynonUpdateCampaignBonus(bonusId, bonusInput));
        }
      }

      const { audit } = await import('../lib/auditLog.js');
      const session = request.session as any;
      audit(session?.user?.username ?? 'system', session?.user?.role ?? 'admin', 'lynon_campaign_update', String(campaignId), `Bonus blocks: ${updatedBonuses.length}`);
      return reply.send({ HasError: false, AlertMessage: 'Lynon kampanya parametreleri güncellendi.', Data: { campaignId, updatedBonuses: updatedBonuses.length } });
    } catch (err) {
      return sendLynonError(reply, err);
    }
  });  async function fetchPost(baseUrl: string, path: string, body: Record<string, unknown>, token: string) {
    const url = `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json;charset=UTF-8',
        'authentication': token.trim()
      },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  // --- Dynamic Rules Endpoints ---
  fastify.get('/admin/rules', async (request, reply) => {
    try {
      const tenantKey = await getTenantKeyForAdmin(request as any);
      const rules = await getRules(tenantKey);
      return reply.send(rules);
    } catch (err) {
      return reply.status(500).send({ HasError: true, AlertMessage: 'Kurallar okunamadı' });
    }
  });

  fastify.post<{ Body: RulesConfig }>('/admin/rules', async (request, reply) => {
    try {
      const tenantKey = await getTenantKeyForAdmin(request as any);
      if (shouldUseLynon(request)) {
        const catalog = await lynonBonusDefinitions();
        const validPartnerBonusIds = new Set(
          (Array.isArray(catalog.Result) ? catalog.Result : [])
            .map((bonus: any) => Number(bonus.PartnerBonusId))
            .filter((id: number) => Number.isInteger(id) && id > 0)
        );
        const existingRules = await getRules(tenantKey);
        const existingSpecs: Record<string, any> = {
          ...(existingRules?.PROMO_SPECS ?? {}),
          ...(existingRules?.PROMO_TITLE_SPECS ?? {}),
        };
        const invalidRules = [
          ...Object.entries(request.body?.PROMO_SPECS ?? {}),
          ...Object.entries(request.body?.PROMO_TITLE_SPECS ?? {}),
        ].filter(([key, spec]) => {
          const ruleType = String(spec.type ?? 'partner').toLocaleLowerCase('tr-TR');
          if (spec.enabled === false || ['cash', 'nakit', 'wheel'].includes(ruleType)) return false;
          if (validPartnerBonusIds.has(Number(spec.partnerBonusId))) return false;
          // Rule already existed with this exact (now-stale) partner ID and isn't being changed here —
          // don't block unrelated edits (e.g. deleting a different rule) because of it.
          const existing = existingSpecs[key];
          if (existing && Number(existing.partnerBonusId) === Number(spec.partnerBonusId)) return false;
          return true;
        }).map(([key, spec]) => `${key} → ${spec.partnerBonusId ?? 'eksik'}`);
        if (invalidRules.length > 0) {
          return reply.status(422).send({
            HasError: true,
            AlertMessage: `Aktif Lynon kataloğunda bulunmayan Partner Bonus ID: ${invalidRules.join(', ')}`,
          });
        }
      }
      await saveRules(tenantKey, request.body);
      await refreshRules(tenantKey);
      return reply.send({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kurallar kaydedilemedi';
      return reply.status(/Partner Bonus ID/i.test(message) ? 422 : 500).send({
        HasError: true,
        AlertMessage: message,
      });
    }
  });

  // --- Promo Overrides (Admin) ---
  fastify.get('/admin/promos/overrides', async (request: any, reply) => {
    try {
      const tenantKey = await getTenantKeyForAdmin(request);
      const data = await getPromoOverrides(tenantKey);
      return reply.send({ ok: true, data });
    } catch (err) {
      return reply.status(500).send({ ok: false, message: 'Overrides okunamadı' });
    }
  });

  fastify.post<{
    Body: { externalId: number; override: { title?: string; image?: string; detailHtml?: string } | null };
  }>('/admin/promos/overrides', async (request: any, reply) => {
    try {
      const tenantKey = await getTenantKeyForAdmin(request);
      const externalId = Number(request.body?.externalId);
      if (!Number.isFinite(externalId) || externalId <= 0) {
        return reply.status(400).send({ ok: false, message: 'externalId gerekli' });
      }
      const override = request.body?.override ?? null;
      await setPromoOverride(tenantKey, externalId, override);
      return reply.send({ ok: true });
    } catch (err) {
      return reply.status(500).send({ ok: false, message: 'Overrides kaydedilemedi' });
    }
  });


  fastify.get('/admin/live-alerts', async (request, reply) => {
    try {
      const boToken = getBackofficeToken();
      if (!boToken) return reply.status(401).send({ HasError: true, AlertMessage: 'Backoffice token eksik' });

      const txData = await fetchBackofficeClientTransactions(config.clientTransactionsApi, boToken, {
        MaxRows: 300,
        SkeepRows: 0,
        IsOrderedDesc: true
      });

      const transactions = (txData?.Data?.Objects ?? []) as any[];
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const report = analyzeTransactionAnomalies(transactions, {
        from: yesterday.toISOString(),
        to: now.toISOString()
      });

      return reply.send(report);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ HasError: true, AlertMessage: 'Anomali tespiti başarısız' });
    }
  });


  // --- INTELLIGENCE ENDPOINTS ---

  fastify.get('/admin/intelligence/clusters', async (request, reply) => {
    const token = getBackofficeToken();
    if (!token) return reply.status(401).send({ HasError: true, AlertMessage: 'No token' });
    try {
      const res = await fetch(`${config.clientsApi.baseUrl}/${config.clientsApi.path}`, {
        method: 'POST',
        headers: { ...BACKOFFICE_HEADERS, authentication: token.trim(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ MaxRows: 500, SkeepRows: 0, OrderedItem: 1, IsOrderedDesc: true })
      });
      const data = await res.json() as any;
      if (!data?.Data?.Objects) return reply.send({ HasError: false, clusters: [] });
      const clusters = await identifyMultiAccountClusters(data.Data.Objects);
      return reply.send({ HasError: false, clusters });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ HasError: true, AlertMessage: 'Cluster analizi başarısız' });
    }
  });

  fastify.get<{ Params: { clientId: string } }>(
    '/admin/intelligence/scorecard/:clientId',
    async (request, reply) => {
      const clientId = Number(request.params.clientId);
      const token = getBackofficeToken();
      if (!token) return reply.status(401).send({ HasError: true, AlertMessage: 'No token' });
      try {
        const snapshot = await buildAccountSnapshotFromClientId(clientId, config, token);
        const scorecard = calculateTrustScore(snapshot);
        return reply.send({ HasError: false, scorecard });
      } catch (err) {
        request.log.error({ err, clientId }, 'Scorecard error');
        return reply.status(500).send({ HasError: true, AlertMessage: 'Oyuncu karnesi oluşturulamadı' });
      }
    }
  );

  fastify.get<{ Params: { login: string } }>(
    '/admin/intelligence/scorecard-by-login/:login',
    async (request, reply) => {
      const login = request.params.login;
      const token = getBackofficeToken();
      if (!token) return reply.status(401).send({ HasError: true, AlertMessage: 'No token' });
      try {
        const res = await fetch(`${config.clientsApi.baseUrl}/${config.clientsApi.path}`, {
          method: 'POST',
          headers: { ...BACKOFFICE_HEADERS, authentication: token.trim(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ MaxRows: 1, SkeepRows: 0, Login: login })
        });
        const data = await res.json() as any;
        const client = data?.Data?.Objects?.[0];
        if (!client) return reply.status(404).send({ HasError: true, AlertMessage: 'Kullanıcı bulunamadı' });
        const clientId = Number(client.Id);
        const snapshot = await buildAccountSnapshotFromClientId(clientId, config, token);
        const scorecard = calculateTrustScore(snapshot);
        return reply.send({ HasError: false, scorecard });
      } catch (err) {
        request.log.error({ err, login }, 'Scorecard by login error');
        return reply.status(500).send({ HasError: true, AlertMessage: 'Kullanıcı analizi başarısız' });
      }
    }
  );

  fastify.post('/admin/intelligence/business-insights', async (request, reply) => {
    const dbToken = getDashboardToken();
    if (!dbToken) return reply.status(401).send({ HasError: true, AlertMessage: 'No token' });
    const { startDate, endDate } = (request.body as any) || {};

    try {
      const summaryPrefix = api.dashboardPathPrefix ?? 'api/tr/Dashboard';
      const profitPrefix = api.partnerProfitPathPrefix ?? summaryPrefix;

      const [summaryRes, profitRes] = await Promise.all([
        fetch(`${api.baseUrl.replace(/\/$/, '')}/${summaryPrefix.replace(/^\//, '')}/GetSummary?startDate=${startDate}&endDate=${endDate}`, {
          headers: { ...DASHBOARD_HEADERS, authentication: dbToken.trim(), 'Content-Type': 'application/json' }
        }),
        fetch(`${api.baseUrl.replace(/\/$/, '')}/${profitPrefix.replace(/^\//, '')}/GetPartnerProfit?startDate=${startDate}&endDate=${endDate}`, {
          headers: { ...DASHBOARD_HEADERS, authentication: dbToken.trim(), 'Content-Type': 'application/json' }
        })
      ]);

      const [summaryData, profitData] = await Promise.all([summaryRes.json(), profitRes.json()]);

      const result = generateBusinessInsights(summaryData as any, profitData as any);
      return reply.send({ HasError: false, ...result });
    } catch (err) {
      request.log.error(err, 'Business insights error');
      return reply.status(500).send({ HasError: true, AlertMessage: 'İşletme analizi raporu oluşturulamadı' });
    }
  });

  fastify.post<{ Body: { phones: string[]; text: string } }>(
    '/sms/send',
    {
      schema: {
        body: {
          type: 'object',
          required: ['phones', 'text'],
          properties: {
            phones: { type: 'array', items: { type: 'string' } },
            text: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      // @ts-ignore
      return proxySmsSend(request, reply, config.sms);
    }
  );

  /** Public: Turnuva Liderlik Tablosu Verisi */
  /**
   * Istemcinin gonderdigi tarihi rapor penceresine cevirir.
   *
   * TournamentLeaderboardPage "DD-MM-YY" gonderiyor (eski backoffice ucunun
   * bekledigi bicim). Rapor ISO an istiyor. Iki bicimi de kabul ediyoruz;
   * cozulemezse son 24 saate duseriz — bos sayfa gostermektense guncel
   * pencere daha yararli.
   */
  function turnuvaTarihi(value: unknown, gunSonu: boolean): Date | null {
    const text = String(value ?? '').trim();
    if (!text) return null;

    const ddmmyy = /^(\d{2})-(\d{2})-(\d{2})$/.exec(text);
    if (ddmmyy) {
      const [, dd, mm, yy] = ddmmyy;
      // Turkiye saatiyle gun siniri; rapor UTC istiyor (+03:00).
      const saat = gunSonu ? '23:59:59.999' : '00:00:00.000';
      const parsed = new Date(`20${yy}-${mm}-${dd}T${saat}+03:00`);
      return Number.isFinite(parsed.getTime()) ? parsed : null;
    }

    const parsed = new Date(text);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  function turnuvaAraligi(body: Record<string, unknown>): { from: Date; to: Date } {
    const to = turnuvaTarihi(body.ToDate, true) ?? new Date();
    const from = turnuvaTarihi(body.FromDate, false) ?? new Date(to.getTime() - 24 * 60 * 60 * 1000);
    // Ters aralik gelirse rapor bos doner; duzelt.
    return from <= to ? { from, to } : { from: to, to: from };
  }

  /** Eski ucun OrderKey degerlerini rapor metriklerine esler. */
  function turnuvaMetrigi(orderKey: unknown): SiralamaMetrigi {
    const key = String(orderKey ?? '').trim().toLowerCase();
    if (key === 'depositamount') return 'yatirimTutari';
    if (key === 'profit' || key === 'ggr') return 'ggr';
    if (key === 'casinobetamount') return 'casinoBahis';
    if (key === 'sportbetamount') return 'sporBahis';
    return 'bahisTutari';
  }

  /**
   * Turnuva siralamasi.
   *
   * Birincil kaynak Players Overview raporu (1841): TEK istekte site
   * genelini, istenen pencereye gore filtrelenmis olarak donuyor. Eski
   * backoffice ucu yalnizca yedek — Lynon yapilandirili degilse ya da
   * rapor okunamazsa devreye giriyor.
   *
   * Cevap sekli KORUNDU (Result.ReportByTResultViewModel): uc turnuva
   * sayfasi da bu alani okuyor, istemci degistirmeye gerek kalmasin.
   */
  fastify.post('/tournament/leaderboard', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;

    if (isLynonConfigured()) {
      try {
        const { from, to } = turnuvaAraligi(body);
        const metrik = turnuvaMetrigi(body.OrderKey);
        const limit = Number(body.Take ?? 20);
        const satirlar = await oyuncuRaporu(from, to, String(body.CurrencyId ?? config.lynon.currency));
        const sirali = siralamaOlustur(satirlar, metrik, Number.isFinite(limit) && limit > 0 ? limit : 20);
        const indeks = new Map(satirlar.map((satir) => [satir.login, satir]));

        return reply.send({
          Result: {
            ReportByTResultViewModel: sirali.map((kayit) => {
              const satir = indeks.get(kayit.login);
              return {
                PlayerId: Number(kayit.playerId) || 0,
                UserName: kayit.login,
                Name: kayit.adSoyad,
                BetAmount: satir?.donem.bahisTutari ?? 0,
                WinAmount: satir?.donem.kazancTutari ?? 0,
                // Oyuncunun kari = kazanc - bahis. Rapordaki GGR kasa
                // tarafindan bakiyor (bahis - kazanc), isareti ters.
                Profit: (satir?.donem.kazancTutari ?? 0) - (satir?.donem.bahisTutari ?? 0),
                Round: 0,
              };
            }),
          },
          kaynak: 'players-overview-1841',
        });
      } catch (err) {
        request.log.warn({ err }, 'Turnuva sıralaması rapordan üretilemedi; eski uca düşülüyor.');
      }
    }

    return proxyTournamentReportPost(request as FastifyRequest<{ Body?: Record<string, unknown> }>, reply, config.tournamentReportApi, getBackofficeToken());
  });

  /**
   * Turnuva ayarlarini getir.
   *
   * Okuma mantigi turnuvaAyarService'e tasindi: oyuncuya acik uc de ayni
   * ayarlari okuyor, iki kopya birinin varsayilani degisince sessizce
   * ayrisirdi.
   */
  fastify.get('/admin/tournaments/settings', async (request: any, reply) => {
    const user = request.session?.user;
    if (!user) return reply.status(401).send({ error: 'Oturum açın' });
    try {
      return reply.send(await readTournamentSettings(await resolveTenantKeyForRequest(request)));
    } catch {
      return reply.status(500).send({ error: 'Ayarlar okunamadı' });
    }
  });

  fastify.post('/admin/tournaments/settings', async (request: any, reply) => {
    const user = request.session?.user;
    if (user?.role !== 'admin') return reply.status(403).send({ error: 'Yetkisiz' });
    try {
      await writeTournamentSettings(await resolveTenantKeyForRequest(request), request.body);
      return reply.send({ ok: true });
    } catch {
      return reply.status(500).send({ error: 'Kaydedilemedi' });
    }
  });
  return void 0;
}

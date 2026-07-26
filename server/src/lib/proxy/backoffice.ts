/**
 * Backoffice API Proxy Fonksiyonları
 * backofficewebadmin.betconstruct.com üzerinden backoffice POST/GET istekleri.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../../config.js';
import { httpRequest, backofficeHeaders, UNAUTHORIZED_HINT, FORBIDDEN_HINT } from '../httpClient.js';

const CIRCUIT_KEY = 'backofficewebadmin.betconstruct.com';

// ─── Generic Backoffice POST Proxy ──────────────────────────────────────────

async function genericBackofficePost(
  request: FastifyRequest<{ Body?: Record<string, unknown> }>,
  reply: FastifyReply,
  apiConfig: { baseUrl: string; path: string },
  authToken: string,
  logLabel: string,
  opts?: { timeoutMs?: number }
): Promise<FastifyReply | void> {
  if (!authToken) {
    return reply.status(401).send({ HasError: true, AlertMessage: 'AUTH_TOKEN .env içinde tanımlı değil' });
  }
  const url = `${apiConfig.baseUrl.replace(/\/$/, '')}/${apiConfig.path.replace(/^\//, '')}`;

  const result = await httpRequest(url, {
    method: 'POST',
    body: request.body ?? {},
    headers: backofficeHeaders(authToken),
    timeoutMs: opts?.timeoutMs ?? 15_000,
    maxRetries: 2,
    circuitKey: CIRCUIT_KEY,
  });

  if (!result.ok) {
    const msg = (result.data?.AlertMessage as string) || (result.data?.ErrorDescription as string) || `API ${result.status}`;
    const hint = result.status === 401 ? UNAUTHORIZED_HINT : result.status === 403 ? FORBIDDEN_HINT : '';
    request.log.error({ url, status: result.status, retries: result.retries }, `${logLabel} error`);
    return reply.status(result.status).send({ HasError: true, AlertMessage: msg + hint, ...result.data });
  }
  return reply.send(result.data);
}

// ─── Bonus API (rgs-webadminapi) ─────────────────────────────────────────────

const RGS_CIRCUIT_KEY = 'rgs-webadminapi.betconstruct.com';

/** POST Bonus API: GetBonusDefinitions */
export async function proxyBonusPost(
  request: FastifyRequest<{ Body?: Record<string, unknown> }>,
  reply: FastifyReply,
  bonusApi: Config['bonusApi'],
  authToken: string
): Promise<FastifyReply | void> {
  if (!authToken) {
    return reply.status(401).send({ HasError: true, AlertMessage: 'AUTH_TOKEN .env içinde tanımlı değil' });
  }
  const url = `${bonusApi.baseUrl.replace(/\/$/, '')}/${bonusApi.path.replace(/^\//, '')}`;

  const result = await httpRequest(url, {
    method: 'POST',
    body: request.body ?? {},
    headers: backofficeHeaders(authToken),
    timeoutMs: 15_000,
    maxRetries: 2,
    circuitKey: RGS_CIRCUIT_KEY,
  });

  if (!result.ok) {
    const msg = (result.data?.ErrorDescription as string) || (result.data?.AlertMessage as string) || `API ${result.status}`;
    return reply.status(result.status).send({
      HasError: true,
      ErrorDescription: result.status === 401 ? msg + UNAUTHORIZED_HINT : msg,
      ...result.data,
    });
  }
  return reply.send(result.data);
}

/** POST FreeBet API: GetFreeBetBonusesByFilter */
export async function proxyFreeBetPost(
  request: FastifyRequest<{ Body?: Record<string, unknown> }>,
  reply: FastifyReply,
  freebetApi: Config['freebetApi'],
  authToken: string
): Promise<FastifyReply | void> {
  return genericBackofficePost(request, reply, freebetApi, authToken, 'FreeBet API');
}

// ─── Client Yönetimi ─────────────────────────────────────────────────────────

/** POST GetClients */
export async function proxyClientsPost(
  request: FastifyRequest<{ Body?: Record<string, unknown> }>,
  reply: FastifyReply,
  clientsApi: Config['clientsApi'],
  authToken: string
): Promise<FastifyReply | void> {
  return genericBackofficePost(request, reply, clientsApi, authToken, 'Clients API', { timeoutMs: 30_000 });
}

/** POST GetClientsByIPAddress */
export async function proxyClientsByIP(
  request: FastifyRequest<{ Body?: Record<string, unknown> }>,
  reply: FastifyReply,
  clientsByIPApi: Config['clientsByIPApi'],
  authToken: string
): Promise<FastifyReply | void> {
  if (!authToken) {
    return reply.status(401).send({ HasError: true, AlertMessage: 'AUTH_TOKEN .env içinde tanımlı değil' });
  }
  const url = `${clientsByIPApi.baseUrl.replace(/\/$/, '')}/${clientsByIPApi.path.replace(/^\//, '')}`;
  request.log.info({ url }, 'Calling ClientsByIP API');

  const result = await httpRequest(url, {
    method: 'POST',
    body: request.body ?? {},
    headers: backofficeHeaders(authToken),
    timeoutMs: 30_000,
    maxRetries: 2,
    circuitKey: CIRCUIT_KEY,
  });

  if (!result.ok) {
    const msg = (result.data?.AlertMessage as string) || `API ${result.status}`;
    return reply.status(result.status).send({ HasError: true, AlertMessage: msg + (result.status === 401 ? UNAUTHORIZED_HINT : ''), ...result.data });
  }
  return reply.send(result.data);
}

/** GET Client KPI: GetClientKpi?id=... */
export async function proxyClientKpi(
  request: FastifyRequest<{ Querystring: { id: string } }>,
  reply: FastifyReply,
  clientKpiApi: Config['clientKpiApi'],
  authToken: string
): Promise<FastifyReply | void> {
  if (!authToken) {
    return reply.status(401).send({ HasError: true, AlertMessage: 'AUTH_TOKEN .env içinde tanımlı değil' });
  }
  const id = request.query.id;
  if (!id) return reply.status(400).send({ HasError: true, AlertMessage: 'Müşteri ID gerekli' });

  const url = `${clientKpiApi.baseUrl}/${clientKpiApi.path}?id=${id}`;
  const result = await httpRequest(url, {
    method: 'GET',
    headers: backofficeHeaders(authToken),
    timeoutMs: 15_000,
    maxRetries: 2,
    circuitKey: CIRCUIT_KEY,
  });

  if (!result.ok) {
    const msg = (result.data?.AlertMessage as string) || `API ${result.status}`;
    return reply.status(result.status).send({ HasError: true, AlertMessage: msg + (result.status === 401 ? UNAUTHORIZED_HINT : ''), ...result.data });
  }
  return reply.send(result.data);
}

/** POST Client Notes: GetClientNotes */
export async function proxyClientNotes(
  request: FastifyRequest<{ Body?: Record<string, unknown> }>,
  reply: FastifyReply,
  clientNoteApi: Config['clientNoteApi'],
  authToken: string
): Promise<FastifyReply | void> {
  return genericBackofficePost(request, reply, clientNoteApi, authToken, 'ClientNotes');
}

/** POST Client Bonuses: GetClientBonuses */
export async function proxyClientBonuses(
  request: FastifyRequest<{ Body?: Record<string, unknown> }>,
  reply: FastifyReply,
  clientBonusesApi: Config['clientBonusesApi'],
  authToken: string
): Promise<FastifyReply | void> {
  return genericBackofficePost(request, reply, clientBonusesApi, authToken, 'ClientBonuses');
}

/** POST Client Transactions: GetDocumentsWithPaging */
export async function proxyClientTransactions(
  request: FastifyRequest<{ Body?: Record<string, unknown> }>,
  reply: FastifyReply,
  clientTransactionsApi: Config['clientTransactionsApi'],
  authToken: string
): Promise<FastifyReply | void> {
  return genericBackofficePost(request, reply, clientTransactionsApi, authToken, 'ClientTransactions');
}

/** Backoffice'den işlem listesi çeker (analitik/anomali için). */
export async function fetchBackofficeClientTransactions(
  clientTransactionsApi: Config['clientTransactionsApi'],
  authToken: string,
  body: Record<string, unknown>
): Promise<{ Data?: { Objects?: unknown[]; Count?: number }; HasError?: boolean; AlertMessage?: string }> {
  if (!authToken) return { HasError: true, AlertMessage: 'AUTH_TOKEN yok' };

  const url = `${clientTransactionsApi.baseUrl.replace(/\/$/, '')}/${clientTransactionsApi.path.replace(/^\//, '')}`;
  const result = await httpRequest(url, {
    method: 'POST',
    body,
    headers: backofficeHeaders(authToken),
    timeoutMs: 20_000,
    maxRetries: 2,
    circuitKey: CIRCUIT_KEY,
  });

  if (!result.ok) {
    return { HasError: true, AlertMessage: (result.data?.AlertMessage as string) || `API ${result.status}` };
  }
  return result.data as { Data?: { Objects?: unknown[]; Count?: number } };
}

// ─── Çekim / Yatırım ────────────────────────────────────────────────────────

/** POST Withdrawal: GetClientWithdrawalRequestsWithTotals */
export async function proxyWithdrawalPost(
  request: FastifyRequest<{ Body?: Record<string, unknown> }>,
  reply: FastifyReply,
  withdrawalApi: Config['withdrawalApi'],
  authToken: string
): Promise<FastifyReply | void> {
  if (!authToken) {
    return reply.status(401).send({ HasError: true, AlertMessage: 'AUTH_TOKEN .env içinde tanımlı değil' });
  }
  const url = `${withdrawalApi.baseUrl.replace(/\/$/, '')}/${withdrawalApi.path.replace(/^\//, '')}`;

  const result = await httpRequest(url, {
    method: 'POST',
    body: request.body ?? {},
    headers: backofficeHeaders(authToken),
    timeoutMs: 30_000,
    maxRetries: 2,
    circuitKey: CIRCUIT_KEY,
  });

  if (!result.ok) {
    const msg = (result.data?.AlertMessage as string) || `API ${result.status}`;
    const hint = result.status === 401 ? UNAUTHORIZED_HINT : result.status === 403 ? FORBIDDEN_HINT : '';
    return reply.status(result.status).send({ HasError: true, AlertMessage: msg + hint, ...result.data });
  }
  return reply.send(result.data);
}

/** POST Deposits: GetDepositsWithdrawalsWithPaging */
export async function proxyDepositsPost(
  request: FastifyRequest<{ Body?: Record<string, unknown> }>,
  reply: FastifyReply,
  depositsApi: Config['depositsApi'],
  authToken: string
): Promise<FastifyReply | void> {
  return genericBackofficePost(request, reply, depositsApi, authToken, 'Deposits API', { timeoutMs: 30_000 });
}

// ─── Rapor ───────────────────────────────────────────────────────────────────

/** POST Registration Stats */
export async function proxyRegistrationStats(
  request: FastifyRequest<{ Body?: Record<string, unknown> }>,
  reply: FastifyReply,
  regStatsApi: { baseUrl: string; path: string },
  authToken: string
): Promise<FastifyReply | void> {
  return genericBackofficePost(request, reply, regStatsApi, authToken, 'RegistrationStats', { timeoutMs: 30_000 });
}

/** POST Bet Report: GetBetReport */
export async function proxyBetReportPost(
  request: FastifyRequest<{ Body?: Record<string, unknown> }>,
  reply: FastifyReply,
  betReportApi: Config['betReportApi'],
  authToken: string
): Promise<FastifyReply | void> {
  return genericBackofficePost(request, reply, betReportApi, authToken, 'BetReport', { timeoutMs: 30_000 });
}

/** POST Bet Selections: GetBetSelections */
export async function proxyBetSelectionsPost(
  request: FastifyRequest<{ Body?: Record<string, unknown> }>,
  reply: FastifyReply,
  betSelectionsApi: Config['betSelectionsApi'],
  authToken: string
): Promise<FastifyReply | void> {
  return genericBackofficePost(request, reply, betSelectionsApi, authToken, 'BetSelections');
}

/** POST Detailed Report: GetClientTurnoverReportWithActiveBonus */
export async function proxyDetailedReport(
  request: FastifyRequest<{ Body?: Record<string, unknown> }>,
  reply: FastifyReply,
  detailedReportApi: Config['detailedReportApi'],
  authToken: string
): Promise<FastifyReply | void> {
  return genericBackofficePost(request, reply, detailedReportApi, authToken, 'DetailedReport', { timeoutMs: 30_000 });
}

/** POST Client Turnovers: GetClientTurnoversPaging */
export async function proxyClientTurnoversPaging(
  request: FastifyRequest<{ Body?: Record<string, unknown> }>,
  reply: FastifyReply,
  clientTurnoversApi: Config['clientTurnoversApi'],
  authToken: string
): Promise<FastifyReply | void> {
  return genericBackofficePost(request, reply, clientTurnoversApi, authToken, 'ClientTurnovers', { timeoutMs: 30_000 });
}

/** POST Tournament Report */
export async function proxyTournamentReportPost(
  request: FastifyRequest<{ Body?: Record<string, unknown> }>,
  reply: FastifyReply,
  tournamentReportApi: Config['tournamentReportApi'],
  authToken: string
): Promise<FastifyReply | void> {
  return genericBackofficePost(request, reply, tournamentReportApi, authToken, 'TournamentReport', { timeoutMs: 30_000 });
}

// ─── İşlem API'leri ──────────────────────────────────────────────────────────

/** POST Bonus Charge: AddClientToBonus */
export async function proxyChargeBonus(
  request: FastifyRequest<{ Body: { ClientId: number; BonusId: number; Amount?: number } }>,
  reply: FastifyReply,
  bonusApi: Config['bonusApi'],
  authToken: string
): Promise<FastifyReply | void> {
  if (!authToken) {
    return reply.status(401).send({ HasError: true, AlertMessage: 'AUTH_TOKEN .env içinde tanımlı değil' });
  }
  const { ClientId, BonusId, Amount = 0 } = request.body;
  if (!ClientId || !BonusId) {
    return reply.status(400).send({ HasError: true, AlertMessage: 'ClientId ve BonusId gerekli' });
  }

  const url = 'https://backofficewebadmin.betconstruct.com/api/tr/Client/AddClientToBonus';
  request.log.info({ url, ClientId, BonusId, Amount }, 'Charging bonus');

  const result = await httpRequest(url, {
    method: 'POST',
    body: {
      ClientId: Number(ClientId),
      PartnerBonusId: Number(BonusId),
      Amount: Number(Amount || 0),
      MessageChannel: null,
      MessageSubject: null,
      MessageContent: null,
    },
    headers: backofficeHeaders(authToken),
    timeoutMs: 15_000,
    maxRetries: 1, // Bonus charge'da fazla retry tehlikeli
    circuitKey: CIRCUIT_KEY,
  });

  if (!result.ok) {
    const msg = (result.data?.AlertMessage as string) || (result.data?.ErrorDescription as string) || `API ${result.status}`;
    return reply.status(result.status).send({ HasError: true, AlertMessage: msg + (result.status === 401 ? UNAUTHORIZED_HINT : ''), ...result.data });
  }
  return reply.send(result.data);
}

/** POST Manual Adjustment: CreateClientPaymentDocument */
export async function proxyManualAdjustment(
  request: FastifyRequest<{ Body: { ClientId: number; Amount: number; Info?: string; DocTypeInt?: number } }>,
  reply: FastifyReply,
  authToken: string
): Promise<FastifyReply | void> {
  if (!authToken) {
    return reply.status(401).send({ HasError: true, AlertMessage: 'AUTH_TOKEN bulunamadı' });
  }
  const { ClientId, Amount, Info = 'Manual Adjustment', DocTypeInt = 3 } = request.body;

  const url = 'https://backofficewebadmin.betconstruct.com/api/tr/Client/CreateClientPaymentDocument';
  const result = await httpRequest(url, {
    method: 'POST',
    body: {
      ClientId: Number(ClientId),
      CurrencyId: 'TRY',
      DocTypeInt: Number(DocTypeInt),
      PaymentSystemId: null,
      Amount: String(Amount),
      Info: String(Info),
    },
    headers: backofficeHeaders(authToken),
    timeoutMs: 15_000,
    maxRetries: 0, // Nakit ekleme retry yapılmamalı
    circuitKey: CIRCUIT_KEY,
  });

  if (!result.ok) {
    const msg = (result.data?.AlertMessage as string) || `API ${result.status}`;
    return reply.status(result.status).send({ HasError: true, AlertMessage: msg, ...result.data });
  }
  return reply.send(result.data);
}

/** POST GetPartnerBonuses */
export async function proxyGetPartnerBonuses(
  request: FastifyRequest,
  reply: FastifyReply,
  authToken: string
): Promise<FastifyReply | void> {
  if (!authToken) {
    return reply.status(401).send({ HasError: true, AlertMessage: 'No token' });
  }

  const bodyObj = (request.body as Record<string, unknown>) || {};
  const finalBody = {
    PartnerId: bodyObj.PartnerId || 18773823,
    IsBonusDetailsIncluded: bodyObj.IsBonusDetailsIncluded !== undefined ? bodyObj.IsBonusDetailsIncluded : true,
    IsDeleted: bodyObj.IsDeleted !== undefined ? bodyObj.IsDeleted : false,
    IsDisabled: bodyObj.IsDisabled !== undefined ? bodyObj.IsDisabled : false,
  };

  const url = 'https://backofficewebadmin.betconstruct.com/api/tr/Client/GetPartnerBonuses';
  console.log(`[proxy] GetPartnerBonuses isteği:`, finalBody);

  const result = await httpRequest(url, {
    method: 'POST',
    body: finalBody,
    headers: backofficeHeaders(authToken),
    timeoutMs: 15_000,
    maxRetries: 2,
    circuitKey: CIRCUIT_KEY,
  });

  if (!result.ok) {
    return reply.status(502).send({ HasError: true, AlertMessage: (result.data?.AlertMessage as string) || 'API isteği başarısız' });
  }
  console.log(`[proxy] GetPartnerBonuses yanıt:`, { HasError: result.data?.HasError, Count: (result.data?.Data as unknown[])?.length });
  return reply.send(result.data);
}

// ─── SMS ─────────────────────────────────────────────────────────────────────

/** Sempico SMS Gönderim Proxy */
/** Sempico API'ye tek bir SMS gönderir. Hem route handler'lar hem background job'lar tarafından kullanılır. */
export async function sendSmsMessage(
  phone: string,
  text: string,
  smsConfig: { token: string; senderId: string; apiUrl: string }
): Promise<{ ok: boolean; data?: string; message?: string }> {
  if (!smsConfig.token) return { ok: false, message: 'SEMPICO_TOKEN eksik.' };

  const q = new URLSearchParams({
    token: smsConfig.token,
    number: phone.replace(/\D/g, ''),
    senderID: smsConfig.senderId,
    text,
  }).toString();

  const url = `${smsConfig.apiUrl}?${q}`;
  console.log(`[sms] Gönderiliyor: ${url.replace(smsConfig.token, '***')}`);

  try {
    const response = await fetch(url);
    const data = await response.text();
    console.log(`[sms] Yanıt [${response.status}]:`, data);
    return response.ok ? { ok: true, data } : { ok: false, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[sms] Hata (${phone}):`, message);
    return { ok: false, message };
  }
}

export async function proxySmsSend(
  request: FastifyRequest<{ Body: { phones: string[]; text: string } }>,
  reply: FastifyReply,
  smsConfig: { token: string; senderId: string; apiUrl: string }
): Promise<FastifyReply | void> {
  const { phones, text } = request.body;

  if (!smsConfig.token) {
    return reply.status(401).send({ success: false, sentCount: 0, errorCount: phones.length, AlertMessage: 'SEMPICO_TOKEN eksik.' });
  }

  const results: { phone: string; status: string; data?: string }[] = [];
  const errors: { phone: string; status: string; data?: string; message?: string }[] = [];

  for (const phone of phones) {
    const result = await sendSmsMessage(phone, text, smsConfig);
    if (result.ok) {
      results.push({ phone, status: 'success', data: result.data });
    } else {
      errors.push({ phone, status: 'error', data: result.data, message: result.message });
    }
  }

  return reply.send({
    success: errors.length === 0,
    sentCount: results.length,
    errorCount: errors.length,
    results,
  });
}

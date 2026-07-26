/**
 * Dashboard API Proxy Fonksiyonları
 * dashboardapi.betconstruct.com üzerinden Dashboard GET/POST istekleri.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../../config.js';
import { getDashboardToken } from '../authStore.js';
import { httpRequest, dashboardHeaders, DASHBOARD_HEADERS, UNAUTHORIZED_HINT } from '../httpClient.js';

/** Dashboard API'ye GET proxy — GetSummary, GetPartnerProfit vb. */
export async function proxyDashboard(
  request: FastifyRequest,
  reply: FastifyReply,
  pathAndQuery: string,
  api: Config['api']
): Promise<FastifyReply | void> {
  const authToken = getDashboardToken();
  if (!authToken) {
    return reply.send({
      HasError: true,
      AlertMessage: 'AUTH_TOKEN .env içinde tanımlı değil.',
      _hint: 'Bu 401 sunucudan (token okunamadı). .env yolu için başlangıç loglarına bakın.',
    });
  }

  const prefix = (api as { dashboardPathPrefix?: string }).dashboardPathPrefix ?? 'api/tr/Dashboard';
  const pathPrefix = prefix.replace(/^\//, '');
  const url = `${api.baseUrl.replace(/\/$/, '')}/${pathPrefix}/${pathAndQuery}`;

  const result = await httpRequest(url, {
    method: 'GET',
    headers: dashboardHeaders(authToken),
    timeoutMs: api.timeoutMs,
    maxRetries: 2,
    circuitKey: 'dashboardapi.betconstruct.com',
  });

  if (!result.ok) {
    if (result.status === 401) {
      request.log.warn({ url, tokenLength: authToken.length }, 'Dashboard API 401');
    }
    const apiMessage = (result.data?.AlertMessage as string) || (result.data?.Message as string) || `API ${result.status}`;
    const hint = result.status === 401 ? UNAUTHORIZED_HINT : '';
    const response = {
      HasError: true,
      AlertMessage: apiMessage + hint,
      ...result.data,
    };
    return result.status === 401 ? reply.send(response) : reply.status(result.status).send(response);
  }

  return reply.send(result.data);
}

/** Belirtilen tam URL'e POST atar. */
export async function proxyPostToUrl(
  request: FastifyRequest,
  reply: FastifyReply,
  fullUrl: string,
  api: Config['api'],
  body: Record<string, string>
): Promise<FastifyReply | void> {
  const authToken = getDashboardToken();
  if (!authToken) {
    return reply.send({ HasError: true, AlertMessage: 'AUTH_TOKEN .env içinde tanımlı değil.' });
  }

  const result = await httpRequest(fullUrl.trim(), {
    method: 'POST',
    body,
    headers: dashboardHeaders(authToken),
    timeoutMs: api.timeoutMs,
    maxRetries: 2,
    circuitKey: 'dashboardapi.betconstruct.com',
  });

  if (!result.ok) {
    const msg = (result.data?.AlertMessage as string) || (result.data?.Message as string) || `API ${result.status}`;
    const response = { HasError: true, AlertMessage: msg, ...result.data };
    return result.status === 401 ? reply.send(response) : reply.status(result.status).send(response);
  }
  return reply.send(result.data);
}

/** Dashboard API'ye POST proxy — GetPartnerProfit vb. */
export async function proxyDashboardPost(
  request: FastifyRequest,
  reply: FastifyReply,
  pathOnly: string,
  api: Config['api'],
  body: Record<string, string>,
  pathPrefixOverride?: string
): Promise<FastifyReply | void> {
  const authToken = getDashboardToken();
  if (!authToken) {
    return reply.send({ HasError: true, AlertMessage: 'AUTH_TOKEN .env içinde tanımlı değil.' });
  }
  const prefix = pathPrefixOverride ?? (api as { dashboardPathPrefix?: string }).dashboardPathPrefix ?? 'api/tr/Dashboard';
  const pathPrefix = prefix.replace(/^\//, '');
  const url = `${api.baseUrl.replace(/\/$/, '')}/${pathPrefix}/${pathOnly.replace(/^\//, '')}`;

  const result = await httpRequest(url, {
    method: 'POST',
    body,
    headers: dashboardHeaders(authToken),
    timeoutMs: api.timeoutMs,
    maxRetries: 2,
    circuitKey: 'dashboardapi.betconstruct.com',
  });

  if (!result.ok) {
    const msg = (result.data?.AlertMessage as string) || (result.data?.Message as string) || `API ${result.status}`;
    const response = { HasError: true, AlertMessage: msg, ...result.data };
    return result.status === 401 ? reply.send(response) : reply.status(result.status).send(response);
  }
  return reply.send(result.data);
}

/** BetConstruct'ta Dashboard dışındaki bir path'e proxy. */
export async function proxyToPath(
  request: FastifyRequest,
  reply: FastifyReply,
  path: string,
  api: Config['api']
): Promise<FastifyReply | void> {
  if (!api.authToken) {
    return reply.send({ HasError: true, AlertMessage: 'AUTH_TOKEN .env içinde tanımlı değil' });
  }
  const base = api.baseUrl.replace(/\/$/, '');
  const url = path.startsWith('http') ? path : `${base}/${path.replace(/^\//, '')}`;

  const result = await httpRequest(url, {
    method: 'GET',
    headers: { ...DASHBOARD_HEADERS, authentication: api.authToken },
    timeoutMs: api.timeoutMs,
    maxRetries: 2,
    circuitKey: new URL(url).hostname,
  });

  if (!result.ok) {
    const msg = (result.data?.ErrorDescription as string) || (result.data?.AlertMessage as string) || `API ${result.status}`;
    const response = { HasError: true, AlertMessage: msg, ...result.data };
    return result.status === 401 ? reply.send(response) : reply.status(result.status).send(response);
  }
  return reply.send(result.data);
}

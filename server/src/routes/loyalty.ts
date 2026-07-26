import type { FastifyInstance } from 'fastify';
import { getLoyaltyService } from '../services/loyaltyService.js';
import { resolveTenantKeyForRequest } from '../lib/tenant.js';

export async function loyaltyRoutes(fastify: FastifyInstance) {
  fastify.get('/loyalty/status', async (request: any, reply) => {
    const username = request.session?.bonusPanelUser?.login || request.session?.user?.username;
    if (!username) return reply.status(401).send({ error: 'Oturum açılmadı' });

    const tenantKey = await resolveTenantKeyForRequest(request);
    const service = getLoyaltyService(tenantKey);
    const authToken = request.session?.bonusPanelUser?.token || request.session?.user?.authToken;

    await service.recordLogin(username);

    if (authToken) {
      return service.syncPointsFromWager(username, authToken);
    }

    return await service.getPlayerStatus(username);
  });

  fastify.get('/loyalty/market', async (request: any) => {
    const tenantKey = await resolveTenantKeyForRequest(request);
    return await getLoyaltyService(tenantKey).getMarket();
  });

  fastify.post<{ Body: { itemId: string } }>('/loyalty/market/buy', async (request: any, reply) => {
    const username = request.session?.bonusPanelUser?.login || request.session?.user?.username;
    if (!username) return reply.status(401).send({ error: 'Oturum açılmadı' });

    const tenantKey = await resolveTenantKeyForRequest(request);
    const { itemId } = request.body;
    try {
      const result = await getLoyaltyService(tenantKey).buyItem(username, itemId);
      return { ok: true, ...result };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post<{ Body: { market: any[]; wagerToPointRatio: number } }>('/admin/loyalty/config', async (request: any, reply) => {
    if (request.session?.user?.role !== 'admin') return reply.status(403).send({ error: 'Yetkisiz' });
    const tenantKey = await resolveTenantKeyForRequest(request);
    const { market, wagerToPointRatio } = request.body;
    await getLoyaltyService(tenantKey).updateConfig(market, wagerToPointRatio);
    return { ok: true };
  });

  fastify.post<{ Body: { username: string; amount: number } }>('/admin/loyalty/add-xp', async (request: any, reply) => {
    if (request.session?.user?.role !== 'admin') return reply.status(403).send({ error: 'Yetkisiz' });
    const tenantKey = await resolveTenantKeyForRequest(request);
    const { username, amount } = request.body;
    return await getLoyaltyService(tenantKey).addXp(username, amount);
  });
}

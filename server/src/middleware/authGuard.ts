import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { SessionUser, BonusPanelUser } from '../types/betconstruct.js';

/** Ana panel giriş ekranını ve session kontrolünü devre dışı bırakır. */
export function isPanelAuthDisabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    String(process.env.PANEL_AUTH_DISABLED || '').trim().toLowerCase()
  );
}

export function getBypassUser(): SessionUser {
  return { username: 'local-panel', role: 'admin' };
}

/**
 * Korunan rotalar için kimlik doğrulama middleware'i.
 * Login, logout, me, health ve diğer açık rotalar atlanır.
 */

/** Auth gerektirmeyen rotaların tam listesi. */
const PUBLIC_EXACT_PATHS = new Set([
  '/api/login',
  '/api/logout',
  '/api/me',
  '/api/tenant-info',
  '/api/health',
  '/api/bonus-panel/login',
  '/api/bonus-panel/me',
  '/api/bonus-panel/logout',
  '/api/promos/list',
  '/api/promos/auto',
  '/api/bonuses',
  '/api/freebet-bonuses',
]);

/** Auth gerektirmeyen rota ön ekleri. */
const PUBLIC_PREFIXES = [
  '/api/loyalty',
  '/api/games',
  '/api/forms',
  '/api/master',
];

/** Bonus panel API'leri — admin veya bonus panel girişi yeterli. */
const BONUS_PANEL_PATHS = new Set([
  '/api/admin/bonus/check-player',
  '/api/admin/bonus/charge',
]);

function isPublicPath(path: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(path)) return true;
  if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
  if (!path.startsWith('/api')) return true;
  return false;
}

export function registerAuthMiddleware(app: FastifyInstance): void {
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url?.split('?')[0] ?? '';

    if (isPublicPath(path)) return;

    const session = (request as any).session;
    let user = session?.user as SessionUser | undefined;
    const bonusPanelUser = session?.bonusPanelUser as BonusPanelUser | undefined;

    if (isPanelAuthDisabled()) {
      user = user || getBypassUser();
      if (session) session.user = user;
    }

    // Bonus panel API'leri: admin veya bonus panel girişi yeterli
    if (BONUS_PANEL_PATHS.has(path) && (user || bonusPanelUser)) {
      return;
    }

    if (!user) {
      if (path.startsWith('/api')) {
        console.warn(`[auth] Yetkisiz erişim denemesi: ${request.url} - BonusPanelUser: ${bonusPanelUser?.login || 'YOK'}`);
        return reply.status(401).send({ HasError: true, AlertMessage: 'Oturum süreniz dolmuş.' });
      }
      return;
    }
  });
}

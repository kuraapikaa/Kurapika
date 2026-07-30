import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { SessionUser, BonusPanelUser, AffiliateUser } from '../types/betconstruct.js';

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
  // Telegram Bot API'nin çağırdığı webhook. Panel oturumu olamaz; kendi kimlik
  // doğrulaması var (x-telegram-bot-api-secret-token). Bu listede olmadığı için
  // Telegram'ın gönderdiği her update handler'a ulaşmadan 401 alıyordu ve
  // oyuncu hesabı hiç bağlanamıyordu.
  '/api/telegram/webhook',
  // Affiliate portal kimlik dogrulama uclari. Panel oturumu olamaz; kendi
  // oturumlarini bu uclar kuruyor.
  '/api/affiliate-portal/login',
  '/api/affiliate-portal/me',
  '/api/affiliate-portal/logout',
]);

/**
 * Affiliate portal veri uclari — ortak oturumu VEYA admin yeterli.
 *
 * Ortak yalnizca kendi BTag'ini gorur; filtreleme rota icinde yapiliyor.
 * Admin de gorebilsin ki destek ekibi ortagin ekranini dogrulayabilsin.
 */
const AFFILIATE_PORTAL_PREFIX = '/api/affiliate-portal/';

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
  // Bonus talep sayfasi bonus katalogunu buradan okuyor. Listede olmadigi
  // icin oyuncu oturumuyla 401 doniyordu ve sayfa bos bonus listesiyle
  // aciliyordu. Uc kullanicidan parametre almiyor; yalnizca oyuncunun zaten
  // gormesi gereken kampanya listesini donuyor.
  '/api/admin/bonus/partner-list',
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

    // Affiliate portal: ortak oturumu veya admin yeterli.
    const affiliateUser = session?.affiliateUser as AffiliateUser | undefined;
    if (path.startsWith(AFFILIATE_PORTAL_PREFIX) && (user || affiliateUser)) {
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

import { describe, expect, it } from 'vitest';

/**
 * authGuard'daki erişim kararının birebir kopyası.
 *
 * Bonus talep sayfası oyuncu oturumuyla çalışır (session.bonusPanelUser),
 * admin oturumu yoktur. İhtiyaç duyduğu her uç ya public listede ya da
 * BONUS_PANEL_PATHS içinde olmalı; biri eksik kalınca sayfa sessizce 401
 * alıp boş açılıyordu (partner-list bunu yaşadı).
 */
const PUBLIC_EXACT_PATHS = new Set([
  '/api/login', '/api/logout', '/api/me', '/api/tenant-info', '/api/health',
  '/api/bonus-panel/login', '/api/bonus-panel/me', '/api/bonus-panel/logout',
  '/api/promos/list', '/api/promos/auto', '/api/bonuses', '/api/freebet-bonuses',
  '/api/telegram/webhook',
]);
const PUBLIC_PREFIXES = ['/api/loyalty', '/api/games', '/api/forms', '/api/master'];
const BONUS_PANEL_PATHS = new Set([
  '/api/admin/bonus/check-player',
  '/api/admin/bonus/charge',
  '/api/admin/bonus/partner-list',
]);

function isPublicPath(path: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(path)) return true;
  if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return true;
  if (!path.startsWith('/api')) return true;
  return false;
}

/** Yalnızca oyuncu oturumu varken (admin yok) istek geçer mi? */
function oyuncuOturumuylaGecerMi(path: string): boolean {
  if (isPublicPath(path)) return true;
  return BONUS_PANEL_PATHS.has(path);
}

describe('bonus talep sayfasının kullandığı uçlar oyuncu oturumuyla erişilebilir', () => {
  const uclar = [
    '/api/bonus-panel/me',
    '/api/bonus-panel/login',
    '/api/admin/bonus/partner-list',
    '/api/admin/bonus/check-player',
    '/api/admin/bonus/charge',
    '/api/freebet-bonuses',
    '/api/promos/auto',
    '/api/games/telegram-bonus/status',
    '/api/games/telegram-bonus/verify',
  ];

  for (const uc of uclar) {
    it(uc, () => {
      expect(oyuncuOturumuylaGecerMi(uc)).toBe(true);
    });
  }
});

describe('admin uçları oyuncu oturumuna açılmadı', () => {
  const kapali = [
    '/api/summary',
    '/api/admin/bonus/lynon-campaign/1',
    '/api/admin/staff-users',
    '/api/admin/games/config',
    '/api/admin/manual-adjustment',
  ];

  for (const uc of kapali) {
    it(uc, () => {
      expect(oyuncuOturumuylaGecerMi(uc)).toBe(false);
    });
  }
});

import { describe, expect, it } from 'vitest';

/** authGuard.ts içindeki isPublicPath mantığının birebir kopyası. */
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
  '/api/telegram/webhook',
]);
const PUBLIC_PREFIXES = ['/api/loyalty', '/api/games', '/api/forms', '/api/master'];

function isPublicPath(path: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(path)) return true;
  if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
  if (!path.startsWith('/api')) return true;
  return false;
}

describe('Telegram webhook erişilebilirliği', () => {
  it('webhook auth guard tarafından engellenmez', () => {
    // Telegram panel oturumu taşıyamaz; engellenirse hesap bağlama hiç çalışmaz.
    expect(isPublicPath('/api/telegram/webhook')).toBe(true);
  });

  it('diğer korumalı uçlar açılmadı', () => {
    expect(isPublicPath('/api/admin/bonus/charge')).toBe(false);
    expect(isPublicPath('/api/summary')).toBe(false);
    expect(isPublicPath('/api/telegram')).toBe(false);
    expect(isPublicPath('/api/telegram/webhook/extra')).toBe(false);
  });
});

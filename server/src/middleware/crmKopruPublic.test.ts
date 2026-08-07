import { describe, expect, it } from 'vitest';
import { isPublicPath } from './authGuard.js';

/**
 * Gerçek `isPublicPath`'i çağırıyor, kopyasını değil.
 *
 * Köprü uçları merge edildiğinde bu listeye eklenmemişti: kendi X-CRM-Key
 * kontrolleri hiç çalışmadan, panel oturumu arayan guard tarafından 401
 * alıyorlardı. Dışarıdan bakınca "anahtar yanlış" gibi görünüyordu.
 */
describe('CRM köprüsü erişilebilirliği', () => {
  it('köprü uçları auth guard tarafından engellenmez', () => {
    expect(isPublicPath('/api/crm/players/lookup')).toBe(true);
    expect(isPublicPath('/api/crm/players/123/kpi')).toBe(true);
    expect(isPublicPath('/api/crm/bonus-definitions')).toBe(true);
    expect(isPublicPath('/api/crm/players/123/bonus')).toBe(true);
  });

  it('muafiyet yalnızca köprü ön ekini kapsar', () => {
    // Guard'ı geçmek, kimlik doğrulaması olmadığı anlamına gelmiyor: köprü
    // kendi paylaşılan sırrını kontrol ediyor. Ama muafiyetin komşu yollara
    // taşmaması gerekiyor.
    expect(isPublicPath('/api/crmb/players')).toBe(false);
    expect(isPublicPath('/api/summary')).toBe(false);
    expect(isPublicPath('/api/admin/bonus/charge')).toBe(false);
  });
});

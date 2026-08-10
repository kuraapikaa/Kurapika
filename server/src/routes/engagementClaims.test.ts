import { describe, expect, it, vi } from 'vitest';

/**
 * KAZI KAZAN "TEK YATIRIM = TEK HAK" KURALININ KALICILIĞI.
 *
 * Bildirilen vaka: oyuncular tek bir yatırımla kazı kazanı sınırsız
 * oynayabiliyordu. Kural (`yatirimHakki.ts`) kendisi doğruydu, ama
 * `writeEngagementClaims`, `readEngagementClaims`'e eklenen `scratch`
 * alanını yazarken UNUTULMUŞTU (bkz. a48aef5) — her yazım o alanı
 * sessizce atıyordu, bir sonraki okuma hep boş dönüyordu, "kullanılmış"
 * kaydı hiçbir zaman kalıcı olmuyordu.
 *
 * documentStore'u bellekte taklit ediyoruz: testin diske dokunması
 * gerekmiyor, yalnızca yaz-sonra-oku davranışını doğruluyoruz.
 */

const bellek = new Map<string, unknown>();

vi.mock('../lib/documentStore.js', () => ({
  readStoredDocument: async ({ namespace, tenantKey, fallback }: any) => {
    const anahtar = `${tenantKey}:${namespace}`;
    return bellek.has(anahtar) ? bellek.get(anahtar) : (typeof fallback === 'function' ? fallback() : fallback);
  },
  writeStoredDocument: async ({ namespace, tenantKey }: any, data: unknown) => {
    bellek.set(`${tenantKey}:${namespace}`, data);
  },
}));

const { readEngagementClaims, writeEngagementClaims } = await import('./games.js');

describe('readEngagementClaims / writeEngagementClaims', () => {
  it('scratch kaydı yazıldıktan sonra AYNEN geri okunur', async () => {
    const tenant = `test-${Math.random().toString(36).slice(2)}`;
    const claims = await readEngagementClaims(tenant);
    expect(claims.scratch).toEqual([]);

    claims.scratch.push({ id: 'dep-1-123', username: 'oyuncu1', depositId: 'dep-1', oyun: 'kazikazan', status: 'granted' });
    await writeEngagementClaims(claims, tenant);

    // BILDIRILEN HATANIN BIREBIR SINAMASI: yazimdan SONRAKI okuma scratch'i
    // BOS DONDURSEYDI, yatirimHakki hicbir zaman "kullanilmis" gormez ve
    // ayni yatirimla sinirsiz oynanabilirdi.
    const tekrarOkunan = await readEngagementClaims(tenant);
    expect(tekrarOkunan.scratch).toEqual([
      { id: 'dep-1-123', username: 'oyuncu1', depositId: 'dep-1', oyun: 'kazikazan', status: 'granted' },
    ]);
  });

  it('daily ve battlePass da scratch ile birlikte korunur', async () => {
    const tenant = `test-${Math.random().toString(36).slice(2)}`;
    const claims = await readEngagementClaims(tenant);
    claims.daily.push({ username: 'oyuncu2', dateKey: '2026-08-10' });
    claims.battlePass.push({ username: 'oyuncu2', level: 3 });
    claims.scratch.push({ id: 'dep-2-1', username: 'oyuncu2', depositId: 'dep-2', oyun: 'kazikazan', status: 'granted' });
    await writeEngagementClaims(claims, tenant);

    const tekrarOkunan = await readEngagementClaims(tenant);
    expect(tekrarOkunan.daily).toHaveLength(1);
    expect(tekrarOkunan.battlePass).toHaveLength(1);
    expect(tekrarOkunan.scratch).toHaveLength(1);
  });

  it('kiracılar birbirinin scratch kaydını görmez', async () => {
    const a = `test-${Math.random().toString(36).slice(2)}`;
    const b = `test-${Math.random().toString(36).slice(2)}`;
    const claimsA = await readEngagementClaims(a);
    claimsA.scratch.push({ id: 'x', username: 'oyuncu3', depositId: 'dep-x', oyun: 'kazikazan', status: 'granted' });
    await writeEngagementClaims(claimsA, a);

    const claimsB = await readEngagementClaims(b);
    expect(claimsB.scratch).toEqual([]);
  });
});

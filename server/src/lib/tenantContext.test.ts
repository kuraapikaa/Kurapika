import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { currentTenantKey, runWithTenant, safeTenantKey, tenantBaglamiVarMi } from './tenantContext.js';

describe('tenantContext', () => {
  describe('safeTenantKey', () => {
    it('bos degeri varsayilana cevirir', () => {
      expect(safeTenantKey('')).toBe('default');
    });

    /** Kimlik dosya adi ve veritabani anahtari olarak kullaniliyor. */
    it('yol ayraclarini temizler', () => {
      expect(safeTenantKey('../../etc/passwd')).toBe('______etc_passwd');
      expect(safeTenantKey('a/b')).toBe('a_b');
    });

    it('gecerli kimligi degistirmez', () => {
      expect(safeTenantKey('9f1c-4a2b_XY')).toBe('9f1c-4a2b_XY');
    });
  });

  describe('baglam', () => {
    it('baglam disinda varsayilana duser', () => {
      expect(tenantBaglamiVarMi()).toBe(false);
      expect(currentTenantKey()).toBe('default');
    });

    it('ic ice cagride en icteki kazanir', () => {
      runWithTenant('dis', () => {
        expect(currentTenantKey()).toBe('dis');
        runWithTenant('ic', () => expect(currentTenantKey()).toBe('ic'));
        expect(currentTenantKey()).toBe('dis');
      });
    });

    /**
     * Bagimsizligin ISPATI.
     *
     * Panelin cok kiracili calismasi tamamen buna dayaniyor: iki istek
     * ayni anda islenirken birinin tenant'i digerine SIZMAMALI. Sizsaydi
     * A sitesinin Lynon oturumuyla B sitesinin oyuncusuna bonus
     * yazilabilirdi.
     */
    it('es zamanli akislar birbirine sizmaz', async () => {
      const gorulen: string[] = [];
      const akis = (key: string, gecikme: number) =>
        runWithTenant(key, async () => {
          await new Promise((resolve) => setTimeout(resolve, gecikme));
          gorulen.push(`${key}=${currentTenantKey()}`);
          return currentTenantKey();
        });

      const sonuc = await Promise.all([akis('site-a', 30), akis('site-b', 5), akis('site-c', 15)]);
      expect(sonuc).toEqual(['site-a', 'site-b', 'site-c']);
      expect(gorulen.sort()).toEqual(['site-a=site-a', 'site-b=site-b', 'site-c=site-c']);
    });
  });

  /**
   * KANCA BICIMI KRITIK.
   *
   * Baglam `preHandler` kancasinda CALLBACK bicimiyle kuruluyor:
   * `runWithTenant(key, () => done())`. Kanca `async` yazilsaydi
   * `AsyncLocalStorage` bagi kanca doner donmez kapanir ve rota
   * isleyicisi varsayilan tenant'i gorurdu — panel tek siteli gibi
   * calismaya devam eder, hata da vermezdi. Bu test o bicimi kilitler.
   */
  describe('fastify istek bagi', () => {
    it('bagi rota isleyicisine ve await sonrasina tasir', async () => {
      const app = Fastify();
      app.addHook('preHandler', (request, _reply, done) => {
        const key = String((request.query as Record<string, string>)?.site ?? 'default');
        runWithTenant(key, () => done());
      });
      app.get('/kim', async () => {
        const oncesi = currentTenantKey();
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { oncesi, sonrasi: currentTenantKey() };
      });

      const [a, b] = await Promise.all([
        app.inject({ method: 'GET', url: '/kim?site=site-a' }),
        app.inject({ method: 'GET', url: '/kim?site=site-b' }),
      ]);

      expect(a.json()).toEqual({ oncesi: 'site-a', sonrasi: 'site-a' });
      expect(b.json()).toEqual({ oncesi: 'site-b', sonrasi: 'site-b' });
      await app.close();
    });
  });
});

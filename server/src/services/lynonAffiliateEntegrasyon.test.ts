import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Lynon third-party affiliate katalogu ve bizim entegrasyonumuzla
 * eslesmesi.
 *
 * Katalogdaki veri gercek bir yakalamadan geliyor:
 *   GET https://backoffice.narcosbahis.com/api/partner/api/v1.0/affiliates
 * (referrer: /websites/137/third-party-integrations/affiliates)
 *
 * Kritik nokta: `affnook` tipinin istedigi anahtarlar
 * (ApiKey, ProductId, EndpointUrl) bu depodaki BugsCRM yapilandirmasiyla
 * BIREBIR ayni. Eslesme ADA gore degil ANAHTAR KUMESINE gore
 * hesaplaniyor; Lynon tarafinda ad degisse bile entegrasyon sekli ayni
 * kalir.
 */

const KATALOG = [
  { id: 6, type: 'affiliateSystem777Mates', name: '777Mates', description: 'Affiliate Service 777 Mates', iconUrl: 'http://777Mates.com', configKeys: ['SkinId', 'CallbackUrl', 'SecretKey', 'PaymentId'] },
  { id: 5, type: 'affnook', name: 'Affnook', description: 'Affnook Description', iconUrl: 'https://affnookicon.url', configKeys: ['ApiKey', 'ProductId', 'EndpointUrl'] },
  { id: 4, type: 'tap', name: 'Tap', description: 'Tap Description', iconUrl: 'https://tapicon.url', configKeys: ['ApiKey', 'BrandId', 'EndpointUrl'] },
  { id: 3, type: 'map', name: 'Map', description: 'Map Description', iconUrl: 'https://map.example/logo.png', configKeys: ['ApiKey', 'ApiSecret', 'MaxDelaySeconds', 'PostBackUrl'] },
  { id: 2, type: 'everyMatrix', name: 'EveryMatrix', description: 'EveryMatrix affilate', iconUrl: '', configKeys: [] },
  { id: 1, type: 'affilka', name: 'Affilka', description: 'Slotgrator affilate', iconUrl: '', configKeys: [] },
];

const bugscrm = { enabled: true, apiKey: '', productId: '', endpointUrl: '', webhookSecret: '', timeoutMs: 15000 };

vi.mock('../config.js', () => ({ config: { get bugscrm() { return bugscrm; } } }));
vi.mock('../lib/tenantRuntimeConfig.js', () => ({
  lynonCfg: () => ({ siteId: 137, backofficeBaseUrl: 'https://backoffice.narcosbahis.com' }),
}));
const lynonRequest = vi.fn();
vi.mock('../lib/lynonAuth.js', () => ({ lynonRequest: (...a: unknown[]) => lynonRequest(...a) }));

async function modul() {
  vi.resetModules();
  return import('./lynonAffiliateEntegrasyon.js');
}

describe('lynon affiliate entegrasyonu', () => {
  beforeEach(() => {
    lynonRequest.mockReset();
    lynonRequest.mockResolvedValue(KATALOG);
    Object.assign(bugscrm, { apiKey: '', productId: '', endpointUrl: '', webhookSecret: '' });
  });
  afterEach(() => vi.restoreAllMocks());

  it('katalogu gozlenen uctan okur', async () => {
    const m = await modul();
    const liste = await m.lynonAffiliateSaglayicilari();
    expect(lynonRequest).toHaveBeenCalledWith('api/partner/api/v1.0/affiliates', { method: 'GET' });
    expect(liste).toHaveLength(6);
    expect(liste.find((s) => s.type === 'affnook')?.configKeys).toEqual(['ApiKey', 'ProductId', 'EndpointUrl']);
  });

  it('Result sarmalayicisini da kabul eder', async () => {
    lynonRequest.mockResolvedValue({ Result: KATALOG });
    const m = await modul();
    expect(await m.lynonAffiliateSaglayicilari()).toHaveLength(6);
  });

  it('tipsiz satirlari eler', async () => {
    lynonRequest.mockResolvedValue([...KATALOG, null, {}, { id: 9 }]);
    const m = await modul();
    expect(await m.lynonAffiliateSaglayicilari()).toHaveLength(6);
  });

  describe('bizim entegrasyonumuzla eslesme', () => {
    it('affnook tipini onerir', async () => {
      const m = await modul();
      const durum = await m.affiliateEntegrasyonDurumu('https://panel.ornek.com');
      expect(durum.onerilenTip).toBe('affnook');
    });

    /** Ayni anahtarlardan birini paylassalar bile kume ayni degilse eslesmez. */
    it('benzer ama farkli anahtar kumesini eslestirmez', async () => {
      const m = await modul();
      const durum = await m.affiliateEntegrasyonDurumu('https://panel.ornek.com');
      const tap = durum.saglayicilar.find((s) => s.saglayici.type === 'tap');
      // Tap da ApiKey ve EndpointUrl istiyor ama BrandId istiyor; bizde yok.
      expect(tap?.bizimkiyleEslesiyor).toBe(false);
    });

    it('anahtar istemeyen saglayicilari eslestirmez', async () => {
      const m = await modul();
      const durum = await m.affiliateEntegrasyonDurumu('https://panel.ornek.com');
      expect(durum.saglayicilar.find((s) => s.saglayici.type === 'affilka')?.bizimkiyleEslesiyor).toBe(false);
      expect(durum.saglayicilar.find((s) => s.saglayici.type === 'everyMatrix')?.bizimkiyleEslesiyor).toBe(false);
    });

    it('hangi anahtarlarin dolu oldugunu ayirt eder', async () => {
      Object.assign(bugscrm, { apiKey: 'K', productId: '' , endpointUrl: 'https://u' });
      const m = await modul();
      const durum = await m.affiliateEntegrasyonDurumu('https://panel.ornek.com');
      const affnook = durum.saglayicilar.find((s) => s.saglayici.type === 'affnook');
      expect(affnook?.hazirAnahtarlar.sort()).toEqual(['ApiKey', 'EndpointUrl']);
      expect(affnook?.eksikAnahtarlar).toEqual(['ProductId']);
    });
  });

  describe('kurulum bilgileri', () => {
    it('backoffice ekraninin adresini site kimligiyle uretir', async () => {
      const m = await modul();
      const durum = await m.affiliateEntegrasyonDurumu('https://panel.ornek.com');
      expect(durum.siteId).toBe(137);
      expect(durum.backofficeEkraniUrl).toBe(
        'https://backoffice.narcosbahis.com/websites/137/third-party-integrations/affiliates',
      );
    });

    it('Lynon a verilecek postback adresini panelin kendi adresinden uretir', async () => {
      const m = await modul();
      const durum = await m.affiliateEntegrasyonDurumu('https://panel.ornek.com/');
      expect(durum.postbackUcumuz).toBe('https://panel.ornek.com/api/bugscrm/postback');
    });

    /**
     * Postback ucu paylasilan sir olmadan 503 donuyor. Adresi Lynon'a
     * vermeden once bunun acik oldugu bilinmeli; yoksa entegrasyon
     * "kurulmus" gorunur ama tek bir olay bile islenmez.
     */
    it('paylasilan sir yoksa postback hazir degil der', async () => {
      const m = await modul();
      expect((await m.affiliateEntegrasyonDurumu('https://p.com')).postbackHazir).toBe(false);
    });

    it('paylasilan sir varsa postback hazir der', async () => {
      Object.assign(bugscrm, { webhookSecret: 'sir' });
      const m = await modul();
      expect((await m.affiliateEntegrasyonDurumu('https://p.com')).postbackHazir).toBe(true);
    });
  });
});

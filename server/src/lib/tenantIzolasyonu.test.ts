import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantConnection } from '../repositories/tenantConnectionRepository.js';

/**
 * ALT SITE ANA SITENIN KIMLIK BILGILERINI DEVRALMAMALI.
 *
 * Cok kiracilikta duzeltilen en pahali hata. `tenantRuntimeConfig`
 * kayitta olmayan HER alani ortam degiskenine dusuruyordu; kaydi hic
 * olmayan bir tenant da tamamen ENV'e dusuyordu. Sonuc: master panelden
 * yeni bir site olusturmak -- baglantisi hic girilmeden -- o siteye ANA
 * SITENIN Lynon kullanici adini, parolasini, TOTP sirrini ve site
 * kimligini veriyordu. Panel sorunsuz aciliyor, alt sitenin ekraninda
 * ana sitenin oyunculari ve cekim talepleri gorunuyordu; hata da
 * vermiyordu.
 *
 * `config.js` TAKLIT EDILIYOR. Gercek modul ice aktarilirken depodaki
 * `.env` dosyasini `override: true` ile yukluyor; testin kurdugu ortam
 * degiskenleri eziliyor ve sonuc gelistiricinin makinesindeki .env'e
 * gore degisiyordu.
 */

const ANA_SITE = {
  enabled: true,
  backofficeBaseUrl: 'https://backoffice.anasite.com',
  idBaseUrl: 'https://id.anasite.com',
  returnUrl: 'https://backoffice.anasite.com/',
  siteId: 137,
  currency: 'TRY',
  username: 'ana-site-kullanici',
  password: 'ana-site-parola',
  otpSecret: 'ANASITETOTPSECRET',
  otpToken: '',
  deviceFingerprint: '',
  trustDevice: false,
  otpAlgorithm: 'SHA1',
  otpDigits: 6,
  otpPeriodSeconds: 30,
  sessionTtlMs: 1_500_000,
  timeoutMs: 15000,
};

vi.mock('../config.js', () => ({
  config: {
    lynon: ANA_SITE,
    api: { authToken: 'ana-dashboard-token', backofficeAuthToken: 'ana-backoffice-token' },
  },
}));

// Tenant listesi diske/veritabanina gitmesin.
vi.mock('../repositories/tenantRepository.js', () => ({ loadTenants: async () => [] }));
vi.mock('../repositories/tenantConnectionRepository.js', () => ({
  bosBaglanti: () => ({ version: 1, lynon: {}, backoffice: {} }),
  loadTenantConnection: async () => ({ version: 1, lynon: {}, backoffice: {} }),
  saveTenantConnection: async () => undefined,
}));

const ONCEKI_TENANT_KEY = process.env.TENANT_KEY;

async function tazeModul() {
  vi.resetModules();
  return import('./tenantRuntimeConfig.js');
}

const baglanti = (lynon: TenantConnection['lynon']): TenantConnection => ({ version: 1, lynon, backoffice: {} });

describe('tenant izolasyonu', () => {
  beforeEach(() => { process.env.TENANT_KEY = 'default'; });
  afterEach(() => {
    if (ONCEKI_TENANT_KEY === undefined) delete process.env.TENANT_KEY;
    else process.env.TENANT_KEY = ONCEKI_TENANT_KEY;
  });

  it('varsayilan site ENV kimlik bilgilerini kullanir', async () => {
    const mod = await tazeModul();
    const cfg = mod.lynonCfg('default');
    expect(cfg.username).toBe('ana-site-kullanici');
    expect(cfg.siteId).toBe(137);
    expect(cfg.enabled).toBe(true);
    expect(mod.tenantBaglantisiKurulduMu('default')).toBe(true);
  });

  /** Duzeltilen acigin ta kendisi. */
  it('kaydi olmayan alt site ENV kimlik bilgilerini DEVRALMAZ', async () => {
    const mod = await tazeModul();
    await mod.ensureTenantRuntime('yeni-site');

    const cfg = mod.lynonCfg('yeni-site');
    expect(cfg.username).toBe('');
    expect(cfg.password).toBe('');
    expect(cfg.otpSecret).toBe('');
    expect(cfg.otpToken).toBe('');
    expect(cfg.enabled).toBe(false);
    // Ana sitenin site kimligine istek atmak da sizma sayilir.
    expect(cfg.siteId).not.toBe(137);
    expect(cfg.backofficeBaseUrl).not.toContain('anasite');
    expect(mod.tenantBaglantisiKurulduMu('yeni-site')).toBe(false);
  });

  it('kaydi olmayan alt site paylasilan backoffice token alamaz', async () => {
    const mod = await tazeModul();
    await mod.ensureTenantRuntime('yeni-site');

    expect(mod.backofficeCfg('default').authToken).toBe('ana-backoffice-token');
    expect(mod.backofficeCfg('default').dashboardAuthToken).toBe('ana-dashboard-token');
    expect(mod.backofficeCfg('yeni-site').authToken).toBe('');
    expect(mod.backofficeCfg('yeni-site').dashboardAuthToken).toBe('');
  });

  it('kendi kimligi girilen alt site calisir ve sir olmayan ayarlari ENV den alir', async () => {
    const mod = await tazeModul();
    mod.tenantRuntimeYaz('alt-site', baglanti({
      username: 'alt-kullanici',
      password: 'alt-parola',
      otpSecret: 'ALTTOTP',
      siteId: 999,
      backofficeBaseUrl: 'https://backoffice.altsite.com',
    }));

    const cfg = mod.lynonCfg('alt-site');
    expect(cfg.username).toBe('alt-kullanici');
    expect(cfg.siteId).toBe(999);
    expect(cfg.enabled).toBe(true);
    // Siteye ozel OLMAYAN ayarlar ENV'den gelmeye devam eder.
    expect(cfg.otpDigits).toBe(6);
    expect(cfg.timeoutMs).toBe(15000);
    // Giris akisi kendi backoffice'ine donmeli, ENV'dekine degil.
    expect(cfg.returnUrl).toBe('https://backoffice.altsite.com/');
    expect(mod.tenantBaglantisiKurulduMu('alt-site')).toBe(true);
  });

  it('yalnizca adres girilmis alt site hala yapilandirilmamis sayilir', async () => {
    const mod = await tazeModul();
    // Adres var ama giris bilgisi yok: bu siteyle oturum acilamaz.
    mod.tenantRuntimeYaz('yarim-site', baglanti({
      backofficeBaseUrl: 'https://backoffice.yarim.com',
      siteId: 500,
    }));

    const cfg = mod.lynonCfg('yarim-site');
    expect(cfg.username).toBe('');
    expect(cfg.enabled).toBe(false);
    // Girilen adres korunur ki panel "eksik" diyebilsin; ama ENV'deki
    // ana site adresine DE dusmez.
    expect(cfg.backofficeBaseUrl).toBe('https://backoffice.yarim.com');
    expect(mod.tenantBaglantisiKurulduMu('yarim-site')).toBe(false);
  });

  it('parola girilmis ama kullanici adi eksikse yine de kendi baglantisi sayilir', async () => {
    // Eksik alan ENV'den TAMAMLANMAZ; site "kurulmus" sayilir ama giris
    // basarisiz olur ve panelde gorunur bir hata verir. Sessizce ana
    // sitenin kullanici adiyla giris denemekten iyidir.
    const mod = await tazeModul();
    mod.tenantRuntimeYaz('eksik-site', baglanti({ password: 'sadece-parola' }));

    const cfg = mod.lynonCfg('eksik-site');
    expect(cfg.password).toBe('sadece-parola');
    expect(cfg.username).toBe('ana-site-kullanici');
    expect(mod.tenantBaglantisiKurulduMu('eksik-site')).toBe(true);
  });
});

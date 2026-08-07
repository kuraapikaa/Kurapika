import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { anahtarParmakIzi, coz, maskele, sifrele, sifrelemeHazirMi, sifreliMi } from './secretBox.js';

const ONCEKI = process.env.TENANT_SECRET_KEY;
const ANAHTAR = 'a'.repeat(64); // 32 bayt hex

describe('secretBox', () => {
  beforeEach(() => { process.env.TENANT_SECRET_KEY = ANAHTAR; });
  afterEach(() => {
    if (ONCEKI === undefined) delete process.env.TENANT_SECRET_KEY;
    else process.env.TENANT_SECRET_KEY = ONCEKI;
  });

  it('sifreleyip geri cozer', () => {
    const sir = 'Lynon-panel-parolasi-2026!';
    const kutu = sifrele(sir);
    expect(kutu).not.toContain(sir);
    expect(sifreliMi(kutu)).toBe(true);
    expect(coz(kutu)).toBe(sir);
  });

  it('ayni girdi her seferinde farkli sifreli metin uretir', () => {
    // Sabit IV, ayni parolayi kullanan iki siteyi kayittan taninir yapardi.
    expect(sifrele('ayni')).not.toBe(sifrele('ayni'));
  });

  it('turkce karakterleri bozmadan tasir', () => {
    expect(coz(sifrele('şifreÇĞİÖÜ'))).toBe('şifreÇĞİÖÜ');
  });

  /**
   * Anahtar yoksa YAZMA REDDEDILIR.
   *
   * Sessizce duz metne dusmek, bu ozelligi eklemenin en kotu yolu
   * olurdu: panel "kaydedildi" derken parolalar okunabilir dururdu.
   */
  it('anahtar yokken sifrelemeyi reddeder', () => {
    delete process.env.TENANT_SECRET_KEY;
    expect(sifrelemeHazirMi()).toBe(false);
    expect(() => sifrele('sir')).toThrow(/TENANT_SECRET_KEY/);
  });

  it('cok kisa parolayi anahtar saymaz', () => {
    process.env.TENANT_SECRET_KEY = '1234';
    expect(sifrelemeHazirMi()).toBe(false);
  });

  it('yeterince uzun serbest metin parolayi kabul eder', () => {
    process.env.TENANT_SECRET_KEY = 'yeterince-uzun-bir-parola';
    expect(sifrelemeHazirMi()).toBe(true);
    expect(coz(sifrele('sir'))).toBe('sir');
  });

  /**
   * Anahtar dondurulunce eski kayitlar cozulemez. Firlatmak yerine null
   * donuyoruz: tum paneli 500'le dusurmek yerine o sitenin baglantisi
   * "yapilandirilmamis" sayilir ve yeniden girilmesi istenir.
   */
  it('yanlis anahtarla cozemez ama firlatmaz', () => {
    const kutu = sifrele('sir');
    process.env.TENANT_SECRET_KEY = 'b'.repeat(64);
    expect(coz(kutu)).toBeNull();
  });

  it('bozulmus sifreli metni reddeder', () => {
    const kutu = sifrele('sir');
    expect(coz(`${kutu}XX`)).toBeNull();
    expect(coz('v1.gcm.bozuk')).toBeNull();
    expect(coz('duz metin')).toBeNull();
  });

  it('anahtar parmak izi anahtarla degisir', () => {
    const ilk = anahtarParmakIzi();
    process.env.TENANT_SECRET_KEY = 'b'.repeat(64);
    expect(anahtarParmakIzi()).not.toBe(ilk);
  });

  describe('maskele', () => {
    it('yalnizca son iki karakteri gosterir', () => {
      expect(maskele('sifre1234')).toBe('••••••••34');
    });

    it('kisa degeri tamamen gizler', () => {
      expect(maskele('ab')).toBe('••••');
    });

    it('bos degeri bos birakir', () => {
      expect(maskele('')).toBe('');
      expect(maskele(undefined)).toBe('');
      expect(maskele(null)).toBe('');
    });
  });
});

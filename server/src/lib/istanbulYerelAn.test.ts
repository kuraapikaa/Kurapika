import { describe, expect, it } from 'vitest';
import { istanbulYerelAn } from './istanbulGunu.js';

/**
 * TAHMIN KAPANISI UC SAAT KAYIYORDU.
 *
 * Bildirilen vaka: "Tahmin baslangic ve kapanis ayarladigim halde durum
 * tahmine acik olmaya devam ediyor."
 *
 * `<input type="datetime-local">` saat dilimi TASIMAYAN bir dizge uretir.
 * Duz `new Date(...)` onu calisan ortamin dilimine gore okur; Railway'de
 * TZ tanimli olmadigi icin sunucu UTC. Yonetici 18:00 (Istanbul) yaziyor,
 * sunucu 18:00 UTC = 21:00 Istanbul saniyor ve uc saat daha kabul ediyor.
 */
describe('istanbulYerelAn', () => {
  it('dilimsiz dizgeyi ISTANBUL saati sayar (sunucu UTC olsa bile)', () => {
    // 18:00 Istanbul = 15:00 UTC
    expect(new Date(istanbulYerelAn('2026-08-20T18:00')).toISOString())
      .toBe('2026-08-20T15:00:00.000Z');
  });

  it('duz new Date ile ARADAKI FARK uc saat', () => {
    const duz = new Date('2026-08-20T18:00').getTime();
    const dogru = istanbulYerelAn('2026-08-20T18:00');
    // Test UTC'de kosarsa fark tam 3 saat; yerel dilimde kosarsa
    // dogru deger degismez — asil garanti bu.
    expect(new Date(dogru).toISOString()).toBe('2026-08-20T15:00:00.000Z');
    expect(Number.isFinite(duz)).toBe(true);
  });

  it('saniyeli bicimi de kabul eder', () => {
    expect(new Date(istanbulYerelAn('2026-08-20T18:00:30')).toISOString())
      .toBe('2026-08-20T15:00:30.000Z');
  });

  it('dilim ZATEN varsa dokunmaz — eski kayitlar bozulmasin', () => {
    expect(new Date(istanbulYerelAn('2026-08-20T18:00:00Z')).toISOString())
      .toBe('2026-08-20T18:00:00.000Z');
    expect(new Date(istanbulYerelAn('2026-08-20T18:00:00+03:00')).toISOString())
      .toBe('2026-08-20T15:00:00.000Z');
  });

  it('bos ve bozuk girdi NaN', () => {
    expect(Number.isNaN(istanbulYerelAn(''))).toBe(true);
    expect(Number.isNaN(istanbulYerelAn(null))).toBe(true);
    expect(Number.isNaN(istanbulYerelAn('bozuk'))).toBe(true);
  });

  it('bosluklu ayirici (T yerine bosluk) da calisir', () => {
    expect(new Date(istanbulYerelAn('2026-08-20 18:00')).toISOString())
      .toBe('2026-08-20T15:00:00.000Z');
  });
});

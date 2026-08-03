import { describe, expect, it } from 'vitest';
import {
  ISTANBUL_OFSETI,
  LYNON_SL_TIMEZONE,
  gunAraligindaMi,
  istanbulDateKey,
  slTimezoneDegeri,
} from './istanbulGunu.js';

describe('istanbulDateKey', () => {
  it('UTC gecesi bitmeden Türkiye günü ilerler', () => {
    // 2026-08-02 22:30 UTC = 2026-08-03 01:30 Istanbul.
    expect(istanbulDateKey('2026-08-02T22:30:00Z')).toBe('2026-08-03');
  });

  it('Istanbul gece yarısından hemen önce günü ilerletmez', () => {
    expect(istanbulDateKey('2026-08-02T20:59:00Z')).toBe('2026-08-02');
  });

  it('çözülemeyen değer boş döner', () => {
    expect(istanbulDateKey('bozuk')).toBe('');
  });
});

describe('gunAraligindaMi', () => {
  it('sınırlar dahil', () => {
    expect(gunAraligindaMi('2026-08-03T05:00:00Z', '2026-08-03', '2026-08-03')).toBe(true);
    expect(gunAraligindaMi('2026-08-02T20:59:00Z', '2026-08-03', '2026-08-03')).toBe(false);
  });

  it('değer yoksa aralıkta sayılmaz', () => {
    expect(gunAraligindaMi(null, '2026-08-03', '2026-08-03')).toBe(false);
    expect(gunAraligindaMi('bozuk', '2026-08-03', '2026-08-03')).toBe(false);
  });
});

describe('slTimezoneDegeri', () => {
  /**
   * Bildirilen "pano yanlis donduruyor" hatasinin kok nedeni buydu:
   * Lynon arayuzu `sl-timezone: -3` gonderiyor, panel hic gondermiyordu.
   * Baslik yokken Lynon tarih-only pencereyi UTC sayip gunun ilk uc
   * saatini disarida birakiyordu.
   */
  it('Istanbul için Lynon arayüzüyle aynı değeri üretir', () => {
    expect(slTimezoneDegeri('+03:00')).toBe(-3);
    expect(LYNON_SL_TIMEZONE).toBe(-3);
  });

  it('proje ofsetiyle tutarlı', () => {
    expect(slTimezoneDegeri(ISTANBUL_OFSETI)).toBe(LYNON_SL_TIMEZONE);
  });

  it('getTimezoneOffset işaret kuralına uyar', () => {
    // UTC'nin dogusundaki dilimler negatif, batisindakiler pozitif.
    expect(slTimezoneDegeri('+05:30')).toBe(-5.5);
    expect(slTimezoneDegeri('-05:00')).toBe(5);
    expect(slTimezoneDegeri('+00:00')).toBe(-0);
  });

  it('okunamayan ofset sıfır verir — kaydırma uydurulmaz', () => {
    expect(slTimezoneDegeri('bozuk')).toBe(0);
    expect(slTimezoneDegeri('')).toBe(0);
  });
});

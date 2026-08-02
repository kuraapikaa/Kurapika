import { describe, expect, it } from 'vitest';
import { istanbulDateKey, istanbulDayBoundsUtc } from './lynonBackofficeService.js';

/**
 * TARIH SAAT DILIMI REGRESYON TESTI.
 *
 * Bildirilen vaka: hem yatirim/cekim listesinde hem panoda "tarih ayarı
 * yanlış".
 *
 * Mekanizma: panelden gelen `2026-08-02` bir TURKIYE IS GUNU ama UTC
 * olarak yorumlaniyordu:
 *
 *   `${text}T00:00:00.000Z`   ->  Turkiye saatiyle 03:00
 *
 * Pencere 3 saat kayiyordu: o gunun 00:00-03:00 arasi DISARIDA kaliyor,
 * ertesi gunun 00:00-03:00 arasi ICERI siziyordu. Ayni yanlis pencere
 * sunucudaki ikinci suzgecte de kullanildigi icin kayitlar iki kez
 * eleniyordu.
 *
 * `toIsoDateTime` disari acilmadigi icin davranis, ayni donusumu yapan
 * `istanbulDayBoundsUtc` uzerinden dogrulaniyor; kod artik gun
 * sinirlarini tek kaynaktan aliyor.
 */

describe('Türkiye gün sınırları', () => {
  it('gün UTC 21:00’de başlar — 00:00Z DEĞİL', () => {
    // Eski davranis `2026-08-02T00:00:00.000Z` uretiyordu; o an Turkiye'de
    // saat 03:00, yani gunun ilk uc saati pencerenin disindaydi.
    expect(istanbulDayBoundsUtc('2026-08-02').from).toBe('2026-08-01T21:00:00.000Z');
  });

  it('gün UTC 20:59:59.999’da biter', () => {
    expect(istanbulDayBoundsUtc('2026-08-02').to).toBe('2026-08-02T20:59:59.999Z');
  });

  it('gece 00:30 Türkiye işlemi O GÜNÜN penceresine düşer', () => {
    // Bildirilen kaybin tam sekli: 2 Agustos 00:30 (TR) = 1 Agustos 21:30Z
    const islem = Date.parse('2026-08-01T21:30:00Z');
    const { from, to } = istanbulDayBoundsUtc('2026-08-02');
    expect(islem).toBeGreaterThanOrEqual(Date.parse(from));
    expect(islem).toBeLessThanOrEqual(Date.parse(to));
  });

  it('gece 00:30 işlemi ERTESI günün penceresine düşmez', () => {
    const islem = Date.parse('2026-08-01T21:30:00Z');
    expect(islem).toBeLessThan(Date.parse(istanbulDayBoundsUtc('2026-08-03').from));
  });

  it('ertesi günün 02:00 işlemi bu güne sızmaz', () => {
    // 3 Agustos 02:00 (TR) = 2 Agustos 23:00Z. Eski pencere
    // (2 Agustos 00:00Z-23:59Z) bunu ICERI aliyordu.
    const islem = Date.parse('2026-08-02T23:00:00Z');
    expect(islem).toBeGreaterThan(Date.parse(istanbulDayBoundsUtc('2026-08-02').to));
  });

  it('gün 24 saat sürer', () => {
    const { from, to } = istanbulDayBoundsUtc('2026-08-02');
    expect(Date.parse(to) - Date.parse(from)).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it('kış saatinde de aynı ofset — Türkiye kalıcı UTC+3', () => {
    // Turkiye 2016'dan beri yaz saati uygulamiyor; ocak da agustos da +03.
    expect(istanbulDayBoundsUtc('2026-01-15').from).toBe('2026-01-14T21:00:00.000Z');
  });

  it('geçersiz gün anahtarı reddedilir', () => {
    expect(() => istanbulDayBoundsUtc('02.08.2026')).toThrow();
    expect(() => istanbulDayBoundsUtc('')).toThrow();
  });
});

describe('Türkiye gün anahtarı', () => {
  it('UTC 21:00 sonrası ERTESI Türkiye günüdür', () => {
    // Bildirilen ikinci hata: todayYmd() UTC kullaniyordu, bu yuzden her
    // gece 21:00-24:00 arasi "bugun" bir gun geride kaliyordu.
    expect(istanbulDateKey(new Date('2026-08-02T21:30:00Z'))).toBe('2026-08-03');
  });

  it('UTC 20:00 hâlâ aynı Türkiye günü', () => {
    expect(istanbulDateKey(new Date('2026-08-02T20:00:00Z'))).toBe('2026-08-02');
  });

  it('gün sınırının kendisi tutarlı', () => {
    const { from } = istanbulDayBoundsUtc('2026-08-02');
    expect(istanbulDateKey(new Date(from))).toBe('2026-08-02');
  });

  it('geçersiz tarih boş döner', () => {
    expect(istanbulDateKey(new Date('çöp'))).toBe('');
  });
});

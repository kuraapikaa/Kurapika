import { describe, expect, it } from 'vitest';
import { ayBasi, aySonu, gunEkle, haftaBasi, kasaGunKodu, oncekiAyBasi } from './kasaGunu';
import { getPresetRanges, onayarAraligi } from './datePresets';

describe('kasaGunKodu', () => {
  it('Türkiye gününü verir — UTC gecesi henüz bitmemişken bile', () => {
    // 2026-08-02 22:30 UTC = 2026-08-03 01:30 Istanbul.
    expect(kasaGunKodu(new Date('2026-08-02T22:30:00Z'))).toBe('2026-08-03');
  });

  it('Istanbul gece yarısından hemen önce günü ilerletmez', () => {
    // 2026-08-02 20:59 UTC = 2026-08-02 23:59 Istanbul.
    expect(kasaGunKodu(new Date('2026-08-02T20:59:00Z'))).toBe('2026-08-02');
  });

  it('bildirilen anı doğru güne koyar (03.08.2026 02:12 Istanbul)', () => {
    expect(kasaGunKodu(new Date('2026-08-02T23:12:53Z'))).toBe('2026-08-03');
  });
});

describe('gün aritmetiği saat diliminden bağımsız', () => {
  it('gün ekler ve çıkarır', () => {
    expect(gunEkle('2026-08-03', -1)).toBe('2026-08-02');
    expect(gunEkle('2026-08-03', 1)).toBe('2026-08-04');
  });

  it('ay ve yıl sınırını aşar', () => {
    expect(gunEkle('2026-03-01', -1)).toBe('2026-02-28');
    expect(gunEkle('2024-03-01', -1)).toBe('2024-02-29'); // artık yıl
    expect(gunEkle('2025-12-31', 1)).toBe('2026-01-01');
  });

  it('haftayı pazartesiden başlatır, pazarı önceki haftaya sayar', () => {
    expect(haftaBasi('2026-08-03')).toBe('2026-08-03'); // pazartesi
    expect(haftaBasi('2026-08-05')).toBe('2026-08-03'); // çarşamba
    expect(haftaBasi('2026-08-09')).toBe('2026-08-03'); // pazar
    expect(haftaBasi('2026-08-10')).toBe('2026-08-10'); // sonraki pazartesi
  });

  it('ay başı ve sonunu bulur', () => {
    expect(ayBasi('2026-08-17')).toBe('2026-08-01');
    expect(aySonu('2026-08-17')).toBe('2026-08-31');
    expect(aySonu('2026-02-05')).toBe('2026-02-28');
    expect(aySonu('2024-02-05')).toBe('2024-02-29');
    expect(oncekiAyBasi('2026-01-15')).toBe('2025-12-01');
  });
});

describe('hazır aralıklar', () => {
  it('bugün tek günlük ve Türkiye gününe eşit', () => {
    const { startDate, endDate } = onayarAraligi('today')!;
    expect(startDate).toBe(endDate);
    expect(startDate).toBe(kasaGunKodu());
  });

  it('dün, bugünün bir gün öncesi', () => {
    expect(onayarAraligi('yesterday')!.endDate).toBe(gunEkle(kasaGunKodu(), -1));
  });

  it('geçen ay tam bir ay kapsar', () => {
    const { startDate, endDate } = onayarAraligi('lastMonth')!;
    expect(startDate).toBe(ayBasi(startDate));
    expect(endDate).toBe(aySonu(startDate));
  });

  it('her aralık başlangıcı bitişten sonra değil', () => {
    for (const onayar of getPresetRanges()) {
      const { startDate, endDate } = onayar.getRange();
      expect(startDate <= endDate, `${onayar.id}: ${startDate} > ${endDate}`).toBe(true);
    }
  });

  it('bilinmeyen kimlik için null döner — elle seçilmiş aralık ezilmesin', () => {
    expect(onayarAraligi(null)).toBeNull();
    expect(onayarAraligi('')).toBeNull();
    expect(onayarAraligi('olmayan')).toBeNull();
  });
});

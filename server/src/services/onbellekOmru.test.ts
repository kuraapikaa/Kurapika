import { describe, expect, it } from 'vitest';
import { CANLI_TTL_MS, GECMIS_TTL_MS, araligaGoreTtl } from './onbellekOmru.js';

const BUGUN = '2026-08-03';

describe('araligaGoreTtl', () => {
  it('bugünü içeren pencere kısa ömürlü', () => {
    // Rakam her yatirimda degisiyor; bes dakika canli takip icin cok uzun.
    expect(araligaGoreTtl(BUGUN, BUGUN)).toBe(CANLI_TTL_MS);
  });

  it('tamamı geçmişte kalan pencere uzun ömürlü', () => {
    // 2 Agustos'un yatirim toplami bir daha degismeyecek.
    expect(araligaGoreTtl('2026-08-02', BUGUN)).toBe(GECMIS_TTL_MS);
    expect(araligaGoreTtl('2026-07-31', BUGUN)).toBe(GECMIS_TTL_MS);
  });

  it('geçmiş uzun ömür canlıdan belirgin biçimde uzun', () => {
    expect(GECMIS_TTL_MS).toBeGreaterThan(CANLI_TTL_MS * 5);
  });

  it('bugüne uzanan çok günlük pencere canlı sayılır', () => {
    // "Bu ay" secildiginde bitis bugun; icine yeni islem dusmeye devam eder.
    expect(araligaGoreTtl(BUGUN, BUGUN)).toBe(CANLI_TTL_MS);
  });

  it('geleceğe uzanan pencere canlı sayılır', () => {
    expect(araligaGoreTtl('2026-12-31', BUGUN)).toBe(CANLI_TTL_MS);
  });

  it('okunamayan tarihte bayat veri göstermektense fazladan istek atar', () => {
    expect(araligaGoreTtl(null, BUGUN)).toBe(CANLI_TTL_MS);
    expect(araligaGoreTtl('', BUGUN)).toBe(CANLI_TTL_MS);
    expect(araligaGoreTtl('03.08.2026', BUGUN)).toBe(CANLI_TTL_MS);
    expect(araligaGoreTtl(BUGUN, 'bozuk')).toBe(CANLI_TTL_MS);
  });

  it('gün sınırında bir gün öncesi geçmiştir', () => {
    expect(araligaGoreTtl('2026-08-02', '2026-08-03')).toBe(GECMIS_TTL_MS);
    expect(araligaGoreTtl('2026-08-03', '2026-08-03')).toBe(CANLI_TTL_MS);
  });

  it('yıl sınırını metin karşılaştırmasıyla doğru geçer', () => {
    expect(araligaGoreTtl('2025-12-31', '2026-01-01')).toBe(GECMIS_TTL_MS);
    expect(araligaGoreTtl('2026-01-01', '2025-12-31')).toBe(CANLI_TTL_MS);
  });
});

import { describe, expect, it } from 'vitest';
import { sadakatIlerlemesi, SEVIYE_BASINA_XP } from './sadakatIlerlemesi';

/**
 * Sunucudaki formulle ayni kalmali: level = floor(xp/1000)+1.
 * Ekranda yanlis bir yuzde sessizce gecerdi, o yuzden matematik bilesenden
 * ayrildi ve burada kilitlendi.
 */
describe('sadakat ilerlemesi', () => {
  it('seviye basina 1000 XP', () => {
    expect(SEVIYE_BASINA_XP).toBe(1000);
  });

  it('seviye basinda yuzde sifir, tam seviye kalir', () => {
    expect(sadakatIlerlemesi(3000, 4)).toEqual({ seviye: 4, yuzde: 0, kalan: 1000 });
  });

  it('seviye ortasinda yuzde ve kalan dogru', () => {
    expect(sadakatIlerlemesi(6620, 7)).toEqual({ seviye: 7, yuzde: 62, kalan: 380 });
  });

  it('sunucu seviyesi yoksa XP', () => {
    expect(sadakatIlerlemesi(6620).seviye).toBe(7);
  });

  it('sunucu seviyesi varsa ona guvenilir', () => {
    // Iki taraf ayrisirsa ekranda tutarsizlik olmasin diye sunucu kazanir.
    expect(sadakatIlerlemesi(6620, 9).seviye).toBe(9);
  });

  it('sifir ve eksik veri cokmez', () => {
    expect(sadakatIlerlemesi(0)).toEqual({ seviye: 1, yuzde: 0, kalan: 1000 });
    expect(sadakatIlerlemesi(undefined)).toEqual({ seviye: 1, yuzde: 0, kalan: 1000 });
    expect(sadakatIlerlemesi(null)).toEqual({ seviye: 1, yuzde: 0, kalan: 1000 });
  });

  it('bozuk girdi varsayilana duser', () => {
    expect(sadakatIlerlemesi('abc')).toEqual({ seviye: 1, yuzde: 0, kalan: 1000 });
    expect(sadakatIlerlemesi(-500)).toEqual({ seviye: 1, yuzde: 0, kalan: 1000 });
  });

  it('yuzde her zaman 0-100 araliginda', () => {
    for (const xp of [1, 999, 1000, 12345, 999999]) {
      const { yuzde } = sadakatIlerlemesi(xp);
      expect(yuzde).toBeGreaterThanOrEqual(0);
      expect(yuzde).toBeLessThanOrEqual(100);
    }
  });
});

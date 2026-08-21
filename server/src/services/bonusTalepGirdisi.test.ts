import { describe, expect, it } from 'vitest';
import { bonusTalepGirdisiniDogrula } from './bonusTalepGirdisi.js';

/**
 * REGRESYON: nakit bonuslar talep edilemiyordu.
 *
 * Canlida gorulen kayit — POST /api/admin/bonus/charge 400, 3ms. Uc
 * milisaniye hicbir dis cagri yapilmadigini gosteriyor; hata kapidaki
 * girdi dogrulamasindaydi. Ayrintili gerekce: bonusTalepGirdisi.ts.
 */
describe('bonusTalepGirdisiniDogrula', () => {
  it('nakit bonusun slug anahtarini KABUL eder (canlida bunu reddediyordu)', () => {
    const sonuc = bonusTalepGirdisiniDogrula({ ClientId: 2531787, BonusId: 'kayip-bonusu' });
    expect(sonuc).toEqual({ gecerli: true, oyuncuId: 2531787, bonusKimligi: 'kayip-bonusu' });
  });

  it('partner bonusunun sayisal kimligini kabul eder', () => {
    const sonuc = bonusTalepGirdisiniDogrula({ ClientId: 2531787, BonusId: 1885 });
    expect(sonuc).toEqual({ gecerli: true, oyuncuId: 2531787, bonusKimligi: '1885' });
  });

  it('sayi metni olarak gelen kimligi de kabul eder', () => {
    expect(bonusTalepGirdisiniDogrula({ ClientId: '2531787', BonusId: '1885' })).toEqual({
      gecerli: true,
      oyuncuId: 2531787,
      bonusKimligi: '1885',
    });
  });

  it('bosluklu kimligi kirpar', () => {
    const sonuc = bonusTalepGirdisiniDogrula({ ClientId: 1, BonusId: '  kayip-bonusu  ' });
    expect(sonuc).toMatchObject({ gecerli: true, bonusKimligi: 'kayip-bonusu' });
  });

  it('oyuncu kimligi sayi degilse reddeder', () => {
    // ClientId Lynon'a oyuncu kimligi olarak gidiyor; burada gevseklik yok.
    expect(bonusTalepGirdisiniDogrula({ ClientId: 'abc', BonusId: 'kayip-bonusu' }))
      .toEqual({ gecerli: false, sebep: 'oyuncu' });
    expect(bonusTalepGirdisiniDogrula({ BonusId: 'kayip-bonusu' }))
      .toEqual({ gecerli: false, sebep: 'oyuncu' });
  });

  it('bonus kimligi yoksa veya bossa reddeder', () => {
    for (const bos of [undefined, null, '', '   ']) {
      expect(bonusTalepGirdisiniDogrula({ ClientId: 1, BonusId: bos as unknown }))
        .toEqual({ gecerli: false, sebep: 'bonus' });
    }
  });

  it('null/undefined kimligi "null" metnine cevirmez', () => {
    // String(null) === 'null' — bos govde sessizce gecerli sayilmamali.
    expect(bonusTalepGirdisiniDogrula({ ClientId: 1, BonusId: null }))
      .toEqual({ gecerli: false, sebep: 'bonus' });
  });
});

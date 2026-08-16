import { describe, expect, it } from 'vitest';
import {
  araligaGorePartnerBonusId,
  araliklariDogrula,
  araliklariNormalize,
  araliklariOzetle,
  specBonusIdSahipleniyorMu,
  specPartnerBonusIdleri,
} from './bonusAraliklari.js';

/** Ornek: tek kampanya, uc kademe. */
const UC_KADEME = [
  { min: 500, max: 4999, partnerBonusId: '5001' },
  { min: 5000, max: 19999, partnerBonusId: '5002' },
  { min: 20000, max: null, partnerBonusId: '5003' },
];

describe('araligaGorePartnerBonusId', () => {
  it('tutari iceren araligin ID sini verir', () => {
    expect(araligaGorePartnerBonusId({ partnerBonusRanges: UC_KADEME }, 1000)).toBe('5001');
    expect(araligaGorePartnerBonusId({ partnerBonusRanges: UC_KADEME }, 8000)).toBe('5002');
    expect(araligaGorePartnerBonusId({ partnerBonusRanges: UC_KADEME }, 50000)).toBe('5003');
  });

  it('sinirlar DAHIL', () => {
    expect(araligaGorePartnerBonusId({ partnerBonusRanges: UC_KADEME }, 500)).toBe('5001');
    expect(araligaGorePartnerBonusId({ partnerBonusRanges: UC_KADEME }, 4999)).toBe('5001');
    expect(araligaGorePartnerBonusId({ partnerBonusRanges: UC_KADEME }, 5000)).toBe('5002');
  });

  it('hicbir araliga dusmezse BONUS YOK — kural duzeyindeki ID ye dusmez', () => {
    // Kasitli: aralik listesi tanimliysa niyet acik. 499 TL bir bosluga
    // denk geliyor; "herhangi bir bonus" vermek yanlis bonus vermektir.
    const spec = { partnerBonusId: '9999', partnerBonusRanges: UC_KADEME };
    expect(araligaGorePartnerBonusId(spec, 499)).toBeNull();
    expect(araligaGorePartnerBonusId(spec, 0)).toBeNull();
  });

  it('aralik tanimli degilse eski davranis surer', () => {
    expect(araligaGorePartnerBonusId({ partnerBonusId: '9999' }, 123)).toBe('9999');
    expect(araligaGorePartnerBonusId({ partnerBonusId: '9999', partnerBonusRanges: [] }, 123)).toBe('9999');
  });

  it('ne aralik ne varsayilan ID varsa null', () => {
    expect(araligaGorePartnerBonusId({}, 1000)).toBeNull();
    expect(araligaGorePartnerBonusId(undefined, 1000)).toBeNull();
  });

  it('gecersiz tutar bonus vermez', () => {
    expect(araligaGorePartnerBonusId({ partnerBonusRanges: UC_KADEME }, Number.NaN)).toBeNull();
  });

  it('bosluklu tanim bosluga dusen tutari reddeder', () => {
    const bosluklu = [
      { min: 100, max: 999, partnerBonusId: 'A' },
      { min: 2000, max: 3000, partnerBonusId: 'B' },
    ];
    expect(araligaGorePartnerBonusId({ partnerBonusRanges: bosluklu }, 1500)).toBeNull();
    expect(araligaGorePartnerBonusId({ partnerBonusRanges: bosluklu }, 999)).toBe('A');
  });
});

describe('araliklariDogrula', () => {
  it('gecerli kademeleri kabul eder', () => {
    expect(araliklariDogrula(UC_KADEME as never).gecerli).toBe(true);
  });

  it('bos liste gecerli', () => {
    expect(araliklariDogrula([]).gecerli).toBe(true);
  });

  it('cakisan araliklari REDDEDER', () => {
    const sonuc = araliklariDogrula([
      { min: 100, max: 1000, partnerBonusId: 'A' },
      { min: 900, max: 2000, partnerBonusId: 'B' },
    ]);
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.hata).toMatch(/cakisiyor/);
  });

  it('sinira degen araliklari da cakisma sayar', () => {
    // 1000 iki aralikta birden; hangisinin verilecegi belirsiz olurdu.
    expect(araliklariDogrula([
      { min: 100, max: 1000, partnerBonusId: 'A' },
      { min: 1000, max: 2000, partnerBonusId: 'B' },
    ]).gecerli).toBe(false);
  });

  it('ters aralik reddedilir', () => {
    expect(araliklariDogrula([{ min: 5000, max: 100, partnerBonusId: 'A' }]).gecerli).toBe(false);
  });

  it('ust sinirsiz aralik en sonda olmali', () => {
    const sonuc = araliklariDogrula([
      { min: 100, max: null, partnerBonusId: 'A' },
      { min: 5000, max: 9000, partnerBonusId: 'B' },
    ]);
    expect(sonuc.gecerli).toBe(false);
    expect(sonuc.hata).toMatch(/ust sinirsiz/);
  });

  it('siralamasiz girilen araliklari da dogru degerlendirir', () => {
    expect(araliklariDogrula([
      { min: 5000, max: 9000, partnerBonusId: 'B' },
      { min: 100, max: 4999, partnerBonusId: 'A' },
    ]).gecerli).toBe(true);
  });
});

describe('araliklariNormalize', () => {
  it('string gelen sayilari cevirir (panel formu string gonderir)', () => {
    const cikti = araliklariNormalize([{ min: '500', max: '4999', partnerBonusId: ' 5001 ' }]);
    expect(cikti).toEqual([{ min: 500, max: 4999, partnerBonusId: '5001' }]);
  });

  it('ID siz veya alt sinirsiz satirlari atar', () => {
    expect(araliklariNormalize([
      { min: 100, partnerBonusId: '' },
      { min: null, partnerBonusId: 'A' },
      { min: 100, partnerBonusId: 'A' },
    ])).toEqual([{ min: 100, max: null, partnerBonusId: 'A' }]);
  });

  it('dizi olmayan girdiye tolerans gosterir', () => {
    expect(araliklariNormalize(null)).toEqual([]);
    expect(araliklariNormalize('bozuk')).toEqual([]);
  });

  it('min e gore siralar', () => {
    const cikti = araliklariNormalize([
      { min: 5000, partnerBonusId: 'B' },
      { min: 100, partnerBonusId: 'A' },
    ]);
    expect(cikti.map((a) => a.partnerBonusId)).toEqual(['A', 'B']);
  });
});

describe('specPartnerBonusIdleri', () => {
  it('kural ID si ve tum aralik ID lerini tekil dondurur', () => {
    expect(specPartnerBonusIdleri({ partnerBonusId: '5001', partnerBonusRanges: UC_KADEME }))
      .toEqual(['5001', '5002', '5003']);
  });

  it('yalnizca aralik varsa onlari dondurur', () => {
    expect(specPartnerBonusIdleri({ partnerBonusRanges: UC_KADEME })).toEqual(['5001', '5002', '5003']);
  });

  it('bos spec bos liste', () => {
    expect(specPartnerBonusIdleri({})).toEqual([]);
  });
});

describe('specBonusIdSahipleniyorMu', () => {
  it('oyuncu HANGI kademeye tiklarsa tiklasin ayni kural bulunur', () => {
    const spec = { partnerBonusRanges: UC_KADEME };
    expect(specBonusIdSahipleniyorMu(spec, '5001')).toBe(true);
    expect(specBonusIdSahipleniyorMu(spec, 5002)).toBe(true);
    expect(specBonusIdSahipleniyorMu(spec, '5003')).toBe(true);
  });

  it('yabanci ID yi sahiplenmez', () => {
    expect(specBonusIdSahipleniyorMu({ partnerBonusRanges: UC_KADEME }, '7777')).toBe(false);
    expect(specBonusIdSahipleniyorMu({ partnerBonusRanges: UC_KADEME }, '')).toBe(false);
  });
});

describe('araliklariOzetle', () => {
  it('panelde gosterilebilir ozet uretir', () => {
    expect(araliklariOzetle(UC_KADEME as never))
      .toBe('500–4999 → 5001 · 5000–19999 → 5002 · 20000–∞ → 5003');
  });
});

import { describe, expect, it } from 'vitest';
import { assignmentValuesForPromoSpec, freespinAtamasiVar } from './rulesService.js';

/**
 * Freespin atamasina para tutari eklenmemeli.
 *
 * Ertesi gun isi, hesaplanan tutar sifirdan buyuk oldugu her durumda
 * `BonusMoneyAmount` ekliyordu. Kayip yuzdesine bagli bir freespin
 * kuralinda bu, BetLevel/RoundCount/Game ile birlikte bir de para tutari
 * gonderilmesi demekti ve atama reddediliyordu.
 */
describe('freespinAtamasiVar', () => {
  it('freespin blogu tanimliysa true', () => {
    const spec = { freespinBetLevel: 1, freespinCount: 50, freespinGameId: 900, freespinGameProviderId: 12 } as never;
    expect(freespinAtamasiVar(assignmentValuesForPromoSpec(spec))).toBe(true);
  });

  it('yalnizca tur sayisi verilse bile true', () => {
    expect(freespinAtamasiVar({ RoundCount: 20 })).toBe(true);
  });

  it('para bonusu atamasinda false', () => {
    expect(freespinAtamasiVar({ BonusMoneyAmount: 250 })).toBe(false);
  });

  it('bos atamada false', () => {
    expect(freespinAtamasiVar({})).toBe(false);
  });

  it('bos string sayilmaz', () => {
    expect(freespinAtamasiVar({ Game: '', BetLevel: null, RoundCount: undefined })).toBe(false);
  });
});

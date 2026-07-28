import { describe, expect, it } from 'vitest';
import { cekilebilirMi } from './games.js';

/**
 * Çark çekilişinde hangi dilimlerin çıkabileceği para etkisi olan bir kural:
 * teslim edilemeyen bir ödülün çıkması oyuncuya "kazandınız" deyip ardından
 * hata göstermek demek. Kural veriye (admin panelindeki olasılık) değil koda
 * bağlı olduğu için burada sabitlenir.
 */
describe('cekilebilirMi', () => {
  it('kayıp dilimi her zaman çekilebilir', () => {
    expect(cekilebilirMi({ id: 'wheel-pass', type: 'none', isLoss: true })).toBe(true);
  });

  it('yapılandırılmamış ödül çekilemez (teslim edilemiyor)', () => {
    // deliverWheelReward bu dilim için "Lynon teslimatına bağlanmamış" döner.
    expect(cekilebilirMi({ type: 'bonus', requiresConfiguration: true, amount: 100 })).toBe(false);
  });

  it('yapılandırılmış bonus çekilebilir', () => {
    expect(cekilebilirMi({ type: 'bonus', requiresConfiguration: false, bonusId: 1880, amount: 500 })).toBe(true);
  });

  it('fiziksel ödül olasılığı sıfırdan büyük olsa bile çekilemez', () => {
    expect(cekilebilirMi({ type: 'physical', requiresConfiguration: false, probability: 50 })).toBe(false);
  });

  it('yüksek nakit (eşik üstü) çekilemez', () => {
    expect(cekilebilirMi({ type: 'cash', requiresConfiguration: false, amount: 10000 })).toBe(false);
    expect(cekilebilirMi({ type: 'cash', requiresConfiguration: false, amount: 50000 })).toBe(false);
  });

  it('eşik altındaki nakit çekilebilir, eşiğin kendisi çekilebilir', () => {
    expect(cekilebilirMi({ type: 'cash', requiresConfiguration: false, amount: 500 })).toBe(true);
    // Sınır: eşiğe eşit olan geçer, yalnızca üstü engellenir.
    expect(cekilebilirMi({ type: 'cash', requiresConfiguration: false, amount: 1000 })).toBe(true);
    expect(cekilebilirMi({ type: 'cash', requiresConfiguration: false, amount: 1001 })).toBe(false);
  });

  it('tanımsız dilim çekilemez', () => {
    expect(cekilebilirMi(null)).toBe(false);
    expect(cekilebilirMi(undefined)).toBe(false);
  });
});

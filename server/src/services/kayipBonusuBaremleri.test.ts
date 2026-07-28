import { describe, expect, it } from 'vitest';
import { evaluateForAccount } from './promoEvaluator.js';
import type { AccountSnapshot } from './withdrawalEngine.js';

/**
 * Kayıp bonusu baremleri — para etkisi olan hesaplama.
 *
 * 50 ₺ – 4.999 ₺      → %20   (1.000 ₺ kayba 200 ₺)
 * 5.000 ₺ – 19.999 ₺  → %25   (10.000 ₺ kayba 2.500 ₺)
 * 20.000 ₺ ve üzeri   → %30   (20.000 ₺ kayba 6.000 ₺)
 *
 * Taban YATIRIM DEĞİL net kayıptır; bu ayrım testlerin asıl konusu.
 */

const KAYIP_SPEC = {
  lossBonus: true,
  amountType: 'tieredPercentage' as const,
  tieredPercentageRanges: [
    { min: 50, max: 4999, percent: 20 },
    { min: 5000, max: 19999, percent: 25 },
    { min: 20000, max: Number.MAX_SAFE_INTEGER, percent: 30 },
  ],
};

const promo = { id: 38, title: '%30 Kayıp Bonusu' } as any;
const specs = { PROMO_SPECS: { 38: KAYIP_SPEC }, PROMO_TITLE_SPECS: {} } as any;

function hesapla(netLoss: number, ekstra: Partial<AccountSnapshot> = {}) {
  const account = {
    id: 1,
    netLoss,
    // Son yatırımı bilerek kaybın çok üstünde tutuyoruz: hesaplama yanlışlıkla
    // yatırım tabanına düşerse test bunu yakalasın.
    lastDeposit: { amount: 999_999, dateLocal: '2026-07-27 10:00:00' },
    ...ekstra,
  } as AccountSnapshot;
  return evaluateForAccount(account, promo, specs);
}

describe('kayıp bonusu baremleri', () => {
  it('1.000 ₺ kayıp → 200 ₺ (%20)', async () => {
    const r = await hesapla(1000);
    expect(r.calculatedAmount).toBe(200);
  });

  it('10.000 ₺ kayıp → 2.500 ₺ (%25)', async () => {
    const r = await hesapla(10000);
    expect(r.calculatedAmount).toBe(2500);
  });

  it('20.000 ₺ kayıp → 6.000 ₺ (%30)', async () => {
    const r = await hesapla(20000);
    expect(r.calculatedAmount).toBe(6000);
  });

  it('barem sınırları: 4.999/5.000 ve 19.999/20.000', async () => {
    expect((await hesapla(4999)).calculatedAmount).toBeCloseTo(999.8, 5);
    expect((await hesapla(5000)).calculatedAmount).toBe(1250);
    expect((await hesapla(19999)).calculatedAmount).toBeCloseTo(4999.75, 5);
    expect((await hesapla(20000)).calculatedAmount).toBe(6000);
  });

  it('alt sınırın altı (49 ₺) hiçbir bareme girmez', async () => {
    const r = await hesapla(49);
    expect(r.calculatedAmount).toBeUndefined();
  });

  it('kaybı olmayan oyuncu bonus alamaz', async () => {
    const r = await hesapla(0);
    expect(r.calculatedAmount).toBeUndefined();
    const kayipMaddesi = r.items.find((i) => i.id === 'loss-bonus-net-loss');
    expect(kayipMaddesi?.ok).toBe(false);
  });

  it('taban yatırım değil kayıptır', async () => {
    // netLoss 1.000 iken son yatırım 999.999: yatırım tabanı kullanılsaydı
    // sonuç %30 baremine düşer ve ~300.000 çıkardı.
    const r = await hesapla(1000);
    expect(r.calculatedAmount).toBe(200);
    const hesap = r.items.find((i) => i.id === 'bonus-calculation');
    expect(hesap?.reason).toContain('Net kayıp');
  });
});

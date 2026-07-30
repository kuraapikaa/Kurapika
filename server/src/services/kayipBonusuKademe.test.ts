import { describe, expect, it } from 'vitest';
import { evaluateForAccount } from './promoEvaluator.js';

/**
 * %30'a varan kayip bonusu — kademeli yuzde.
 *
 *     50 ₺ –  4.999 ₺  → %20
 *  5.000 ₺ – 19.999 ₺  → %25
 * 20.000 ₺ ve uzeri    → %30
 *
 * Taban NET KAYIP (lossBonus: true → depositBasis netLoss'u secer), yatirim
 * degil. Nakit tipi oldugu icin platform bonus ID'si gerekmiyor.
 */

const KURAL = {
  enabled: true,
  type: 'cash',
  title: "%30'a Varan Kayip Bonusu",
  lossBonus: true,
  amountType: 'tieredPercentage',
  tieredPercentageRanges: [
    { min: 50, max: 4999, percent: 20 },
    { min: 5000, max: 19999, percent: 25 },
    { min: 20000, max: 999999999, percent: 30 },
  ],
};

const kurallar = { PROMO_SPECS: { 'kayip-bonusu': KURAL }, PROMO_TITLE_SPECS: {} } as any;
const promo = { id: 'kayip-bonusu', title: "%30'a Varan Kayip Bonusu" } as any;

function hesap(netLoss: number) {
  return {
    id: 1,
    balance: 0,
    netLoss,
    lastDeposit: { amount: 0, dateLocal: '2026-07-29T10:00:00.000Z' },
    bonuses: [],
    profileTransactions: [],
    profileTransactionsByType: {},
    dataCompleteness: { kpi: true, payments: true, financialMovements: true, bonuses: true, casino: true, sport: true },
  } as any;
}

async function tutar(netLoss: number) {
  const r = await evaluateForAccount(hesap(netLoss), promo, kurallar, 'default', 'bonus');
  return r.calculatedAmount;
}

describe('kayıp bonusu kademeleri', () => {
  it('alt kademe: 1.000 ₺ kayıp → %20 = 200 ₺', async () => {
    expect(await tutar(1000)).toBe(200);
  });

  it('orta kademe: 10.000 ₺ kayıp → %25 = 2.500 ₺', async () => {
    expect(await tutar(10000)).toBe(2500);
  });

  it('üst kademe: 50.000 ₺ kayıp → %30 = 15.000 ₺', async () => {
    expect(await tutar(50000)).toBe(15000);
  });

  it('kademe sınırları doğru tarafta', async () => {
    expect(await tutar(4999)).toBeCloseTo(999.8, 1);   // hâlâ %20
    expect(await tutar(5000)).toBe(1250);              // %25 başlıyor
    expect(await tutar(19999)).toBeCloseTo(4999.75, 2); // hâlâ %25
    expect(await tutar(20000)).toBe(6000);             // %30 başlıyor
  });

  it('taban altı kayıpta bonus yok', async () => {
    // 50 ₺ altı hiçbir aralığa girmiyor; hesaplama 0 ve kontrol düşüyor.
    const r = await evaluateForAccount(hesap(49), promo, kurallar, 'default', 'bonus');
    expect(r.calculatedAmount ?? 0).toBe(0);
    expect(r.items.some((i: any) => i.id === 'bonus-calculation' && !i.ok)).toBe(true);
  });

  it('taban yatırım değil kayıp — yatırımı olan ama kaybı olmayan bonus almaz', async () => {
    const yatirimVarKayipYok = { ...hesap(0), lastDeposit: { amount: 50000, dateLocal: '2026-07-29T10:00:00.000Z' } };
    const r = await evaluateForAccount(yatirimVarKayipYok, promo, kurallar, 'default', 'bonus');
    expect(r.calculatedAmount ?? 0).toBe(0);
  });
});

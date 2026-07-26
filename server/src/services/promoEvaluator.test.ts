import { describe, expect, it } from 'vitest';
import { evaluateForAccount } from './promoEvaluator.js';

describe('evaluateForAccount', () => {
  it('blocks bonus requests when no matching rule exists', async () => {
    const account = {
      id: 1,
      balance: 2500,
      totalDeposits: 1000,
      lastDeposit: { amount: 1000, dateLocal: '2024-01-01T12:00:00' },
      profileTransactions: [],
      bonuses: [],
      profileTransactionsByType: {},
    };

    const result = await evaluateForAccount(
      account as any,
      { id: 999, title: 'Bilinmeyen Bonus' } as any,
      { PROMO_SPECS: {}, PROMO_TITLE_SPECS: {} } as any,
      'default'
    );

    expect(result.overallOk).toBe(false);
    expect(result.items.some((item) => item.id === 'missing-rule')).toBe(true);
  });
  it('fails closed when any Lynon eligibility source is incomplete', async () => {
    const result = await evaluateForAccount(
      {
        id: 1,
        balance: 100,
        bonuses: [],
        profileTransactions: [],
        profileTransactionsByType: {},
        dataCompleteness: {
          kpi: true,
          payments: true,
          financialMovements: false,
          bonuses: true,
          casino: true,
          sport: true,
        },
      } as any,
      { id: 1780, title: 'Test Bonusu' } as any,
      {
        PROMO_SPECS: { '1780': { enabled: true, type: 'partner', partnerBonusId: '1780' } },
        PROMO_TITLE_SPECS: {},
      } as any,
      'default'
    );

    expect(result.overallOk).toBe(false);
    expect(result.items).toContainEqual(expect.objectContaining({ id: 'incomplete-lynon-data', ok: false }));
  });

  it('uses historical campaign assignments to block a second bonus on the same deposit', async () => {
    const result = await evaluateForAccount(
      {
        id: 1,
        balance: 100,
        lastDeposit: { amount: 100, dateLocal: '2026-07-25T10:00:00.000Z' },
        totalBetAmountSinceLastDeposit: 100,
        wageringRemaining: 0,
        bonuses: [{ Id: 1780, Name: 'Test Bonusu', CreatedLocal: '2026-07-25T11:00:00.000Z', ToWagerAmount: 0 }],
        profileTransactions: [{ DocumentTypeName: 'Deposit', CreatedLocal: '2026-07-25T10:00:00.000Z' }],
        profileTransactionsByType: { Deposit: { count: 1, totalAmount: 100 } },
        dataCompleteness: {
          kpi: true,
          payments: true,
          financialMovements: true,
          bonuses: true,
          casino: true,
          sport: true,
        },
      } as any,
      { id: 1780, title: 'Test Bonusu' } as any,
      {
        PROMO_SPECS: {
          '1780': {
            enabled: true,
            type: 'partner',
            partnerBonusId: '1780',
            checkSingleInvestmentUsage: true,
          },
        },
        PROMO_TITLE_SPECS: {},
      } as any,
      'default'
    );

    expect(result.overallOk).toBe(false);
    expect(result.items).toContainEqual(expect.objectContaining({ id: 'check-single-investment', ok: false }));
  });
  it('uses the previous Istanbul calendar day total for next-day bonus eligibility and amount', async () => {
    const result = await evaluateForAccount(
      {
        id: 7,
        balance: 0,
        lastDeposit: { amount: 25, dateLocal: '2026-07-26T08:00:00.000Z' },
        previousDayDateKey: '2026-07-25',
        previousDayDepositTotal: 300,
        previousDayDepositCount: 2,
        previousDayLastDeposit: { amount: 200, dateLocal: '2026-07-25T18:00:00.000Z' },
        bonuses: [], profileTransactions: [], profileTransactionsByType: {}, totalBetAmountSinceLastDeposit: 300,
        dataCompleteness: { kpi: true, payments: true, financialMovements: true, bonuses: true, casino: true, sport: true },
      } as any,
      { id: 1880, title: 'Ertesi Gün Test' } as any,
      { PROMO_SPECS: { '1880': { enabled: true, type: 'partner', partnerBonusId: '1880', isNextDayBonus: true, amountType: 'percentage', percentageAmount: 10, minDepositAmount: 250, principalWagerMult: 0 } }, PROMO_TITLE_SPECS: {} } as any,
      'default'
    );
    expect(result.overallOk).toBe(true);
    expect(result.calculatedAmount).toBe(30);
    expect(result.items).toContainEqual(expect.objectContaining({ id: 'previous-day-deposit', ok: true }));
  });

  it('blocks a next-day bonus when the previous day has no successful deposit', async () => {
    const result = await evaluateForAccount(
      {
        id: 8, balance: 0, previousDayDateKey: '2026-07-25', previousDayDepositTotal: 0, previousDayDepositCount: 0,
        bonuses: [], profileTransactions: [], profileTransactionsByType: {},
        dataCompleteness: { kpi: true, payments: true, financialMovements: true, bonuses: true, casino: true, sport: true },
      } as any,
      { id: 1880, title: 'Ertesi Gün Test' } as any,
      { PROMO_SPECS: { '1880': { enabled: true, type: 'partner', partnerBonusId: '1880', isNextDayBonus: true, amountType: 'fixed', fixedAmount: 10 } }, PROMO_TITLE_SPECS: {} } as any,
      'default'
    );
    expect(result.overallOk).toBe(false);
    expect(result.items).toContainEqual(expect.objectContaining({ id: 'previous-day-deposit', ok: false }));
  });
});

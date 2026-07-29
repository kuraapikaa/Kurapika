import { describe, expect, it } from 'vitest';
import { evaluateForAccount } from './promoEvaluator.js';

/**
 * Kural Merkezi'nde "Çevrim & Ödeme Kuralları" boş bırakıldığında sunucu da
 * çevrim aramamalı. Önceden varsayılan 1 idi: 1885 gibi alanı hiç tanımlanmamış
 * bonuslarda panel boş görünürken oyuncu "Çevrim henüz tamamlanmadı" alıyordu.
 */

const hesap = {
  id: 42,
  balance: 0,
  lastDeposit: { amount: 1000, dateLocal: '2026-07-28T10:00:00.000Z' },
  // Yatırımdan sonra hiç bahis yok: 1x şart uygulanırsa kontrol düşer.
  totalBetAmountSinceLastDeposit: 0,
  bonuses: [],
  profileTransactions: [],
  profileTransactionsByType: {},
  dataCompleteness: { kpi: true, payments: true, financialMovements: true, bonuses: true, casino: true, sport: true },
} as any;

const promo = { id: 1885, title: 'Çevrimsiz Test Bonusu' } as any;

function kurallar(spec: Record<string, unknown>) {
  return { PROMO_SPECS: { '1885': { enabled: true, type: 'partner', partnerBonusId: '1885', ...spec } }, PROMO_TITLE_SPECS: {} } as any;
}

describe('anapara çevrimi varsayılanı', () => {
  it('alan tanımlı değilse anapara çevrimi kontrolü hiç eklenmez', async () => {
    const result = await evaluateForAccount(hesap, promo, kurallar({}), 'default');
    expect(result.items.some((item: any) => item.id === 'principal-wager')).toBe(false);
  });

  it('alan açıkça 0 ise de eklenmez', async () => {
    const result = await evaluateForAccount(hesap, promo, kurallar({ principalWagerMult: 0 }), 'default');
    expect(result.items.some((item: any) => item.id === 'principal-wager')).toBe(false);
  });

  it('alan açıkça verilmişse kontrol çalışmaya devam eder', async () => {
    const result = await evaluateForAccount(hesap, promo, kurallar({ principalWagerMult: 1 }), 'default');
    expect(result.items).toContainEqual(expect.objectContaining({ id: 'principal-wager', ok: false }));
  });

  it('açık çarpan karşılanmışsa kontrol geçer', async () => {
    const oynayan = { ...hesap, totalBetAmountSinceLastDeposit: 1000 };
    const result = await evaluateForAccount(oynayan, promo, kurallar({ principalWagerMult: 1 }), 'default');
    expect(result.items).toContainEqual(expect.objectContaining({ id: 'principal-wager', ok: true }));
  });
});

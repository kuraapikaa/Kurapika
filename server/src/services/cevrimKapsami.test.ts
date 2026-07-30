import { describe, expect, it } from 'vitest';
import { evaluateForAccount } from './promoEvaluator.js';

/**
 * "Çevrim & Ödeme Kuralları" bonus TALEBİNİ engellememeli.
 *
 * Oyuncu bonus isterken önceki bonusun çevrimini tamamlamış olmak zorunda
 * değil; bu kurallar yalnızca otomatik çekim onayında anlamlı. autoWithdrawJob
 * aynı fonksiyonu kullandığı için kontroller silinemedi, kapsama bağlandı.
 */

const hesap = {
  id: 7,
  balance: 50000,                      // maksimum kazanç limitini aşacak kadar
  lastDeposit: { amount: 1000, dateLocal: '2026-07-29T10:00:00.000Z' },
  totalBetAmountSinceLastDeposit: 0,   // anapara çevrimi tamamlanmamış
  wageringRemaining: 2500,             // bonus çevrimi de sürüyor
  bonuses: [],
  profileTransactions: [],
  profileTransactionsByType: {},
  dataCompleteness: { kpi: true, payments: true, financialMovements: true, bonuses: true, casino: true, sport: true },
} as any;

const promo = { id: 4242, title: 'Test Bonusu' } as any;

const kurallar = {
  PROMO_SPECS: {
    '4242': {
      enabled: true,
      type: 'partner',
      partnerBonusId: '4242',
      principalWagerMult: 1,
      bonusWagerMult: 5,
      maxPayoutFixed: 1000,
    },
  },
  PROMO_TITLE_SPECS: {},
} as any;

const idler = (r: any) => r.items.map((i: any) => i.id);

describe('çevrim kurallarının kapsamı', () => {
  it('bonus talebinde çevrim ve ödeme kontrolleri hiç eklenmez', async () => {
    const r = await evaluateForAccount(hesap, promo, kurallar, 'default', 'bonus');
    expect(idler(r)).not.toContain('principal-wager');
    expect(idler(r)).not.toContain('bonus-wagering');
    expect(idler(r)).not.toContain('max-payout-check');
  });

  it('otomatik çekimde üçü de çalışmaya devam eder', async () => {
    const r = await evaluateForAccount(hesap, promo, kurallar, 'default', 'cekim');
    expect(idler(r)).toContain('principal-wager');
    expect(idler(r)).toContain('bonus-wagering');
    expect(idler(r)).toContain('max-payout-check');
  });

  it('varsayılan kapsam çekim — mevcut çağıranların davranışı değişmesin', async () => {
    const r = await evaluateForAccount(hesap, promo, kurallar, 'default');
    expect(idler(r)).toContain('principal-wager');
  });

  it('çevrim tamamlanmamışken bonus talebi bu yüzden düşmez', async () => {
    const r = await evaluateForAccount(hesap, promo, kurallar, 'default', 'bonus');
    const cevrimDusuruyor = r.items.some(
      (i: any) => !i.ok && ['principal-wager', 'bonus-wagering', 'max-payout-check'].includes(i.id),
    );
    expect(cevrimDusuruyor).toBe(false);
  });
});

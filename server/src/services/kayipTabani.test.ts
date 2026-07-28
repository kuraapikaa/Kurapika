import { describe, expect, it } from 'vitest';
import { lossBasisExcludedBonusNames } from '../lib/narcosBonusCatalog.js';
import { evaluateForAccount } from './promoEvaluator.js';
import type { AccountSnapshot } from './withdrawalEngine.js';

/**
 * Kayıp tabanı = yatırım (yatırım bonusu almış olanlar hariç) − çekim.
 *
 * Buradaki testler iki şeyi ayrı ayrı sabitler:
 *  1. Hangi bonusların tabandan düştüğü (katalog bayrağı)
 *  2. Çevrim maddelerinin bonus TALEBİNİ engellememesi
 */

describe('kayıp tabanından hariç tutulan bonuslar', () => {
  const adlar = lossBasisExcludedBonusNames();

  it('yatırım üzerine verilen bonuslar listede', () => {
    for (const beklenen of [
      '%100 Risksiz İlk Yatırım',
      'İlk Yatırımına 2 Katıyla Başla',
      '%20 Casino Yatırım Bonusu',
      '%15 Spor Yatırım Bonusu',
      '%400 Çarşamba Happy Days',
      'Her Yatırıma Freespin',
      '5X Yap 7X Çek!',
      '8X Yap 10X Çek!',
    ]) {
      expect(adlar, `${beklenen} listede olmalı`).toContain(beklenen);
    }
  });

  it('kayıp ve yatırıma bağlı olmayan bonuslar listede DEĞİL', () => {
    // Bunlar yatırım üzerine verilmiyor; tabanı düşürmemeliler.
    for (const olmamali of ['%30 Kayıp Bonusu', '%5 Haftalık Kayıp Bonusu', '250 TL Deneme Bonusu', 'Doğum Günü Bonusu']) {
      expect(adlar, `${olmamali} listede olmamalı`).not.toContain(olmamali);
    }
  });
});

describe('çevrim maddeleri bonus talebini engellemez', () => {
  const spec = {
    // Çevrim şartı bilerek yüksek: madde "başarısız" olacak ama talebi kesmemeli.
    principalWagerMult: 5,
    amountType: 'fixed' as const,
    fixedAmount: 100,
  };
  const promo = { id: 900, title: 'Test Bonusu' } as any;
  const specs = { PROMO_SPECS: { 900: spec }, PROMO_TITLE_SPECS: {} } as any;

  it('anapara çevrimi tamamlanmamışken bile talep engellenmez', async () => {
    const account = {
      id: 1,
      lastDeposit: { amount: 1000, dateLocal: '2026-07-27 10:00:00' },
      totalBetAmountSinceLastDeposit: 0,   // hiç çevrim yapılmamış
    } as AccountSnapshot;

    const r = await evaluateForAccount(account, promo, specs);
    const cevrim = r.items.find((i) => i.id === 'principal-wager');

    // Madde listede GÖRÜNMELİ (otomatik çekim kontrolleri için bilgi),
    expect(cevrim).toBeDefined();
    expect(cevrim?.ok).toBe(false);
    // ama sonucu düşürmemeli.
    expect(r.overallOk).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { evaluateForAccount } from './promoEvaluator.js';

/**
 * PARA SIZINTISI REGRESYON TESTI.
 *
 * Bildirilen vaka: oyuncu 2492369 cok sayida %30 kayip bonusu almis —
 * perDayLimit ve mukerrer korumasi eklendikten SONRA bile.
 *
 * ── Mekanizma ─────────────────────────────────────────────────────────
 *
 * Nakit bonuslarin kullanim sayisi bakiye duzeltmesi notundan okunuyor:
 *
 *   yazma  (charge):  `Bonus ${resolvedRule.key} / ${username}`
 *   okuma  (limit):   promo.id ile karsilastir
 *
 * `resolveBonusRule` bir kurali `partnerBonusId` uzerinden de bulabiliyor.
 * O durumda dondurdugu `key` bir BASLIK anahtari olurken `promo.id`
 * sayisal kampanya kimligi kaliyor. Iki deger ayrildiginda not
 * "kayip-bonusu" ile yazilip "1306" ile araniyor; kontrol hicbir kullanim
 * gormuyor ve HER TALEP GECIYOR.
 *
 * Duzeltme: cozulmus kural anahtari degerlendiriciye acikca gecirilir
 * (`promo.kuralAnahtari`) ve hem gunluk limit hem tek-yatirim kontrolu
 * onu kullanir.
 */

const BUGUN = new Date().toISOString();

const kural = {
  enabled: true,
  type: 'cash',
  title: '%30 Kayıp Bonusu',
  lossBonus: true,
  perDayLimit: 1,
  partnerBonusId: '1306',
  amountType: 'tieredPercentage',
  tieredPercentageRanges: [{ min: 50, max: 999999999, percent: 30 }],
};

/**
 * Kural BASLIK anahtariyla saklanmis, panele 1306 ile geliyor.
 * Anahtar `normalizeTitleForMatch('%30 Kayıp Bonusu')` ciktisi.
 */
const KURAL_ANAHTARI = '30 kayıp bonusu';
const kurallar = { PROMO_SPECS: {}, PROMO_TITLE_SPECS: { [KURAL_ANAHTARI]: kural } } as any;

const hesap = (duzeltmeler: any[]) =>
  ({
    id: 2492369, balance: 0, netLoss: 10_000,
    lastDeposit: { id: '77001', amount: 10_000, dateLocal: BUGUN },
    bonuses: [],
    balanceCorrections: duzeltmeler,
    profileTransactions: [], profileTransactionsByType: {},
    dataCompleteness: { kpi: true, payments: true, financialMovements: true, bonuses: true, casino: true, sport: true },
  }) as any;

/** Charge yolunun yazdigi not — anahtar `resolvedRule.key`. */
const notlu = (anahtar: string) => [
  { not: `Bonus ${anahtar} / destek1`, tutar: 3000, tarih: BUGUN, tur: 'crediting' },
];

const degerlendir = (duzeltmeler: any[], kuralAnahtari?: string) =>
  evaluateForAccount(
    hesap(duzeltmeler),
    { id: 1306, title: '%30 Kayıp Bonusu', kuralAnahtari } as any,
    kurallar, 'default', 'bonus',
  );

describe('kural anahtarı uyuşmazlığı — bildirilen sızıntı', () => {
  it('anahtar geçirilmezse limit KÖR kalır (eski davranış)', async () => {
    // Not "kayip-bonusu" ile yazilmis; kontrol "1306" ariyor.
    const r = await degerlendir(notlu(KURAL_ANAHTARI));
    expect(r.items.find((i: any) => i.id === 'per-day-limit')?.ok).toBe(true);
  });

  it('çözülmüş anahtar geçirilince limit DÜŞER', async () => {
    const r = await degerlendir(notlu(KURAL_ANAHTARI), KURAL_ANAHTARI);
    const madde = r.items.find((i: any) => i.id === 'per-day-limit');
    expect(madde?.ok).toBe(false);
    expect(madde?.reason).toContain('1/1');
    expect(r.overallOk).toBe(false);
  });

  it('tek-yatırım kontrolü de aynı anahtarı kullanır', async () => {
    const r = await degerlendir(notlu(KURAL_ANAHTARI), KURAL_ANAHTARI);
    expect(r.items.find((i: any) => i.id === 'deposit-scoped-usage')?.ok).toBe(false);
  });

  it('anahtar sayısal olduğunda eski davranış korunur', async () => {
    const r = await degerlendir(notlu('1306'), '1306');
    expect(r.items.find((i: any) => i.id === 'per-day-limit')?.ok).toBe(false);
  });

  it('hiç kullanım yoksa geçer', async () => {
    const r = await degerlendir([], KURAL_ANAHTARI);
    expect(r.items.find((i: any) => i.id === 'per-day-limit')?.ok).toBe(true);
    expect(r.items.find((i: any) => i.id === 'deposit-scoped-usage')?.ok).toBe(true);
  });

  it('başka kuralın notu bu kuralı engellemez', async () => {
    const r = await degerlendir(notlu('baska-bonus'), KURAL_ANAHTARI);
    expect(r.items.find((i: any) => i.id === 'per-day-limit')?.ok).toBe(true);
  });

  it('geri ALINAN düzeltme kullanım saymaz', async () => {
    const r = await degerlendir(
      [{ not: `Bonus ${KURAL_ANAHTARI} / destek1`, tutar: 3000, tarih: BUGUN, tur: 'debiting' }],
      KURAL_ANAHTARI,
    );
    expect(r.items.find((i: any) => i.id === 'per-day-limit')?.ok).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  bugunVerilmisMi,
  kullanimSayisi,
  nakitKullanimlari,
  nottanKuralAnahtari,
  type DuzeltmeSatiri,
} from './nakitBonusGecmisi.js';

/**
 * PARA SIZINTISI REGRESYON TESTI.
 *
 * Bildirilen vaka: oyuncu 2492369 cok sayida `correction` almis, yani
 * defalarca bedava bakiye kazanmis.
 *
 * Mekanizma: nakit bonuslar Lynon'a kampanya olarak atanmiyor, bakiye
 * DUZELTMESI olarak yaziliyor. perDayLimit/perWeekLimit ise
 * `account.bonuses` (kampanya atamalari) listesinden sayiyor. Duzeltmeler
 * orada hic gorunmedigi icin limitler her zaman "0 kullanim" goruyor ve
 * hicbir seyi engellemiyor.
 *
 * Oyuncu: bonusu al -> kaybet -> bakiye tekrar esigin altina dussun ->
 * ayni bonusu tekrar al. Her tur yeni bir correction.
 */

const GUN = 24 * 60 * 60 * 1000;
const simdi = Date.parse('2026-07-31T12:00:00Z');
const gunOnce = (n: number) => new Date(simdi - n * GUN).toISOString();

const d = (not: string, tutar: number, tarih: string, tur = 'crediting'): DuzeltmeSatiri =>
  ({ not, tutar, tarih, tur });

describe('nottan kural anahtarı', () => {
  it('charge yolunun yazdığı biçimi çözer', () => {
    expect(nottanKuralAnahtari('Bonus kayip-bonusu / destek1')).toBe('kayip-bonusu');
  });

  it('kullanıcı adı olmadan da çalışır', () => {
    expect(nottanKuralAnahtari('Bonus kayip-bonusu')).toBe('kayip-bonusu');
  });

  it('elle yazılmış düzeltme sayılmaz', () => {
    // Operatorun elle verdigi para bonus kullanimi degil.
    expect(nottanKuralAnahtari('Musteri sikayeti telafi')).toBeNull();
    expect(nottanKuralAnahtari('')).toBeNull();
    expect(nottanKuralAnahtari(null)).toBeNull();
  });

  it('yalnızca "Bonus " öneki eşleşir', () => {
    expect(nottanKuralAnahtari('Bonuslar toplu')).toBeNull();
  });
});

describe('nakit kullanımlarını çıkarma', () => {
  it('crediting düzeltmeler sayılır', () => {
    const k = nakitKullanimlari([d('Bonus kayip-bonusu / op', 2500, gunOnce(0))]);
    expect(k).toHaveLength(1);
    expect(k[0]).toMatchObject({ kuralAnahtari: 'kayip-bonusu', tutar: 2500 });
  });

  it('debiting düzeltme sayılmaz — para geri alınmış', () => {
    expect(nakitKullanimlari([d('Bonus kayip-bonusu / op', 2500, gunOnce(0), 'debiting')])).toHaveLength(0);
  });

  it('tür belirtilmemişse negatif tutar sayılmaz', () => {
    const satir = { not: 'Bonus x / op', tutar: -500, tarih: gunOnce(0) } as DuzeltmeSatiri;
    expect(nakitKullanimlari([satir])).toHaveLength(0);
  });

  it('bozuk tarih ve tutar atlanır, çökmez', () => {
    const k = nakitKullanimlari([
      d('Bonus a / op', NaN as never, gunOnce(0)),
      d('Bonus b / op', 100, 'gecersiz-tarih'),
      d('Bonus c / op', 300, gunOnce(0)),
    ]);
    expect(k.map((x) => x.kuralAnahtari)).toEqual(['c']);
  });

  it('boş liste çökmez', () => {
    expect(nakitKullanimlari([])).toEqual([]);
    expect(nakitKullanimlari(undefined as never)).toEqual([]);
  });
});

describe('kullanım sayısı — bildirilen sızıntı', () => {
  const cokKullanim = [
    d('Bonus kayip-bonusu / op', 2500, gunOnce(0)),
    d('Bonus kayip-bonusu / op', 2500, gunOnce(0)),
    d('Bonus kayip-bonusu / op', 1800, gunOnce(0)),
    d('Bonus kayip-bonusu / op', 900, gunOnce(3)),
    d('Bonus baska-bonus / op', 5000, gunOnce(0)),
  ];

  it('aynı gün üç kez alınmış — limit bunu görebilmeli', () => {
    const k = nakitKullanimlari(cokKullanim);
    expect(kullanimSayisi(k, 'kayip-bonusu', simdi - GUN)).toBe(3);
  });

  it('haftalık pencerede dördü de sayılır', () => {
    const k = nakitKullanimlari(cokKullanim);
    expect(kullanimSayisi(k, 'kayip-bonusu', simdi - 7 * GUN)).toBe(4);
  });

  it('başka kuralın kullanımı karışmaz', () => {
    const k = nakitKullanimlari(cokKullanim);
    expect(kullanimSayisi(k, 'baska-bonus', simdi - GUN)).toBe(1);
  });

  it('pencere dışındaki kullanım sayılmaz', () => {
    const k = nakitKullanimlari([d('Bonus x / op', 100, gunOnce(10))]);
    expect(kullanimSayisi(k, 'x', simdi - GUN)).toBe(0);
  });

  it('kural anahtarı büyük/küçük harf duyarsız', () => {
    const k = nakitKullanimlari([d('Bonus Kayip-Bonusu / op', 100, gunOnce(0))]);
    expect(kullanimSayisi(k, 'kayip-bonusu', simdi - GUN)).toBe(1);
  });

  it('boş kural anahtarı hiçbir şey saymaz', () => {
    const k = nakitKullanimlari([d('Bonus x / op', 100, gunOnce(0))]);
    expect(kullanimSayisi(k, '', simdi - GUN)).toBe(0);
  });
});

describe('mükerrer koruma', () => {
  it('aynı kural bugün verilmişse yakalanır', () => {
    const k = nakitKullanimlari([d('Bonus kayip-bonusu / op', 2500, gunOnce(0))]);
    expect(bugunVerilmisMi(k, 'kayip-bonusu', simdi - GUN)).toBe(true);
  });

  it('dün verilmişse bugünü engellemez', () => {
    const k = nakitKullanimlari([d('Bonus kayip-bonusu / op', 2500, gunOnce(2))]);
    expect(bugunVerilmisMi(k, 'kayip-bonusu', simdi - GUN)).toBe(false);
  });

  it('hiç kullanım yoksa false', () => {
    expect(bugunVerilmisMi([], 'kayip-bonusu', simdi - GUN)).toBe(false);
  });
});

/**
 * UÇTAN UCA: limit artik nakit bonuslarda da calisiyor.
 *
 * Onceden checkUsageLimits `account.bonuses` listesinden sayiyordu ve
 * bakiye duzeltmeleri orada gorunmedigi icin nakit bonuslarda her zaman
 * "0 kullanim" cikiyordu.
 */
describe('gerçek kuralla uçtan uca', () => {
  const kural = {
    enabled: true, type: 'cash', title: 'Kayip Bonusu', lossBonus: true,
    perDayLimit: 1,
    amountType: 'tieredPercentage',
    tieredPercentageRanges: [{ min: 50, max: 999999999, percent: 25 }],
  };
  const kurallar = { PROMO_SPECS: { 'kayip-bonusu': kural }, PROMO_TITLE_SPECS: {} } as any;

  const hesap = (duzeltmeler: DuzeltmeSatiri[]) => ({
    id: 2492369, balance: 0, netLoss: 10_000,
    lastDeposit: { amount: 10_000, dateLocal: new Date().toISOString() },
    bonuses: [],                      // kampanya atamasi YOK — nakit bonus burada gorunmez
    balanceCorrections: duzeltmeler,  // ama duzeltmede var
    profileTransactions: [], profileTransactionsByType: {},
    dataCompleteness: { kpi: true, payments: true, financialMovements: true, bonuses: true, casino: true, sport: true },
  }) as any;

  const madde = async (duzeltmeler: DuzeltmeSatiri[]) => {
    const { evaluateForAccount } = await import('./promoEvaluator.js');
    const r = await evaluateForAccount(
      hesap(duzeltmeler),
      { id: 'kayip-bonusu', title: 'Kayip Bonusu' } as any,
      kurallar, 'default', 'bonus',
    );
    return r.items.find((i: any) => i.id === 'per-day-limit');
  };

  it('hiç kullanım yoksa limit geçer', async () => {
    expect((await madde([]))?.ok).toBe(true);
  });

  it('bugün bir kez alınmışsa limit DÜŞER — bildirilen sızıntı', async () => {
    const bugun = new Date().toISOString();
    const m = await madde([{ not: 'Bonus kayip-bonusu / destek1', tutar: 2500, tarih: bugun, tur: 'crediting' }]);
    expect(m?.ok).toBe(false);
    expect(m?.reason).toContain('1/1');
  });

  it('düzeltme listesi boşken eski davranış korunur (kampanya bonusları)', async () => {
    // bonuses bos + duzeltme bos -> 0 kullanim, limit gecer.
    expect((await madde([]))?.ok).toBe(true);
  });

  it('elle yazılmış düzeltme limiti tüketmez', async () => {
    const bugun = new Date().toISOString();
    const m = await madde([{ not: 'Musteri telafisi', tutar: 5000, tarih: bugun, tur: 'crediting' }]);
    expect(m?.ok).toBe(true);
  });
});

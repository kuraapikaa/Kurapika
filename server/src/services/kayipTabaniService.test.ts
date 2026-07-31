import { describe, expect, it } from 'vitest';
import { kayipTabani, type OdemeHareketi } from './kayipTabaniService.js';
import { evaluateForAccount } from './promoEvaluator.js';

/**
 * PARA REGRESYON TESTI.
 *
 * Bildirilen vaka: oyuncu 10.000 kendi parasini yatirdi, uzerine 2x manuel
 * duzeltme aldi (20.000) ve toplam ~30.000 cevirdi. Taban GGR oldugu icin
 * ~23.000 gorundu, %30 diliminden 7.000 kayip bonusu yazildi. Kasa kendi
 * verdigi paranin kaybini geri odedi.
 *
 * Yeni taban yalnizca YATIRIM − CEKIM sayiyor; bonus ve manuel duzeltme
 * yatirim islemi olmadigi icin tabana hic girmiyor.
 */

const y = (tutar: number, tarih: string, durum = 'success'): OdemeHareketi =>
  ({ tur: 'deposit', durum, tutar, tarih });
const c = (tutar: number, tarih: string, durum = 'success'): OdemeHareketi =>
  ({ tur: 'withdrawal', durum, tutar, tarih });

describe('bildirilen vaka', () => {
  it('manuel düzeltmeyle verilen para tabana GİRMEZ', () => {
    // Yalnizca 10.000 yatirim var. 20.000 manuel duzeltme bir odeme
    // hareketi degil, listede hic yok — taban 10.000 kalmali.
    const sonuc = kayipTabani([y(10_000, '2026-07-30T10:00:00Z')]);
    expect(sonuc.netLoss).toBe(10_000);
  });

  it('eski davranışta taban 23.000 olurdu — artık 10.000', () => {
    // GGR tabani bonus parasiyla oynanani da sayiyordu; bu test o farkin
    // kapandigini kayit altina aliyor.
    const sonuc = kayipTabani([y(10_000, '2026-07-30T10:00:00Z')]);
    expect(sonuc.netLoss).toBeLessThan(23_000);
    // %30 dilimine (20.000+) girmiyor; 5.000-19.999 diliminden %25 = 2.500.
    expect(sonuc.netLoss! * 0.25).toBe(2_500);
  });
});

describe('yatırım − çekim', () => {
  it('çekim tabandan düşer', () => {
    const sonuc = kayipTabani([
      c(2_000, '2026-07-01T00:00:00Z'),
      y(10_000, '2026-07-30T10:00:00Z'),
    ]);
    expect(sonuc.netLoss).toBe(10_000); // cekim donemin ONCESINDE
  });

  it('birden fazla yatırım toplanır', () => {
    const sonuc = kayipTabani([
      y(3_000, '2026-07-30T10:00:00Z'),
      y(7_000, '2026-07-30T12:00:00Z'),
    ]);
    expect(sonuc.netLoss).toBe(10_000);
  });

  it('negatife düşmez', () => {
    const sonuc = kayipTabani([
      y(1_000, '2026-07-30T10:00:00Z'),
      c(5_000, '2026-07-30T11:00:00Z'),
    ]);
    // Son cekim donem sinirini olusturur; sonrasinda yatirim yok -> 0.
    expect(sonuc.netLoss).toBe(0);
  });
});

describe('dönem penceresi: son ödenen çekim', () => {
  it('çekimden ÖNCEKİ yatırımlar sayılmaz', () => {
    // Omur boyu alinsaydi 60.000 cikardi; oyuncu parasini geri aldi,
    // o donem kapandi.
    const sonuc = kayipTabani([
      y(50_000, '2026-01-01T00:00:00Z'),
      c(45_000, '2026-06-01T00:00:00Z'),
      y(10_000, '2026-07-30T10:00:00Z'),
    ]);
    expect(sonuc.netLoss).toBe(10_000);
    expect(sonuc.donemBaslangici).toBe('2026-06-01T00:00:00.000Z');
  });

  it('aynı kaybı iki kez paraya çevirmeyi engeller', () => {
    // Cekim yoksa omur boyu birikirdi; cekimle sinirlandigi icin
    // her donem bir kez sayilir.
    const cekimsiz = kayipTabani([
      y(20_000, '2026-01-01T00:00:00Z'),
      y(20_000, '2026-07-01T00:00:00Z'),
    ]);
    expect(cekimsiz.netLoss).toBe(40_000); // hic cekim yok: hepsi acik donem

    const cekimli = kayipTabani([
      y(20_000, '2026-01-01T00:00:00Z'),
      c(20_000, '2026-02-01T00:00:00Z'),
      y(20_000, '2026-07-01T00:00:00Z'),
    ]);
    expect(cekimli.netLoss).toBe(20_000);
  });

  it('hiç çekim yoksa dönem başlangıcı null', () => {
    expect(kayipTabani([y(5_000, '2026-07-30T10:00:00Z')]).donemBaslangici).toBeNull();
  });

  it('son çekimden sonra yatırım yoksa taban 0', () => {
    const sonuc = kayipTabani([
      y(10_000, '2026-01-01T00:00:00Z'),
      c(10_000, '2026-07-30T10:00:00Z'),
    ]);
    expect(sonuc.netLoss).toBe(0);
  });
});

describe('yalnızca başarılı işlemler sayılır', () => {
  it('reddedilen yatırım tabana girmez', () => {
    const sonuc = kayipTabani([
      y(10_000, '2026-07-30T10:00:00Z'),
      y(50_000, '2026-07-30T11:00:00Z', 'rejected'),
    ]);
    expect(sonuc.netLoss).toBe(10_000);
  });

  it('bekleyen çekim dönemi kapatmaz', () => {
    // Para henuz odenmedi; donem acik kalmali.
    const sonuc = kayipTabani([
      y(10_000, '2026-07-30T10:00:00Z'),
      c(10_000, '2026-07-30T12:00:00Z', 'pending'),
    ]);
    expect(sonuc.netLoss).toBe(10_000);
  });

  it('başarısız çekim de dönemi kapatmaz', () => {
    const sonuc = kayipTabani([
      y(8_000, '2026-07-30T10:00:00Z'),
      c(8_000, '2026-07-30T12:00:00Z', 'failed'),
    ]);
    expect(sonuc.netLoss).toBe(8_000);
  });
});

describe('veri yokluğu ile sıfır ayrı şeyler', () => {
  it('hiç yatırım yoksa undefined — "veri yok"', () => {
    expect(kayipTabani([]).netLoss).toBeUndefined();
    expect(kayipTabani([c(5_000, '2026-07-30T10:00:00Z')]).netLoss).toBeUndefined();
  });

  it('yatırım var ama dönemde yoksa 0 — "kayıp yok"', () => {
    const sonuc = kayipTabani([
      y(10_000, '2026-01-01T00:00:00Z'),
      c(10_000, '2026-07-30T10:00:00Z'),
    ]);
    expect(sonuc.netLoss).toBe(0);
    expect(sonuc.netLoss).not.toBeUndefined();
  });
});

describe('bozuk girdi', () => {
  it('geçersiz tarih ve tutar çökmez', () => {
    const sonuc = kayipTabani([
      { tur: 'deposit', durum: 'success', tutar: NaN as never, tarih: 'gecersiz' },
      y(5_000, '2026-07-30T10:00:00Z'),
    ]);
    expect(sonuc.netLoss).toBe(5_000);
  });

  it('negatif tutar mutlak değere çevrilir', () => {
    expect(kayipTabani([y(-5_000, '2026-07-30T10:00:00Z')]).netLoss).toBe(5_000);
  });

  it('boş/null liste çökmez', () => {
    expect(kayipTabani(undefined as never).netLoss).toBeUndefined();
  });

  it('durum büyük harfli gelse de sayılır', () => {
    expect(kayipTabani([{ tur: 'Deposit', durum: 'SUCCESS', tutar: 900, tarih: '2026-07-30T10:00:00Z' }]).netLoss).toBe(900);
  });
});

describe('denetlenebilirlik', () => {
  it('dönem yatırım ve çekim toplamları ayrı raporlanır', () => {
    const sonuc = kayipTabani([
      c(1_000, '2026-06-01T00:00:00Z'),
      y(4_000, '2026-07-01T00:00:00Z'),
      y(6_000, '2026-07-02T00:00:00Z'),
    ]);
    expect(sonuc).toMatchObject({ netLoss: 10_000, donemYatirimi: 10_000, donemCekimi: 0 });
  });
});

/**
 * UÇTAN UCA: bildirilen vaka, gercek kayip bonusu kuraliyla.
 *
 * default.json'daki kademeler: 50-4.999 %20 / 5.000-19.999 %25 /
 * 20.000+ %30.
 */
describe('gerçek kuralla uçtan uca', () => {
  const kurallar = {
    PROMO_SPECS: {
      'kayip-bonusu': {
        enabled: true, type: 'cash', title: 'Kayip Bonusu', lossBonus: true,
        amountType: 'tieredPercentage',
        tieredPercentageRanges: [
          { min: 50, max: 4999, percent: 20 },
          { min: 5000, max: 19999, percent: 25 },
          { min: 20000, max: 999999999, percent: 30 },
        ],
      },
    },
    PROMO_TITLE_SPECS: {},
  } as any;

  const hesap = (netLoss: number | undefined) => ({
    id: 2492369, balance: 0, netLoss,
    lastDeposit: { amount: 10_000, dateLocal: '2026-07-30T10:00:00Z' },
    bonuses: [], profileTransactions: [], profileTransactionsByType: {},
    dataCompleteness: { kpi: true, payments: true, financialMovements: true, bonuses: true, casino: true, sport: true },
  }) as any;

  const tutar = async (netLoss: number | undefined) => {
    const r = await evaluateForAccount(hesap(netLoss), { id: 'kayip-bonusu', title: 'Kayip Bonusu' } as any, kurallar, 'default', 'bonus');
    return r.calculatedAmount ?? 0;
  };

  it('YENİ taban (10.000) → 2.500, eski taban (23.333) → 7.000 idi', async () => {
    const yeni = kayipTabani([{ tur: 'deposit', durum: 'success', tutar: 10_000, tarih: '2026-07-30T10:00:00Z' }]);
    expect(await tutar(yeni.netLoss)).toBe(2_500);

    // Bildirilen hatali sonucun nasil olustugunun kaydi.
    expect(await tutar(23_333)).toBeCloseTo(7_000, 0);
  });

  it('veri yoksa bonus hesaplanmaz', async () => {
    expect(await tutar(undefined)).toBe(0);
  });
});

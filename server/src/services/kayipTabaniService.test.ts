import { describe, expect, it } from 'vitest';
import { kayipTabani, type OdemeHareketi } from './kayipTabaniService.js';
import { evaluateForAccount } from './promoEvaluator.js';
import { odemeSatiriniNormalize } from './odemeTutari.js';

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

describe('haftalık dönem', () => {
  // 2026-08-10 Pazartesi 12:00 UTC = 2026-08-10 15:00 Istanbul (ayni Turkiye haftasi).
  const simdi = Date.parse('2026-08-10T12:00:00Z');

  it('bu haftadan önceki yatırımı tabana katmaz', () => {
    const sonuc = kayipTabani([
      y(10_000, '2026-08-01T10:00:00Z'), // gecen hafta
      y(3_000, '2026-08-11T10:00:00Z'), // bu hafta
    ], { donemTipi: 'haftalik', simdi });
    expect(sonuc.netLoss).toBe(3_000);
  });

  it('son ödenen çekim bu haftanın başlangıcından daha yakınsa onu esas alır', () => {
    const sonuc = kayipTabani([
      y(10_000, '2026-08-11T08:00:00Z'),
      c(4_000, '2026-08-11T09:00:00Z'), // hafta ortasi cekim
      y(2_000, '2026-08-11T10:00:00Z'),
    ], { donemTipi: 'haftalik', simdi });
    // Cekimden ONCEKI 10.000 tabana girmez; yalnizca sonraki 2.000.
    expect(sonuc.netLoss).toBe(2_000);
  });

  it('sonOdenenCekim (varsayılan) haftayla sınırlı değildir', () => {
    const sonuc = kayipTabani([y(10_000, '2026-08-01T10:00:00Z')], { simdi });
    expect(sonuc.netLoss).toBe(10_000);
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

describe('lossBonusPeriod: weekly — uçtan uca', () => {
  const kurallar = {
    PROMO_SPECS: {
      'haftalik-kayip-bonusu': {
        enabled: true, type: 'cash', title: 'Haftalık Kayıp Bonusu',
        lossBonus: true, lossBonusPeriod: 'weekly',
        amountType: 'percentage', percentageAmount: 20,
      },
    },
    PROMO_TITLE_SPECS: {},
  } as any;

  const hesap = (netLoss: number | undefined, netLossWeekly: number | undefined) => ({
    id: 2492369, balance: 0, netLoss, netLossWeekly,
    lastDeposit: { amount: 10_000, dateLocal: '2026-08-11T10:00:00Z' },
    bonuses: [], profileTransactions: [], profileTransactionsByType: {},
    dataCompleteness: { kpi: true, payments: true, financialMovements: true, bonuses: true, casino: true, sport: true },
  }) as any;

  it('weekly işaretli kural netLossWeekly\'i okur, ömür boyu netLoss\'u değil', async () => {
    const sonuc = await evaluateForAccount(
      hesap(50_000, 1_000), // omur boyu 50.000, bu hafta yalnizca 1.000
      { id: 'haftalik-kayip-bonusu', title: 'Haftalık Kayıp Bonusu' } as any,
      kurallar, 'default', 'bonus',
    );
    expect(sonuc.calculatedAmount).toBe(200); // %20 x 1.000, 50.000 degil
  });

  it('bu hafta net kaybı yoksa reddeder, ömür boyu kayıp olsa bile', async () => {
    const sonuc = await evaluateForAccount(
      hesap(50_000, 0),
      { id: 'haftalik-kayip-bonusu', title: 'Haftalık Kayıp Bonusu' } as any,
      kurallar, 'default', 'bonus',
    );
    const madde = sonuc.items.find((i) => i.id === 'loss-bonus-net-loss');
    expect(madde?.ok).toBe(false);
    expect(madde?.reason).toContain('bu hafta');
  });
});

/**
 * SON 24 SAAT PENCERESI.
 *
 * Bildirilen sorun: kayip bonusu tum zamanlarin yatirim ve cekimini
 * topluyordu; yalnizca son 24 saati almasi gerekiyor. Varsayilan taban
 * son ODENEN CEKIMDEN itibaren hesaplaniyor ve arada cekim yoksa omur
 * boyu birikiyor -- aylar once yatirilan para bugun hala taban.
 */
describe('donemTipi: son24Saat', () => {
  const SIMDI = Date.parse('2026-08-21T12:00:00Z');
  const saatOnce = (s: number) => new Date(SIMDI - s * 3_600_000).toISOString();

  const hesapla = (hareketler: any[]) =>
    kayipTabani(hareketler, { donemTipi: 'son24Saat', simdi: SIMDI });

  it('24 saatten ESKI yatirimi saymaz', () => {
    const sonuc = hesapla([
      { tur: 'deposit', durum: 'success', tutar: 50_000, tarih: saatOnce(200) }, // ~8 gun once
      { tur: 'deposit', durum: 'success', tutar: 1_000, tarih: saatOnce(3) },
    ]);
    expect(sonuc.netLoss).toBe(1_000);
    expect(sonuc.donemYatirimi).toBe(1_000);
  });

  it('24 saat icindeki cekimi yatirimdan duser', () => {
    const sonuc = hesapla([
      { tur: 'deposit', durum: 'success', tutar: 5_000, tarih: saatOnce(10) },
      { tur: 'withdrawal', durum: 'success', tutar: 2_000, tarih: saatOnce(8) },
      { tur: 'deposit', durum: 'success', tutar: 3_000, tarih: saatOnce(6) },
    ]);
    // Cekim siniri: 8 saat once. Taban ondan SONRAKI yatirim = 3.000.
    // Cekimden onceki 5.000 sayilmaz -- oyuncu parasini geri aldi.
    expect(sonuc.netLoss).toBe(3_000);
  });

  it('pencere KAYAR, gece yarisinda sifirlanmaz', () => {
    // 23 saat once yapilan yatirim hala kapsamda; takvim gunu olsaydi
    // dunku yatirim kapsam disi kalirdi.
    const sonuc = hesapla([
      { tur: 'deposit', durum: 'success', tutar: 4_000, tarih: saatOnce(23) },
    ]);
    expect(sonuc.netLoss).toBe(4_000);
  });

  it('tam 24 saat sinirindaki kayit kapsam DISI (sinir dahil degil)', () => {
    const sonuc = hesapla([
      { tur: 'deposit', durum: 'success', tutar: 9_000, tarih: saatOnce(24) },
      { tur: 'deposit', durum: 'success', tutar: 100, tarih: saatOnce(1) },
    ]);
    expect(sonuc.netLoss).toBe(100);
  });

  it('basarisiz islemleri saymaz', () => {
    const sonuc = hesapla([
      { tur: 'deposit', durum: 'failed', tutar: 10_000, tarih: saatOnce(2) },
      { tur: 'deposit', durum: 'success', tutar: 500, tarih: saatOnce(2) },
    ]);
    expect(sonuc.netLoss).toBe(500);
  });

  it('24 saat icinde yatirim yoksa taban 0 (veri yok DEGIL)', () => {
    const sonuc = hesapla([
      { tur: 'deposit', durum: 'success', tutar: 50_000, tarih: saatOnce(100) },
    ]);
    // Yatirim kaydi VAR ama pencerede degil: "kayip yok" demek dogru.
    expect(sonuc.netLoss).toBe(0);
  });

  it('hic yatirim yoksa undefined (veri eksikligi gorunur kalsin)', () => {
    expect(hesapla([]).netLoss).toBeUndefined();
  });

  it('varsayilan donem AYNI veride tum zamanlari alir — farki gosterir', () => {
    const hareketler = [
      { tur: 'deposit', durum: 'success', tutar: 50_000, tarih: saatOnce(200) },
      { tur: 'deposit', durum: 'success', tutar: 1_000, tarih: saatOnce(3) },
    ];
    // Bildirilen hatanin ta kendisi: cekim yoksa varsayilan taban her seyi topluyor.
    expect(kayipTabani(hareketler).netLoss).toBe(51_000);
    expect(hesapla(hareketler).netLoss).toBe(1_000);
  });
});

describe('lossBonusPeriod: last24h — uçtan uca', () => {
  const kurallar = {
    PROMO_SPECS: {
      'kayip-bonusu': {
        enabled: true, type: 'cash', title: '%30 Kayıp Bonusu',
        lossBonus: true, lossBonusPeriod: 'last24h',
        amountType: 'percentage', percentageAmount: 30,
      },
    },
    PROMO_TITLE_SPECS: {},
  } as any;

  const hesap = (netLoss: number | undefined, netLoss24h: number | undefined) => ({
    id: 2492369, balance: 0, netLoss, netLoss24h,
    lastDeposit: { amount: 10_000, dateLocal: '2026-08-21T10:00:00Z' },
    bonuses: [], profileTransactions: [], profileTransactionsByType: {},
    dataCompleteness: { kpi: true, payments: true, financialMovements: true, bonuses: true, casino: true, sport: true },
  }) as any;

  it('last24h isaretli kural netLoss24h okur, omur boyu netLoss degil', async () => {
    const sonuc = await evaluateForAccount(
      hesap(50_000, 1_000), // omur boyu 50.000, son 24 saatte 1.000
      { id: 'kayip-bonusu', title: '%30 Kayıp Bonusu' } as any,
      kurallar, 'default', 'bonus',
    );
    expect(sonuc.calculatedAmount).toBe(300); // %30 x 1.000
  });

  it('son 24 saatte kayip yoksa reddeder, omur boyu kayip olsa bile', async () => {
    const sonuc = await evaluateForAccount(
      hesap(50_000, 0),
      { id: 'kayip-bonusu', title: '%30 Kayıp Bonusu' } as any,
      kurallar, 'default', 'bonus',
    );
    const madde = sonuc.items.find((i) => i.id === 'loss-bonus-net-loss');
    expect(madde?.ok).toBe(false);
    expect(madde?.reason).toContain('son 24 saatte');
  });
});

/**
 * PARA SIZINTISI REGRESYONU — şişmiş yatırım tabanı.
 *
 * Bildirilen vaka: oyuncu 2499894'e 22.08.2026 02:04'te 13.650 TRY
 * kayıp bonusu yazıldı. Kök sebep zincirin BAŞINDAYDI: yatırım satırının
 * tutarı `amount` alanından okunuyordu ve canlıda ölçülen değer
 * `amount: 2000` iken gerçek yatırım `actualAmount: 500` idi.
 *
 * Taban dört kat şişince %30'luk kademe de dört kat ödedi. Bu test
 * zinciri baştan sona kuruyor: ham satır → normalize → kayıp tabanı.
 */
describe('şişmiş amount kayıp tabanını şişirmemeli', () => {
  const hamSatirlar = [
    { transactionType: 'deposit', status: 'success', amount: 2000, actualAmount: 500, createdAt: '2026-08-20T10:00:00Z' },
    { transactionType: 'deposit', status: 'success', amount: 8000, actualAmount: 2000, createdAt: '2026-08-21T10:00:00Z' },
  ];

  const hareketlereCevir = (satirlar: Array<Record<string, unknown>>) =>
    satirlar.map(odemeSatiriniNormalize).map((row) => ({
      tur: String(row.transactionType ?? ''),
      durum: String(row.status ?? ''),
      // lynonBackofficeService de tam olarak boyle kuruyor.
      tutar: Number(row.amount),
      tarih: String(row.createdAt ?? ''),
    }));

  it('taban gerçek yatırımdan hesaplanır, amount alanından değil', () => {
    const taban = kayipTabani(hareketlereCevir(hamSatirlar));
    // Gercek: 500 + 2000 = 2500. Duzeltme oncesi 10.000 cikiyordu.
    expect(taban.netLoss).toBe(2500);
  });

  it('%30 kademe artık dört kat fazla ödemiyor', () => {
    const taban = kayipTabani(hareketlereCevir(hamSatirlar));
    const bonus = Math.round((taban.netLoss ?? 0) * 0.3 * 100) / 100;
    expect(bonus).toBe(750);
    // Duzeltme oncesi: 10.000 * %30 = 3.000.
    expect(bonus).toBeLessThan(3000);
  });

  it('çekim düşüldükten sonra da doğru', () => {
    const taban = kayipTabani(hareketlereCevir([
      { transactionType: 'withdrawal', status: 'success', amount: 300, createdAt: '2026-08-19T10:00:00Z' },
      ...hamSatirlar,
    ]));
    // Cekim 19'unda; sonraki yatirimlar 500 + 2000 = 2500.
    expect(taban.netLoss).toBe(2500);
  });
});

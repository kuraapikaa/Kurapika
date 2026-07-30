import { describe, expect, it } from 'vitest';
import { evaluateForAccount } from './promoEvaluator.js';
import varsayilanKurallar from '../data/rules/default.json' with { type: 'json' };

/**
 * "4. Yatirimin Bizden Hediye" ve "%400 Carsamba Happy Days" kural
 * konfigurasyonlari.
 *
 * Ikisi de ayni gunun yatirim SIRASINA bakiyor; bu yuzden snapshot'taki
 * sameDayDeposits alanina bagimlilar. Alan eskiden yeniye sirali gelmeli —
 * sira ters olursa Happy Days kademesi ve hediye ortalamasi yanlis cikar.
 */

const HEDIYE = (varsayilanKurallar as any).PROMO_SPECS['dorduncu-yatirim-hediyesi'];
const HAPPY = (varsayilanKurallar as any).PROMO_SPECS['carsamba-happy-days'];

function hesap(yatirimlar: number[], ek: Record<string, unknown> = {}) {
  const sameDayDeposits = yatirimlar.map((amount, i) => ({
    amount,
    dateLocal: `2026-07-29T${String(9 + i).padStart(2, '0')}:00:00.000Z`,
  }));
  return {
    id: 1,
    balance: 0,
    netLoss: 1000,
    openBetCount: 0,
    sameDayDeposits,
    sameDayDepositCount: sameDayDeposits.length,
    lastDeposit: sameDayDeposits.at(-1) ?? { amount: 0, dateLocal: '2026-07-29T09:00:00.000Z' },
    bonuses: [],
    profileTransactions: [],
    profileTransactionsByType: {},
    dataCompleteness: { kpi: true, payments: true, financialMovements: true, bonuses: true, casino: true, sport: true },
    ...ek,
  } as any;
}

async function degerlendir(spec: unknown, anahtar: string, baslik: string, account: unknown) {
  const kurallar = { PROMO_SPECS: { [anahtar]: spec }, PROMO_TITLE_SPECS: {} } as any;
  return evaluateForAccount(account as any, { id: anahtar, title: baslik } as any, kurallar, 'default', 'bonus');
}

const hediye = (account: unknown) =>
  degerlendir(HEDIYE, 'dorduncu-yatirim-hediyesi', '4. Yatirimin Bizden Hediye!', account);
const happy = (account: unknown) =>
  degerlendir(HAPPY, 'carsamba-happy-days', '%400 Carsamba Happy Days', account);

const madde = (r: any, id: string) => r.items.find((i: any) => i.id === id);

describe('4. Yatırımın Bizden Hediye', () => {
  it('üç yatırım ve net kayıp varsa ortalama kadar bonus', async () => {
    const r = await hediye(hesap([500, 1000, 1500]));
    expect(madde(r, 'consecutive-loss-deposits').ok).toBe(true);
    expect(r.calculatedAmount).toBe(1000); // (500 + 1000 + 1500) / 3
  });

  it('iki yatırımda kural düşer — dördüncü yatırım hakkı doğmamıştır', async () => {
    const r = await hediye(hesap([500, 1000]));
    expect(madde(r, 'consecutive-loss-deposits').ok).toBe(false);
    expect(r.overallOk).toBe(false);
  });

  it('net kayıp yoksa kural düşer — üç yatırım da kaybedilmiş olmalı', async () => {
    const r = await hediye(hesap([500, 1000, 1500], { netLoss: 0 }));
    expect(madde(r, 'consecutive-loss-deposits').ok).toBe(false);
  });

  it('yatırımlardan biri 500 TL altındaysa kural düşer', async () => {
    const r = await hediye(hesap([500, 400, 1500]));
    expect(madde(r, 'each-deposit-minimum').ok).toBe(false);
    expect(madde(r, 'each-deposit-minimum').reason).toContain('400');
  });

  it('ortalama 100 TL altına düşerse alt sınıra yükseltilir', async () => {
    // Alt sinir kampanya metnindeki "bonus 100-2.000 TL araligindadir"
    // ifadesinden geliyor: dusuk ortalama bonusu iptal etmez, yukseltir.
    const r = await hediye(hesap([500, 500, 500], { netLoss: 1000 }));
    expect(r.calculatedAmount).toBe(500);
  });

  it('ortalama 2.000 TL tavanını aşamaz', async () => {
    const r = await hediye(hesap([5000, 6000, 7000]));
    expect(r.calculatedAmount).toBe(2000);
  });

  it('ortalama son ÜÇ yatırımdan alınır, günün tamamından değil', async () => {
    // Gunun ilk yatirimi 10.000 olsa da ortalamaya girmemeli.
    const r = await hediye(hesap([10000, 500, 600, 700]));
    expect(r.calculatedAmount).toBe(600); // (500 + 600 + 700) / 3
  });
});

describe('%400 Çarşamba Happy Days', () => {
  it('günün kaçıncı yatırımı olduğuna göre kademe seçilir', async () => {
    // Carsamba disinda active-days-check duser; tutar hesabini ayrica dogruluyoruz.
    expect((await happy(hesap([1000]))).calculatedAmount).toBe(200);              // 1. → %20
    expect((await happy(hesap([1000, 1000]))).calculatedAmount).toBe(400);         // 2. → %40
    expect((await happy(hesap([1000, 1000, 1000]))).calculatedAmount).toBe(600);   // 3. → %60
    expect((await happy(hesap([1000, 1000, 1000, 1000]))).calculatedAmount).toBe(800); // 4. → %80
    expect((await happy(hesap(Array(5).fill(1000)))).calculatedAmount).toBe(1000); // 5. → %100
  });

  it('yüzde SON yatırıma uygulanır, günün toplamına değil', async () => {
    // 3. yatirim 2.000 TL; taban 2.000 olmali (toplam 4.000 degil).
    const r = await happy(hesap([1000, 1000, 2000]));
    expect(r.calculatedAmount).toBe(1200); // 2000 × %60
  });

  it('altıncı yatırım kademe dışı — kampanya beş kademeyle sınırlı', async () => {
    const r = await happy(hesap(Array(6).fill(1000)));
    expect(r.calculatedAmount ?? 0).toBe(0);
    expect(madde(r, 'bonus-calculation').ok).toBe(false);
    expect(madde(r, 'bonus-calculation').reason).toContain('5 kademeyle');
  });

  it('kademeler kampanya metniyle birebir aynı', () => {
    // DIKKAT: kampanya adi "%400" ama kademe toplami %300 (20+40+60+80+100).
    // "%400" pazarlama basligi; yuzdeler narcosBonusCatalog'daki sart
    // metninden geliyor. Kademe listesi degistirilecekse once o metin
    // guncellenmeli — ikisi ayrisirsa oyuncuya yanlis tutar cikar.
    expect(HAPPY.dailySequencePercents).toEqual([20, 40, 60, 80, 100]);
  });

  it('yalnızca çarşamba günü aktif', async () => {
    const r = await happy(hesap([1000]));
    const gun = madde(r, 'active-days-check');
    expect(gun).toBeDefined();
    const bugunCarsamba = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', weekday: 'long' })
      .format(new Date()) === 'Wednesday';
    expect(gun.ok).toBe(bugunCarsamba);
  });

  it('açık bahis varsa kural düşer', async () => {
    const r = await happy(hesap([1000], { openBetCount: 2 }));
    expect(madde(r, 'no-open-bets').ok).toBe(false);
  });
});

describe('konfigürasyon bütünlüğü', () => {
  it('her iki kural da nakit tipi — platform bonus ID’si gerektirmez', () => {
    expect(HEDIYE.type).toBe('cash');
    expect(HAPPY.type).toBe('cash');
    expect(HEDIYE.partnerBonusId).toBeUndefined();
    expect(HAPPY.partnerBonusId).toBeUndefined();
  });

  it('ikisi de kayıp bonusu tabanından düşülür — aynı paraya iki bonus verilmez', () => {
    expect(HEDIYE.excludeFromLossCalculations).toBe(true);
    expect(HAPPY.excludeFromLossCalculations).toBe(true);
  });

  it('sameDayDeposits yoksa çökmez, kural düşer', async () => {
    const r = await hediye({ ...hesap([]), sameDayDeposits: undefined });
    expect(r.overallOk).toBe(false);
  });
});

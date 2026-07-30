import { describe, expect, it } from 'vitest';
import { churnSkoru, churnListesi, DEGER_ESIKLERI } from './churnScoreService.js';

/**
 * Skor para ve musteri iliskisi kararlarini etkiliyor: kimin aranacagini,
 * kime bonus verilecegini belirliyor. Esikler sessizce kayarsa yanlis
 * kisilere kampanya gider. Bu yuzden davranis burada kilitli.
 */

const SIMDI = Date.parse('2026-07-30T12:00:00.000Z');
const gunOnce = (n: number) => new Date(SIMDI - n * 86_400_000).toISOString();

function oyuncu(over: Partial<Parameters<typeof churnSkoru>[0]> = {}) {
  return {
    lastLoginDate: gunOnce(1),
    registrationDate: gunOnce(400),
    totalDeposits: 5000,
    totalWithdrawals: 1000,
    balance: 500,
    isLocked: false,
    ...over,
  };
}

describe('churn skoru — sessizlik', () => {
  it('dün giriş yapan riskli değil', () => {
    const r = churnSkoru(oyuncu(), SIMDI);
    expect(r.skor).toBe(0);
    expect(r.seviye).toBe('dusuk');
  });

  it('sessizlik arttıkça skor artar', () => {
    const gunler = [7, 14, 30, 60];
    const skorlar = gunler.map((g) => churnSkoru(oyuncu({ lastLoginDate: gunOnce(g) }), SIMDI).skor);
    for (let i = 1; i < skorlar.length; i++) {
      expect(skorlar[i]).toBeGreaterThan(skorlar[i - 1]);
    }
  });

  it('hiç giriş kaydı yoksa sebep olarak işaretlenir', () => {
    const r = churnSkoru(oyuncu({ lastLoginDate: null }), SIMDI);
    expect(r.sessizGun).toBeNull();
    expect(r.sebepler.map((s) => s.kod)).toContain('giris-yok');
  });
});

describe('churn skoru — değer segmenti', () => {
  it('VIP eşiği üstü vip sayılır', () => {
    const r = churnSkoru(oyuncu({ totalDeposits: DEGER_ESIKLERI.vip + 1000, totalWithdrawals: 0 }), SIMDI);
    expect(r.segment).toBe('vip');
  });

  it('aynı sessizlikte VIP daha yüksek skor alır — kaybedilen gelir büyük', () => {
    const sade = churnSkoru(oyuncu({ lastLoginDate: gunOnce(20), totalDeposits: 1500, totalWithdrawals: 0 }), SIMDI);
    const vip = churnSkoru(oyuncu({ lastLoginDate: gunOnce(20), totalDeposits: 90000, totalWithdrawals: 0 }), SIMDI);
    expect(vip.skor).toBeGreaterThan(sade.skor);
    expect(vip.sebepler.map((s) => s.kod)).toContain('vip-sessiz');
  });

  it('yeni ve düşük hacimli hesap "yeni" segmentinde', () => {
    const r = churnSkoru(oyuncu({ registrationDate: gunOnce(5), totalDeposits: 100, totalWithdrawals: 0 }), SIMDI);
    expect(r.segment).toBe('yeni');
  });
});

describe('churn skoru — davranış sinyalleri', () => {
  it('bakiye boş + çekim yapılmış ayrı sinyal', () => {
    const r = churnSkoru(oyuncu({ balance: 0, totalWithdrawals: 3000 }), SIMDI);
    expect(r.sebepler.map((s) => s.kod)).toContain('bakiye-bos');
  });

  it('net çıkış işaretlenir', () => {
    const r = churnSkoru(oyuncu({ totalDeposits: 1000, totalWithdrawals: 4000 }), SIMDI);
    expect(r.deger).toBe(-3000);
    expect(r.sebepler.map((s) => s.kod)).toContain('net-cikis');
  });

  it('yeni hesabın erken sessizliği onboarding sorunu sayılır', () => {
    const r = churnSkoru(oyuncu({ registrationDate: gunOnce(10), lastLoginDate: gunOnce(8) }), SIMDI);
    expect(r.sebepler.map((s) => s.kod)).toContain('onboarding');
  });
});

describe('churn skoru — kilitli hesap', () => {
  it('kilitli hesap risk listesine girmez', () => {
    const r = churnSkoru(oyuncu({ isLocked: true, lastLoginDate: gunOnce(200) }), SIMDI);
    expect(r.skor).toBe(0);
    expect(r.seviye).toBe('dusuk');
    expect(r.oneri).toContain('kilitli');
  });
});

describe('churn skoru — sınırlar ve öneri', () => {
  it('skor 0-100 aralığını aşmaz', () => {
    const enKotu = churnSkoru(
      oyuncu({ lastLoginDate: gunOnce(500), registrationDate: gunOnce(20), totalDeposits: 200000, totalWithdrawals: 300000, balance: 0 }),
      SIMDI,
    );
    expect(enKotu.skor).toBeLessThanOrEqual(100);
    expect(enKotu.skor).toBeGreaterThan(0);
  });

  it('VIP için öneri kişiye özel temas', () => {
    const r = churnSkoru(oyuncu({ lastLoginDate: gunOnce(40), totalDeposits: 90000, totalWithdrawals: 0 }), SIMDI);
    expect(r.oneri).toContain('VIP');
  });

  it('risksiz oyuncuya aksiyon önerilmez', () => {
    expect(churnSkoru(oyuncu(), SIMDI).oneri).toContain('Aksiyon gerekmiyor');
  });

  it('bozuk tarih çökmez', () => {
    const r = churnSkoru(oyuncu({ lastLoginDate: 'abc', registrationDate: '' }), SIMDI);
    expect(r.sessizGun).toBeNull();
    expect(Number.isFinite(r.skor)).toBe(true);
  });
});

describe('churn listesi', () => {
  it('en riskli önce sıralanır', () => {
    const liste = churnListesi([
      { lastLoginDate: gunOnce(1), totalDeposits: 100 },
      { lastLoginDate: gunOnce(90), totalDeposits: 80000 },
      { lastLoginDate: gunOnce(20), totalDeposits: 2000 },
    ], SIMDI);
    expect(liste[0].churn.skor).toBeGreaterThanOrEqual(liste[1].churn.skor);
    expect(liste[1].churn.skor).toBeGreaterThanOrEqual(liste[2].churn.skor);
  });

  it('boş liste çökmez', () => {
    expect(churnListesi([], SIMDI)).toEqual([]);
  });
});

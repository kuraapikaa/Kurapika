import { describe, expect, it } from 'vitest';
import { carkAnalizi, disaridaKalmaNedeni, type CarkDilimi } from './carkOlasiliklari.js';

/**
 * Panelin GERCEK varsayilan carki (games.ts icindeki liste).
 * Kayip %97, tek gercek odul %3, kalan on dilim sifir ve
 * yapilandirilmamis.
 */
const VARSAYILAN: CarkDilimi[] = [
  { id: 'wheel-pass', label: 'Tekrar Dene', probability: 97, type: 'none', isLoss: true },
  { id: 'wheel-fs-sweet-100', label: '100 Freespin', probability: 0, type: 'bonus', requiresConfiguration: true },
  { id: 'wheel-fs-gates-150', label: '150 Freespin', probability: 0, type: 'bonus', requiresConfiguration: true },
  { id: 'wheel-cash-150', label: '150 ₺ Nakit', probability: 0, type: 'cash', amount: 150, requiresConfiguration: true },
  { id: 'wheel-cash-250', label: '250 ₺ Nakit', probability: 0, type: 'cash', amount: 250, requiresConfiguration: true },
  { id: 'wheel-freebet-500', label: '500 ₺ Freebet', probability: 3, type: 'bonus', requiresConfiguration: false },
  { id: 'wheel-fs-sweet-500', label: '500 ₺ Freespin', probability: 0, type: 'bonus', requiresConfiguration: true },
  { id: 'wheel-cash-500', label: '500 ₺ Nakit', probability: 0, type: 'cash', amount: 500, requiresConfiguration: true },
  { id: 'wheel-cash-10000', label: '10.000 ₺ Nakit', probability: 0, type: 'cash', amount: 10000, requiresConfiguration: true },
  { id: 'wheel-cash-50000', label: '50.000 ₺ Nakit', probability: 0, type: 'cash', amount: 50000, requiresConfiguration: true },
  { id: 'wheel-watch', label: 'Apple Watch Ultra 3', probability: 0, type: 'physical', requiresConfiguration: true },
  { id: 'wheel-iphone', label: 'iPhone 17 Pro Max', probability: 0, type: 'physical', requiresConfiguration: true },
];

describe('disaridaKalmaNedeni', () => {
  it('kayıp dilimi her zaman çekilişe girer', () => {
    expect(disaridaKalmaNedeni({ type: 'none', isLoss: true, probability: 97 })).toBeNull();
  });

  it('yapılandırılmamış ödül girmez', () => {
    expect(disaridaKalmaNedeni({ type: 'cash', amount: 150, probability: 30, requiresConfiguration: true }))
      .toBe('yapilandirilmamis');
  });

  it('fiziksel ödül girmez', () => {
    expect(disaridaKalmaNedeni({ type: 'physical', probability: 5 })).toBe('fiziksel');
  });

  it('yüksek nakit girmez', () => {
    expect(disaridaKalmaNedeni({ type: 'cash', amount: 10_000, probability: 5 })).toBe('yuksek-nakit');
    expect(disaridaKalmaNedeni({ type: 'cash', amount: 1_000, probability: 5 })).toBeNull();
  });

  it('olasılığı sıfır olan girmez', () => {
    expect(disaridaKalmaNedeni({ type: 'bonus', probability: 0 })).toBe('olasilik-sifir');
  });
});

describe('varsayılan çark', () => {
  const analiz = carkAnalizi(VARSAYILAN);

  it('sadece iki dilim çekilişe giriyor', () => {
    expect(analiz.etkinDilim).toBe(2);
    expect(analiz.gercekDagilim.map((d) => d.id)).toEqual(['wheel-pass', 'wheel-freebet-500']);
  });

  it('turların %97si pas dönüyor', () => {
    expect(analiz.gercekPasYuzdesi).toBeCloseTo(97, 5);
  });

  it('panelde görünen oranla gerçek oran aynı — burada çelişki yok', () => {
    expect(analiz.gercekPasYuzdesi).toBeCloseTo(analiz.ayarlananPasYuzdesi!, 5);
    expect(analiz.kaybolanPay).toBe(0);
  });

  it('yüksek pas oranını uyarı olarak bildirir', () => {
    expect(analiz.uyarilar.some((u) => u.includes('97'))).toBe(true);
  });
});

describe('sessiz çelişki — olasılık düşürmek pası çoğaltıyor', () => {
  /**
   * Operator "150 TL Nakit"e %30 verip pasi %67'ye dusuruyor. Nakit dilim
   * yapilandirilmamis oldugu icin motor onu atiyor; toplam agirlik 70'e
   * duyuyor ve pas ORANI ARTIYOR.
   */
  const ayarlanmis: CarkDilimi[] = [
    { id: 'wheel-pass', label: 'Tekrar Dene', probability: 67, type: 'none', isLoss: true },
    { id: 'wheel-cash-150', label: '150 ₺ Nakit', probability: 30, type: 'cash', amount: 150, requiresConfiguration: true },
    { id: 'wheel-freebet-500', label: '500 ₺ Freebet', probability: 3, type: 'bonus', requiresConfiguration: false },
  ];
  const analiz = carkAnalizi(ayarlanmis);

  it('operatör %67 sanıyor ama gerçek %95,7', () => {
    expect(analiz.ayarlananPasYuzdesi).toBeCloseTo(67, 5);
    expect(analiz.gercekPasYuzdesi).toBeCloseTo((67 / 70) * 100, 5);
  });

  it('kaybolan payı adlandırır', () => {
    expect(analiz.kaybolanPay).toBe(30);
    expect(analiz.disaridaKalanlar).toHaveLength(1);
    expect(analiz.disaridaKalanlar[0]).toMatchObject({
      id: 'wheel-cash-150',
      ayarlananOlasilik: 30,
      neden: 'yapilandirilmamis',
    });
  });

  it('çelişkiyi açıkça uyarır', () => {
    expect(analiz.uyarilar.some((u) => u.includes('Olasılığı düşürmek pası çoğaltıyor'))).toBe(true);
  });
});

describe('uç durumlar', () => {
  it('tek çekilebilir dilim kayıpsa çark her turda pas döner', () => {
    const analiz = carkAnalizi([
      { id: 'wheel-pass', label: 'Tekrar Dene', probability: 50, type: 'none', isLoss: true },
      { id: 'x', label: 'Ödül', probability: 50, type: 'physical' },
    ]);
    expect(analiz.gercekPasYuzdesi).toBe(100);
    expect(analiz.uyarilar.some((u) => u.includes('her turda pas'))).toBe(true);
  });

  it('hiçbir dilim çekilişe giremiyorsa bunu söyler', () => {
    const analiz = carkAnalizi([{ id: 'x', label: 'Ödül', probability: 50, type: 'physical' }]);
    expect(analiz.toplamAgirlik).toBe(0);
    expect(analiz.gercekPasYuzdesi).toBeNull();
    expect(analiz.uyarilar.some((u) => u.includes('hata döndürür'))).toBe(true);
  });

  it('olasılığı sıfır olanlar gürültü yapmaz', () => {
    // Varsayilan carkta on dilim sifir; hicbiri "disarida kalan" listesine girmemeli.
    expect(carkAnalizi(VARSAYILAN).disaridaKalanlar).toHaveLength(0);
  });

  it('boş girdi çökmez', () => {
    const analiz = carkAnalizi(null);
    expect(analiz.etkinDilim).toBe(0);
    expect(analiz.gercekPasYuzdesi).toBeNull();
  });

  it('gerçek dağılım yüzdeleri 100e tamamlanır', () => {
    const toplam = carkAnalizi(VARSAYILAN).gercekDagilim.reduce((t, d) => t + d.yuzde, 0);
    expect(toplam).toBeCloseTo(100, 5);
  });
});

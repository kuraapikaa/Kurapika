import { describe, expect, it } from 'vitest';
import {
  acilisiDogrula,
  beklenenDeger,
  gecerliOduller,
  kasaMarji,
  kasaVitrini,
  odulCek,
  type Kasa,
} from './kasaAcma.js';

const kasa = (ekle: Partial<Kasa> = {}): Kasa => ({
  id: 'prime',
  label: 'Prime',
  price: 500,
  enabled: true,
  rewards: [
    { id: 'a', label: 'Boş', amount: 0, weight: 50 },
    { id: 'b', label: '250 ₺', amount: 250, weight: 30 },
    { id: 'c', label: '1.000 ₺', amount: 1000, weight: 15, rarity: 'nadir' },
    { id: 'd', label: '10.000 ₺', amount: 10_000, weight: 5, rarity: 'efsane' },
  ],
  ...ekle,
});

describe('gecerliOduller', () => {
  it('ağırlığı sıfır veya negatif olanı eler', () => {
    const k = kasa({ rewards: [
      { id: 'a', label: 'x', amount: 100, weight: 0 },
      { id: 'b', label: 'y', amount: 100, weight: -5 },
      { id: 'c', label: 'z', amount: 100, weight: 10 },
    ] });
    expect(gecerliOduller(k).map((o) => o.id)).toEqual(['c']);
  });

  it('tutarı geçersiz olanı eler ama SIFIR tutarı korur', () => {
    // Sifir tutar "bos" oduldur ve kasanin en yaygin sonucudur.
    const k = kasa({ rewards: [
      { id: 'a', label: 'boş', amount: 0, weight: 10 },
      { id: 'b', label: 'bozuk', amount: Number.NaN, weight: 10 },
      { id: 'c', label: 'eksi', amount: -5, weight: 10 },
    ] });
    expect(gecerliOduller(k).map((o) => o.id)).toEqual(['a']);
  });

  it('boş kasada boş liste', () => {
    expect(gecerliOduller(null)).toEqual([]);
    expect(gecerliOduller(kasa({ rewards: [] }))).toEqual([]);
  });
});

describe('beklenenDeger ve marj', () => {
  it('ağırlıklı ortalamayı hesaplar', () => {
    // (0*50 + 250*30 + 1000*15 + 10000*5) / 100 = 725
    expect(beklenenDeger(kasa())).toBe(725);
  });

  it('bedelden büyük beklenen değer NEGATİF marj verir', () => {
    // 500 TL'ye satilan kasa ortalama 725 TL odul veriyor: zarar.
    // Bu, ilk oyuncu binlerce kez actiktan sonra degil, kaydedilirken
    // gorulmeli.
    expect(kasaMarji(kasa())).toBeLessThan(0);
  });

  it('kârlı kasada pozitif marj', () => {
    const k = kasa({ price: 1000 });
    expect(kasaMarji(k)).toBeCloseTo(27.5, 1);
  });

  it('bedelsiz kasada marj yok', () => {
    expect(kasaMarji(kasa({ price: 0 }))).toBeNull();
  });

  it('ödülsüz kasada beklenen değer sıfır', () => {
    expect(beklenenDeger(kasa({ rewards: [] }))).toBe(0);
  });
});

describe('odulCek', () => {
  const k = kasa();

  it('rastgele değere göre doğru ödülü seçer', () => {
    // Agirliklar: 50 / 30 / 15 / 5 (toplam 100)
    expect(odulCek(k, 0.00)!.odul.id).toBe('a');
    expect(odulCek(k, 0.49)!.odul.id).toBe('a');
    expect(odulCek(k, 0.50)!.odul.id).toBe('b');
    expect(odulCek(k, 0.79)!.odul.id).toBe('b');
    expect(odulCek(k, 0.80)!.odul.id).toBe('c');
    expect(odulCek(k, 0.94)!.odul.id).toBe('c');
    expect(odulCek(k, 0.95)!.odul.id).toBe('d');
    expect(odulCek(k, 0.999)!.odul.id).toBe('d');
  });

  it('sınır dışı değerlerde ödülsüz DÖNMEZ', () => {
    // Bos donmek, bedeli alinmis bir acilisi odulsuz birakirdi.
    expect(odulCek(k, 1)!.odul.id).toBe('d');
    expect(odulCek(k, 1.5)!.odul.id).toBe('d');
    expect(odulCek(k, -1)!.odul.id).toBe('a');
  });

  it('olasılığı da bildirir — denetim kaydına yazılıyor', () => {
    expect(odulCek(k, 0.96)!.olasilik).toBe(0.05);
  });

  it('ödülsüz kasada null', () => {
    expect(odulCek(kasa({ rewards: [] }), 0.5)).toBeNull();
  });

  it('tek ödüllü kasada her zaman o ödül', () => {
    const tek = kasa({ rewards: [{ id: 'x', label: 'x', amount: 100, weight: 1 }] });
    for (const r of [0, 0.3, 0.7, 0.99]) {
      expect(odulCek(tek, r)!.odul.id).toBe('x');
    }
  });

  it('dağılım uzun vadede ağırlıklara yakınsıyor', () => {
    const sayac: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
    const N = 10_000;
    for (let i = 0; i < N; i += 1) sayac[odulCek(k, i / N)!.odul.id] += 1;
    expect(sayac.a / N).toBeCloseTo(0.5, 2);
    expect(sayac.d / N).toBeCloseTo(0.05, 2);
  });
});

describe('acilisiDogrula', () => {
  const temel = { kasa: kasa(), bakiye: 10_000, bugunAcilis: 0, sonYatirim: 10_000 };

  it('her şey uygunsa geçer', () => {
    expect(acilisiDogrula(temel).uygun).toBe(true);
  });

  it('kapalı kasa reddedilir', () => {
    const s = acilisiDogrula({ ...temel, kasa: kasa({ enabled: false }) });
    expect(s).toMatchObject({ uygun: false, kod: 'kapali' });
  });

  it('ödülsüz kasa reddedilir', () => {
    const s = acilisiDogrula({ ...temel, kasa: kasa({ rewards: [] }) });
    expect(s).toMatchObject({ uygun: false, kod: 'odulYok' });
  });

  it('yetersiz bakiye reddedilir ve tutarı SÖYLER', () => {
    const s = acilisiDogrula({ ...temel, bakiye: 100 });
    expect(s).toMatchObject({ uygun: false, kod: 'bakiyeYetersiz' });
    expect(s.uygun === false && s.mesaj).toContain('500');
  });

  it('günlük limit dolduysa reddedilir', () => {
    const s = acilisiDogrula({ ...temel, kasa: kasa({ dailyLimit: 3 }), bugunAcilis: 3 });
    expect(s).toMatchObject({ uygun: false, kod: 'gunlukLimit' });
  });

  it('limit altındaysa geçer', () => {
    expect(acilisiDogrula({ ...temel, kasa: kasa({ dailyLimit: 3 }), bugunAcilis: 2 }).uygun).toBe(true);
  });

  it('limit 0 ise sınırsız', () => {
    expect(acilisiDogrula({ ...temel, kasa: kasa({ dailyLimit: 0 }), bugunAcilis: 99 }).uygun).toBe(true);
  });

  it('yetersiz son yatırım reddedilir', () => {
    const s = acilisiDogrula({ ...temel, kasa: kasa({ minDeposit: 5000 }), sonYatirim: 1000 });
    expect(s).toMatchObject({ uygun: false, kod: 'yatirimYetersiz' });
  });

  it('bedelsiz kasada bakiye aranmaz', () => {
    expect(acilisiDogrula({ ...temel, kasa: kasa({ price: 0 }), bakiye: 0 }).uygun).toBe(true);
  });

  it('kasa yoksa reddedilir, çökmez', () => {
    expect(acilisiDogrula({ ...temel, kasa: null }).uygun).toBe(false);
    expect(acilisiDogrula({ ...temel, kasa: undefined, bakiye: null }).uygun).toBe(false);
  });
});

describe('kasaVitrini', () => {
  it('olasılıkları yüzde olarak AÇIK verir', () => {
    // Gizlemek kasa icerigini tahmin oyununa cevirir ve sikayet
    // geldiginde elde gosterilecek bir sey kalmaz.
    const v = kasaVitrini(kasa());
    expect(v.oduller.find((o) => o.amount === 10_000)!.olasilik).toBe(5);
    expect(v.oduller.find((o) => o.amount === 0)!.olasilik).toBe(50);
  });

  it('ham ağırlığı dışarı VERMEZ', () => {
    const v = kasaVitrini(kasa());
    expect(JSON.stringify(v)).not.toContain('weight');
  });

  it('ödülleri büyükten küçüğe sıralar', () => {
    const v = kasaVitrini(kasa());
    expect(v.oduller.map((o) => o.amount)).toEqual([10_000, 1000, 250, 0]);
  });

  it('en büyük ödülü ve sayısını bildirir', () => {
    const v = kasaVitrini(kasa());
    expect(v.enBuyukOdul).toBe(10_000);
    expect(v.odulSayisi).toBe(4);
  });
});

import { describe, expect, it } from 'vitest';
import {
  duzeltmeSatiri,
  duzeltmeToplami,
  duzeltmeYonu,
  hesapBazindaOzet,
  notAnlamliMi,
  tarihAraligindakiDuzeltmeler,
  tarihineGoreSirala,
  yapanBazindaOzet,
  type HamDuzeltme,
  type OyuncuAdlari,
} from './manuelDuzeltmeRaporu.js';

/** Kullanicinin yapistirdigi gercek yanit satiri. */
const GERCEK: HamDuzeltme = {
  id: 74803,
  playerId: 2502959,
  accountName: 'PlayerUnusedBalance',
  updateBalanceType: 'crediting',
  amount: 1000,
  currency: 'TRY',
  userName: 'destek@narcosbahis.com',
  createdAt: '2026-08-03T15:35:05.448579Z',
  note: 'info sarp ',
  category: { categoryName: 'New Player' },
};

const adlar: OyuncuAdlari = new Map([['2502959', { login: 'sarp61', adSoyad: 'Sarp K.' }]]);

describe('duzeltmeSatiri', () => {
  it('gerçek yanıtı ekran satırına çevirir', () => {
    const satir = duzeltmeSatiri(GERCEK, adlar);
    expect(satir.Id).toBe(74803);
    expect(satir.ClientId).toBe(2502959);
    expect(satir.ClientLogin).toBe('sarp61');
    expect(satir.Hesap).toBe('PlayerUnusedBalance');
    expect(satir.Yon).toBe('giris');
    expect(satir.Tutar).toBe(1000);
    expect(satir.NetTutar).toBe(1000);
    expect(satir.Kategori).toBe('New Player');
  });

  it('düzeltmeyi yapan yöneticiyi taşır', () => {
    // Panelin kendi denetim kaydinda olmayan alan; Lynon arayuzunden
    // elle yapilan hareketin tek sorumlusu bu.
    expect(duzeltmeSatiri(GERCEK).Yapan).toBe('destek@narcosbahis.com');
  });

  it('eşleşme yoksa kullanıcı adı uydurmaz', () => {
    expect(duzeltmeSatiri(GERCEK, new Map()).ClientLogin).toBe('');
  });

  it('çıkış yönünde net tutar negatif', () => {
    const satir = duzeltmeSatiri({ ...GERCEK, updateBalanceType: 'debiting' });
    expect(satir.Yon).toBe('cikis');
    expect(satir.Tutar).toBe(1000);
    expect(satir.NetTutar).toBe(-1000);
  });

  it('yönü bilinmeyen hareket toplama katılmaz', () => {
    // Bilinmeyen turu "giris" saymak kasa raporunu sessizce yanlislar.
    const satir = duzeltmeSatiri({ ...GERCEK, updateBalanceType: 'bilinmeyen' });
    expect(satir.Yon).toBe('bilinmiyor');
    expect(satir.NetTutar).toBe(0);
  });

  it('negatif tutar mutlak değere çevrilir, yön alandan gelir', () => {
    const satir = duzeltmeSatiri({ ...GERCEK, amount: -1000, updateBalanceType: 'debiting' });
    expect(satir.Tutar).toBe(1000);
    expect(satir.NetTutar).toBe(-1000);
  });

  it('hesap adı gelmezse uydurulmaz', () => {
    expect(duzeltmeSatiri({ ...GERCEK, accountName: '' }).Hesap).toBe('Bilinmiyor');
  });
});

describe('duzeltmeYonu', () => {
  it('bilinen türleri çevirir', () => {
    expect(duzeltmeYonu('crediting')).toBe('giris');
    expect(duzeltmeYonu('DEBITING')).toBe('cikis');
  });

  it('bilinmeyen türü tahmin etmez', () => {
    expect(duzeltmeYonu('')).toBe('bilinmiyor');
    expect(duzeltmeYonu(null)).toBe('bilinmiyor');
    expect(duzeltmeYonu('transfer')).toBe('bilinmiyor');
  });
});

describe('not denetimi', () => {
  it('gerçek not anlamlı sayılır', () => {
    // "info sarp " — kisa ama esigi geciyor.
    expect(notAnlamliMi('info sarp ')).toBe(true);
  });

  it('boş ve çok kısa not anlamsız', () => {
    expect(notAnlamliMi('')).toBe(false);
    expect(notAnlamliMi('   ')).toBe(false);
    expect(notAnlamliMi('ok')).toBe(false);
  });

  it('notsuz düzeltme satırda işaretlenir', () => {
    expect(duzeltmeSatiri({ ...GERCEK, note: '' }).NotAnlamli).toBe(false);
  });
});

describe('tarih aralığı Türkiye gününe göre', () => {
  const kayitlar: HamDuzeltme[] = [
    { ...GERCEK, id: 1, createdAt: '2026-08-02T20:59:00Z' }, // TR 23:59, 2 Ağustos
    { ...GERCEK, id: 2, createdAt: '2026-08-02T21:01:00Z' }, // TR 00:01, 3 Ağustos
    { ...GERCEK, id: 3, createdAt: '2026-08-03T15:35:05Z' }, // TR 18:35, 3 Ağustos
  ];

  it('gece yarısını Türkiye saatiyle keser', () => {
    const gun = tarihAraligindakiDuzeltmeler(kayitlar, { startDate: '2026-08-03', endDate: '2026-08-03' });
    expect(gun.map((k) => k.id)).toEqual([2, 3]);
  });

  it('aralık verilmezse hepsi kalır', () => {
    expect(tarihAraligindakiDuzeltmeler(kayitlar, {})).toHaveLength(3);
  });

  it('çözülemeyen tarih dışarıda kalır', () => {
    expect(tarihAraligindakiDuzeltmeler([{ ...GERCEK, createdAt: 'yok' }], { startDate: '2026-08-03' }))
      .toHaveLength(0);
  });
});

describe('özetler', () => {
  const satirlar = [
    duzeltmeSatiri({ ...GERCEK, id: 1, amount: 1000 }, adlar),
    duzeltmeSatiri({ ...GERCEK, id: 2, amount: 500, updateBalanceType: 'debiting' }, adlar),
    duzeltmeSatiri({ ...GERCEK, id: 3, amount: 250, userName: 'admin@x.com', accountName: 'PlayerAccount', note: '' }, adlar),
  ];

  it('yönetici bazında toplar', () => {
    const ozet = yapanBazindaOzet(satirlar);
    expect(ozet[0]).toEqual({
      yapan: 'destek@narcosbahis.com', adet: 2, giris: 1000, cikis: 500, net: 500, notsuz: 0,
    });
    expect(ozet.find((o) => o.yapan === 'admin@x.com')).toMatchObject({ adet: 1, giris: 250, notsuz: 1 });
  });

  it('hesap türlerini ayrı tutar', () => {
    // PlayerAccount ile PlayerUnusedBalance ayni kalem degil.
    const ozet = hesapBazindaOzet(satirlar);
    expect(ozet.map((o) => o.hesap).sort()).toEqual(['PlayerAccount', 'PlayerUnusedBalance']);
    expect(ozet.find((o) => o.hesap === 'PlayerUnusedBalance')!.adet).toBe(2);
  });

  it('genel toplam giriş ve çıkışı ayırır', () => {
    const toplam = duzeltmeToplami(satirlar);
    expect(toplam).toMatchObject({ adet: 3, giris: 1250, cikis: 500, net: 750, notsuz: 1, yonuBilinmeyen: 0 });
    expect(toplam.oyuncuSayisi).toBe(1);
  });

  it('yönü bilinmeyen hareket ayrı sayılır', () => {
    const toplam = duzeltmeToplami([duzeltmeSatiri({ ...GERCEK, updateBalanceType: '?' })]);
    expect(toplam.yonuBilinmeyen).toBe(1);
    expect(toplam.giris).toBe(0);
    expect(toplam.net).toBe(0);
  });

  it('en yeni önce sıralanır', () => {
    const sirali = tarihineGoreSirala([
      duzeltmeSatiri({ ...GERCEK, id: 1, createdAt: '2026-08-01T10:00:00Z' }),
      duzeltmeSatiri({ ...GERCEK, id: 2, createdAt: '2026-08-03T10:00:00Z' }),
    ]);
    expect(sirali.map((s) => s.Id)).toEqual([2, 1]);
  });

  it('boş girdi çökmez', () => {
    expect(yapanBazindaOzet(null)).toEqual([]);
    expect(hesapBazindaOzet(null)).toEqual([]);
    expect(duzeltmeToplami(null).adet).toBe(0);
  });
});

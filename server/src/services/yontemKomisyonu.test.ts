import { describe, expect, it } from 'vitest';
import { komisyonHesapla, komisyonlariUygula, type YontemKomisyonu } from './yontemKomisyonu.js';

const oran = (ek: Partial<YontemKomisyonu> = {}): YontemKomisyonu => ({
  anahtar: 'HemenOde · Havale',
  yatirimYuzde: 2.5,
  yatirimSabit: 1.5,
  cekimYuzde: 1,
  cekimSabit: 0,
  not: null,
  updatedAt: '2026-08-07T00:00:00Z',
  ...ek,
});

const satir = (ek: Record<string, unknown> = {}) => ({
  anahtar: 'HemenOde · Havale', yatirim: 10000, cekim: 4000, ...ek,
} as { anahtar: string; yatirim: number; cekim: number; islemSayisi?: number | null });

describe('yontem komisyonu', () => {
  it('yuzde bilesenini uygular', () => {
    const h = komisyonHesapla(oran({ yatirimSabit: 0 }), satir());
    expect(h.yatirimKomisyonu).toBe(250);
    expect(h.cekimKomisyonu).toBe(40);
    expect(h.toplamKomisyon).toBe(290);
  });

  it('net yatirimi komisyon dusulmus doner', () => {
    expect(komisyonHesapla(oran({ yatirimSabit: 0 }), satir()).netYatirim).toBe(9750);
  });

  /**
   * Saglayicilar genelde "%2.5 + 1,50 TL" gibi iki parcali kesiyor.
   * Yalnizca yuzde tutmak, kucuk tutarli cok sayida islemde bariz
   * sapma uretirdi.
   */
  it('islem sayisi verilince sabit ucreti ekler', () => {
    const h = komisyonHesapla(oran(), satir({ islemSayisi: 20 }));
    expect(h.yatirimKomisyonu).toBe(280); // 250 + 20 x 1.5
  });

  /**
   * Islem sayisi bilinmiyorsa sabit ucret UYGULANMAZ. Tahmin edilen her
   * deger sistematik sapma uretir; atlamak ve panelde yalnizca yuzdeyi
   * gostermek dogru.
   */
  it('islem sayisi yoksa sabit ucreti uydurmaz', () => {
    expect(komisyonHesapla(oran(), satir()).yatirimKomisyonu).toBe(250);
    expect(komisyonHesapla(oran(), satir({ islemSayisi: 0 })).yatirimKomisyonu).toBe(250);
    expect(komisyonHesapla(oran(), satir({ islemSayisi: null })).yatirimKomisyonu).toBe(250);
  });

  /** Yatirim ve cekim komisyonu neredeyse hic ayni degil. */
  it('yatirim ve cekimi ayri oranlarla hesaplar', () => {
    const h = komisyonHesapla(oran({ yatirimYuzde: 3, cekimYuzde: 0.5, yatirimSabit: 0 }), satir());
    expect(h.yatirimKomisyonu).toBe(300);
    expect(h.cekimKomisyonu).toBe(20);
  });

  it('kurusa yuvarlar', () => {
    const h = komisyonHesapla(oran({ yatirimYuzde: 3.33, yatirimSabit: 0 }), satir({ yatirim: 10.1 }));
    expect(h.yatirimKomisyonu).toBe(0.34);
  });

  /**
   * Orani tanimsiz satirda komisyon 0 sayilir ama bu BELIRTILIR;
   * "komisyon yok" ile "oran girilmemis" ayni sey degil.
   */
  it('oran tanimsizsa isaretler', () => {
    const h = komisyonHesapla(undefined, satir());
    expect(h.oranTanimli).toBe(false);
    expect(h.toplamKomisyon).toBe(0);
    expect(h.netYatirim).toBe(10000);
  });

  describe('toplu uygulama', () => {
    it('oranlari anahtara gore eslestirir', () => {
      const sonuc = komisyonlariUygula(
        [oran({ yatirimSabit: 0 }), oran({ anahtar: 'Papara · Papara', yatirimYuzde: 1, yatirimSabit: 0, cekimYuzde: 0 })],
        [satir(), satir({ anahtar: 'Papara · Papara', yatirim: 5000, cekim: 0 })],
      );
      expect(sonuc.toplamKomisyon).toBe(340); // 290 + 50
      expect(sonuc.oransizSatir).toEqual([]);
    });

    it('orani olmayan satirlari ayrica bildirir', () => {
      const sonuc = komisyonlariUygula([oran()], [satir(), satir({ anahtar: 'Bilinmiyor · X' })]);
      expect(sonuc.oransizSatir).toEqual(['Bilinmiyor · X']);
    });

    it('bos listede sifir doner', () => {
      expect(komisyonlariUygula([], []).toplamKomisyon).toBe(0);
    });
  });
});

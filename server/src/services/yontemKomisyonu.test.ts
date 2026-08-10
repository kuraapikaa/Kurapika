import { randomUUID } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import type { YontemKomisyonu } from './yontemKomisyonu.js';

const bellek = new Map<string, unknown>();

vi.mock('../lib/documentStore.js', () => ({
  readStoredDocument: async ({ namespace, tenantKey, fallback }: any) => {
    const k = `${tenantKey}:${namespace}`;
    return bellek.has(k) ? bellek.get(k) : fallback();
  },
  writeStoredDocument: async ({ namespace, tenantKey }: any, data: unknown) => {
    bellek.set(`${tenantKey}:${namespace}`, data);
  },
}));

const {
  komisyonHesapla, komisyonlariUygula, komisyonOranlari, komisyonOraniKaydet, komisyonOraniSil,
  YontemKomisyonuHatasi,
} = await import('./yontemKomisyonu.js');

const oran = (ek: Partial<YontemKomisyonu> = {}): YontemKomisyonu => ({
  anahtar: 'HemenOde · Havale',
  yatirimYuzde: 2.5,
  yatirimSabit: 1.5,
  cekimYuzde: 1,
  cekimSabit: 0,
  teslimatKurali: null,
  takviyeEsigi: null,
  takviyeNotu: null,
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

  describe('komisyonOraniKaydet / komisyonOranlari / komisyonOraniSil', () => {
    const kiraci = () => `test-${randomUUID().slice(0, 8)}`;

    it('yeni bir yontem ayari kaydeder ve geri okur', async () => {
      const k = kiraci();
      await komisyonOraniKaydet(k, {
        anahtar: 'HemenOde · Havale', yatirimYuzde: 2.5, yatirimSabit: 1.5, cekimYuzde: 1, cekimSabit: 0,
      });

      const oranlar = await komisyonOranlari(k);
      expect(oranlar).toHaveLength(1);
      expect(oranlar[0]).toMatchObject({ anahtar: 'HemenOde · Havale', yatirimYuzde: 2.5 });
    });

    it('teslimat/takviye alanlarini kaydeder', async () => {
      const k = kiraci();
      const kaydedilen = await komisyonOraniKaydet(k, {
        anahtar: 'Papara · Papara', yatirimYuzde: 1, yatirimSabit: 0, cekimYuzde: 1, cekimSabit: 0,
        teslimatKurali: 'Her Pazartesi elden teslim', takviyeEsigi: 50000, takviyeNotu: 'Ali arasın',
      });

      expect(kaydedilen).toMatchObject({
        teslimatKurali: 'Her Pazartesi elden teslim', takviyeEsigi: 50000, takviyeNotu: 'Ali arasın',
      });
    });

    it('teslimat/takviye BOS birakilirsa null kaydedilir, 0 degil', async () => {
      const k = kiraci();
      const kaydedilen = await komisyonOraniKaydet(k, {
        anahtar: 'Test · Yontem', yatirimYuzde: 0, yatirimSabit: 0, cekimYuzde: 0, cekimSabit: 0,
      });

      expect(kaydedilen.teslimatKurali).toBeNull();
      expect(kaydedilen.takviyeEsigi).toBeNull();
      expect(kaydedilen.takviyeNotu).toBeNull();
    });

    it('takviyeEsigi negatifse reddeder', async () => {
      const k = kiraci();
      await expect(komisyonOraniKaydet(k, {
        anahtar: 'X · Y', yatirimYuzde: 0, yatirimSabit: 0, cekimYuzde: 0, cekimSabit: 0, takviyeEsigi: -5,
      })).rejects.toThrow(YontemKomisyonuHatasi);
    });

    it('ayni anahtarla tekrar kaydetmek GUNCELLER, cogaltmaz', async () => {
      const k = kiraci();
      await komisyonOraniKaydet(k, { anahtar: 'X · Y', yatirimYuzde: 1, yatirimSabit: 0, cekimYuzde: 0, cekimSabit: 0 });
      await komisyonOraniKaydet(k, { anahtar: 'X · Y', yatirimYuzde: 5, yatirimSabit: 0, cekimYuzde: 0, cekimSabit: 0 });

      const oranlar = await komisyonOranlari(k);
      expect(oranlar).toHaveLength(1);
      expect(oranlar[0].yatirimYuzde).toBe(5);
    });

    it('anahtar zorunlu', async () => {
      const k = kiraci();
      await expect(komisyonOraniKaydet(k, { yatirimYuzde: 1, yatirimSabit: 0, cekimYuzde: 0, cekimSabit: 0 }))
        .rejects.toThrow(/anahtar/);
    });

    it('siler', async () => {
      const k = kiraci();
      await komisyonOraniKaydet(k, { anahtar: 'X · Y', yatirimYuzde: 1, yatirimSabit: 0, cekimYuzde: 0, cekimSabit: 0 });
      await komisyonOraniSil(k, 'X · Y');
      expect(await komisyonOranlari(k)).toEqual([]);
    });

    it('olmayan anahtari silmeye calisinca hata verir', async () => {
      const k = kiraci();
      await expect(komisyonOraniSil(k, 'hic-yok')).rejects.toThrow(YontemKomisyonuHatasi);
    });

    it('kiracilar birbirinin ayarlarini gormez', async () => {
      const a = kiraci();
      const b = kiraci();
      await komisyonOraniKaydet(a, { anahtar: 'X · Y', yatirimYuzde: 1, yatirimSabit: 0, cekimYuzde: 0, cekimSabit: 0 });

      expect(await komisyonOranlari(b)).toEqual([]);
    });
  });
});

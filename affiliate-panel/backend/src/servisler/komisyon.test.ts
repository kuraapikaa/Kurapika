import { describe, expect, it } from 'vitest';
import { hakedisHesapla, type KomisyonPlani } from './komisyon.js';

const plan = (ek: Partial<KomisyonPlani> = {}): KomisyonPlani => ({
  id: 'p1',
  ad: 'Standart',
  tur: 'gelir-payi',
  gelirPayiYuzde: 30,
  cpaTutari: 0,
  yonetimGideriYuzde: 20,
  asgariOdeme: 0,
  negatifDevir: true,
  varsayilan: true,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
  ...ek,
});

describe('hakedis hesabi', () => {
  it('isletme payini dusup net gelirin yuzdesini verir', () => {
    const h = hakedisHesapla(plan(), { ggr: 10_000, ftdSayisi: null });
    expect(h.yonetimGideri).toBe(2000);
    expect(h.netGelir).toBe(8000);
    expect(h.gelirPayi).toBe(2400);
    expect(h.odenecek).toBe(2400);
  });

  /**
   * CPA, ilk yatirim sayisina dayaniyor. Toplam duzeyinde rapor veren
   * backoffice'lerde bu sayi gelmiyor; SIFIR yazmak ortaga "hic ilk
   * yatirim getirmedin" demek olurdu.
   */
  it('ftd olculemediyse CPA bilesenini uydurmaz, sebebini bildirir', () => {
    const h = hakedisHesapla(plan({ tur: 'cpa', cpaTutari: 500 }), { ggr: 10_000, ftdSayisi: null });
    expect(h.cpaPayi).toBe(0);
    expect(h.cpaHesaplanamadiSebebi).toContain('ölçülemiyor');
  });

  it('ftd sifir ise CPA gercekten sifirdir', () => {
    const h = hakedisHesapla(plan({ tur: 'cpa', cpaTutari: 500 }), { ggr: 10_000, ftdSayisi: 0 });
    expect(h.cpaPayi).toBe(0);
    expect(h.cpaHesaplanamadiSebebi).toBeNull();
  });

  it('hibritte iki bileseni de toplar', () => {
    const h = hakedisHesapla(
      plan({ tur: 'hibrit', gelirPayiYuzde: 20, cpaTutari: 300 }),
      { ggr: 10_000, ftdSayisi: 3 },
    );
    expect(h.gelirPayi).toBe(1600); // 8000 x %20
    expect(h.cpaPayi).toBe(900);
    expect(h.toplam).toBe(2500);
  });

  describe('devir', () => {
    it('negatif ayda odeme sifir, zarar sonraki doneme tasinir', () => {
      const h = hakedisHesapla(plan(), { ggr: -5000, ftdSayisi: null });
      expect(h.gelirPayi).toBe(0);
      expect(h.odenecek).toBe(0);
      expect(h.sonrakiDevredenZarar).toBe(-5000);
    });

    it('devir kapaliysa zarar tasinmaz', () => {
      const h = hakedisHesapla(plan({ negatifDevir: false }), { ggr: -5000, ftdSayisi: null });
      expect(h.sonrakiDevredenZarar).toBe(0);
    });

    it('devreden zarar gelir tabanindan dusulur', () => {
      const h = hakedisHesapla(plan(), { ggr: 10_000, ftdSayisi: null, devredenZarar: -3000 });
      expect(h.hesapTabani).toBe(5000); // 8000 - 3000
      expect(h.gelirPayi).toBe(1500);
    });

    /**
     * Zarar devri ile odeme devri AYRI: birincisi gelir tabanina girip
     * yuzdeyle carpiliyor, ikincisi zaten hesaplanmis bir odeme. Tek
     * alanda toplamak, birikmis odemeyi bir kez daha yuzdeye tabi
     * tutardi.
     */
    it('odenmemis bakiye yuzdeye TEKRAR tabi tutulmaz', () => {
      const h = hakedisHesapla(plan({ asgariOdeme: 0 }), {
        ggr: 10_000, ftdSayisi: null, devredenOdeme: 1000,
      });
      expect(h.gelirPayi).toBe(2400);
      expect(h.toplam).toBe(3400); // 2400 + 1000, yuzde uygulanmadan
    });

    it('pozitif gelen devreden zarar yok sayilir', () => {
      const h = hakedisHesapla(plan(), { ggr: 10_000, ftdSayisi: null, devredenZarar: 5000 });
      expect(h.hesapTabani).toBe(8000);
    });
  });

  describe('asgari odeme', () => {
    it('altinda kalan tutar odenmez ama SILINMEZ, devreder', () => {
      const h = hakedisHesapla(plan({ asgariOdeme: 1000 }), { ggr: 1000, ftdSayisi: null });
      expect(h.toplam).toBe(240);
      expect(h.odenecek).toBe(0);
      expect(h.sonrakiDevredenOdeme).toBe(240);
    });

    it('birikip esigi gecince odenir', () => {
      const h = hakedisHesapla(plan({ asgariOdeme: 1000 }), {
        ggr: 1000, ftdSayisi: null, devredenOdeme: 800,
      });
      expect(h.odenecek).toBe(1040);
      expect(h.sonrakiDevredenOdeme).toBe(0);
    });
  });

  it('kurusa yuvarlar', () => {
    const h = hakedisHesapla(plan({ gelirPayiYuzde: 33.33, yonetimGideriYuzde: 0 }), {
      ggr: 10.1, ftdSayisi: null,
    });
    expect(h.gelirPayi).toBe(3.37);
  });
});

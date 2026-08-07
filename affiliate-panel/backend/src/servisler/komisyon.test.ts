import { describe, expect, it } from 'vitest';
import { gelirPayiHesapla, hakedisHesapla, type KomisyonPlani } from './komisyon.js';

const plan = (ek: Partial<KomisyonPlani> = {}): KomisyonPlani => ({
  id: 'p1',
  ad: 'Standart',
  tur: 'gelir-payi',
  gelirPayiYuzde: 30,
  gelirKademeleri: [],
  kademeModu: 'topluca',
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

/**
 * KADEMELI GELIR PAYI.
 *
 * Iki mod arasindaki fark BUYUK: 50.000'de %40 esigi olan bir planda
 * `topluca` 20.000 oderken `dilimli` ~15.000 odyor. Yanlis modu
 * uygulamak, sozlesmenin yarisini sessizce yanlis hesaplamak olurdu.
 */
describe('kademeli gelir payi', () => {
  const KADEMELER = [
    { esik: 0, yuzde: 25 },
    { esik: 10_000, yuzde: 35 },
    { esik: 50_000, yuzde: 45 },
  ];

  const kademeli = (mod: 'topluca' | 'dilimli') =>
    plan({ gelirKademeleri: KADEMELER, kademeModu: mod, yonetimGideriYuzde: 0 });

  describe('topluca (ulasilan kademe tum tutara)', () => {
    it('en alt kademede taban orani uygular', () => {
      const s = gelirPayiHesapla(kademeli('topluca'), 5_000);
      expect(s.tutar).toBe(1_250); // 5.000 x %25
      expect(s.efektifYuzde).toBe(25);
    });

    it('esigi gecince TUM tutara ust orani uygular', () => {
      const s = gelirPayiHesapla(kademeli('topluca'), 60_000);
      expect(s.tutar).toBe(27_000); // 60.000 x %45, dilimlemeden
      expect(s.ulasilanKademe).toEqual({ esik: 50_000, yuzde: 45 });
    });

    it('esigin tam ustunde ust kademeye geciyor', () => {
      expect(gelirPayiHesapla(kademeli('topluca'), 10_000).efektifYuzde).toBe(35);
      expect(gelirPayiHesapla(kademeli('topluca'), 9_999).efektifYuzde).toBe(25);
    });
  });

  describe('dilimli (her dilim kendi orani)', () => {
    it('dilimleri ayri ayri hesaplar', () => {
      const s = gelirPayiHesapla(kademeli('dilimli'), 60_000);
      // 10.000x%25=2.500 + 40.000x%35=14.000 + 10.000x%45=4.500
      expect(s.tutar).toBe(21_000);
    });

    it('ilk dilimin icinde kalirsa toplucayla ayni sonucu verir', () => {
      expect(gelirPayiHesapla(kademeli('dilimli'), 5_000).tutar)
        .toBe(gelirPayiHesapla(kademeli('topluca'), 5_000).tutar);
    });

    it('efektif orani dogru bildirir', () => {
      const s = gelirPayiHesapla(kademeli('dilimli'), 60_000);
      expect(s.efektifYuzde).toBe(35); // 21.000 / 60.000
    });

    /** Esikte ucurum olmamasi dilimli modun varlik sebebi. */
    it('esik civarinda sicrama yaratmaz', () => {
      const altta = gelirPayiHesapla(kademeli('dilimli'), 49_999).tutar;
      const ustte = gelirPayiHesapla(kademeli('dilimli'), 50_001).tutar;
      expect(ustte - altta).toBeLessThan(1);
    });

    /** Ayni esikte topluca mod SICRAR; bu bilincli bir tercih. */
    it('topluca modda esikte sicrama VARDIR', () => {
      const altta = gelirPayiHesapla(kademeli('topluca'), 49_999).tutar;
      const ustte = gelirPayiHesapla(kademeli('topluca'), 50_001).tutar;
      expect(ustte - altta).toBeGreaterThan(4_000);
    });
  });

  it('kademesiz planda duz oran gecerli', () => {
    const s = gelirPayiHesapla(plan({ yonetimGideriYuzde: 0 }), 10_000);
    expect(s.tutar).toBe(3_000);
    expect(s.ulasilanKademe).toBeNull();
  });

  it('negatif ve sifir tabanda pay dagitmaz', () => {
    expect(gelirPayiHesapla(kademeli('topluca'), 0).tutar).toBe(0);
    expect(gelirPayiHesapla(kademeli('dilimli'), -5_000).tutar).toBe(0);
  });

  it('hakedis hesabi kademeyi kullanir', () => {
    const h = hakedisHesapla(kademeli('topluca'), { ggr: 60_000, ftdSayisi: null });
    expect(h.gelirPayi).toBe(27_000);
    expect(h.gelirPayiYuzdesi).toBe(45);
  });

  /**
   * Kademe alanlari sonradan eklendi. Eski kayitta `gelirKademeleri`
   * hic yok; erisim patlarsa TUM hakedis hesabi duser.
   */
  it('eski plan kaydinda (kademe alani yok) patlamaz', () => {
    const eski = { ...plan() } as Partial<KomisyonPlani>;
    delete eski.gelirKademeleri;
    delete eski.kademeModu;
    expect(gelirPayiHesapla(eski as KomisyonPlani, 10_000).tutar).toBe(3_000);
  });
});

import { describe, expect, it } from 'vitest';
import { dikeyHakedisHesapla, dikeyOku, planinDikeyOrani } from './dikey.js';
import type { KomisyonPlani } from './komisyon.js';

const plan = (ek: Partial<KomisyonPlani> = {}): KomisyonPlani => ({
  id: 'p1',
  ad: 'Standart',
  tur: 'gelir-payi',
  gelirPayiYuzde: 30,
  gelirKademeleri: [],
  kademeModu: 'topluca',
  cpaTutari: 0,
  yonetimGideriYuzde: 20,
  yonetimGideriSabit: 0,
  asgariOdeme: 0,
  negatifDevir: true,
  varsayilan: true,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
  ...ek,
});

describe('dikeyOku', () => {
  it('bilinen varyantları normalize eder', () => {
    expect(dikeyOku('casino')).toBe('casino');
    expect(dikeyOku('livecasino')).toBe('casino');
    expect(dikeyOku('slots')).toBe('casino');
    expect(dikeyOku('spor')).toBe('spor');
    expect(dikeyOku('sportsbook')).toBe('spor');
    expect(dikeyOku('BETTING')).toBe('spor');
  });

  it('tanımadığı ya da boş değer bilinmiyor döner, hata fırlatmaz', () => {
    expect(dikeyOku(undefined)).toBe('bilinmiyor');
    expect(dikeyOku(null)).toBe('bilinmiyor');
    expect(dikeyOku('')).toBe('bilinmiyor');
    // Yarın adaptör "yeni-oyun-turu" gibi bilinmeyen bir string
    // gönderirse turun tamamı düşmemeli.
    expect(dikeyOku('yeni-oyun-turu')).toBe('bilinmiyor');
  });
});

describe('planinDikeyOrani', () => {
  it('dikeyOranlari tanımsızsa düz orana düşer', () => {
    const oran = planinDikeyOrani(plan(), 'casino');
    expect(oran.yuzde).toBe(30);
  });

  it('bilinmiyor HER ZAMAN düz orana düşer, dikeyOranlari tanımlı olsa bile', () => {
    const p = plan({ dikeyOranlari: { casino: { yuzde: 40 } } });
    expect(planinDikeyOrani(p, 'bilinmiyor').yuzde).toBe(30);
  });

  it('dikeye özel oran tanımlıysa onu kullanır', () => {
    const p = plan({ dikeyOranlari: { spor: { yuzde: 18 } } });
    expect(planinDikeyOrani(p, 'spor').yuzde).toBe(18);
    expect(planinDikeyOrani(p, 'casino').yuzde).toBe(30); // casino icin ozel tanim yok, duz orana duser
  });
});

describe('dikeyHakedisHesapla', () => {
  /**
   * EN ÖNEMLİ TEST: dikeysiz (bilinmiyor) ölçüm düz oranla ödeniyor,
   * göçün ödeme davranışını değiştirmediğinin kanıtı. `komisyon.test.ts`
   * · `hakedisHesapla` ile AYNI girdiyle AYNI sonucu üretmeli.
   */
  it('dikeysiz (bilinmiyor) ölçüm düz planla tek-akışlı hakedisHesapla ile AYNI sonucu verir', () => {
    const h = dikeyHakedisHesapla(plan(), [{ dikey: 'bilinmiyor', ggr: 10_000, ftdSayisi: null }]);
    expect(h.yonetimGideri).toBe(2000);
    expect(h.netGelir).toBe(8000);
    expect(h.gelirPayi).toBe(2400);
    expect(h.odenecek).toBe(2400);
  });

  it('aynı dikey iki kez gelirse toplar, ayrı satır üretmez', () => {
    const h = dikeyHakedisHesapla(plan(), [
      { dikey: 'casino', ggr: 4000, ftdSayisi: 2 },
      { dikey: 'casino', ggr: 6000, ftdSayisi: 1 },
    ]);
    expect(h.satirlar).toHaveLength(1);
    expect(h.satirlar[0].brutGelir).toBe(10_000);
  });

  it('sabit işletme gideri dikeylere brüt paylarına göre bölünür, toplamı aşmaz', () => {
    const h = dikeyHakedisHesapla(
      plan({ yonetimGideriYuzde: 0, yonetimGideriSabit: 1000 }),
      [
        { dikey: 'casino', ggr: 9000, ftdSayisi: null },
        { dikey: 'spor', ggr: 1000, ftdSayisi: null },
      ],
    );
    const casino = h.satirlar.find((s) => s.dikey === 'casino')!;
    const spor = h.satirlar.find((s) => s.dikey === 'spor')!;
    expect(casino.yonetimGideri).toBe(900); // %90 pay
    expect(spor.yonetimGideri).toBe(100); // %10 pay
    expect(h.yonetimGideri).toBe(1000); // tam sabit gideri esit, asmaz
  });

  it('bir dikeyde FTD ölçülemezse yalnız o dikeyin CPA bileşeni hesaplanamaz, diğeri ödenir', () => {
    const h = dikeyHakedisHesapla(
      plan({ tur: 'cpa', cpaTutari: 500, yonetimGideriYuzde: 0 }),
      [
        { dikey: 'casino', ggr: 5000, ftdSayisi: 3 },
        { dikey: 'spor', ggr: 5000, ftdSayisi: null },
      ],
    );
    const casino = h.satirlar.find((s) => s.dikey === 'casino')!;
    const spor = h.satirlar.find((s) => s.dikey === 'spor')!;
    expect(casino.cpaPayi).toBe(1500);
    expect(casino.cpaHesaplanamadiSebebi).toBeNull();
    expect(spor.cpaPayi).toBe(0);
    expect(spor.cpaHesaplanamadiSebebi).toContain('ölçülemiyor');
    expect(h.cpaPayi).toBe(1500); // yalnizca casino sayilir, sifir uydurulmaz
  });

  it('iki dikeyin toplamı asgari ödemeyi geçiyorsa ödenir, tek tek geçmese bile', () => {
    const h = dikeyHakedisHesapla(
      plan({ yonetimGideriYuzde: 0, asgariOdeme: 1000 }),
      [
        { dikey: 'casino', ggr: 2000, ftdSayisi: null },
        { dikey: 'spor', ggr: 2000, ftdSayisi: null },
      ],
    );
    // Her biri %30 -> 600 (asgarinin altinda), toplam 1200 >= 1000.
    expect(h.gelirPayi).toBe(1200);
    expect(h.odenecek).toBe(1200);
  });

  it('asgarinin altında kalırsa hiç ödenmez, sonraki döneme devreder', () => {
    const h = dikeyHakedisHesapla(
      plan({ yonetimGideriYuzde: 0, asgariOdeme: 5000 }),
      [
        { dikey: 'casino', ggr: 2000, ftdSayisi: null },
        { dikey: 'spor', ggr: 2000, ftdSayisi: null },
      ],
    );
    expect(h.odenecek).toBe(0);
    expect(h.sonrakiDevredenOdeme).toBe(h.toplam);
  });

  it('devreden zarar dikeylere net gelir payına göre bölünür, toplamı zarara eşittir', () => {
    const h = dikeyHakedisHesapla(
      plan({ yonetimGideriYuzde: 0 }),
      [
        { dikey: 'casino', ggr: 8000, ftdSayisi: null },
        { dikey: 'spor', ggr: 2000, ftdSayisi: null },
      ],
      -1000,
    );
    const casino = h.satirlar.find((s) => s.dikey === 'casino')!;
    const spor = h.satirlar.find((s) => s.dikey === 'spor')!;
    // Casino %80 pay -> -800, spor %20 pay -> -200; toplam -1000.
    expect(casino.hesapTabani).toBe(8000 - 800);
    expect(spor.hesapTabani).toBe(2000 - 200);
    expect(h.hesapTabani).toBe(10_000 - 1000); // net gelir toplami + zarar
  });

  it('dikeye özel oran tanımlıysa o dikeyin ödemesinde kullanılır', () => {
    const h = dikeyHakedisHesapla(
      plan({ yonetimGideriYuzde: 0, dikeyOranlari: { spor: { yuzde: 18 } } }),
      [
        { dikey: 'casino', ggr: 5000, ftdSayisi: null },
        { dikey: 'spor', ggr: 5000, ftdSayisi: null },
      ],
    );
    const casino = h.satirlar.find((s) => s.dikey === 'casino')!;
    const spor = h.satirlar.find((s) => s.dikey === 'spor')!;
    expect(casino.gelirPayi).toBe(1500); // duz oran %30
    expect(spor.gelirPayi).toBe(900); // ozel oran %18
  });
});

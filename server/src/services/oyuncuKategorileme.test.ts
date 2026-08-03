import { describe, expect, it } from 'vitest';
import {
  durgunlukGunu,
  esikCoz,
  kategoriGovdeleri,
  kategoriOnerileri,
  kategoriOnerisi,
  kategoriRiski,
  hedefSeviye,
  merdivenBosluklari,
  seviyeBul,
  seviyeMerdiveni,
  seviyeNoCoz,
  turkceSayi,
  varsayilanSeviye,
  type LynonKategori,
  type OyuncuProfili,
} from './oyuncuKategorileme.js';

/**
 * Sitenin GERCEK kategori listesi (site 137).
 *
 * Tahmin edilmis esiklerle test etmek, tahminleri dogrulamak olurdu.
 * Bantlarin 10.000 TL'den basladigina ve 0 – 9.999 arasinin bosta
 * kaldigina dikkat: bu bosluk asagida ayrica test ediliyor.
 */
const MERDIVEN_KAYNAGI: LynonKategori[] = [
  { id: 318, name: 'El Patrón (Seviye 5)', description: '[500.000 TL ve üzeri]', isDefault: false },
  { id: 317, name: 'Baron (Seviye 4)', description: '[250.000 TL - 499.999 TL]', isDefault: false },
  { id: 316, name: 'Jefe (Seviye 3)', description: '[100.000 TL - 249.999 TL]', isDefault: false },
  { id: 315, name: 'Capo (Seviye 2)', description: '[50.000 TL - 99.999 TL]', isDefault: false },
  { id: 314, name: 'Sicario (Seviye 1)', description: '[10.000 TL - 49.999 TL]', isDefault: false },
  { id: 308, name: 'Yeni Oyuncu', description: 'Default Category', isDefault: true },
];

const merdiven = seviyeMerdiveni(MERDIVEN_KAYNAGI);

describe('turkceSayi', () => {
  it('nokta binlik ayracını doğru okur', () => {
    // Ingilizce varsayimla 500.000 → 500 olurdu: bin kat hata.
    expect(turkceSayi('500.000')).toBe(500_000);
    expect(turkceSayi('1.250,75')).toBe(1250.75);
    expect(turkceSayi('999')).toBe(999);
  });

  it('sayı olmayanı reddeder', () => {
    expect(turkceSayi('abc')).toBeNull();
  });
});

describe('esikCoz', () => {
  it('gerçek açıklamaları çözer', () => {
    expect(esikCoz('[500.000 TL ve üzeri]')).toEqual({ min: 500_000, max: null, belirsiz: false });
    expect(esikCoz('[250.000 TL - 499.999 TL]')).toEqual({ min: 250_000, max: 499_999, belirsiz: false });
    expect(esikCoz('[10.000 TL - 49.999 TL]')).toEqual({ min: 10_000, max: 49_999, belirsiz: false });
  });

  it('varsayılan kategorinin eşiği yoktur', () => {
    // "Default Category" — sayı içermiyor, banda çevrilemez.
    expect(esikCoz('Default Category')).toBeNull();
  });

  it('üst sınır açıklamasını çözer', () => {
    expect(esikCoz('[5.000 TL altı]')).toEqual({ min: null, max: 5_000, belirsiz: false });
  });

  it('ters yazılmış aralığı düzeltir', () => {
    expect(esikCoz('[499.999 - 100.000 TL]')).toEqual({ min: 100_000, max: 499_999, belirsiz: false });
  });

  it('yönü belirsiz tek sayıyı işaretler', () => {
    expect(esikCoz('[25.000 TL]')).toEqual({ min: 25_000, max: null, belirsiz: true });
  });

  it('sayısız açıklamayı çözemez', () => {
    expect(esikCoz('VIP oyuncular')).toBeNull();
    expect(esikCoz('')).toBeNull();
    expect(esikCoz(null)).toBeNull();
  });
});

describe('seviyeNoCoz', () => {
  it('addan seviye numarasını çıkarır', () => {
    expect(seviyeNoCoz('El Patrón (Seviye 5)')).toBe(5);
    expect(seviyeNoCoz('Level 3')).toBe(3);
  });

  it('numarasız adda null döner', () => {
    expect(seviyeNoCoz('VIP')).toBeNull();
  });
});

describe('seviyeMerdiveni', () => {
  it('yüksekten alçağa sıralar, eşiksiz varsayılan sona düşer', () => {
    expect(merdiven.map((s) => s.id)).toEqual([318, 317, 316, 315, 314, 308]);
  });

  it('varsayılan kategoriyi işaretler', () => {
    expect(varsayilanSeviye(merdiven)?.id).toBe(308);
  });

  it('eşiği çözülemeyen kategoriyi listede tutar ama eşiksiz', () => {
    const liste = seviyeMerdiveni([{ id: 400, name: 'Özel', description: 'elle atanır' }]);
    expect(liste).toHaveLength(1);
    expect(liste[0].esik).toBeNull();
  });

  it('kimliksiz satırı atar', () => {
    expect(seviyeMerdiveni([{ name: 'kimliksiz' }])).toEqual([]);
  });
});

describe('seviyeBul', () => {
  it('tutarı doğru banda koyar', () => {
    expect(seviyeBul(merdiven, 750_000)?.id).toBe(318);
    expect(seviyeBul(merdiven, 300_000)?.id).toBe(317);
    expect(seviyeBul(merdiven, 150_000)?.id).toBe(316);
    expect(seviyeBul(merdiven, 60_000)?.id).toBe(315);
    expect(seviyeBul(merdiven, 20_000)?.id).toBe(314);
  });

  it('sınır değerleri dahil sayar', () => {
    expect(seviyeBul(merdiven, 500_000)?.id).toBe(318);
    expect(seviyeBul(merdiven, 499_999)?.id).toBe(317);
    expect(seviyeBul(merdiven, 250_000)?.id).toBe(317);
    expect(seviyeBul(merdiven, 249_999)?.id).toBe(316);
    expect(seviyeBul(merdiven, 10_000)?.id).toBe(314);
  });

  it('10.000 TL altı hiçbir banda girmez', () => {
    // Merdivende gercek bir bosluk: 0 - 9.999.
    expect(seviyeBul(merdiven, 9_999)).toBeNull();
    expect(seviyeBul(merdiven, 0)).toBeNull();
  });

  it('yatırım bilinmiyorsa seviye atamaz', () => {
    // Olculmemis yatirimla oyuncu terfi ettirmek en sessiz hata turu.
    expect(seviyeBul(merdiven, null)).toBeNull();
    expect(seviyeBul(merdiven, NaN)).toBeNull();
  });

  it('eşiksiz merdivende hiçbir şey bulmaz', () => {
    expect(seviyeBul(seviyeMerdiveni([{ id: 1, name: 'Özel', description: 'yok' }]), 100)).toBeNull();
  });
});

describe('merdiven boşluğu', () => {
  it('0 – 9.999 aralığının kapsanmadığını bildirir', () => {
    // Bantlar 10.000'den basliyor; bu bosluk sitenin gercek durumu.
    expect(merdivenBosluklari(merdiven)).toEqual([{ min: 0, max: 9_999 }]);
  });

  it('üst sınırsız bant üstünü kapatır', () => {
    // El Patrón "ve üzeri" oldugu icin 500.000 sonrasi bosluk sayilmaz.
    expect(merdivenBosluklari(merdiven).some((b) => b.max === null)).toBe(false);
  });

  it('ortadaki boşluğu yakalar', () => {
    const delik = seviyeMerdiveni([
      { id: 1, name: 'A (Seviye 1)', description: '[0 - 999 TL]' },
      { id: 2, name: 'C (Seviye 3)', description: '[5.000 TL ve üzeri]' },
    ]);
    expect(merdivenBosluklari(delik)).toEqual([{ min: 1_000, max: 4_999 }]);
  });

  it('üst sınırsız bant yoksa tepeyi açık bildirir', () => {
    const kapali = seviyeMerdiveni([{ id: 1, name: 'A (Seviye 1)', description: '[0 - 999 TL]' }]);
    expect(kapali.length).toBe(1);
    expect(merdivenBosluklari(kapali)).toEqual([{ min: 1_000, max: null }]);
  });
});

describe('hedefSeviye — boşluğu varsayılan kategori kapatır', () => {
  it('10.000 TL altındaki oyuncuyu Yeni Oyuncu\'ya koyar', () => {
    expect(hedefSeviye(merdiven, 5_000)?.id).toBe(308);
    expect(hedefSeviye(merdiven, 0)?.id).toBe(308);
  });

  it('banda giren oyuncuyu varsayılana düşürmez', () => {
    expect(hedefSeviye(merdiven, 20_000)?.id).toBe(314);
  });

  it('yatırım bilinmiyorsa varsayılana da koymaz', () => {
    expect(hedefSeviye(merdiven, null)).toBeNull();
  });

  it('varsayılan kategori yoksa boşluk boş kalır', () => {
    const varsayilansiz = seviyeMerdiveni(MERDIVEN_KAYNAGI.filter((k) => k.id !== 308));
    expect(varsayilanSeviye(varsayilansiz)).toBeNull();
    expect(hedefSeviye(varsayilansiz, 5_000)).toBeNull();
  });
});

const profil = (yama: Partial<OyuncuProfili>): OyuncuProfili => ({
  playerId: 2501238,
  login: 'zlfkr79',
  toplamYatirim: 0,
  netKarZarar: 0,
  sonYatirim: null,
  ayniIpHesapSayisi: null,
  mevcutKategoriId: null,
  ...yama,
});

describe('kategoriRiski', () => {
  it('veri yoksa düşük', () => {
    expect(kategoriRiski(profil({ netKarZarar: null }))).toBe('DÜŞÜK');
  });

  it('çoklu hesap + yüksek kazanç kritik', () => {
    expect(kategoriRiski(profil({ ayniIpHesapSayisi: 3, netKarZarar: -80_000 }))).toBe('KRİTİK');
  });

  it('tek başına çoklu hesap orta', () => {
    expect(kategoriRiski(profil({ ayniIpHesapSayisi: 3 }))).toBe('ORTA');
  });

  it('aynı IP\'de tek hesap risk değil', () => {
    expect(kategoriRiski(profil({ ayniIpHesapSayisi: 1 }))).toBe('DÜŞÜK');
  });
});

describe('durgunlukGunu', () => {
  const simdi = Date.parse('2026-08-03T00:00:00Z');

  it('gün farkını hesaplar', () => {
    expect(durgunlukGunu('2026-07-04T00:00:00Z', simdi)).toBe(30);
  });

  it('tarih yoksa null', () => {
    expect(durgunlukGunu(null, simdi)).toBeNull();
    expect(durgunlukGunu('bozuk', simdi)).toBeNull();
  });
});

describe('kategoriOnerisi', () => {
  const simdi = Date.parse('2026-08-03T00:00:00Z');

  it('doğru bandı önerir', () => {
    const oneri = kategoriOnerisi(profil({ toplamYatirim: 750_000, mevcutKategoriId: 314 }), merdiven, simdi);
    expect(oneri?.hedefKategoriId).toBe(318);
    expect(oneri?.hedefKategoriAdi).toBe('El Patrón (Seviye 5)');
    expect(oneri?.gerekce).toContain('750.000');
  });

  it('kategori zaten doğruysa öneri üretmez', () => {
    expect(kategoriOnerisi(profil({ toplamYatirim: 750_000, mevcutKategoriId: 318 }), merdiven, simdi)).toBeNull();
  });

  it('yatırım ölçülemiyorsa öneri üretmez', () => {
    expect(kategoriOnerisi(profil({ toplamYatirim: null }), merdiven, simdi)).toBeNull();
  });

  it('kritik riskli oyuncuyu otomatik terfi ettirmez', () => {
    const oneri = kategoriOnerisi(
      profil({ toplamYatirim: 750_000, mevcutKategoriId: 314, ayniIpHesapSayisi: 4, netKarZarar: -90_000 }),
      merdiven, simdi,
    );
    expect(oneri?.risk).toBe('KRİTİK');
    expect(oneri?.bekletme).toContain('Kritik risk');
  });

  it('seviye düşürmeyi otomatik uygulamaz', () => {
    // El Patrón'daki oyuncunun yatirim toplami 5.000 gorunuyor: ya
    // kategori elle atanmis ya da toplam eksik okunmus. Ikisinde de
    // sessizce dusurmek yanlis.
    const oneri = kategoriOnerisi(profil({ toplamYatirim: 5_000, mevcutKategoriId: 318 }), merdiven, simdi);
    expect(oneri?.hedefKategoriId).toBe(308);
    expect(oneri?.bekletme).toContain('Seviye düşürme');
    expect(oneri?.bekletme).toContain('El Patrón');
  });

  it('terfi bekletilmez', () => {
    const oneri = kategoriOnerisi(profil({ toplamYatirim: 300_000, mevcutKategoriId: 316 }), merdiven, simdi);
    expect(oneri?.hedefKategoriId).toBe(317);
    expect(oneri?.bekletme).toBeNull();
  });

  it('varsayılandan terfi bekletilmez', () => {
    const oneri = kategoriOnerisi(profil({ toplamYatirim: 20_000, mevcutKategoriId: 308 }), merdiven, simdi);
    expect(oneri?.hedefKategoriId).toBe(314);
    expect(oneri?.bekletme).toBeNull();
  });

  it('boşluktaki oyuncu varsayılana yönlendirilir ve sebebi yazılır', () => {
    const oneri = kategoriOnerisi(profil({ toplamYatirim: 5_000, mevcutKategoriId: null }), merdiven, simdi);
    expect(oneri?.hedefKategoriId).toBe(308);
    expect(oneri?.gerekce).toContain('varsayılan kategoriye düşüyor');
  });

  it('düşük riskli oyuncuda bekletme yok', () => {
    const oneri = kategoriOnerisi(profil({ toplamYatirim: 750_000, mevcutKategoriId: 314 }), merdiven, simdi);
    expect(oneri?.bekletme).toBeNull();
  });

  it('durgunluğu gerekçeye yazar ama terfiyi engellemez', () => {
    const oneri = kategoriOnerisi(
      profil({ toplamYatirim: 750_000, mevcutKategoriId: 314, sonYatirim: '2026-01-01T00:00:00Z' }),
      merdiven, simdi,
    );
    expect(oneri?.gerekce).toContain('gündür yatırım yok');
    expect(oneri?.bekletme).toBeNull();
  });

  it('belirsiz eşikli kategoriyi otomatik uygulamaz', () => {
    const belirsizMerdiven = seviyeMerdiveni([{ id: 500, name: 'Özel (Seviye 9)', description: '[25.000 TL]' }]);
    const oneri = kategoriOnerisi(profil({ toplamYatirim: 30_000 }), belirsizMerdiven, simdi);
    expect(oneri?.bekletme).toContain('belirsiz');
  });
});

describe('kategoriOnerileri', () => {
  it('yatırıma göre sıralar ve önerisizleri eler', () => {
    const oneriler = kategoriOnerileri(
      [
        profil({ playerId: 1, toplamYatirim: 30_000, mevcutKategoriId: 308 }),
        profil({ playerId: 2, toplamYatirim: 750_000, mevcutKategoriId: 314 }),
        profil({ playerId: 3, toplamYatirim: 750_000, mevcutKategoriId: 318 }), // zaten doğru
        profil({ playerId: 4, toplamYatirim: null }),                            // ölçülemiyor
      ],
      merdiven,
    );
    expect(oneriler.map((o) => o.playerId)).toEqual([2, 1]);
  });

  it('boş girdi çökmez', () => {
    expect(kategoriOnerileri(null, merdiven)).toEqual([]);
  });
});

describe('kategoriGovdeleri', () => {
  it('üç aday gövde üretir', () => {
    expect(kategoriGovdeleri(2501238, 318)).toHaveLength(3);
    expect(kategoriGovdeleri(2501238, 318)[0]).toEqual({ categoryId: 318 });
  });
});

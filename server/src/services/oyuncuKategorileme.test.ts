import { describe, expect, it } from 'vitest';
import {
  durgunlukGunu,
  esikCoz,
  kategoriGovdeleri,
  kategoriOnerileri,
  kategoriOnerisi,
  kategoriRiski,
  seviyeBul,
  seviyeMerdiveni,
  seviyeNoCoz,
  turkceSayi,
  type LynonKategori,
  type OyuncuProfili,
} from './oyuncuKategorileme.js';

/** Kullanicinin yapistirdigi gercek kategori satiri. */
const GERCEK: LynonKategori = {
  id: 318,
  name: 'El Patrón (Seviye 5)',
  description: '[500.000 TL ve üzeri]',
  isDefault: false,
};

const MERDIVEN_KAYNAGI: LynonKategori[] = [
  GERCEK,
  { id: 317, name: 'Sicario (Seviye 4)', description: '[100.000 TL - 499.999 TL]' },
  { id: 316, name: 'Halcón (Seviye 3)', description: '[25.000 TL - 99.999 TL]' },
  { id: 315, name: 'Mula (Seviye 2)', description: '[5.000 TL - 24.999 TL]' },
  { id: 314, name: 'Novato (Seviye 1)', description: '[5.000 TL altı]', isDefault: true },
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
  it('gerçek açıklamayı çözer', () => {
    expect(esikCoz('[500.000 TL ve üzeri]')).toEqual({ min: 500_000, max: null, belirsiz: false });
  });

  it('aralık açıklamasını çözer', () => {
    expect(esikCoz('[100.000 TL - 499.999 TL]')).toEqual({ min: 100_000, max: 499_999, belirsiz: false });
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
  it('yüksekten alçağa sıralar', () => {
    expect(merdiven.map((s) => s.id)).toEqual([318, 317, 316, 315, 314]);
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
    expect(seviyeBul(merdiven, 200_000)?.id).toBe(317);
    expect(seviyeBul(merdiven, 30_000)?.id).toBe(316);
    expect(seviyeBul(merdiven, 100)?.id).toBe(314);
  });

  it('sınır değerleri dahil sayar', () => {
    expect(seviyeBul(merdiven, 500_000)?.id).toBe(318);
    expect(seviyeBul(merdiven, 499_999)?.id).toBe(317);
    expect(seviyeBul(merdiven, 100_000)?.id).toBe(317);
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
        profil({ playerId: 1, toplamYatirim: 30_000, mevcutKategoriId: 314 }),
        profil({ playerId: 2, toplamYatirim: 750_000, mevcutKategoriId: 314 }),
        profil({ playerId: 3, toplamYatirim: 750_000, mevcutKategoriId: 318 }), // zaten doğru
        profil({ playerId: 4, toplamYatirim: null }),
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

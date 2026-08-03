import { describe, expect, it } from 'vitest';
import {
  ESIKLER,
  kayittanBeriGun,
  oyuncuEtiketleri,
  oyuncuPersonasi,
  riskSeviyesi,
  tercihEdilenKategori,
  type OyuncuOlculeri,
} from './oyuncuEtiketleri';

/** Hiçbir şey bilinmiyor — bildirilen "her profilde etiket" hatasının tabanı. */
const BOS: OyuncuOlculeri = {
  yatirimTutari: null,
  yatirimAdedi: null,
  cekimTutari: null,
  netKarZarar: null,
  sporHacmi: null,
  casinoHacmi: null,
  kayitTarihi: null,
  bonusAdedi: null,
  ayniIpHesapSayisi: null,
};

const olcu = (yama: Partial<OyuncuOlculeri>): OyuncuOlculeri => ({ ...BOS, ...yama });
const kimlikler = (o: OyuncuOlculeri, simdi?: number) => oyuncuEtiketleri(o, simdi).map((e) => e.id);

describe('veri yokken etiket üretilmez', () => {
  it('boş ölçü hiç etiket vermez', () => {
    expect(oyuncuEtiketleri(BOS)).toEqual([]);
  });

  it('bilinmeyen bonus adedi "Bonus almamış" üretmez', () => {
    // Eski sürüm anlık bonus bakiyesine bakıp bunu herkese basıyordu.
    expect(kimlikler(olcu({ yatirimTutari: 10_000, bonusAdedi: null }))).not.toContain('bonus-almamis');
  });

  it('bilinen sıfır bonus adedi etiket üretir', () => {
    expect(kimlikler(olcu({ yatirimTutari: 10_000, bonusAdedi: 0 }))).toContain('bonus-almamis');
  });

  it('bonus almış oyuncuya etiket basılmaz', () => {
    expect(kimlikler(olcu({ yatirimTutari: 10_000, bonusAdedi: 3 }))).not.toContain('bonus-almamis');
  });

  it('hacim bilinmiyorsa "Pasif" denmez', () => {
    expect(kimlikler(olcu({ yatirimAdedi: 0 }))).not.toContain('pasif');
    expect(kimlikler(olcu({ yatirimAdedi: 0, sporHacmi: 0, casinoHacmi: 0 }))).toContain('pasif');
  });
});

describe('tek sinyal tek etiket üretir', () => {
  it('kârda olmak dört rozet birden basmaz', () => {
    // Eski liste burada Risk Review + High Risk + Negative + Review veriyordu.
    const etiketler = oyuncuEtiketleri(olcu({ netKarZarar: -80_000 }));
    expect(etiketler).toHaveLength(1);
    expect(etiketler[0].id).toBe('kasa-zararda');
  });

  it('aynı aileden en fazla bir etiket kalır', () => {
    const etiketler = oyuncuEtiketleri(
      olcu({ yatirimTutari: 500_000, netKarZarar: -200_000, ayniIpHesapSayisi: 4 }),
    );
    const aileler = etiketler.map((e) => e.aile);
    expect(new Set(aileler).size).toBe(aileler.length);
  });

  it('çoklu hesap + yüksek kazanç tek kritik etiket verir', () => {
    const risk = oyuncuEtiketleri(olcu({ ayniIpHesapSayisi: 3, netKarZarar: -120_000 }))
      .filter((e) => e.aile === 'risk');
    expect(risk).toHaveLength(1);
    expect(risk[0].id).toBe('coklu-hesap-kritik');
  });

  it('etiketler ağırlığa göre sıralanır', () => {
    const etiketler = oyuncuEtiketleri(
      olcu({ yatirimTutari: 500_000, netKarZarar: -200_000, ayniIpHesapSayisi: 4 }),
    );
    const agirliklar = etiketler.map((e) => e.agirlik);
    expect([...agirliklar].sort((a, b) => b - a)).toEqual(agirliklar);
  });
});

describe('eşikler', () => {
  it('40 lira önde olan oyuncu risk etiketi almaz', () => {
    expect(kimlikler(olcu({ netKarZarar: -40 }))).toEqual([]);
  });

  it('VIP eşiği tam sınırda geçer', () => {
    expect(kimlikler(olcu({ yatirimTutari: ESIKLER.vipYatirim }))).toContain('vip');
    expect(kimlikler(olcu({ yatirimTutari: ESIKLER.vipYatirim - 1 }))).toContain('vip-adayi');
  });

  it('küçük hacimde oyun deseni yorumlanmaz', () => {
    const kucuk = olcu({ sporHacmi: 900, casinoHacmi: 100, netKarZarar: -60_000 });
    expect(kimlikler(kucuk)).not.toContain('surebet-suphesi');
  });

  it('spor ağırlıklı yüksek hacimli kazanç surebet şüphesi verir', () => {
    const buyuk = olcu({ sporHacmi: 90_000, casinoHacmi: 10_000, netKarZarar: -60_000 });
    expect(kimlikler(buyuk)).toContain('surebet-suphesi');
  });

  it('casino ağırlıklı kazanç ayrı etiket verir', () => {
    const buyuk = olcu({ sporHacmi: 5_000, casinoHacmi: 95_000, netKarZarar: -60_000 });
    expect(kimlikler(buyuk)).toContain('casino-kazanc-serisi');
  });

  it('küçük yatırımda çekim oranı gürültü sayılır', () => {
    expect(kimlikler(olcu({ yatirimTutari: 100, cekimTutari: 400 }))).not.toContain('cekim-yatirimi-asti');
    expect(kimlikler(olcu({ yatirimTutari: 20_000, cekimTutari: 30_000 }))).toContain('cekim-yatirimi-asti');
  });
});

describe('risk seviyesi', () => {
  it('veri yoksa düşük', () => {
    expect(riskSeviyesi(BOS)).toBe('DÜŞÜK');
  });

  it('sadece kârda olmak orta yapmaz — tutar önemli olmalı', () => {
    expect(riskSeviyesi(olcu({ netKarZarar: -500 }))).toBe('DÜŞÜK');
    expect(riskSeviyesi(olcu({ netKarZarar: -60_000 }))).toBe('ORTA');
  });

  it('çoklu hesap + yüksek kazanç kritik', () => {
    expect(riskSeviyesi(olcu({ ayniIpHesapSayisi: 3, netKarZarar: -60_000 }))).toBe('KRİTİK');
  });

  it('aynı IP\'de tek hesap çoklu hesap değildir', () => {
    expect(riskSeviyesi(olcu({ ayniIpHesapSayisi: 1, netKarZarar: -100 }))).toBe('DÜŞÜK');
  });
});

describe('persona ve kategori', () => {
  it('ölçü yoksa persona uydurulmaz', () => {
    expect(oyuncuPersonasi(BOS).ad).toBe('Profil çıkarılamadı');
  });

  it('yatırımı olmayan oyuncu VIP olamaz', () => {
    expect(oyuncuPersonasi(olcu({ yatirimTutari: 0, yatirimAdedi: 0 })).ad).toBe('Yeni / pasif kayıt');
  });

  it('hacim yoksa kategori uydurulmaz', () => {
    expect(tercihEdilenKategori(BOS)).toBeNull();
    expect(tercihEdilenKategori(olcu({ sporHacmi: 0, casinoHacmi: 0 }))).toBeNull();
  });

  it('kategori paya göre seçilir', () => {
    expect(tercihEdilenKategori(olcu({ sporHacmi: 10, casinoHacmi: 90 }))).toBe('Canlı casino & slot');
    expect(tercihEdilenKategori(olcu({ sporHacmi: 90, casinoHacmi: 10 }))).toBe('Spor bahisleri');
    expect(tercihEdilenKategori(olcu({ sporHacmi: 50, casinoHacmi: 50 }))).toBe('Karma (spor & casino)');
  });
});

describe('kayıt tarihi', () => {
  it('okunamayan tarih null verir', () => {
    expect(kayittanBeriGun(null)).toBeNull();
    expect(kayittanBeriGun('bozuk')).toBeNull();
  });

  it('yeni oyuncu etiketi süreye bağlı', () => {
    const simdi = Date.parse('2026-08-03T00:00:00Z');
    const yeni = olcu({ kayitTarihi: '2026-07-20T00:00:00Z' });
    const eski = olcu({ kayitTarihi: '2026-01-01T00:00:00Z' });
    expect(kimlikler(yeni, simdi)).toContain('yeni-oyuncu');
    expect(kimlikler(eski, simdi)).not.toContain('yeni-oyuncu');
  });
});

describe('telefon doğrulaması', () => {
  it('doğrulanmamış telefon etiketi üretir', () => {
    expect(kimlikler(olcu({ telefonDogrulandi: false }))).toContain('telefon-dogrulanmamis');
  });

  it('doğrulanmış telefon etiket üretmez', () => {
    expect(kimlikler(olcu({ telefonDogrulandi: true }))).not.toContain('telefon-dogrulanmamis');
  });

  it('ölçülemediyse etiket üretmez', () => {
    // `=== true` ile daraltmak, alani gelmeyen oyuncuyu "dogrulanmamis"
    // gosterip yanlis etiket uretirdi.
    expect(kimlikler(olcu({ telefonDogrulandi: null }))).not.toContain('telefon-dogrulanmamis');
    expect(kimlikler(BOS)).not.toContain('telefon-dogrulanmamis');
  });

  it('kendi ailesinde; değer bandıyla yarışmaz', () => {
    const etiketler = oyuncuEtiketleri(olcu({ telefonDogrulandi: false, yatirimTutari: 500_000 }));
    expect(etiketler.map((e) => e.id)).toEqual(expect.arrayContaining(['vip', 'telefon-dogrulanmamis']));
  });
});

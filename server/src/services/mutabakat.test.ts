import { describe, expect, it } from 'vitest';
import {
  ayAraligi,
  ayinManuelKalemleri,
  ayinTamAraligi,
  mutabakatMesaji,
  mutabakatSatirlari,
  mutabakatToplami,
  oncekiAyAnahtari,
  ozetFarki,
  satirlariManuelIleZenginlestir,
  yontemKasaMesaji,
  type ManuelKalem,
} from './mutabakat.js';

/** Kullanicinin yapistirdigi gercek rapor 1842 yaniti. */
const GERCEK_SATIRLAR = [
  {
    'Integration Name': 'HemenOde', 'Payment Name': 'Havale', Currency: 'TRY',
    'Deposit Amount': 5310, 'Deposit Amount (TRY)': 5310, 'Deposit Count': 5,
    'Withdrawal Amount': 13166, 'Withdrawal Amount (TRY)': 13166, 'Withdrawal Count': 2,
  },
  {
    'Integration Name': 'NeoPays', 'Payment Name': 'Havale', Currency: 'TRY',
    'Deposit Amount': 12000, 'Deposit Amount (TRY)': 12000, 'Deposit Count': 4,
    'Withdrawal Amount': 0, 'Withdrawal Amount (TRY)': 0, 'Withdrawal Count': 0,
  },
  {
    'Integration Name': 'UltraPay', 'Payment Name': 'Havale', Currency: 'TRY',
    'Deposit Amount': 1000, 'Deposit Amount (TRY)': 1000, 'Deposit Count': 1,
    'Withdrawal Amount': 0, 'Withdrawal Amount (TRY)': 0, 'Withdrawal Count': 0,
  },
];

const GERCEK_OZET = { 'Deposit Amount (TRY)': 18310, 'Withdrawal Amount (TRY)': 13166 };

describe('mutabakatSatirlari', () => {
  const satirlar = mutabakatSatirlari(GERCEK_SATIRLAR);

  it('gerçek yanıtı yönteme göre çevirir', () => {
    expect(satirlar).toHaveLength(3);
    expect(satirlar[0]).toMatchObject({
      anahtar: 'NeoPays · Havale', yatirim: 12000, yatirimAdedi: 4, cekim: 0, net: 12000,
    });
  });

  it('yatırıma göre sıralar', () => {
    expect(satirlar.map((s) => s.yatirim)).toEqual([12000, 5310, 1000]);
  });

  it('aynı entegrasyon+yöntem ikilisini toplar', () => {
    // Uc ayni ikiliyi para birimi bazinda bolerek donebiliyor.
    const bolunmus = mutabakatSatirlari([
      { 'Integration Name': 'HemenOde', 'Payment Name': 'Havale', 'Deposit Amount': 100, 'Deposit Count': 1 },
      { 'Integration Name': 'HemenOde', 'Payment Name': 'Havale', 'Deposit Amount': 200, 'Deposit Count': 2 },
    ]);
    expect(bolunmus).toHaveLength(1);
    expect(bolunmus[0]).toMatchObject({ yatirim: 300, yatirimAdedi: 3 });
  });

  it('adı gelmeyen satırı uydurmaz', () => {
    const isimsiz = mutabakatSatirlari([{ 'Deposit Amount': 50 }]);
    expect(isimsiz[0].anahtar).toBe('Bilinmiyor · Bilinmiyor');
  });

  it('boş girdi çökmez', () => {
    expect(mutabakatSatirlari(null)).toEqual([]);
  });
});

describe('mutabakatToplami', () => {
  const satirlar = mutabakatSatirlari(GERCEK_SATIRLAR);

  it('uçun kendi özetini kullanır', () => {
    const toplam = mutabakatToplami(satirlar, GERCEK_OZET, []);
    expect(toplam.raporYatirim).toBe(18310);
    expect(toplam.raporCekim).toBe(13166);
    expect(toplam.raporNet).toBe(18310 - 13166);
  });

  it('özet yoksa satırlardan hesaplar', () => {
    const toplam = mutabakatToplami(satirlar, null, []);
    expect(toplam.raporYatirim).toBe(18310);
  });

  it('elle eklenen kalemleri AYRI tutar', () => {
    // Tek toplam gostermek, farkin kaynagini gizlerdi.
    const manuel: ManuelKalem[] = [
      { id: '1', gun: '2026-08-02', tur: 'yatirim', tutar: 5000, aciklama: 'elden havale', ekleyen: 'a', eklendi: '' },
      { id: '2', gun: '2026-08-03', tur: 'cekim', tutar: 1500, aciklama: 'iade', ekleyen: 'a', eklendi: '' },
    ];
    const toplam = mutabakatToplami(satirlar, GERCEK_OZET, manuel);
    expect(toplam.raporYatirim).toBe(18310);
    expect(toplam.manuelYatirim).toBe(5000);
    expect(toplam.manuelCekim).toBe(1500);
    expect(toplam.toplamYatirim).toBe(23310);
    expect(toplam.toplamCekim).toBe(14666);
    expect(toplam.toplamNet).toBe(23310 - 14666);
    expect(toplam.manuelKalemAdedi).toBe(2);
  });

  it('manuel kalem yoksa toplam rapora eşit', () => {
    const toplam = mutabakatToplami(satirlar, GERCEK_OZET, []);
    expect(toplam.toplamYatirim).toBe(toplam.raporYatirim);
    expect(toplam.toplamNet).toBe(toplam.raporNet);
  });
});

describe('ozetFarki', () => {
  const satirlar = mutabakatSatirlari(GERCEK_SATIRLAR);

  it('gerçek veride satır toplamı özetle tutuyor', () => {
    expect(ozetFarki(satirlar, GERCEK_OZET).tutarli).toBe(true);
  });

  it('tutmayan farkı bildirir', () => {
    // Rapor icinde gormedigimiz bir kalem varsa sessizce yutulmamali.
    const fark = ozetFarki(satirlar, { 'Deposit Amount (TRY)': 20000, 'Withdrawal Amount (TRY)': 13166 });
    expect(fark.tutarli).toBe(false);
    expect(fark.yatirimFarki).toBe(20000 - 18310);
  });

  it('özet yoksa tutarsızlık iddia etmez', () => {
    expect(ozetFarki(satirlar, null).tutarli).toBe(true);
  });
});

describe('ay aralığı ve manuel süzme', () => {
  it('ayın ilk gününden bugüne', () => {
    expect(ayAraligi('2026-08-03')).toEqual({ startDate: '2026-08-01', endDate: '2026-08-03', ay: '2026-08' });
  });

  it('yalnız o ayın kalemlerini alır', () => {
    const kalemler: ManuelKalem[] = [
      { id: '1', gun: '2026-08-02', tur: 'yatirim', tutar: 100, aciklama: '', ekleyen: '', eklendi: '' },
      { id: '2', gun: '2026-07-31', tur: 'yatirim', tutar: 200, aciklama: '', ekleyen: '', eklendi: '' },
    ];
    expect(ayinManuelKalemleri(kalemler, '2026-08').map((k) => k.id)).toEqual(['1']);
  });

  it('boş girdi çökmez', () => {
    expect(ayinManuelKalemleri(null, '2026-08')).toEqual([]);
  });
});

describe('oncekiAyAnahtari', () => {
  it('yılın ortasında bir önceki ayı verir', () => {
    expect(oncekiAyAnahtari('2026-08-03')).toBe('2026-07');
  });

  it('yıl başında bir önceki yılın aralığına döner', () => {
    expect(oncekiAyAnahtari('2026-01-15')).toBe('2025-12');
  });
});

describe('ayinTamAraligi', () => {
  it('31 günlük ayın tam aralığını verir', () => {
    expect(ayinTamAraligi('2026-07')).toEqual({ startDate: '2026-07-01', endDate: '2026-07-31', ay: '2026-07' });
  });

  it('şubatta artık yılı doğru hesaplar', () => {
    expect(ayinTamAraligi('2024-02')).toEqual({ startDate: '2024-02-01', endDate: '2024-02-29', ay: '2024-02' });
    expect(ayinTamAraligi('2026-02')).toEqual({ startDate: '2026-02-01', endDate: '2026-02-28', ay: '2026-02' });
  });
});

describe('satirlariManuelIleZenginlestir', () => {
  const satirlar = mutabakatSatirlari(GERCEK_SATIRLAR);

  it('yönteme etiketli kalemi ilgili satıra işler', () => {
    const manuel: ManuelKalem[] = [
      { id: '1', gun: '2026-08-02', tur: 'yatirim', tutar: 500, aciklama: '', ekleyen: '', eklendi: '', yontem: 'HemenOde · Havale' },
    ];
    const zengin = satirlariManuelIleZenginlestir(satirlar, manuel);
    const hemenode = zengin.find((s) => s.anahtar === 'HemenOde · Havale')!;
    expect(hemenode.manuelYatirim).toBe(500);
    expect(hemenode.duzeltilmisYatirim).toBe(5310 + 500);
    expect(hemenode.duzeltilmisNet).toBe(5310 + 500 - 13166);
  });

  it('yöntemsiz (genel) kalem hiçbir satırı değiştirmez', () => {
    const manuel: ManuelKalem[] = [
      { id: '1', gun: '2026-08-02', tur: 'yatirim', tutar: 500, aciklama: '', ekleyen: '', eklendi: '' },
    ];
    const zengin = satirlariManuelIleZenginlestir(satirlar, manuel);
    expect(zengin.every((s) => !s.manuelYatirim && !s.manuelCekim)).toBe(true);
  });

  it('eşleşmeyen yöntem hiçbir satırı değiştirmez', () => {
    const manuel: ManuelKalem[] = [
      { id: '1', gun: '2026-08-02', tur: 'yatirim', tutar: 500, aciklama: '', ekleyen: '', eklendi: '', yontem: 'Olmayan · Yöntem' },
    ];
    const zengin = satirlariManuelIleZenginlestir(satirlar, manuel);
    expect(zengin.every((s) => !s.manuelYatirim && !s.manuelCekim)).toBe(true);
  });

  it('boş girdi çökmez', () => {
    expect(satirlariManuelIleZenginlestir(null, null)).toEqual([]);
  });
});

describe('mutabakatMesaji', () => {
  const satirlar = mutabakatSatirlari(GERCEK_SATIRLAR);
  const manuel: ManuelKalem[] = [
    { id: '1', gun: '2026-08-02', tur: 'yatirim', tutar: 5000, aciklama: 'elden havale', ekleyen: 'a', eklendi: '' },
  ];

  it('gerçek rakamları yazar', () => {
    const mesaj = mutabakatMesaji({
      ay: '2026-08',
      aralik: { startDate: '2026-08-01', endDate: '2026-08-03' },
      satirlar,
      toplam: mutabakatToplami(satirlar, GERCEK_OZET, manuel),
      fark: ozetFarki(satirlar, GERCEK_OZET),
      manuel,
    });
    expect(mesaj).toContain('AYLIK MUTABAKAT · 2026-08');
    expect(mesaj).toContain('HemenOde · Havale');
    expect(mesaj).toContain('18.310 TRY');
    expect(mesaj).toContain('13.166 TRY');
    expect(mesaj).toContain('elden havale');
    expect(mesaj).toContain('23.310 TRY');
  });

  it('manuel kalem yoksa o bölümü hiç yazmaz', () => {
    const mesaj = mutabakatMesaji({
      ay: '2026-08',
      aralik: { startDate: '2026-08-01', endDate: '2026-08-03' },
      satirlar,
      toplam: mutabakatToplami(satirlar, GERCEK_OZET, []),
      fark: ozetFarki(satirlar, GERCEK_OZET),
      manuel: [],
    });
    expect(mesaj).not.toContain('ELLE EKLENEN');
  });

  it('tutarsızlığı mesaja yazar', () => {
    const bozukOzet = { 'Deposit Amount (TRY)': 20000, 'Withdrawal Amount (TRY)': 13166 };
    const mesaj = mutabakatMesaji({
      ay: '2026-08',
      aralik: { startDate: '2026-08-01', endDate: '2026-08-03' },
      satirlar,
      toplam: mutabakatToplami(satirlar, bozukOzet, []),
      fark: ozetFarki(satirlar, bozukOzet),
      manuel: [],
    });
    expect(mesaj).toContain('tutmuyor');
  });

  it('kapanış modunda başlığı ayırt eder', () => {
    const mesaj = mutabakatMesaji({
      ay: '2026-07',
      aralik: { startDate: '2026-07-01', endDate: '2026-07-31' },
      satirlar,
      toplam: mutabakatToplami(satirlar, GERCEK_OZET, []),
      fark: ozetFarki(satirlar, GERCEK_OZET),
      manuel: [],
      kapanis: true,
    });
    expect(mesaj).toContain('AY KAPANIŞI · 2026-07');
    expect(mesaj).not.toContain('AYLIK MUTABAKAT');
  });

  it('yönteme etiketli düzeltmeyi satırın altına yazar', () => {
    const manuelYontemli: ManuelKalem[] = [
      { id: '1', gun: '2026-08-02', tur: 'yatirim', tutar: 500, aciklama: '', ekleyen: 'a', eklendi: '', yontem: 'HemenOde · Havale' },
    ];
    const zengin = satirlariManuelIleZenginlestir(satirlar, manuelYontemli);
    const mesaj = mutabakatMesaji({
      ay: '2026-08',
      aralik: { startDate: '2026-08-01', endDate: '2026-08-03' },
      satirlar: zengin,
      toplam: mutabakatToplami(satirlar, GERCEK_OZET, manuelYontemli),
      fark: ozetFarki(satirlar, GERCEK_OZET),
      manuel: manuelYontemli,
    });
    expect(mesaj).toContain('Elle düzeltme: yatırım 500 TRY');
    expect(mesaj).toContain('düzeltilmiş net -7.356 TRY');
  });

  it('hareketsiz ayda boş liste demez, açıkça söyler', () => {
    const mesaj = mutabakatMesaji({
      ay: '2026-09',
      aralik: { startDate: '2026-09-01', endDate: '2026-09-01' },
      satirlar: [],
      toplam: mutabakatToplami([], null, []),
      fark: { yatirimFarki: 0, cekimFarki: 0, tutarli: true },
      manuel: [],
    });
    expect(mesaj).toContain('sağlayıcı hareketi yok');
  });
});

describe('yontemKasaMesaji', () => {
  const satirlar = mutabakatSatirlari(GERCEK_SATIRLAR);
  const aralik = { baslangic: '2026-07-28', bitis: '2026-08-04' };

  it('yöntem başına yatırım/çekim/net yazar', () => {
    const mesaj = yontemKasaMesaji(aralik, satirlar);
    expect(mesaj).toContain('YÖNTEM BAZINDA KASA · TÜM ZAMANLAR');
    expect(mesaj).toContain('2026-07-28 → 2026-08-04');
    expect(mesaj).toContain('HemenOde · Havale');
    expect(mesaj).toContain('5.310 TRY (5)');
    expect(mesaj).toContain('13.166 TRY (2)');
  });

  it('toplam satırını ekler', () => {
    const mesaj = yontemKasaMesaji(aralik, satirlar);
    expect(mesaj).toContain('TOPLAM Yatırım: 18.310 TRY');
    expect(mesaj).toContain('TOPLAM Çekim:   13.166 TRY');
  });

  it('saat verilirse başlığa yazar', () => {
    expect(yontemKasaMesaji(aralik, satirlar, '14:20')).toContain('· 14:20');
  });

  it('hareket yoksa açıkça söyler', () => {
    const mesaj = yontemKasaMesaji(aralik, []);
    expect(mesaj).toContain('sağlayıcı hareketi yok');
  });

  it('yönteme etiketli manuel kalemi rapor rakamının yanında gösterir', () => {
    const manuel: ManuelKalem[] = [
      { id: '1', gun: '2026-08-02', tur: 'cekim', tutar: 1000, aciklama: '', ekleyen: '', eklendi: '', yontem: 'HemenOde · Havale' },
    ];
    const zengin = satirlariManuelIleZenginlestir(satirlar, manuel);
    const mesaj = yontemKasaMesaji(aralik, zengin);
    expect(mesaj).toContain('rapor 13.166 TRY + manuel 1.000 TRY');
    expect(mesaj).toContain('(manuel dahil:');
  });
});

import { describe, expect, it } from 'vitest';
import {
  GUNLUK_CEKIM_ESIGI,
  cekimBaglamMesaji,
  gunlukCekimSayisi,
  otomatikRedKarari,
  riskNotuVarMi,
  sonYatirimdanSonrakiBonuslar,
  vipNotuVarMi,
  casinoCevrimToplami,
  sporCevrimToplami,
  sonKullanilanBonusSec,
  enCokOynananOyunlar,
  type CekimBaglami,
} from './cekimDegerlendirmesi.js';

const cekim = (id: number, clientId: number, iso: string) => ({ Id: id, ClientId: clientId, CreatedLocal: iso });

describe('gunlukCekimSayisi', () => {
  const cekimler = [
    cekim(1, 500, '2026-08-02T21:01:00Z'), // TR 00:01, 3 Ağustos
    cekim(2, 500, '2026-08-03T09:00:00Z'),
    cekim(3, 500, '2026-08-03T18:00:00Z'),
    cekim(4, 999, '2026-08-03T10:00:00Z'), // başka oyuncu
    cekim(5, 500, '2026-08-02T15:00:00Z'), // önceki gün
  ];

  it('yalnız aynı oyuncunun aynı günkü taleplerini sayar', () => {
    expect(gunlukCekimSayisi(cekimler, 500, '2026-08-03')).toBe(3);
  });

  it('gece yarısını Türkiye saatiyle keser', () => {
    // 21:01 UTC = 00:01 Istanbul; onceki gune degil 3 Agustos'a sayilir.
    expect(gunlukCekimSayisi(cekimler, 500, '2026-08-02')).toBe(1);
  });

  it('değerlendirilen talebin kendisi hariç tutulabilir', () => {
    expect(gunlukCekimSayisi(cekimler, 500, '2026-08-03', 3)).toBe(2);
  });

  it('başka oyuncunun talebi karışmaz', () => {
    expect(gunlukCekimSayisi(cekimler, 999, '2026-08-03')).toBe(1);
  });

  it('kimliksiz sorgu sıfır döner', () => {
    expect(gunlukCekimSayisi(cekimler, null, '2026-08-03')).toBe(0);
  });

  it('boş girdi çökmez', () => {
    expect(gunlukCekimSayisi(null, 500, '2026-08-03')).toBe(0);
  });
});

describe('otomatikRedKarari', () => {
  it('eşiğe ulaşan talebi reddeder', () => {
    const karar = otomatikRedKarari(3, 3);
    expect(karar.reddet).toBe(true);
    expect(karar.neden).toContain('3');
  });

  it('eşiğin altında reddetmez', () => {
    expect(otomatikRedKarari(2, 3).reddet).toBe(false);
  });

  it('eşiğin üstünde de reddeder', () => {
    expect(otomatikRedKarari(7, 3).reddet).toBe(true);
  });

  it('varsayılan eşik üç', () => {
    expect(GUNLUK_CEKIM_ESIGI).toBe(3);
  });

  it('geçersiz eşikle reddetmez', () => {
    // Esik tanimsizsa otomatik para hareketi durdurulmaz.
    expect(otomatikRedKarari(99, 0).reddet).toBe(false);
    expect(otomatikRedKarari(99, NaN).reddet).toBe(false);
  });
});

describe('profil notları', () => {
  /** Kullanicinin yapistirdigi gercek not satiri. */
  const VIP_NOT = {
    id: 910819, text: 'VIP', noteCreatedUserEmail: 'cvnsigliere@proton.me',
    noteType: 'VIP', createdAt: '2026-08-03T19:04:03.196622Z',
  };

  it('gerçek VIP notunu tanır', () => {
    expect(vipNotuVarMi([VIP_NOT])).toBe(true);
    expect(riskNotuVarMi([VIP_NOT])).toBe(false);
  });

  it('sitedeki risk tiplerini tanır', () => {
    expect(riskNotuVarMi([{ noteType: 'High Risk' }])).toBe(true);
    expect(riskNotuVarMi([{ noteType: 'Risk' }])).toBe(true);
  });

  it('risk olmayan tipleri risk saymaz', () => {
    for (const tip of ['Manual', 'Affiliate', 'Call', 'VIP']) {
      expect(riskNotuVarMi([{ noteType: tip }]), tip).toBe(false);
    }
  });

  it('boş liste risk üretmez', () => {
    expect(riskNotuVarMi([])).toBe(false);
    expect(riskNotuVarMi(null)).toBe(false);
  });
});

describe('sonYatirimdanSonrakiBonuslar', () => {
  const bonuslar = [
    { CreatedLocal: '2026-08-03T08:00:00Z', Name: 'Önceki' },
    { CreatedLocal: '2026-08-03T12:00:00Z', Name: 'Sonraki' },
  ];

  it('yalnız son yatırımdan sonrakileri verir', () => {
    const sonuc = sonYatirimdanSonrakiBonuslar(bonuslar, '2026-08-03T10:00:00Z');
    expect(sonuc.map((b) => b.Name)).toEqual(['Sonraki']);
  });

  it('yatırım anı bilinmiyorsa boş döner', () => {
    // "Bonus yok" degil "olculemedi"; cagiran bu ayrimi gostermeli.
    expect(sonYatirimdanSonrakiBonuslar(bonuslar, null)).toEqual([]);
    expect(sonYatirimdanSonrakiBonuslar(bonuslar, 'bozuk')).toEqual([]);
  });

  it('tam yatırım anındaki bonus dahildir', () => {
    expect(sonYatirimdanSonrakiBonuslar(bonuslar, '2026-08-03T12:00:00Z')).toHaveLength(1);
  });
});

describe('cekimBaglamMesaji', () => {
  const SIMDI = Date.parse('2026-08-03T20:00:00Z');
  const taban: CekimBaglami = {
    playerId: 2503142, login: 'larac', tutar: 3000, paraBirimi: 'TRY',
    gunlukCekim: 1, netKarZarar: -5000, toplamYatirim: 20000, toplamCekim: 8000,
    bakiye: 4200, sonYatirimTutari: 1000, sonYatirimZamani: '2026-08-03T10:00:00Z',
    sonCekimZamani: '2026-08-02T10:00:00Z',
    sonYatirimBonuslari: [], bonusOlculdu: true, notlar: [],
    otomatikRed: { reddet: false, neden: '', gunlukSayi: 1 },
    kayitTarihi: '2026-07-01T10:00:00Z',
    telefonDogrulandi: true, epostaDogrulandi: true, kimlikDogrulandi: false,
    kategori: 'Sicario (Seviye 1)',
    yatirimAdedi: 4, cekimAdedi: 2, bonusBakiye: 0,
    casinoBahis: 98.8, casinoGgr: 37.56, sporBahis: 0, sporGgr: 0,
    bonusKaynakliKazanc: 47.4, yatirimsizBakiye: false,
    casinoCevrimSonYatirim: 500, sporCevrimSonYatirim: 0,
    sonKullanilanBonus: { ad: '100 FS Telegram Katıl Bonusu', tutar: 100, tarih: '2026-08-03T10:00:00Z', durum: 'Completed' },
    enCokOynananOyunlar: [{ ad: 'Sweet Bonanza', adet: 12, bahis: 240 }],
  };

  it('temel alanları yazar', () => {
    const mesaj = cekimBaglamMesaji('❌ ÇEKİM REDDEDİLDİ', taban);
    expect(mesaj).toContain('larac · 2503142');
    expect(mesaj).toContain('3.000 TRY');
    expect(mesaj).toContain('Bugünkü talep: 1');
  });

  it('toplam yatırım ve çekimi en üstte, ilk bakışta gösterir', () => {
    const mesaj = cekimBaglamMesaji('x', taban);
    const enUstBlok = mesaj.split('🪪 HESAP')[0];
    expect(enUstBlok).toContain('Toplam yatırım: 20.000 TRY · Toplam çekim: 8.000 TRY');
  });

  it('toplam yatırım/çekim ölçülemiyorsa en üstte de sıfır göstermez', () => {
    const mesaj = cekimBaglamMesaji('x', { ...taban, toplamYatirim: null, toplamCekim: null });
    const enUstBlok = mesaj.split('🪪 HESAP')[0];
    expect(enUstBlok).toContain('Toplam yatırım: — · Toplam çekim: —');
  });

  it('oyuncunun önde olduğunu yazar', () => {
    expect(cekimBaglamMesaji('x', taban, SIMDI)).toContain('oyuncu 🔴 önde');
  });

  it('risk notunu en üste taşır', () => {
    const mesaj = cekimBaglamMesaji('x', { ...taban, notlar: [{ noteType: 'High Risk', text: 'şüpheli' }] });
    expect(mesaj).toContain('Profilde RİSK notu var');
  });

  it('otomatik ret gerekçesini yazar', () => {
    const mesaj = cekimBaglamMesaji('x', {
      ...taban, otomatikRed: { reddet: true, neden: 'Aynı gün 3. çekim talebi (eşik 3).', gunlukSayi: 3 },
    });
    expect(mesaj).toContain('Aynı gün 3. çekim talebi');
  });

  it('bonus ölçülemediyse "yok" demez', () => {
    const mesaj = cekimBaglamMesaji('x', { ...taban, bonusOlculdu: false });
    expect(mesaj).toContain('ölçülemedi');
    expect(mesaj).not.toContain('bonus: yok');
  });

  it('son yatırım sonrası bonusları listeler', () => {
    const mesaj = cekimBaglamMesaji('x', {
      ...taban,
      sonYatirimBonuslari: [{ ad: '100 FS Telegram Katıl Bonusu', tutar: 100 }],
    });
    expect(mesaj).toContain('100 FS Telegram Katıl Bonusu');
  });

  it('ölçülemeyen tutarı sıfır göstermez', () => {
    const mesaj = cekimBaglamMesaji('x', {
      ...taban, bakiye: null, toplamYatirim: null, toplamCekim: null, netKarZarar: null,
    });
    expect(mesaj).toContain('Bakiye:   —');
    expect(mesaj).toContain('Kasaya karşı: —');
  });

  it('not yoksa açıkça söyler', () => {
    expect(cekimBaglamMesaji('x', taban)).toContain('Profil notu yok');
  });

  it('kayıt tarihini ve yaşını yazar', () => {
    expect(cekimBaglamMesaji('x', taban, SIMDI)).toContain('33 gün önce');
  });

  it('doğrulama durumlarını ayrı ayrı gösterir', () => {
    const mesaj = cekimBaglamMesaji('x', taban, SIMDI);
    expect(mesaj).toContain('Telefon:  ✅');
    expect(mesaj).toContain('Kimlik: ❌');
  });

  it('doğrulanmamış telefonu uyarıya taşır', () => {
    const mesaj = cekimBaglamMesaji('x', { ...taban, telefonDogrulandi: false }, SIMDI);
    expect(mesaj).toContain('📵 Telefon doğrulanmamış');
  });

  it('doğrulama ölçülemediyse uyarı üretmez', () => {
    // `=== true` ile daraltmak okunamayan alani "dogrulanmamis" gosterirdi.
    const mesaj = cekimBaglamMesaji('x', { ...taban, telefonDogrulandi: null }, SIMDI);
    expect(mesaj).not.toContain('📵');
    expect(mesaj).toContain('bilinmiyor');
  });

  it('yatırımsız bakiyeyi en üste uyarı olarak koyar', () => {
    // Cekim talebinde bakilmasi gereken ilk sey.
    const mesaj = cekimBaglamMesaji('x', { ...taban, yatirimsizBakiye: true }, SIMDI);
    expect(mesaj).toContain('Hiç yatırım yok — bakiye bonustan');
  });

  it('casino ve spor kırılımını ayrı yazar', () => {
    const mesaj = cekimBaglamMesaji('x', taban, SIMDI);
    expect(mesaj).toContain('Casino: 98,8 TRY');
    expect(mesaj).toContain('Spor:   0 TRY');
  });

  it('oyun verisi hiç yoksa o bölümü yazmaz', () => {
    const mesaj = cekimBaglamMesaji('x', {
      ...taban, casinoBahis: null, sporBahis: null, casinoGgr: null, sporGgr: null,
    }, SIMDI);
    expect(mesaj).not.toContain('🎰 OYUN');
  });

  it('hiç yatırım yoksa son yatırımı boş bırakmaz, söyler', () => {
    const mesaj = cekimBaglamMesaji('x', { ...taban, sonYatirimZamani: null }, SIMDI);
    expect(mesaj).toContain('hiç yatırım yok');
  });

  it('ilk çekimi belirtir', () => {
    expect(cekimBaglamMesaji('x', { ...taban, sonCekimZamani: null }, SIMDI)).toContain('ilk çekim');
  });

  it('bonus kaynaklı kazancı yazar', () => {
    expect(cekimBaglamMesaji('x', taban, SIMDI)).toContain('Bonustan kazanç: 47,4 TRY');
  });

  it('son yatırımdan sonraki çevrimi yazar', () => {
    const mesaj = cekimBaglamMesaji('x', taban, SIMDI);
    expect(mesaj).toContain('Son yatırımdan sonra çevrim: 500 TRY (casino 500 TRY · spor 0 TRY)');
  });

  it('çevrim ölçülemediyse o satırı yazmaz', () => {
    const mesaj = cekimBaglamMesaji('x', {
      ...taban, casinoCevrimSonYatirim: null, sporCevrimSonYatirim: null,
    }, SIMDI);
    expect(mesaj).not.toContain('Son yatırımdan sonra çevrim');
  });

  it('en çok oynanan oyunları yazar', () => {
    const mesaj = cekimBaglamMesaji('x', taban, SIMDI);
    expect(mesaj).toContain('Son yatırımdan sonra en çok oynanan: Sweet Bonanza (12)');
  });

  it('en çok oynanan oyun yoksa o satırı yazmaz', () => {
    const mesaj = cekimBaglamMesaji('x', { ...taban, enCokOynananOyunlar: [] }, SIMDI);
    expect(mesaj).not.toContain('en çok oynanan');
  });

  it('son kullanılan bonusu yazar', () => {
    const mesaj = cekimBaglamMesaji('x', taban, SIMDI);
    expect(mesaj).toContain('Son kullanılan bonus: 100 FS Telegram Katıl Bonusu (100 TRY) · Completed');
  });

  it('son kullanılan bonus yoksa açıkça söyler', () => {
    const mesaj = cekimBaglamMesaji('x', { ...taban, sonKullanilanBonus: null }, SIMDI);
    expect(mesaj).toContain('Son kullanılan bonus: —');
  });
});

describe('casinoCevrimToplami / sporCevrimToplami', () => {
  it('yalnız bet tipindeki casino satırlarını toplar', () => {
    expect(casinoCevrimToplami([
      { type: 'bet', amount: -100 },
      { type: 'win', amount: 250 },
      { type: 'Bet', amount: 50 },
    ])).toBe(150);
  });

  it('boş/eksik girişte sıfır döner', () => {
    expect(casinoCevrimToplami(null)).toBe(0);
    expect(sporCevrimToplami(undefined)).toBe(0);
  });

  it('spor satırlarında amount/stake/betAmount alanlarına düşer', () => {
    expect(sporCevrimToplami([
      { amount: 100 },
      { stake: 50 },
      { betAmount: 25 },
    ])).toBe(175);
  });
});

describe('enCokOynananOyunlar', () => {
  it('bahis adedine göre sıralar, ciroya göre değil', () => {
    const sonuc = enCokOynananOyunlar([
      { type: 'bet', gameName: 'Sweet Bonanza', amount: -1000 },
      { type: 'bet', gameName: 'Gates of Olympus', amount: -10 },
      { type: 'bet', gameName: 'Gates of Olympus', amount: -10 },
      { type: 'bet', gameName: 'Gates of Olympus', amount: -10 },
    ]);
    expect(sonuc[0]).toEqual({ ad: 'Gates of Olympus', adet: 3, bahis: 30 });
    expect(sonuc[1]).toEqual({ ad: 'Sweet Bonanza', adet: 1, bahis: 1000 });
  });

  it('yalnız bet tipindeki satırları sayar', () => {
    const sonuc = enCokOynananOyunlar([
      { type: 'bet', gameName: 'X', amount: -10 },
      { type: 'win', gameName: 'X', amount: 20 },
    ]);
    expect(sonuc).toEqual([{ ad: 'X', adet: 1, bahis: 10 }]);
  });

  it('oyun adı yoksa satırı atlar', () => {
    expect(enCokOynananOyunlar([{ type: 'bet', amount: -10 }])).toEqual([]);
  });

  it('azami sayıyı kırpar', () => {
    const rows = ['A', 'B', 'C', 'D'].map((ad) => ({ type: 'bet', gameName: ad, amount: -10 }));
    expect(enCokOynananOyunlar(rows, 2)).toHaveLength(2);
  });

  it('boş/eksik girişte boş liste döner', () => {
    expect(enCokOynananOyunlar(null)).toEqual([]);
    expect(enCokOynananOyunlar(undefined)).toEqual([]);
  });

  it('game.name alanına düşer', () => {
    expect(enCokOynananOyunlar([{ type: 'bet', game: { name: 'Book of Dead' }, amount: -10 }]))
      .toEqual([{ ad: 'Book of Dead', adet: 1, bahis: 10 }]);
  });
});

describe('sonKullanilanBonusSec', () => {
  it('en son tarihli bonusu seçer', () => {
    const sonuc = sonKullanilanBonusSec([
      { Name: 'Eski', CreatedLocal: '2026-08-01T10:00:00Z', Amount: 50 },
      { Name: 'Yeni', CreatedLocal: '2026-08-03T10:00:00Z', Amount: 100, ResultType: 'Claimed' },
    ]);
    expect(sonuc).toEqual({ ad: 'Yeni', tutar: 100, tarih: '2026-08-03T10:00:00Z', durum: 'Claimed' });
  });

  it('liste boşsa null döner', () => {
    expect(sonKullanilanBonusSec([])).toBeNull();
    expect(sonKullanilanBonusSec(null)).toBeNull();
  });

  it('geçersiz tarihli satırları yok sayar', () => {
    const sonuc = sonKullanilanBonusSec([{ Name: 'Bozuk', CreatedLocal: 'gecersiz' }]);
    expect(sonuc).toBeNull();
  });
});

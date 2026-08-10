import { describe, expect, it } from 'vitest';
import {
  AZAMI_GORULEN,
  bildirilecekYatirimMi,
  bonusMesaji,
  bosImlec,
  cekimMesaji,
  cekimOlayKimligi,
  correctionMesaji,
  gunlukYapanOzeti,
  gunlukYatirimOzeti,
  islemDurumu,
  kasaMesaji,
  manuelDuzeltmeMesaji,
  oyuncuYaz,
  ozetZamaniMi,
  paraYaz,
  saatYaz,
  yatirimMesaji,
  yeniOlaylar,
  type AkisImleci,
  type KasaOzeti,
} from './telegramRaporu.js';

const kimlik = (satir: { id: string }) => satir.id;

describe('yeniOlaylar', () => {
  it('ilk turda hiçbir şey bildirmez ama durumu öğrenir', () => {
    // Bot ilk açıldığında geçmişteki yüzlerce kaydı atmamalı.
    const sonuc = yeniOlaylar([{ id: 'a' }, { id: 'b' }], undefined, kimlik);
    expect(sonuc.yeniler).toEqual([]);
    expect(sonuc.imlec.baslatildi).toBe(true);
    expect(sonuc.imlec.gorulen).toEqual(['a', 'b']);
  });

  it('ikinci turda yalnızca yeni kaydı verir', () => {
    const imlec: AkisImleci = { baslatildi: true, gorulen: ['a', 'b'] };
    const sonuc = yeniOlaylar([{ id: 'c' }, { id: 'a' }, { id: 'b' }], imlec, kimlik);
    expect(sonuc.yeniler).toEqual([{ id: 'c' }]);
  });

  it('aynı kaydı ikinci kez bildirmez', () => {
    let imlec: AkisImleci = { baslatildi: true, gorulen: ['a'] };
    const ilk = yeniOlaylar([{ id: 'b' }, { id: 'a' }], imlec, kimlik);
    expect(ilk.yeniler).toEqual([{ id: 'b' }]);
    imlec = ilk.imlec;
    const ikinci = yeniOlaylar([{ id: 'b' }, { id: 'a' }], imlec, kimlik);
    expect(ikinci.yeniler).toEqual([]);
  });

  it('gerçekten boş bir akışta ilk kaydı bildirir', () => {
    // "görülen listesi boş" ile "hiç çalışmadı" ayrı şeyler.
    const baslamis: AkisImleci = { baslatildi: true, gorulen: [] };
    expect(yeniOlaylar([{ id: 'ilk' }], baslamis, kimlik).yeniler).toEqual([{ id: 'ilk' }]);
  });

  it('kimliksiz satırı atlar', () => {
    const imlec: AkisImleci = { baslatildi: true, gorulen: [] };
    const sonuc = yeniOlaylar([{ id: '' }, { id: 'x' }], imlec, kimlik);
    expect(sonuc.yeniler).toEqual([{ id: 'x' }]);
    expect(sonuc.imlec.gorulen).toEqual(['x']);
  });

  it('kesintiden sonra taşanı ayrı sayar', () => {
    const imlec: AkisImleci = { baslatildi: true, gorulen: [] };
    const satirlar = Array.from({ length: 30 }, (_, i) => ({ id: `k${i}` }));
    const sonuc = yeniOlaylar(satirlar, imlec, kimlik, 12);
    expect(sonuc.yeniler).toHaveLength(12);
    expect(sonuc.tasan).toBe(18);
    // Taşanlar da görülmüş sayılır; bir sonraki turda tekrar akmasın.
    expect(sonuc.imlec.gorulen).toHaveLength(30);
  });

  it('görülen listesi sınırsız büyümez', () => {
    const imlec: AkisImleci = {
      baslatildi: true,
      gorulen: Array.from({ length: AZAMI_GORULEN }, (_, i) => `eski${i}`),
    };
    const sonuc = yeniOlaylar([{ id: 'yeni' }], imlec, kimlik);
    expect(sonuc.imlec.gorulen).toHaveLength(AZAMI_GORULEN);
    expect(sonuc.imlec.gorulen[0]).toBe('yeni');
  });

  it('boş girdi çökmez', () => {
    expect(yeniOlaylar(null, undefined, kimlik).yeniler).toEqual([]);
  });
});

describe('biçimleme', () => {
  it('para birimi ile yazar', () => {
    expect(paraYaz(1500)).toBe('1.500 TRY');
    expect(paraYaz('yok')).toBe('—');
    expect(paraYaz(null)).toBe('—');
  });

  it('saati Türkiye dilimiyle yazar', () => {
    // 02:00 UTC = 05:00 Istanbul.
    expect(saatYaz('2026-08-03T02:00:16.248848Z')).toBe('03.08.2026 05:00');
    expect(saatYaz('bozuk')).toBe('—');
  });

  it('kullanıcı adı yoksa kimliği ada terfi ettirmez', () => {
    expect(oyuncuYaz('zlfkr79', 2501238)).toBe('zlfkr79 (2501238)');
    expect(oyuncuYaz('', 2501238)).toBe('2501238');
    expect(oyuncuYaz('', '')).toBe('bilinmeyen oyuncu');
  });

  it('yatırım mesajı temel alanları içerir', () => {
    const mesaj = yatirimMesaji({
      ClientLogin: 'zlfkr79', ClientId: 2501238, Amount: 1500,
      PaymentSystemName: 'Papara', CreatedLocal: '2026-08-03T02:00:00Z',
    });
    expect(mesaj).toContain('YATIRIM');
    expect(mesaj).toContain('zlfkr79 (2501238)');
    expect(mesaj).toContain('1.500 TRY');
    expect(mesaj).toContain('Papara');
  });

  it('çekim mesajı yatırımdan ayırt edilebilir', () => {
    expect(cekimMesaji({ ClientId: 1, Amount: 3400, status: 'pending' })).toContain('ÇEKİM TALEBİ');
  });

  it('yatırım mesajı yöntem ve entegrasyonu birlikte yazar', () => {
    // Uc `method` ("Havale") ve `integration` ("HemenOde") olarak ayri doner.
    const mesaj = yatirimMesaji({ ClientId: 1, Amount: 1000, method: 'Havale', integration: 'HemenOde' });
    expect(mesaj).toContain('Havale · HemenOde');
  });

  it('yatırım mesajı işlem sonrası bakiyeyi yazar', () => {
    const mesaj = yatirimMesaji({ ClientId: 1, Amount: 1000, Balance: 4200 });
    expect(mesaj).toContain('İşlem sonrası bakiye: 4.200 TRY');
  });

  it('yatırım mesajı bakiye bilinmiyorsa o satırı atlar', () => {
    expect(yatirimMesaji({ ClientId: 1, Amount: 1000 })).not.toContain('İşlem sonrası bakiye');
  });

  it('correction yönünü yazar', () => {
    expect(correctionMesaji({ ClientId: 1, Amount: 500, CorrectionType: 'debiting' })).toContain('ÇIKIŞ');
    expect(correctionMesaji({ ClientId: 1, Amount: 500, CorrectionType: 'crediting' })).toContain('GİRİŞ');
  });

  it('bonus mesajı atama notundan kaynak/talebi geri okuyup yazar', () => {
    const mesaj = bonusMesaji({
      ClientId: 2501238, Name: '100 FS Telegram Katıl Bonusu',
      Description: 'Narcosbahis oyun ödülü: 100 FS | Kaynak: telegram | Talep: zlfkr79',
    });
    expect(mesaj).toContain('100 FS Telegram Katıl Bonusu');
    expect(mesaj).toContain('Kaynak / Talep:</b> telegram / zlfkr79');
  });

  it('bonus mesajı kural kodunu notundan geri okur', () => {
    const mesaj = bonusMesaji({
      ClientId: 2527735, ClientLogin: 'ronican', Name: '100 FS Telegram Katıl Bonusu',
      TotalPaidAmount: 100, ClientCurrency: 'TRY', Durum: 'Onaylandı',
      Description: 'Narcosbahis oyun ödülü: 100 FS | Kaynak: panel | Kural: 1885 | Talep: System',
      CreatedLocal: '2026-08-10T06:22:00Z',
    });
    expect(mesaj).toContain('Oyuncu:</b> <code>ronican</code> (ID: <code>2527735</code>)');
    expect(mesaj).toContain('Bonus:</b> 100 FS Telegram Katıl Bonusu');
    expect(mesaj).toContain('Değer:</b> 100 TRY');
    expect(mesaj).toContain('Marka:</b> Narcosbahis');
    expect(mesaj).toContain('Kural Kodu:</b> <code>1885</code>');
    expect(mesaj).toContain('Kaynak / Talep:</b> panel / System');
    expect(mesaj).toContain('Durum:</b> ✅ Onaylandı');
  });

  it('kural kodu yoksa o satır hiç yazılmaz', () => {
    expect(bonusMesaji({ ClientId: 1, Name: 'X', Description: 'Kaynak: panel' })).not.toContain('Kural Kodu');
  });

  it('segment verilmezse o satır hiç yazılmaz -- uydurulmaz', () => {
    expect(bonusMesaji({ ClientId: 1, Name: 'X' })).not.toContain('Segment');
  });

  it('segment verilirse yazılır', () => {
    expect(bonusMesaji({ ClientId: 1, Name: 'X', Segment: 'Yeni Oyuncu' })).toContain('Segment:</b> Yeni Oyuncu');
  });

  it('atama notu yoksa sistem detayları bölümü yalnızca markayı gösterir', () => {
    const mesaj = bonusMesaji({ ClientId: 1, Name: 'X' });
    expect(mesaj).toContain('Marka:</b> Narcosbahis');
    expect(mesaj).not.toContain('Kaynak / Talep');
    expect(mesaj).not.toContain('Durum');
  });

  it('red durumunu ❌ ile işaretler', () => {
    expect(bonusMesaji({ ClientId: 1, Name: 'X', Durum: 'Reddedildi' })).toContain('❌ Reddedildi');
  });
});

/** Kullanicinin yapistirdigi gercek yatirim satiri. */
const GERCEK_YATIRIM = {
  id: 966358,
  transactionType: 'deposit',
  amount: 1000,
  currency: 'TRY',
  userId: '2502686',
  status: 'success',
  method: 'Havale',
  integration: 'HemenOde',
  ClientId: 2502686,
  ClientLogin: 'demircin20',
  Amount: 1000,
};

describe('gunlukYatirimOzeti', () => {
  const gunun = [
    { Id: 1, ClientId: 500, Amount: 100, CreatedLocal: '2026-08-03T08:00:00Z' },
    { Id: 2, ClientId: 500, Amount: 300, CreatedLocal: '2026-08-03T12:00:00Z' },
    { Id: 3, ClientId: 999, Amount: 1000, CreatedLocal: '2026-08-03T09:00:00Z' },
  ];

  it('oyuncunun kaçıncı yatırımı olduğunu ve toplamı bulur', () => {
    expect(gunlukYatirimOzeti(gunun, gunun[1])).toEqual({ sira: 2, toplam: 400 });
  });

  it('günün ilk yatırımı için sıra 1 verir', () => {
    expect(gunlukYatirimOzeti(gunun, gunun[0])).toEqual({ sira: 1, toplam: 100 });
  });

  it('başka oyuncunun yatırımlarını karıştırmaz', () => {
    expect(gunlukYatirimOzeti(gunun, gunun[2])).toEqual({ sira: 1, toplam: 1000 });
  });

  it('satır listede yoksa null döner', () => {
    expect(gunlukYatirimOzeti(gunun, { Id: 999, ClientId: 500 })).toBeNull();
  });

  it('kimliksiz girdide null döner', () => {
    expect(gunlukYatirimOzeti(gunun, { Id: 1 })).toBeNull();
  });

  it('yatırım mesajına günlük sırayı ekler', () => {
    const mesaj = yatirimMesaji({ ...gunun[1], ClientLogin: 'x' }, gunun);
    expect(mesaj).toContain('Bugünkü 2. yatırımı · günlük toplam 400 TRY');
  });

  it('gununYatirimlari verilmezse günlük sıra satırı eklenmez', () => {
    expect(yatirimMesaji(gunun[1])).not.toContain('Bugünkü');
  });
});

describe('işlem durumu', () => {
  it('gerçek yatırım yanıtını başarılı sayar', () => {
    expect(islemDurumu(GERCEK_YATIRIM)).toBe('onay');
    expect(bildirilecekYatirimMi(GERCEK_YATIRIM)).toBe(true);
  });

  it('bekleyen yatırım bildirilmez', () => {
    // Kasaya girmemis parayi girmis gostermek, operatore yanlis bonus verdirir.
    expect(bildirilecekYatirimMi({ ...GERCEK_YATIRIM, status: 'pending' })).toBe(false);
  });

  it('reddedilen yatırım bildirilmez', () => {
    expect(bildirilecekYatirimMi({ ...GERCEK_YATIRIM, status: 'rejected' })).toBe(false);
  });

  it('durumu okunamayan yatırım bildirilmez', () => {
    expect(bildirilecekYatirimMi({ ...GERCEK_YATIRIM, status: '' })).toBe(false);
  });

  it('alan adı farklı gelse de durumu bulur', () => {
    expect(islemDurumu({ DocumentState: 'Approved' })).toBe('onay');
    expect(islemDurumu({ state: 'CANCELLED' })).toBe('red');
    expect(islemDurumu({ Status: 'in progress' })).toBe('bekliyor');
  });

  it('tanınmayan durum sessizce elenmez', () => {
    expect(islemDurumu({ status: 'gozden_geciriliyor' })).toBe('bilinmiyor');
    expect(cekimMesaji({ ClientId: 1, Amount: 100, status: 'gozden_geciriliyor' }))
      .toContain('gozden_geciriliyor');
  });
});

describe('çekim onay / red ayrımı', () => {
  it('onaylanan ve reddedilen çekim farklı başlık alır', () => {
    expect(cekimMesaji({ ClientId: 1, Amount: 3400, status: 'success' })).toContain('ÇEKİM ONAYLANDI');
    expect(cekimMesaji({ ClientId: 1, Amount: 3400, status: 'rejected' })).toContain('ÇEKİM REDDEDİLDİ');
  });

  it('aynı çekimin durum değişimi AYRI olaydır', () => {
    // Yalnizca kimlik kullanilsaydi talep bildirilir, onayi hic bildirilmezdi.
    const bekleyen = cekimOlayKimligi({ Id: 500, status: 'pending' });
    const onayli = cekimOlayKimligi({ Id: 500, status: 'success' });
    expect(bekleyen).not.toBe(onayli);
    expect(onayli).toBe('500:onay');
  });

  it('kimliksiz satır olay üretmez', () => {
    expect(cekimOlayKimligi({ status: 'success' })).toBe('');
  });

  it('durum değişimi imleçte yeni olay sayılır', () => {
    const imlec: AkisImleci = { baslatildi: true, gorulen: ['500:bekliyor'] };
    const sonuc = yeniOlaylar([{ Id: 500, status: 'success' }], imlec, cekimOlayKimligi);
    expect(sonuc.yeniler).toHaveLength(1);
  });
});

describe('manuel düzeltme mesajı', () => {
  /** `manuelDuzeltmeRaporu.duzeltmeSatiri` ciktisiyla ayni sekil. */
  const SATIR = {
    Id: 74803, ClientId: 2502959, ClientLogin: 'sarp61',
    Hesap: 'PlayerUnusedBalance', Yon: 'giris', Tutar: 1000, ParaBirimi: 'TRY',
    Yapan: 'destek@narcosbahis.com', Not: 'info sarp', NotAnlamli: true,
    CreatedLocal: '2026-08-03T15:35:05.448579Z',
  };

  it('yönü başlıkta ayırır', () => {
    expect(manuelDuzeltmeMesaji(SATIR)).toContain('MANUEL BAKİYE EKLEME');
    expect(manuelDuzeltmeMesaji({ ...SATIR, Yon: 'cikis' })).toContain('MANUEL BAKİYE ÇIKARMA');
  });

  it('yapan yöneticiyi her zaman yazar', () => {
    // Bu alan panelin kendi denetim kaydinda yok; mesajin varlik sebebi.
    expect(manuelDuzeltmeMesaji(SATIR)).toContain('destek@narcosbahis.com');
  });

  it('hesap türünü yazar', () => {
    expect(manuelDuzeltmeMesaji(SATIR)).toContain('PlayerUnusedBalance');
  });

  it('gerekçesiz hareketi işaretler', () => {
    const mesaj = manuelDuzeltmeMesaji({ ...SATIR, Not: '', NotAnlamli: false });
    expect(mesaj).toContain('Gerekçe notu yok');
  });

  it('yönü bilinmeyen hareket için nötr başlık', () => {
    expect(manuelDuzeltmeMesaji({ ...SATIR, Yon: 'bilinmiyor' })).toContain('MANUEL DÜZELTME');
  });

  it('gununDuzeltmeleri verilmezse yönetici özeti eklenmez', () => {
    expect(manuelDuzeltmeMesaji(SATIR)).not.toContain('bugün');
  });

  it('aynı yöneticinin gün içindeki sırasını ve net toplamını yazar', () => {
    const gunun = [
      { Id: 1, Yapan: 'destek@narcosbahis.com', Yon: 'giris', NetTutar: 1000, CreatedLocal: '2026-08-03T10:00:00Z' },
      { ...SATIR, NetTutar: 1000 }, // Id 74803, ayni gunun ikinci hareketi
    ];
    const mesaj = manuelDuzeltmeMesaji(SATIR, gunun);
    expect(mesaj).toContain('bugün 2. işlemi (net 2.000 TRY)');
  });
});

describe('gunlukYapanOzeti', () => {
  const gunun = [
    { Id: 1, Yapan: 'a@x.com', Yon: 'giris', NetTutar: 500, CreatedLocal: '2026-08-03T08:00:00Z' },
    { Id: 2, Yapan: 'a@x.com', Yon: 'cikis', NetTutar: -200, CreatedLocal: '2026-08-03T09:00:00Z' },
    { Id: 3, Yapan: 'b@x.com', Yon: 'giris', NetTutar: 900, CreatedLocal: '2026-08-03T09:30:00Z' },
  ];

  it('yöneticinin sırasını ve net toplamını hesaplar', () => {
    expect(gunlukYapanOzeti(gunun, gunun[1])).toEqual({ sira: 2, netToplam: 300 });
  });

  it('başka yöneticinin hareketlerini karıştırmaz', () => {
    expect(gunlukYapanOzeti(gunun, gunun[2])).toEqual({ sira: 1, netToplam: 900 });
  });

  it('yapan alanı boşsa null döner', () => {
    expect(gunlukYapanOzeti(gunun, { Id: 1, Yapan: '' })).toBeNull();
  });

  it('satır listede yoksa null döner', () => {
    expect(gunlukYapanOzeti(gunun, { Id: 999, Yapan: 'a@x.com' })).toBeNull();
  });
});

describe('kasa özeti', () => {
  /** Hicbir olcusu bilinmeyen taban; testler yalnizca ilgilendigini doldurur. */
  const BOS_OZET: KasaOzeti = {
    gun: '2026-08-03', saat: null,
    yatirim: null, cekim: null, ggr: null, kar: null, yeniKayit: null,
    yatirimOyuncu: null, cekimOyuncu: null, oyuncuBakiyesi: null,
    ilkYatirim: null, yatirimAdedi: null, bahisAdedi: null, bahisOyuncu: null,
    gercekBahis: null, gercekKazanc: null, bonusBakiye: null,
    freespinKazanc: null, bonusOdeme: null, cashback: null,
  };

  it('bildirilen günü GG.AA.YYYY biçiminde yazar', () => {
    expect(kasaMesaji(BOS_OZET)).toContain('03.08.2026');
  });

  it('temel para alanlarını ₺ biçiminde yazar', () => {
    const mesaj = kasaMesaji({
      ...BOS_OZET,
      yatirim: 11_000, cekim: 3_400, ggr: -24_737.14,
      kar: -58_973.17, yeniKayit: 19, yatirimOyuncu: 2, cekimOyuncu: 1,
      oyuncuBakiyesi: 66_573.17,
    });
    expect(mesaj).toContain('₺11,000.00');
    expect(mesaj).toContain('₺3,400.00');
    expect(mesaj).toContain('+₺7,600.00'); // net, isaretli
  });

  it('ölçülemeyen alanı sıfır göstermez', () => {
    const mesaj = kasaMesaji(BOS_OZET);
    expect(mesaj).not.toContain('₺0.00');
    expect(mesaj).toContain('—');
  });

  it('genişletilmiş ölçüleri yazar', () => {
    const mesaj = kasaMesaji({
      ...BOS_OZET,
      gercekBahis: 95_173.9, gercekKazanc: 119_505.74, bahisAdedi: 3475,
      bahisOyuncu: 15, ilkYatirim: 3, freespinKazanc: 828.9,
    });
    expect(mesaj).toContain('₺95,173.90');
    expect(mesaj).toContain('3,475 Bahis');
    expect(mesaj).toContain('₺828.90');
  });

  it('bonus maliyetini kalemlerden toplar', () => {
    const mesaj = kasaMesaji({ ...BOS_OZET, freespinKazanc: 800, bonusOdeme: 200, cashback: 100 });
    expect(mesaj).toContain('Toplam Bonus:</b> ₺1,100.00');
  });

  it('bonus kalemlerinin hiçbiri bilinmiyorsa maliyet uydurulmaz', () => {
    // Bilinmeyeni sifir sayip "0 TRY maliyet" yazmak, bonus giderini yok gosterir.
    expect(kasaMesaji(BOS_OZET)).toContain('Toplam Bonus:</b> —');
  });

  it('cashback ve ödemeyi tek satırda toplar', () => {
    const mesaj = kasaMesaji({ ...BOS_OZET, bonusOdeme: 200, cashback: 100 });
    expect(mesaj).toContain('Cashback / Ödeme: ₺300.00');
  });

  it('saat verildiyse tarih satırına eklenir — 20 dakikalık mesajlar karışmasın', () => {
    expect(kasaMesaji({ ...BOS_OZET, saat: '14:20' })).toContain('03.08.2026 — 14:20');
  });

  it('elde tutma oranını yazar', () => {
    const mesaj = kasaMesaji({ ...BOS_OZET, kar: 1000, gercekBahis: 4000 });
    expect(mesaj).toContain('%25.0');
  });

  it('elde tutma negatifse uyarı işareti ekler', () => {
    const mesaj = kasaMesaji({ ...BOS_OZET, kar: -1000, gercekBahis: 4000 });
    expect(mesaj).toContain('%-25.0 ⚠️');
  });

  it('elde tutma ölçülemiyorsa uydurulmaz', () => {
    const mesaj = kasaMesaji(BOS_OZET);
    expect(mesaj).toContain('Elde Tutma (Hold):</b> —');
    expect(mesaj).not.toContain('⚠️');
  });

  it('önceki özete göre kâr/zarar için yüzde artış okunu yazar', () => {
    const mesaj = kasaMesaji({ ...BOS_OZET, kar: 1_500 }, { ...BOS_OZET, kar: 1_000 });
    expect(mesaj).toContain('▲%50.0');
  });

  it('önceki özete göre kâr/zarar için yüzde azalış okunu yazar', () => {
    const mesaj = kasaMesaji({ ...BOS_OZET, kar: -32_228.75 }, { ...BOS_OZET, kar: -20_360 });
    expect(mesaj).toContain('▼%58.3');
  });

  it('önceki özet verilmezse trend oku eklenmez', () => {
    const mesaj = kasaMesaji({ ...BOS_OZET, kar: 1_500 });
    expect(mesaj).not.toContain('▲%');
    expect(mesaj).not.toContain('▼%');
  });

  it('en çok oynanan oyunları madde madde yazar', () => {
    const mesaj = kasaMesaji({
      ...BOS_OZET,
      enCokOynananOyunlar: [{ ad: 'Sweet Bonanza', ciro: 12_500 }, { ad: 'Gates of Olympus', ciro: 8_000 }],
    });
    expect(mesaj).toContain('• Sweet Bonanza — ₺12,500.00');
    expect(mesaj).toContain('• Gates of Olympus — ₺8,000.00');
  });

  it('en çok oynanan oyun verilmezse bölüm hiç yazılmaz', () => {
    expect(kasaMesaji(BOS_OZET)).not.toContain('En Çok Oynanan');
  });

  it('en çok oynanan oyun verilmezse o satırı yazmaz', () => {
    expect(kasaMesaji(BOS_OZET)).not.toContain('En çok oynanan');
  });

  it('kâr pozitifse olumlu kapanış notu ekler', () => {
    expect(kasaMesaji({ ...BOS_OZET, kar: 1000 })).toContain('kasa lehine gidiyor');
  });

  it('kâr negatifse uyarı tonlu kapanış notu ekler', () => {
    expect(kasaMesaji({ ...BOS_OZET, kar: -1000 })).toContain('oyuncular önde');
  });

  it('kâr ölçülemiyorsa kapanış notu uydurulmaz', () => {
    expect(kasaMesaji(BOS_OZET)).not.toContain('kasa lehine');
    expect(kasaMesaji(BOS_OZET)).not.toContain('oyuncular önde');
  });
});

describe('ozetZamaniMi', () => {
  const simdi = Date.parse('2026-08-03T06:00:00Z');

  it('hiç gönderilmediyse gönderir', () => {
    expect(ozetZamaniMi(null, 3_600_000, simdi)).toBe(true);
  });

  it('süre dolmadıysa göndermez', () => {
    expect(ozetZamaniMi('2026-08-03T05:30:00Z', 3_600_000, simdi)).toBe(false);
  });

  it('süre dolduysa gönderir', () => {
    expect(ozetZamaniMi('2026-08-03T04:30:00Z', 3_600_000, simdi)).toBe(true);
  });

  it('aralık 0 ise özet kapalıdır', () => {
    expect(ozetZamaniMi(null, 0, simdi)).toBe(false);
  });

  it('bozuk zaman damgası bloklamaz', () => {
    expect(ozetZamaniMi('bozuk', 3_600_000, simdi)).toBe(true);
  });
});

describe('bosImlec', () => {
  it('temiz durumla başlar', () => {
    expect(bosImlec()).toEqual({ akislar: {}, sonOzet: null, sonKasaOzeti: null });
  });
});

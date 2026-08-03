import { describe, expect, it } from 'vitest';
import {
  AZAMI_GORULEN,
  bonusMesaji,
  bosImlec,
  cekimMesaji,
  correctionMesaji,
  kasaMesaji,
  oyuncuYaz,
  ozetZamaniMi,
  paraYaz,
  saatYaz,
  yatirimMesaji,
  yeniOlaylar,
  type AkisImleci,
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
    expect(cekimMesaji({ ClientId: 1, Amount: 3400 })).toContain('ÇEKİM TALEBİ');
  });

  it('correction yönünü yazar', () => {
    expect(correctionMesaji({ ClientId: 1, Amount: 500, CorrectionType: 'debiting' })).toContain('ÇIKIŞ');
    expect(correctionMesaji({ ClientId: 1, Amount: 500, CorrectionType: 'crediting' })).toContain('GİRİŞ');
  });

  it('bonus mesajı atama notunu taşır', () => {
    const mesaj = bonusMesaji({
      ClientId: 2501238, Name: '100 FS Telegram Katıl Bonusu',
      Description: 'Kaynak: telegram | Talep: zlfkr79',
    });
    expect(mesaj).toContain('100 FS Telegram Katıl Bonusu');
    expect(mesaj).toContain('Kaynak: telegram');
  });
});

describe('kasa özeti', () => {
  it('bildirilen günü doğru yazar', () => {
    const mesaj = kasaMesaji({
      gun: '2026-08-03', yatirim: 11_000, cekim: 3_400, ggr: -24_737.14,
      kar: -58_973.17, yeniKayit: 19, yatirimOyuncu: 2, cekimOyuncu: 1,
      oyuncuBakiyesi: 66_573.17,
    });
    expect(mesaj).toContain('11.000 TRY');
    expect(mesaj).toContain('3.400 TRY');
    expect(mesaj).toContain('7.600 TRY'); // net
  });

  it('ölçülemeyen alanı sıfır göstermez', () => {
    const mesaj = kasaMesaji({
      gun: '2026-08-03', yatirim: null, cekim: null, ggr: null,
      kar: null, yeniKayit: null, yatirimOyuncu: null, cekimOyuncu: null,
      oyuncuBakiyesi: null,
    });
    expect(mesaj).not.toContain('0 TRY');
    expect(mesaj).toContain('—');
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
    expect(bosImlec()).toEqual({ akislar: {}, sonOzet: null });
  });
});

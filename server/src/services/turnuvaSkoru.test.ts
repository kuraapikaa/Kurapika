import { describe, expect, it } from 'vitest';
import {
  VARSAYILAN_KURALLAR,
  kurallariCozumle,
  loginMaskele,
  oyuncuSkoru,
  turnuvaSiralamasi,
  type OyuncuOlcumu,
} from './turnuvaSkoru.js';

/**
 * Turnuva skorlamasi.
 *
 * Bu sayilar odul dagitimini belirliyor; her kural ayri ayri kilitleniyor.
 */

const olcum = (patch: Partial<OyuncuOlcumu> = {}): OyuncuOlcumu => ({
  login: 'oyuncu',
  playerId: '1',
  adSoyad: 'Test Oyuncu',
  bahisTutari: 10_000,
  kazancTutari: 8_000,
  bahisAdedi: 100,
  ggr: 2_000,
  ...patch,
});

const kural = (patch: Partial<typeof VARSAYILAN_KURALLAR> = {}) => ({ ...VARSAYILAN_KURALLAR, ...patch });

describe('kural çözümleme', () => {
  it('boş girdi varsayılana düşer', () => {
    expect(kurallariCozumle(undefined)).toEqual(VARSAYILAN_KURALLAR);
    expect(kurallariCozumle({})).toEqual(VARSAYILAN_KURALLAR);
  });

  it('geçersiz formül varsayılana düşer', () => {
    expect(kurallariCozumle({ formul: 'uydurma' }).formul).toBe('bahis');
  });

  it('çarpan 0 kabul edilmez — tüm skorlar 0 olurdu', () => {
    expect(kurallariCozumle({ skorCarpani: 0 }).skorCarpani).toBe(0.01);
    expect(kurallariCozumle({ skorCarpani: -5 }).skorCarpani).toBe(0.01);
  });

  it('negatif sınırlar 0’a kırpılır', () => {
    const k = kurallariCozumle({ tekBahisMin: -100, toplamBahisAdediMin: -3 });
    expect(k.tekBahisMin).toBe(0);
    expect(k.toplamBahisAdediMin).toBe(0);
  });

  it('adet sınırları tam sayıya indirilir', () => {
    expect(kurallariCozumle({ toplamBahisAdediMin: 5.9 }).toplamBahisAdediMin).toBe(5);
  });
});

describe('formüller', () => {
  it('bahis: toplam bahis tutarı', () => {
    expect(oyuncuSkoru(olcum(), kural({ formul: 'bahis' }))).toEqual({ skor: 10_000 });
  });

  it('bahisXcarpan: çarpan uygulanır', () => {
    expect(oyuncuSkoru(olcum(), kural({ formul: 'bahisXcarpan', skorCarpani: 2.5 }))).toEqual({ skor: 25_000 });
  });

  it('kazancOrani: kazanç ÷ bahis', () => {
    expect(oyuncuSkoru(olcum(), kural({ formul: 'kazancOrani' }))).toEqual({ skor: 0.8 });
  });

  it('kazancOrani: bahis yoksa 0, bölme hatası yok', () => {
    const sonuc = oyuncuSkoru(olcum({ bahisTutari: 0, bahisAdedi: 0 }), kural({ formul: 'kazancOrani' }));
    expect(sonuc).toEqual({ skor: 0 });
  });

  it('netKayip: GGR kullanılır', () => {
    expect(oyuncuSkoru(olcum(), kural({ formul: 'netKayip' }))).toEqual({ skor: 2_000 });
  });

  it('netKayip: kazanan oyuncu 0’a kırpılır, negatif skor olmaz', () => {
    expect(oyuncuSkoru(olcum({ ggr: -5_000 }), kural({ formul: 'netKayip' }))).toEqual({ skor: 0 });
  });

  it('bahisAdedi: adet skordur', () => {
    expect(oyuncuSkoru(olcum(), kural({ formul: 'bahisAdedi' }))).toEqual({ skor: 100 });
  });
});

describe('tek bahis sınırları', () => {
  it('ortalama bahis alt sınırın altındaysa elenir', () => {
    // 10.000 / 100 = 100 ortalama; sinir 250.
    const sonuc = oyuncuSkoru(olcum(), kural({ tekBahisMin: 250 }));
    expect(sonuc).toHaveProperty('elenmeNedeni');
  });

  it('ortalama bahis alt sınırı karşılıyorsa geçer', () => {
    expect(oyuncuSkoru(olcum(), kural({ tekBahisMin: 100 }))).toEqual({ skor: 10_000 });
  });

  it('üst sınır ortalamayı kırpar — tek devasa bahis listeyi kilitlemesin', () => {
    // Ortalama 100; tavan 40 -> sayilan 40 x 100 adet = 4.000.
    expect(oyuncuSkoru(olcum(), kural({ tekBahisMax: 40 }))).toEqual({ skor: 4_000 });
  });

  it('üst sınır ortalamanın üstündeyse etkisiz', () => {
    expect(oyuncuSkoru(olcum(), kural({ tekBahisMax: 5_000 }))).toEqual({ skor: 10_000 });
  });
});

describe('bahis adedi sınırları', () => {
  it('alt sınırın altındaki oyuncu elenir', () => {
    const sonuc = oyuncuSkoru(olcum({ bahisAdedi: 5 }), kural({ toplamBahisAdediMin: 20 }));
    expect(sonuc).toEqual({ elenmeNedeni: 'En az 20 bahis gerekli' });
  });

  it('üst sınır sayılan adedi kırpar', () => {
    // 100 adet, tavan 50 -> ortalama 100 x 50 = 5.000.
    expect(oyuncuSkoru(olcum(), kural({ toplamBahisAdediMax: 50 }))).toEqual({ skor: 5_000 });
  });

  it('bahisAdedi formülünde üst sınır doğrudan uygulanır', () => {
    expect(oyuncuSkoru(olcum(), kural({ formul: 'bahisAdedi', toplamBahisAdediMax: 30 }))).toEqual({ skor: 30 });
  });

  it('0 = sınırsız', () => {
    expect(oyuncuSkoru(olcum(), kural({ toplamBahisAdediMax: 0, tekBahisMax: 0 }))).toEqual({ skor: 10_000 });
  });
});

describe('sıralama', () => {
  const liste = [
    olcum({ login: 'ali', bahisTutari: 5_000, bahisAdedi: 50 }),
    olcum({ login: 'veli', bahisTutari: 15_000, bahisAdedi: 150 }),
    olcum({ login: 'ayse', bahisTutari: 0, bahisAdedi: 0 }),
    olcum({ login: 'fatma', bahisTutari: 9_000, bahisAdedi: 90 }),
  ];

  it('skora göre büyükten küçüğe', () => {
    expect(turnuvaSiralamasi(liste, VARSAYILAN_KURALLAR).map((s) => s.login)).toEqual(['veli', 'fatma', 'ali']);
  });

  it('skoru 0 olan listeye girmez', () => {
    expect(turnuvaSiralamasi(liste, VARSAYILAN_KURALLAR).some((s) => s.login === 'ayse')).toBe(false);
  });

  it('elenen oyuncu listeye girmez', () => {
    const sonuc = turnuvaSiralamasi(liste, kural({ toplamBahisAdediMin: 100 }));
    expect(sonuc.map((s) => s.login)).toEqual(['veli']);
  });

  it('eşitlikte sıra kararlı — alfabetik', () => {
    const esit = [
      olcum({ login: 'zeynep', bahisTutari: 1_000, bahisAdedi: 10 }),
      olcum({ login: 'ahmet', bahisTutari: 1_000, bahisAdedi: 10 }),
    ];
    expect(turnuvaSiralamasi(esit, VARSAYILAN_KURALLAR).map((s) => s.login)).toEqual(['ahmet', 'zeynep']);
  });

  it('sıra numarası 1’den başlar ve boşluk bırakmaz', () => {
    expect(turnuvaSiralamasi(liste, VARSAYILAN_KURALLAR).map((s) => s.sira)).toEqual([1, 2, 3]);
  });

  it('limit uygulanır', () => {
    expect(turnuvaSiralamasi(liste, VARSAYILAN_KURALLAR, 2)).toHaveLength(2);
  });

  it('boş liste çökmez', () => {
    expect(turnuvaSiralamasi([], VARSAYILAN_KURALLAR)).toEqual([]);
  });
});

describe('kullanıcı adı maskeleme', () => {
  it('ilk harf + yıldız', () => {
    expect(loginMaskele('medellin_kral')).toBe('M***');
    expect(loginMaskele('ayse')).toBe('A***');
  });

  it('Türkçe harf doğru büyütülür', () => {
    expect(loginMaskele('ismail')).toBe('İ***');
  });

  it('boş girdi güvenli', () => {
    expect(loginMaskele('')).toBe('***');
    expect(loginMaskele(undefined as never)).toBe('***');
  });
});

/**
 * REGRESYON: siralama her zaman bos donuyordu.
 *
 * Players Overview raporu bahis ADEDI dondurmuyor; cagiran taraf 0
 * geciyordu. Skor `ortalamaBahis x sayilanAdet` ile hesaplandigi icin
 * 0 x 0 = 0 cikiyor, her oyuncu eleniyor ve lobide "Siralama henuz
 * olusmadi" gorunuyordu.
 */
describe('bahis adedi bilinmiyorken (rapor adet vermiyor)', () => {
  const adetsiz = (patch: Partial<OyuncuOlcumu> = {}) => olcum({ bahisAdedi: 0, ...patch });

  it('tutar doğrudan skor olur — sıfıra çökmez', () => {
    expect(oyuncuSkoru(adetsiz(), kural({ formul: 'bahis' }))).toEqual({ skor: 10_000 });
  });

  it('çarpanlı formül de çalışır', () => {
    expect(oyuncuSkoru(adetsiz(), kural({ formul: 'bahisXcarpan', skorCarpani: 3 }))).toEqual({ skor: 30_000 });
  });

  it('kazanç oranı doğru hesaplanır', () => {
    expect(oyuncuSkoru(adetsiz(), kural({ formul: 'kazancOrani' }))).toEqual({ skor: 0.8 });
  });

  it('net kayıp tam değeri kullanır — orantı 1', () => {
    expect(oyuncuSkoru(adetsiz(), kural({ formul: 'netKayip' }))).toEqual({ skor: 2_000 });
  });

  it('adede dayalı sınırlar UYGULANMAZ — bilinmeyen değere göre eleme olmaz', () => {
    expect(oyuncuSkoru(adetsiz(), kural({ toplamBahisAdediMin: 50 }))).toEqual({ skor: 10_000 });
    expect(oyuncuSkoru(adetsiz(), kural({ toplamBahisAdediMax: 10 }))).toEqual({ skor: 10_000 });
    expect(oyuncuSkoru(adetsiz(), kural({ tekBahisMin: 500 }))).toEqual({ skor: 10_000 });
  });

  it('bahis adedi formülü açıkça elenme nedeni verir', () => {
    expect(oyuncuSkoru(adetsiz(), kural({ formul: 'bahisAdedi' }))).toEqual({
      elenmeNedeni: 'Bahis adedi verisi yok',
    });
  });

  it('sıralama dolu döner — bildirilen hata', () => {
    const liste = [
      adetsiz({ login: 'ali', bahisTutari: 5_000 }),
      adetsiz({ login: 'veli', bahisTutari: 15_000 }),
      adetsiz({ login: 'ayse', bahisTutari: 0 }),
    ];
    expect(turnuvaSiralamasi(liste, VARSAYILAN_KURALLAR).map((s) => s.login)).toEqual(['veli', 'ali']);
  });
});

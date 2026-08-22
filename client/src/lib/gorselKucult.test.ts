import { describe, expect, it } from 'vitest';
import {
  EN_BUYUK_KAYNAK,
  EN_BUYUK_KENAR,
  gorselUygunMu,
  hedefBoyut,
  kbYaz,
  veriUriBoyutu,
} from './gorselKucult';

describe('gorselUygunMu', () => {
  it('bilinen gorsel tiplerini kabul ediyor', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']) {
      expect(gorselUygunMu({ type, size: 1000 }).uygun).toBe(true);
    }
  });

  it('SVG kabul ETMIYOR', () => {
    // SVG script tasiyabiliyor; panele yuklenen bir SVG oyuncu
    // sayfasinda calisirdi.
    expect(gorselUygunMu({ type: 'image/svg+xml', size: 500 }).uygun).toBe(false);
  });

  it('gorsel olmayani reddediyor', () => {
    expect(gorselUygunMu({ type: 'application/pdf', size: 500 }).uygun).toBe(false);
    expect(gorselUygunMu({ type: '', size: 500 }).uygun).toBe(false);
  });

  it('tip buyuk harfle gelse de taniyor', () => {
    expect(gorselUygunMu({ type: 'IMAGE/PNG', size: 10 }).uygun).toBe(true);
  });

  it('cok buyuk kaynagi reddedip sebebini yaziyor', () => {
    const sonuc = gorselUygunMu({ type: 'image/png', size: EN_BUYUK_KAYNAK + 1 });
    expect(sonuc.uygun).toBe(false);
    if (!sonuc.uygun) expect(sonuc.sebep).toMatch(/çok büyük/i);
  });

  it('dosya yoksa reddediyor', () => {
    expect(gorselUygunMu(null).uygun).toBe(false);
    expect(gorselUygunMu(undefined).uygun).toBe(false);
  });
});

describe('hedefBoyut', () => {
  it('en-boy oranini koruyor', () => {
    expect(hedefBoyut(1000, 500, 256)).toEqual({ genislik: 256, yukseklik: 128 });
  });

  it('uzun kenar dikey olsa da calisiyor', () => {
    expect(hedefBoyut(500, 1000, 256)).toEqual({ genislik: 128, yukseklik: 256 });
  });

  it('kucuk gorseli BUYUTMUYOR', () => {
    // Buyutmek dosyayi sisirir ve gorsel bulaniklasir; kazanci yok.
    expect(hedefBoyut(64, 48, 256)).toEqual({ genislik: 64, yukseklik: 48 });
  });

  it('asiri ince gorselde kenar sifira inmiyor', () => {
    expect(hedefBoyut(4000, 3, 256).yukseklik).toBeGreaterThanOrEqual(1);
  });

  it('bozuk girdide makul bir kutu donuyor', () => {
    expect(hedefBoyut(Number.NaN, Number.NaN)).toEqual({ genislik: 1, yukseklik: 1 });
  });

  it('varsayilan sinir EN_BUYUK_KENAR', () => {
    expect(hedefBoyut(1024, 1024).genislik).toBe(EN_BUYUK_KENAR);
  });
});

describe('veriUriBoyutu', () => {
  it('base64 dolgusunu hesaba katiyor', () => {
    // "hello" -> aGVsbG8= : 8 karakter, 1 dolgu -> 5 bayt
    expect(veriUriBoyutu('data:image/webp;base64,aGVsbG8=')).toBe(5);
  });

  it('data URI olmayana sifir diyor', () => {
    expect(veriUriBoyutu('https://ornek/logo.png')).toBe(0);
    expect(veriUriBoyutu('')).toBe(0);
    expect(veriUriBoyutu(null)).toBe(0);
  });
});

describe('kbYaz', () => {
  it('KB ve MB esigini ayiriyor', () => {
    expect(kbYaz(2048)).toBe('2 KB');
    expect(kbYaz(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});

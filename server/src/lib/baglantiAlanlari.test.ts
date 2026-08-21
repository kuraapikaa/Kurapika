import { describe, expect, it } from 'vitest';
import { boolCozumle } from './baglantiAlanlari.js';

/**
 * REGRESYON: "Cihaza güven" seçimi sessizce kaydedilmiyordu.
 *
 * `trustDevice` canlıda gerçekten sorun çıkardı — kapalıyken Lynon
 * "User isn't authorized" dönüyor ve sebebi hiçbir yerde yazmıyordu.
 * Panelden açılabilir olması, açıldığının GERÇEKTEN kaydedilmesine bağlı.
 */
describe('boolCozumle', () => {
  it('gerçek boolean değerleri geçirir', () => {
    expect(boolCozumle(true)).toEqual({ degisti: true, deger: true });
    expect(boolCozumle(false)).toEqual({ degisti: true, deger: false });
  });

  it('<select> metinlerini çözer (asıl hata buydu)', () => {
    expect(boolCozumle('true')).toEqual({ degisti: true, deger: true });
    expect(boolCozumle('false')).toEqual({ degisti: true, deger: false });
  });

  it('büyük harf ve boşluğa dayanıklı', () => {
    expect(boolCozumle('  TRUE ')).toEqual({ degisti: true, deger: true });
    expect(boolCozumle('False')).toEqual({ degisti: true, deger: false });
  });

  it('boş değer "değiştirme" demek', () => {
    // "ENV değeri" seçeneği boş string gönderiyor.
    expect(boolCozumle('')).toEqual({ degisti: false });
    expect(boolCozumle('   ')).toEqual({ degisti: false });
    expect(boolCozumle(undefined)).toEqual({ degisti: false });
    expect(boolCozumle(null)).toEqual({ degisti: false });
  });

  it('anlamsız metin sessizce YOK SAYILIR, true sayılmaz', () => {
    // 'evet' veya '1' gibi degerleri true saymak, yazim hatasini
    // guvenlik ayari acmaya cevirirdi.
    expect(boolCozumle('evet')).toEqual({ degisti: false });
    expect(boolCozumle('1')).toEqual({ degisti: false });
    expect(boolCozumle('on')).toEqual({ degisti: false });
    expect(boolCozumle(1)).toEqual({ degisti: false });
  });
});

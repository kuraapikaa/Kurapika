import { describe, expect, it } from 'vitest';
import {
  altDegerTemizle,
  altParametreleriTemizle,
  izlemeBaglamiCoz,
  izlemeLinki,
  makrolariUygula,
  sablondakiMakrolar,
} from './izleme.js';

describe('alt parametre temizligi', () => {
  it('kontrol karakterlerini atar', () => {
    // Kaynak dosyaya gorunmez bayt yazmamak icin kod noktasindan uretiliyor.
    const kirli = `kanal${String.fromCharCode(10)}bir${String.fromCharCode(0)}`;
    expect(altDegerTemizle(kirli)).toBe('kanalbir');
  });

  it('100 karakterde keser', () => {
    expect(altDegerTemizle('x'.repeat(500))).toHaveLength(100);
  });

  it('yalnizca sub1..sub5 alir', () => {
    const temiz = altParametreleriTemizle({ sub1: 'a', sub6: 'b', baska: 'c' });
    expect(temiz).toEqual({ sub1: 'a' });
  });
});

describe('izleme linki', () => {
  it('anahtari ve medyayi ekler', () => {
    const url = new URL(izlemeLinki('https://site.example/kayit', { ortakAnahtari: 'ORT1', medyaId: 'm9' }));
    expect(url.searchParams.get('btag')).toBe('ORT1');
    expect(url.searchParams.get('mid')).toBe('m9');
  });

  /**
   * Elle birlestirme yapilsaydi, icinde `&` gecen tek bir alt parametre
   * sonraki tum alanlari ezerdi.
   */
  it('ozel karakterli degeri kodlar, sonraki alanlari ezmez', () => {
    const url = new URL(izlemeLinki('https://site.example/', {
      ortakAnahtari: 'ORT1',
      alt: { sub1: 'a&sub2=hile', sub2: 'gercek' },
    }));
    expect(url.searchParams.get('sub1')).toBe('a&sub2=hile');
    expect(url.searchParams.get('sub2')).toBe('gercek');
  });

  it('mevcut sorgu parametrelerini korur', () => {
    const url = new URL(izlemeLinki('https://site.example/?kampanya=yaz', { ortakAnahtari: 'ORT1' }));
    expect(url.searchParams.get('kampanya')).toBe('yaz');
  });

  it('anahtar bossa reddeder', () => {
    expect(() => izlemeLinki('https://site.example/', { ortakAnahtari: '  ' })).toThrow();
  });

  it('http/https disinda protokol kabul etmez', () => {
    expect(() => izlemeLinki('javascript:alert(1)', { ortakAnahtari: 'ORT1' })).toThrow();
  });
});

describe('izleme baglami cozme', () => {
  it('bilinen anahtar adlarini kabul eder', () => {
    expect(izlemeBaglamiCoz({ BTag: 'ORT1' })?.ortakAnahtari).toBe('ORT1');
    expect(izlemeBaglamiCoz({ ref: 'ORT2' })?.ortakAnahtari).toBe('ORT2');
  });

  it('anahtar yoksa null doner', () => {
    expect(izlemeBaglamiCoz({ sub1: 'a' })).toBeNull();
  });
});

describe('makrolar', () => {
  it('degerleri kodlayarak koyar', () => {
    expect(makrolariUygula('https://t.example/?c={clickid}', { clickid: 'a b&c' }))
      .toBe('https://t.example/?c=a%20b%26c');
  });

  /**
   * Bilinmeyen makro OLDUGU GIBI birakilsaydi, ortagin sisteminde
   * cozumlenmeyen bir `{foo}` literali gorunur ve hata sessizce onun
   * tarafina tasinirdi.
   */
  it('bilinmeyen makroyu bosa cevirir', () => {
    expect(makrolariUygula('https://t.example/?x={yok}', {})).toBe('https://t.example/?x=');
  });

  it('bos ve null degeri bos yazar', () => {
    expect(makrolariUygula('{a}|{b}', { a: '', b: null })).toBe('|');
  });

  it('sablondaki makrolari tekrarsiz listeler', () => {
    expect(sablondakiMakrolar('{a}{b}{a}')).toEqual(['a', 'b']);
  });
});

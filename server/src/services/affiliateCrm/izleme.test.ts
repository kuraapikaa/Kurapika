import { describe, expect, it } from 'vitest';
import {
  altDegerTemizle,
  altParametreleriTemizle,
  izlemeBaglamiCoz,
  izlemeLinki,
  makrolariUygula,
  sablondakiMakrolar,
} from './izleme.js';

describe('izleme parametreleri', () => {
  describe('deger temizleme', () => {
    it('bosluklari kirpar', () => {
      expect(altDegerTemizle('  kanal-a  ')).toBe('kanal-a');
    });

    /** Kontrol karakteri hem depoyu hem sonraki postback URL sini bozar. */
    it('kontrol karakterlerini atar', () => {
      const kontrolCharlar = 'kanal' + String.fromCharCode(0) + 'a' + String.fromCharCode(31) + 'b' + String.fromCharCode(127) + 'c';
      expect(altDegerTemizle(kontrolCharlar)).toBe('kanalabc');
    });

    it('yeni satiri atar', () => {
      expect(altDegerTemizle('a\nb\r\nc')).toBe('abc');
    });

    it('cok uzun degeri kirpar', () => {
      expect(altDegerTemizle('x'.repeat(500))).toHaveLength(100);
    });

    it('bos ve tanimsiz degerleri bos dizeye cevirir', () => {
      expect(altDegerTemizle(undefined)).toBe('');
      expect(altDegerTemizle(null)).toBe('');
    });

    it('turkce karakterleri korur', () => {
      expect(altDegerTemizle('şğüöçİ')).toBe('şğüöçİ');
    });
  });

  describe('alt parametreler', () => {
    it('yalnizca tanimli alanlari alir', () => {
      expect(altParametreleriTemizle({ sub1: 'a', sub9: 'b', baska: 'c' })).toEqual({ sub1: 'a' });
    });

    it('bos degerleri atlar', () => {
      expect(altParametreleriTemizle({ sub1: '', sub2: '   ', sub3: 'x' })).toEqual({ sub3: 'x' });
    });
  });

  describe('izleme linki', () => {
    it('btag ve alt parametreleri ekler', () => {
      const url = new URL(izlemeLinki('https://site.com/kayit', { bTag: 'ORTAK1', alt: { sub1: 'yt' } }));
      expect(url.searchParams.get('btag')).toBe('ORTAK1');
      expect(url.searchParams.get('sub1')).toBe('yt');
    });

    it('medya kimligini ekler', () => {
      const url = new URL(izlemeLinki('https://site.com', { bTag: 'A', medyaId: 'm-1' }));
      expect(url.searchParams.get('mid')).toBe('m-1');
    });

    it('mevcut sorgu parametrelerini korur', () => {
      const url = new URL(izlemeLinki('https://site.com/?kampanya=yaz', { bTag: 'A' }));
      expect(url.searchParams.get('kampanya')).toBe('yaz');
      expect(url.searchParams.get('btag')).toBe('A');
    });

    /**
     * Elle birlestirme yapilsaydi icinde & gecen tek bir deger sonraki
     * tum alanlari ezerdi.
     */
    it('ozel karakterli degeri kacisla kodlar', () => {
      const link = izlemeLinki('https://site.com', { bTag: 'A', alt: { sub1: 'a&b=c d' } });
      expect(link).not.toContain('a&b=c d');
      expect(new URL(link).searchParams.get('sub1')).toBe('a&b=c d');
    });

    it('bTag yoksa reddeder', () => {
      expect(() => izlemeLinki('https://site.com', { bTag: '' })).toThrow(/bTag/);
    });

    it('gecersiz adresi reddeder', () => {
      expect(() => izlemeLinki('site.com', { bTag: 'A' })).toThrow(/Gecersiz|Geçersiz/);
    });

    /** javascript: ve data: semalari tiklama linkinde XSS tasiyicisi olur. */
    it('http disi semalari reddeder', () => {
      expect(() => izlemeLinki('javascript:alert(1)', { bTag: 'A' })).toThrow(/http/);
      expect(() => izlemeLinki('data:text/html,x', { bTag: 'A' })).toThrow(/http/);
    });
  });

  describe('baglam cozme', () => {
    it('sorgudan baglami cikarir', () => {
      expect(izlemeBaglamiCoz({ btag: 'A', mid: 'm1', sub1: 'k', sub9: 'yok' }))
        .toEqual({ bTag: 'A', medyaId: 'm1', alt: { sub1: 'k' } });
    });

    it('btag yoksa null doner', () => {
      expect(izlemeBaglamiCoz({ sub1: 'k' })).toBeNull();
    });

    it('farkli buyuk-kucuk yazimlari kabul eder', () => {
      expect(izlemeBaglamiCoz({ BTag: 'A' })?.bTag).toBe('A');
    });
  });

  describe('makrolar', () => {
    it('degerleri yerine koyar', () => {
      expect(makrolariUygula('https://t.com/pb?c={clickid}&p={payout}', { clickid: 'c1', payout: 12.5 }))
        .toBe('https://t.com/pb?c=c1&p=12.5');
    });

    it('kucuk harfli karsiligi da bulur', () => {
      expect(makrolariUygula('{ClickId}', { clickid: 'x' })).toBe('x');
    });

    /**
     * Bilinmeyen makro oldugu gibi kalsaydi ortagin sisteminde
     * cozumlenmeyen bir literal olarak gorunur, hatayi sessizce onun
     * tarafina tasirdi.
     */
    it('bilinmeyen makroyu bosa cevirir', () => {
      expect(makrolariUygula('https://t.com/?a={yok}&b=1', {})).toBe('https://t.com/?a=&b=1');
    });

    it('deger kacisi uygular', () => {
      expect(makrolariUygula('{v}', { v: 'a&b c' })).toBe('a%26b%20c');
    });

    it('sablondaki makrolari listeler', () => {
      expect(sablondakiMakrolar('{a}/{b}?x={a}')).toEqual(['a', 'b']);
    });
  });
});

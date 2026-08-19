import { describe, expect, it } from 'vitest';
import { bilinenLogo, commonsGorselUrl, enUygunDosya, takimAnahtari } from './takimLogosu.js';

describe('takimAnahtari', () => {
  it('Turkce buyuk/kucuk harfi dogru cevirir', () => {
    // toLowerCase() olsaydi "İstanbul" -> "i̇stanbul" olur ve eslesmezdi.
    expect(takimAnahtari('İstanbul Başakşehir')).toBe('istanbul-basaksehir');
    expect(takimAnahtari('Beşiktaş')).toBe('besiktas');
    expect(takimAnahtari('Fenerbahçe')).toBe('fenerbahce');
  });

  it('kulup eklerini atar — operator nasil yazarsa yazsin ayni anahtar', () => {
    for (const ad of ['Galatasaray', 'Galatasaray SK', 'Galatasaray Spor Kulübü']) {
      expect(takimAnahtari(ad)).toBe('galatasaray');
    }
  });

  it('bos ve bozuk girdi bos anahtar', () => {
    expect(takimAnahtari('')).toBe('');
    expect(takimAnahtari(null)).toBe('');
  });
});

describe('bilinenLogo', () => {
  it('bilinen takimda ag istegi olmadan adres uretir', () => {
    const url = bilinenLogo('Beşiktaş');
    expect(url).toContain('Special:FilePath');
    expect(url).toContain('width=160');
  });

  it('yazim farkliliklarini tolere eder', () => {
    expect(bilinenLogo('galatasaray sk')).toBe(bilinenLogo('Galatasaray'));
  });

  it('bilinmeyen takimda null — tahmin etmez', () => {
    expect(bilinenLogo('Filanca United')).toBeNull();
  });

  it('genislik parametresi adrese yansir', () => {
    expect(bilinenLogo('Trabzonspor', 320)).toContain('width=320');
  });
});

describe('enUygunDosya', () => {
  it('logo/arma gecen dosyalari secer, fotograflari eler', () => {
    expect(enUygunDosya([
      'File:Vodafone_Park_stadium.jpg',
      'File:Besiktas_JK_logo.svg',
    ])).toBe('Besiktas_JK_logo.svg');
  });

  it('vektoru tercih eder — her olcekte net', () => {
    expect(enUygunDosya(['File:X_logo.png', 'File:X_logo.svg'])).toBe('X_logo.svg');
  });

  it('uygun aday yoksa null — yanlis gorsel gostermektense logosuz', () => {
    expect(enUygunDosya(['File:Takim_formasi.jpg', 'File:Taraftar.png'])).toBeNull();
    expect(enUygunDosya(null)).toBeNull();
  });
});

describe('commonsGorselUrl', () => {
  it('File: onekini ve boslugu temizler', () => {
    expect(commonsGorselUrl('File:A B.svg')).toContain('A_B.svg');
  });
  it('bos girdi bos adres', () => {
    expect(commonsGorselUrl('')).toBe('');
  });
});

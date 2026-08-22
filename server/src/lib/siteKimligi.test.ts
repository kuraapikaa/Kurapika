import { describe, expect, it } from 'vitest';
import { siteKimligi } from './siteKimligi.js';

describe('siteKimligi', () => {
  it('once oturumdaki site adini kullaniyor', () => {
    expect(siteKimligi({
      oturumSiteAdi: 'Narcos Bahis',
      tenant: { siteName: 'Taco Bahis', domain: 'tacobahis.com', id: 'taco' },
    })).toBe('Narcos Bahis');
  });

  it('oturum bossa kiraci kaydindan okuyor', () => {
    expect(siteKimligi({ tenant: { siteName: 'Taco Bahis', id: 'taco' } })).toBe('Taco Bahis');
  });

  it('site adi yoksa alan adina dusuyor', () => {
    expect(siteKimligi({ tenant: { domain: 'narcosbahis.vip', id: 'narcos' } })).toBe('narcosbahis.vip');
  });

  it('hicbiri yoksa kiraci anahtarini veriyor', () => {
    expect(siteKimligi({ tenant: { id: 'default' } })).toBe('default');
    expect(siteKimligi({ anahtar: 'default' })).toBe('default');
  });

  it('PANEL MARKASINI kimlik saymiyor', () => {
    // `adminTitle` butun kiracilarda ayni olabiliyor; kaynak nesnesine
    // hic girmiyor. Girseydi rozet her sitede ayni ismi gosterirdi --
    // tam olarak bildirilen hata buydu.
    const kaynak = { tenant: { siteName: 'Taco Bahis', id: 'taco' }, adminTitle: 'Arwen Software Solutions' } as never;
    expect(siteKimligi(kaynak)).toBe('Taco Bahis');
  });

  it('bosluklu degerleri dolu saymiyor', () => {
    expect(siteKimligi({ oturumSiteAdi: '   ', tenant: { siteName: 'Taco Bahis' } })).toBe('Taco Bahis');
  });

  it('hicbir kaynak yoksa bos donuyor -- uydurmuyor', () => {
    expect(siteKimligi({})).toBe('');
    expect(siteKimligi({ tenant: null })).toBe('');
  });
});

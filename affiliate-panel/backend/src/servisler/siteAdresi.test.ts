import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import { siteAdresiDurumu, siteAdresiOku, siteAdresiYaz } from './siteAdresi.js';

const kiraci = () => `site-adresi-${randomUUID().slice(0, 8)}`;

describe('site adresi', () => {
  it('bastan bos', async () => {
    const k = kiraci();
    expect(await siteAdresiOku(k)).toBeNull();
    expect(await siteAdresiDurumu(k)).toEqual({ adres: null, guncellendi: null });
  });

  it('yazip okuyor', async () => {
    const k = kiraci();
    const simdi = new Date('2026-08-08T00:00:00.000Z');
    const sonuc = await siteAdresiYaz(k, 'https://narcosbahis.vip', simdi);

    expect(sonuc).toEqual({ adres: 'https://narcosbahis.vip/', guncellendi: simdi.toISOString() });
    expect(await siteAdresiOku(k)).toBe('https://narcosbahis.vip/');
  });

  it('gecersiz adresi reddediyor', async () => {
    const k = kiraci();
    await expect(siteAdresiYaz(k, 'boyle-bir-adres-yok')).rejects.toThrow(/geçerli/i);
    await expect(siteAdresiYaz(k, 'ftp://ornek.test')).rejects.toThrow(/http/i);
  });

  /**
   * TEMİZLEME: boş gövde adresi siler. Ayrı bir "sil" ucu yerine bu
   * bilinçli -- admin panelde alanı boşaltıp kaydedebilsin.
   */
  it('bos deger adresi temizliyor', async () => {
    const k = kiraci();
    await siteAdresiYaz(k, 'https://narcosbahis.vip');
    expect(await siteAdresiOku(k)).not.toBeNull();

    await siteAdresiYaz(k, '');
    expect(await siteAdresiOku(k)).toBeNull();
  });

  it('kiracilar birbirinden bagimsiz', async () => {
    const bir = kiraci();
    const iki = kiraci();
    await siteAdresiYaz(bir, 'https://bir.test');
    expect(await siteAdresiOku(iki)).toBeNull();
  });
});

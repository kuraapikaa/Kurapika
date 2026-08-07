import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import {
  altLinkBul,
  altLinkDurumDegistir,
  altLinkleriListele,
  altLinkOlustur,
  altLinkSil,
  kodUret,
} from './altLink.js';

const kiraci = () => `altlink-${randomUUID().slice(0, 8)}`;
const girdi = { ad: 'Instagram bio', medyaId: 'm1', alt: { sub1: 'instagram' } };

describe('kisa kod', () => {
  /**
   * Kod sozlu ya da elle aktarilabilmeli. 0/O ve 1/l/I karistirilan
   * karakterler; "linkin calismiyor" desteginin en sik sebebi yanlis
   * okunan bir karakter olur.
   */
  it('karistirilan karakterleri icermez', () => {
    const hepsi = Array.from({ length: 200 }, () => kodUret()).join('');
    expect(hepsi).not.toMatch(/[0O1lI]/);
  });

  it('istenen uzunlukta ve tekrarsiz uretiyor', () => {
    expect(kodUret(7)).toHaveLength(7);
    const kodlar = new Set(Array.from({ length: 500 }, () => kodUret()));
    expect(kodlar.size).toBeGreaterThan(495);
  });
});

describe('alt link', () => {
  it('olusturup listeliyor', async () => {
    const k = kiraci();
    const link = await altLinkOlustur(k, 'ORT1', girdi);
    expect(link.kod).toBeTruthy();
    expect(link.alt).toEqual({ sub1: 'instagram' });
    expect(await altLinkleriListele(k, 'ORT1')).toHaveLength(1);
  });

  /** Ayni isim, ortagin raporunda hangisinin hangisi oldugunu belirsizlestirir. */
  it('ayni ismi (buyuk/kucuk harf farkiyla da) reddediyor', async () => {
    const k = kiraci();
    await altLinkOlustur(k, 'ORT1', girdi);
    await expect(altLinkOlustur(k, 'ORT1', { ...girdi, ad: 'instagram BIO' }))
      .rejects.toThrow(/zaten var/);
  });

  it('farkli ortak ayni ismi kullanabiliyor', async () => {
    const k = kiraci();
    await altLinkOlustur(k, 'ORT1', girdi);
    await expect(altLinkOlustur(k, 'ORT2', girdi)).resolves.toBeTruthy();
  });

  it('ad ve medyaId zorunlu', async () => {
    const k = kiraci();
    await expect(altLinkOlustur(k, 'ORT1', { ad: '', medyaId: 'm1' })).rejects.toThrow(/ad/);
    await expect(altLinkOlustur(k, 'ORT1', { ad: 'x', medyaId: '' })).rejects.toThrow(/medyaId/);
  });

  it('gecersiz alt parametreleri ayikliyor', async () => {
    const k = kiraci();
    const link = await altLinkOlustur(k, 'ORT1', { ...girdi, alt: { sub1: 'a', sub9: 'b', baska: 'c' } });
    expect(link.alt).toEqual({ sub1: 'a' });
  });

  it('koddan bulunuyor', async () => {
    const k = kiraci();
    const link = await altLinkOlustur(k, 'ORT1', girdi);
    expect((await altLinkBul(k, link.kod))?.id).toBe(link.id);
    expect(await altLinkBul(k, 'yokboyle')).toBeNull();
  });

  /**
   * SAHIPLIK. Baskasinin linkini kapatmak, rakibin kampanyasini
   * durdurmak olurdu; silmek daha kotusu.
   */
  describe('sahiplik', () => {
    it('baskasinin linkini silemiyor', async () => {
      const k = kiraci();
      const link = await altLinkOlustur(k, 'ORT1', girdi);
      await expect(altLinkSil(k, 'ORT2', link.id)).rejects.toThrow(/bulunamadı/);
      expect(await altLinkleriListele(k, 'ORT1')).toHaveLength(1);
    });

    it('baskasinin linkini kapatamiyor', async () => {
      const k = kiraci();
      const link = await altLinkOlustur(k, 'ORT1', girdi);
      await expect(altLinkDurumDegistir(k, 'ORT2', link.id, false)).rejects.toThrow(/bulunamadı/);
    });

    it('kendi linkini kapatip acabiliyor', async () => {
      const k = kiraci();
      const link = await altLinkOlustur(k, 'ORT1', girdi);
      expect((await altLinkDurumDegistir(k, 'ORT1', link.id, false)).aktif).toBe(false);
      expect((await altLinkDurumDegistir(k, 'ORT1', link.id, true)).aktif).toBe(true);
    });

    it('liste yalnizca kendi linklerini doner', async () => {
      const k = kiraci();
      await altLinkOlustur(k, 'ORT1', girdi);
      await altLinkOlustur(k, 'ORT2', { ...girdi, ad: 'Baska' });
      const kendi = await altLinkleriListele(k, 'ORT1');
      expect(kendi).toHaveLength(1);
      expect(kendi[0].ortakAnahtari).toBe('ORT1');
    });
  });
});

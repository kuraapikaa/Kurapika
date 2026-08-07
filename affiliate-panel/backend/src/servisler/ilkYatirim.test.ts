import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import { ftdDefteriniSifirla, ftdDurumu, ftdIsle } from './ilkYatirim.js';

const kiraci = () => `ftd-${randomUUID().slice(0, 8)}`;
const olc = (k: string, gun: string, oyuncular: string[], kalibrasyonMu = false) =>
  ftdIsle(k, gun, oyuncular, { kalibrasyonMu });

describe('ilk yatirim turetme', () => {
  it('daha once gorulmemis yatiranlari FTD sayar', async () => {
    const k = kiraci();
    expect((await olc(k, '2026-08-01', ['a', 'b'])).ftdSayisi).toBe(2);
  });

  it('ayni oyuncu ikinci gun FTD sayilmaz', async () => {
    const k = kiraci();
    await olc(k, '2026-08-01', ['a', 'b']);
    expect((await olc(k, '2026-08-02', ['a', 'b', 'c'])).ftdSayisi).toBe(1);
  });

  it('ayni gun icinde tekrarlanan kimligi bir kez sayar', async () => {
    const k = kiraci();
    expect((await olc(k, '2026-08-01', ['a', 'a', 'a'])).ftdSayisi).toBe(1);
  });

  it('bos listede sifir doner', async () => {
    const k = kiraci();
    await olc(k, '2026-08-01', ['a']);
    expect((await olc(k, '2026-08-02', [])).ftdSayisi).toBe(0);
  });

  it('bos ve bosluklu kimlikleri ayiklar', async () => {
    const k = kiraci();
    expect((await olc(k, '2026-08-01', ['a', '', '  ', 'b'])).ftdSayisi).toBe(2);
  });

  /**
   * KALIBRASYON. Defter bosken HERKES "ilk kez yatirim yapiyor"
   * gorunur ve o rakam gercek gibi durur -- tipi dogru, degeri
   * tamamen yanlis. En tehlikeli hata turu bu.
   */
  describe('kalibrasyon', () => {
    it('kalibrasyon gununde FTD null doner ama defter dolar', async () => {
      const k = kiraci();
      const sonuc = await olc(k, '2026-08-01', ['a', 'b', 'c'], true);
      expect(sonuc.ftdSayisi).toBeNull();
      expect(sonuc.deftereEklenen).toBe(3);
    });

    it('kalibrasyondan sonra yalnizca GERCEKTEN yeni olan sayilir', async () => {
      const k = kiraci();
      await olc(k, '2026-08-01', ['a', 'b', 'c'], true);
      // b ve c defterde; yalnizca d yeni.
      expect((await olc(k, '2026-08-02', ['b', 'c', 'd'])).ftdSayisi).toBe(1);
    });

    it('kalibrasyon suresince olcum baslamamis sayilir', async () => {
      const k = kiraci();
      await olc(k, '2026-08-01', ['a'], true);
      expect((await ftdDurumu(k)).olculuyorMu).toBe(false);
      await olc(k, '2026-08-02', ['b']);
      expect((await ftdDurumu(k)).olculuyorMu).toBe(true);
    });

    it('olcumun basladigi gunu kaydeder', async () => {
      const k = kiraci();
      await olc(k, '2026-08-01', ['a'], true);
      await olc(k, '2026-08-05', ['b']);
      expect((await ftdDurumu(k)).olcumBaslangici).toBe('2026-08-05');
    });
  });

  /**
   * Defter TUM ortaklar icin ortak. Ayni oyuncu iki ortagin listesinde
   * gorunurse (atif degisebilir) ikisine birden FTD yazmak, tek bir
   * ilk yatirim icin iki kez CPA odemek olurdu.
   */
  it('ayni oyuncu iki ortakta iki kez FTD sayilmaz', async () => {
    const k = kiraci();
    expect((await olc(k, '2026-08-01', ['ortak-a-oyuncusu'])).ftdSayisi).toBe(1);
    expect((await olc(k, '2026-08-01', ['ortak-a-oyuncusu'])).ftdSayisi).toBe(0);
  });

  describe('defter sifirlama', () => {
    it('sifirlayinca kalibrasyon bastan baslar', async () => {
      const k = kiraci();
      await olc(k, '2026-08-01', ['a'], true);
      await olc(k, '2026-08-02', ['b']);
      expect((await ftdDurumu(k)).olculuyorMu).toBe(true);

      await ftdDefteriniSifirla(k);
      const durum = await ftdDurumu(k);
      expect(durum.olculuyorMu).toBe(false);
      expect(durum.defterdekiOyuncu).toBe(0);

      // Eski oyuncu artik "yeni" gorunur -- sifirlamanin bilinen bedeli.
      expect((await olc(k, '2026-08-03', ['a'])).ftdSayisi).toBe(1);
    });
  });

  it('defterdeki oyuncu sayisini bildirir', async () => {
    const k = kiraci();
    await olc(k, '2026-08-01', ['a', 'b', 'c'], true);
    expect((await ftdDurumu(k)).defterdekiOyuncu).toBe(3);
  });
});

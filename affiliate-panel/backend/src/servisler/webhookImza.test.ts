import { describe, expect, it } from 'vitest';
import {
  IMZA_BASLIGI,
  ZAMAN_BASLIGI,
  ZAMAN_PENCERESI_SN,
  imzaHesapla,
  imzayiDogrula,
} from './webhookImza.js';

const SIR = 'lynon-paylasilan-sirri-yeterince-uzun';
const SIMDI = new Date('2026-08-09T12:00:00Z');
const ZAMAN = Math.floor(SIMDI.getTime() / 1000);

const govde = JSON.stringify({ eventType: 'deposit', playerId: '123', amount: 500 });

const basliklar = (ek: Record<string, unknown> = {}, hamGovde = govde, zaman: number | string = ZAMAN) => ({
  [ZAMAN_BASLIGI]: String(zaman),
  [IMZA_BASLIGI]: imzaHesapla(SIR, String(zaman), hamGovde),
  ...ek,
});

describe('webhook imzasi', () => {
  it('dogru imzayi kabul eder', () => {
    expect(imzayiDogrula(SIR, basliklar(), govde, SIMDI)).toEqual({ gecerli: true, zaman: ZAMAN });
  });

  it('sha256= onekiyle de kabul eder', () => {
    const b = basliklar();
    b[IMZA_BASLIGI] = `sha256=${b[IMZA_BASLIGI]}`;
    expect(imzayiDogrula(SIR, b, govde, SIMDI).gecerli).toBe(true);
  });

  it('yanlis sirla uretilmis imzayi reddeder', () => {
    const b = { [ZAMAN_BASLIGI]: String(ZAMAN), [IMZA_BASLIGI]: imzaHesapla('baska-sir', ZAMAN, govde) };
    expect(imzayiDogrula(SIR, b, govde, SIMDI)).toEqual({ gecerli: false, sebep: 'imza-tutmadi' });
  });

  it('govde degistirilmisse reddeder', () => {
    const bozulmus = JSON.stringify({ eventType: 'deposit', playerId: '123', amount: 999999 });
    expect(imzayiDogrula(SIR, basliklar(), bozulmus, SIMDI))
      .toEqual({ gecerli: false, sebep: 'imza-tutmadi' });
  });

  /**
   * IMZA HAM METIN UZERINDEN.
   *
   * Ayni JSON'un alan sirasi degisik yazimi ANLAMCA ayni ama metin
   * olarak farkli. Dogrulama cozulmus nesne uzerinden yapilsaydi bu
   * gecerdi; ham metin uzerinden yapildigi icin gecmiyor. Bu, imza
   * dogrulamalarinda en sik yapilan hatanin testi.
   */
  it('alan sirasi degismis ayni JSON gecmez', () => {
    const yenidenDizilmis = JSON.stringify({ playerId: '123', amount: 500, eventType: 'deposit' });
    expect(yenidenDizilmis).not.toBe(govde);
    expect(imzayiDogrula(SIR, basliklar(), yenidenDizilmis, SIMDI).gecerli).toBe(false);
  });

  describe('tekrar saldirisi', () => {
    it('pencere disinda kalan eski istegi reddeder', () => {
      const eski = ZAMAN - ZAMAN_PENCERESI_SN - 1;
      expect(imzayiDogrula(SIR, basliklar({}, govde, eski), govde, SIMDI))
        .toEqual({ gecerli: false, sebep: 'zaman-disi' });
    });

    it('pencere icindeki eski istegi kabul eder', () => {
      const eski = ZAMAN - ZAMAN_PENCERESI_SN + 5;
      expect(imzayiDogrula(SIR, basliklar({}, govde, eski), govde, SIMDI).gecerli).toBe(true);
    });

    /** Ileri tarihli istek de reddedilmeli; saat kaymasi iki yonlu. */
    it('cok ileri tarihli istegi reddeder', () => {
      const ileri = ZAMAN + ZAMAN_PENCERESI_SN + 1;
      expect(imzayiDogrula(SIR, basliklar({}, govde, ileri), govde, SIMDI))
        .toEqual({ gecerli: false, sebep: 'zaman-disi' });
    });

    /**
     * Zaman imzali metnin ICINDE: saldirgan yakaladigi istegin zamanini
     * guncelleyip pencereye sokmaya calisirsa imza bozulur.
     */
    it('zaman degistirilirse imza bozulur', () => {
      const b = basliklar();
      b[ZAMAN_BASLIGI] = String(ZAMAN + 10);
      expect(imzayiDogrula(SIR, b, govde, SIMDI)).toEqual({ gecerli: false, sebep: 'imza-tutmadi' });
    });
  });

  describe('eksik girdiler', () => {
    it('sir kurulu degilse reddeder', () => {
      expect(imzayiDogrula(null, basliklar(), govde, SIMDI)).toEqual({ gecerli: false, sebep: 'sir-yok' });
    });

    it('imza basligi yoksa reddeder', () => {
      expect(imzayiDogrula(SIR, { [ZAMAN_BASLIGI]: String(ZAMAN) }, govde, SIMDI))
        .toEqual({ gecerli: false, sebep: 'imza-yok' });
    });

    it('zaman basligi yoksa reddeder', () => {
      expect(imzayiDogrula(SIR, { [IMZA_BASLIGI]: imzaHesapla(SIR, ZAMAN, govde) }, govde, SIMDI))
        .toEqual({ gecerli: false, sebep: 'zaman-yok' });
    });

    it('zaman sayi degilse reddeder', () => {
      expect(imzayiDogrula(SIR, basliklar({ [ZAMAN_BASLIGI]: 'dun' }), govde, SIMDI))
        .toEqual({ gecerli: false, sebep: 'zaman-yok' });
    });

    /** Bozuk uzunluktaki imza istisna degil RET uretmeli. */
    it('kisa/bozuk imza firlatmaz, reddeder', () => {
      expect(imzayiDogrula(SIR, basliklar({ [IMZA_BASLIGI]: 'abc' }), govde, SIMDI))
        .toEqual({ gecerli: false, sebep: 'imza-tutmadi' });
      expect(imzayiDogrula(SIR, basliklar({ [IMZA_BASLIGI]: 'zzzz' }), govde, SIMDI).gecerli).toBe(false);
    });

    it('bos govde de imzalanabiliyor', () => {
      expect(imzayiDogrula(SIR, basliklar({}, ''), '', SIMDI).gecerli).toBe(true);
    });
  });
});

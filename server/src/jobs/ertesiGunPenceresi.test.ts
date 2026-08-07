import { describe, expect, it } from 'vitest';
import { bekleyenGun, gunEkle, VARSAYILAN_PENCERE, type GunDurumu } from './ertesiGunPenceresi.js';

/** Turkiye saatiyle verilen an. Yaz saati yok, ofset sabit +03:00. */
const tr = (isoYerel: string) => new Date(`${isoYerel}+03:00`);

describe('ertesi gun dagitim penceresi', () => {
  describe('gunluk calisma', () => {
    it('baslangic saatinden once bugunu islemez', () => {
      expect(bekleyenGun({}, tr('2026-08-07T00:14:00'))).toBeNull();
    });

    it('baslangic saatinde bugunu isler', () => {
      expect(bekleyenGun({}, tr('2026-08-07T00:15:00'))).toBe('2026-08-07');
    });

    it('tamamlanmis gunu tekrar islemez', () => {
      const gunler: Record<string, GunDurumu> = { '2026-08-07': { durum: 'done', deneme: 1 } };
      expect(bekleyenGun(gunler, tr('2026-08-07T00:20:00'))).toBeNull();
    });
  });

  /**
   * Duzeltilen hatanin ta kendisi.
   *
   * Eski is yalnizca 00:15-00:19 arasinda calisiyordu; o bes dakikada
   * sunucu ayakta degilse gun sessizce kayboluyordu. Asagidaki uc durum
   * eski kodda da "hicbir sey yapma" derdi.
   */
  describe('kacirilan gunun telafisi', () => {
    it('pencere kacirildiginda gun ayni gun icinde hala islenir', () => {
      // Sunucu 00:15'te ayakta degildi, 09:40'ta acildi.
      expect(bekleyenGun({}, tr('2026-08-07T09:40:00'))).toBe('2026-08-07');
    });

    it('gece yarisindan sonra bile ayni gun bekleyen kalir', () => {
      expect(bekleyenGun({}, tr('2026-08-07T23:59:00'))).toBe('2026-08-07');
    });

    it('yarim kalan onceki gunu telafi eder', () => {
      const gunler: Record<string, GunDurumu> = {
        '2026-08-06': { durum: 'bekliyor', deneme: 1, sonDenemeAt: tr('2026-08-06T00:15:00').toISOString() },
        '2026-08-07': { durum: 'done', deneme: 1 },
      };
      expect(bekleyenGun(gunler, tr('2026-08-07T10:00:00'))).toBe('2026-08-06');
    });

    it('yarim kalan en eski gunu once isler', () => {
      const gunler: Record<string, GunDurumu> = {
        '2026-08-05': { durum: 'bekliyor', deneme: 1, sonDenemeAt: tr('2026-08-05T00:15:00').toISOString() },
        '2026-08-06': { durum: 'bekliyor', deneme: 1, sonDenemeAt: tr('2026-08-06T00:15:00').toISOString() },
      };
      expect(bekleyenGun(gunler, tr('2026-08-07T10:00:00'))).toBe('2026-08-05');
    });

    it('telafi penceresinin disindaki gunlere donmez', () => {
      const gunler: Record<string, GunDurumu> = {
        '2026-08-04': { durum: 'bekliyor', deneme: 1, sonDenemeAt: tr('2026-08-04T00:15:00').toISOString() },
        '2026-08-07': { durum: 'done', deneme: 1 },
      };
      expect(bekleyenGun(gunler, tr('2026-08-07T10:00:00'))).toBeNull();
    });
  });

  /**
   * Telafi mekanizmasinin en pahali yan etkisi: temiz bir durumla acilan
   * sunucunun gecmis gunlerin bonusunu topluca yeniden dagitmasi. Hic
   * gorulmemis gun aday degil.
   */
  describe('gecmise donuk toplu dagitim korumasi', () => {
    it('temiz durumda yalnizca bugunu aday sayar', () => {
      expect(bekleyenGun({}, tr('2026-08-07T10:00:00'))).toBe('2026-08-07');
    });

    it('bugun bittiyse hic gorulmemis gecmis gunlere donmez', () => {
      const gunler: Record<string, GunDurumu> = { '2026-08-07': { durum: 'done', deneme: 1 } };
      expect(bekleyenGun(gunler, tr('2026-08-07T10:00:00'))).toBeNull();
    });
  });

  /**
   * Telafi sinirsiz olmamali: kalici bir hata (silinmis kampanya gibi)
   * Lynon'a dakikada bir istek atmaya donusmemeli.
   */
  describe('yeniden deneme sinirlari', () => {
    it('denemeler arasinda bekler', () => {
      const gunler: Record<string, GunDurumu> = {
        '2026-08-07': { durum: 'bekliyor', deneme: 1, sonDenemeAt: tr('2026-08-07T00:15:00').toISOString() },
      };
      expect(bekleyenGun(gunler, tr('2026-08-07T00:20:00'))).toBeNull();
    });

    it('bekleme suresi dolunca yeniden dener', () => {
      const gunler: Record<string, GunDurumu> = {
        '2026-08-07': { durum: 'bekliyor', deneme: 1, sonDenemeAt: tr('2026-08-07T00:15:00').toISOString() },
      };
      expect(bekleyenGun(gunler, tr('2026-08-07T00:26:00'))).toBe('2026-08-07');
    });

    it('deneme tavaninda vazgecer', () => {
      const gunler: Record<string, GunDurumu> = {
        '2026-08-07': { durum: 'bekliyor', deneme: VARSAYILAN_PENCERE.maxDeneme, sonDenemeAt: tr('2026-08-07T00:15:00').toISOString() },
      };
      expect(bekleyenGun(gunler, tr('2026-08-07T12:00:00'))).toBeNull();
    });

    it('tavana ulasan gun bugunun islenmesini engellemez', () => {
      const gunler: Record<string, GunDurumu> = {
        '2026-08-06': { durum: 'bekliyor', deneme: VARSAYILAN_PENCERE.maxDeneme, sonDenemeAt: tr('2026-08-06T00:15:00').toISOString() },
      };
      expect(bekleyenGun(gunler, tr('2026-08-07T00:15:00'))).toBe('2026-08-07');
    });
  });

  describe('gunEkle', () => {
    it('ay sinirini gecer', () => {
      expect(gunEkle('2026-08-01', -1)).toBe('2026-07-31');
    });

    it('yil sinirini gecer', () => {
      expect(gunEkle('2026-01-01', -1)).toBe('2025-12-31');
    });

    it('artik yili dogru sayar', () => {
      expect(gunEkle('2028-03-01', -1)).toBe('2028-02-29');
    });

    /** Yaz saati gecisinde gun kaymamali; hesap ogle vaktinden yapiliyor. */
    it('yaz saati gecisinde gun kaydirmaz', () => {
      expect(gunEkle('2026-03-30', -1)).toBe('2026-03-29');
      expect(gunEkle('2026-10-26', -1)).toBe('2026-10-25');
    });
  });
});

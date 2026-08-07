import { afterEach, describe, expect, it } from 'vitest';
import { guvenliKiraciAnahtari, kiraciCozumle, sabitKiraci } from './kiraci.js';

/**
 * KİRACI ÇÖZÜMÜ.
 *
 * Buradaki bir hata sessiz: panel çalışır, hiçbir istisna düşmez, ama
 * veriler "yok" görünür — çünkü başka bir anahtarda aranmaktadır.
 * Üretimde tam olarak bu oldu: yönetimde oluşturulan ortak, ortak
 * portalinde bulunamadı.
 */

afterEach(() => {
  delete process.env.AFF_SABIT_KIRACI;
  delete process.env.VARSAYILAN_KIRACI;
});

describe('kiraci anahtari temizligi', () => {
  it('dizin gecisini keser', () => {
    expect(guvenliKiraciAnahtari('../../etc')).toBe('etc');
  });

  it('bos deger varsayilana duser', () => {
    expect(guvenliKiraciAnahtari('   ')).toBe('varsayilan');
  });
});

describe('kiraci cozumu', () => {
  it('alt alan adini kiraci sayar', () => {
    expect(kiraciCozumle(null, { host: 'musteri1.panel.com' })).toBe('musteri1');
  });

  it('www alt alan adi sayilmaz', () => {
    expect(kiraciCozumle(null, { host: 'www.panel.com' })).toBe('varsayilan');
  });

  it('oturum basligi ezer', () => {
    // Gecerli oturumu olan biri baslik degistirerek baska kiraciya
    // gecememeli.
    expect(kiraciCozumle('gercek', { host: 'baska.panel.com', 'x-kiraci': 'sahte' })).toBe('gercek');
  });

  it('oturum yoksa baslik kullanilir', () => {
    expect(kiraciCozumle(null, { host: 'panel.com', 'x-kiraci': 'musteri2' })).toBe('musteri2');
  });

  /**
   * URETIMDEKI HATA.
   *
   * `affiliate.` ve `ortak.` bir musteriyi degil bir islevi
   * adlandiriyor; ayri kiraciya dusunce yonetimde olusturulan ortak
   * portalda bulunamiyordu.
   */
  describe('tek marka dagitimi', () => {
    it('sabit kiraci verilmeden iki host AYRISIYOR', () => {
      expect(kiraciCozumle(null, { host: 'affiliate.narcosbahis.vip' })).toBe('affiliate');
      expect(kiraciCozumle(null, { host: 'ortak.narcosbahis.vip' })).toBe('ortak');
    });

    it('sabit kiraci verildiginde iki host AYNI kiraciya duser', () => {
      process.env.AFF_SABIT_KIRACI = 'affiliate';
      expect(kiraciCozumle(null, { host: 'affiliate.narcosbahis.vip' })).toBe('affiliate');
      expect(kiraciCozumle(null, { host: 'ortak.narcosbahis.vip' })).toBe('affiliate');
    });

    /** Elde kalmis eski bir oturum cerezi yanlis anahtari tasiyabilir. */
    it('sabit kiraci oturumu da ezer', () => {
      process.env.AFF_SABIT_KIRACI = 'affiliate';
      expect(kiraciCozumle('ortak', { host: 'ortak.narcosbahis.vip' })).toBe('affiliate');
    });

    it('sabit kiraci basligi da ezer', () => {
      process.env.AFF_SABIT_KIRACI = 'affiliate';
      expect(kiraciCozumle(null, { host: 'x.y.z', 'x-kiraci': 'baskasi' })).toBe('affiliate');
    });

    it('sabit kiraci temizlenerek uygulanir', () => {
      process.env.AFF_SABIT_KIRACI = '  Affiliate/../x  ';
      expect(sabitKiraci()).toBe('affiliate-x');
    });

    it('bos degisken sabit kiraci sayilmaz', () => {
      process.env.AFF_SABIT_KIRACI = '   ';
      expect(sabitKiraci()).toBeNull();
      expect(kiraciCozumle(null, { host: 'ortak.narcosbahis.vip' })).toBe('ortak');
    });
  });

  it('host yoksa varsayilana duser', () => {
    expect(kiraciCozumle(null, {})).toBe('varsayilan');
  });
});

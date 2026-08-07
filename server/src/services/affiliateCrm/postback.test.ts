import { describe, expect, it } from 'vitest';
import { genelIpMi, PostbackHatasi, sablonuDogrula } from './postback.js';

/**
 * Postback adresini ORTAK yaziyor ve istegi BIZIM sunucumuz atiyor.
 * Kontrol olmasaydi ortak `http://169.254.169.254/...` yazarak bulut
 * kimlik uclarina, `http://localhost:5432` yazarak ic agdaki
 * veritabanina bizim adimiza istek attirabilirdi.
 */
describe('postback SSRF korumasi', () => {
  describe('genel IP tespiti', () => {
    it.each([
      ['8.8.8.8', true],
      ['1.1.1.1', true],
      ['93.184.216.34', true],
    ])('genel adres %s -> %s', (ip, beklenen) => {
      expect(genelIpMi(ip)).toBe(beklenen);
    });

    it.each([
      ['127.0.0.1', 'geri dongu'],
      ['0.0.0.0', 'belirsiz'],
      ['10.0.0.5', 'ozel'],
      ['172.16.0.1', 'ozel'],
      ['172.31.255.254', 'ozel'],
      ['192.168.1.1', 'ozel'],
      ['169.254.169.254', 'bulut meta-veri'],
      ['100.64.0.1', 'tasiyici NAT'],
      ['224.0.0.1', 'coklu yayin'],
    ])('ozel adres %s (%s) reddedilir', (ip) => {
      expect(genelIpMi(ip)).toBe(false);
    });

    it('172.32 ozel araligin disinda, gecerli', () => {
      expect(genelIpMi('172.32.0.1')).toBe(true);
    });

    it.each([
      ['::1', 'geri dongu'],
      ['::', 'belirsiz'],
      ['fe80::1', 'baglanti-yerel'],
      ['fc00::1', 'benzersiz yerel'],
      ['fd12::1', 'benzersiz yerel'],
      ['ff02::1', 'coklu yayin'],
    ])('IPv6 ozel adres %s (%s) reddedilir', (ip) => {
      expect(genelIpMi(ip)).toBe(false);
    });

    it('genel IPv6 kabul edilir', () => {
      expect(genelIpMi('2606:4700:4700::1111')).toBe(true);
    });

    /**
     * Yalnizca metin olarak bakmak bu bicimi kacirir ve geri donguye
     * cikis verirdi.
     */
    it('IPv4 eslemeli IPv6 geri donguyu yakalar', () => {
      expect(genelIpMi('::ffff:127.0.0.1')).toBe(false);
      expect(genelIpMi('::ffff:10.0.0.1')).toBe(false);
      expect(genelIpMi('::ffff:8.8.8.8')).toBe(true);
    });

    it('bos ve bozuk degerleri reddeder', () => {
      expect(genelIpMi('')).toBe(false);
      expect(genelIpMi('abc')).toBe(false);
      expect(genelIpMi('999.1.1.1')).toBe(false);
    });
  });

  describe('sablon dogrulama', () => {
    it('makrolu gecerli sablonu kabul eder', () => {
      const { makrolar } = sablonuDogrula('https://t.com/pb?c={clickid}&p={payout}');
      expect(makrolar).toEqual(['clickid', 'payout']);
    });

    /** http, ortagin izleme verisini de aciga cikarir. */
    it('http sablonu reddeder', () => {
      expect(() => sablonuDogrula('http://t.com/pb')).toThrow(PostbackHatasi);
    });

    it('bos sablonu reddeder', () => {
      expect(() => sablonuDogrula('')).toThrow(/zorunlu/);
    });

    it('adres uretmeyen sablonu reddeder', () => {
      expect(() => sablonuDogrula('sadece-metin')).toThrow(/adres/);
    });

    /** `{clickid}` iceren ham metin gecerli bir URL olmayabilir. */
    it('makro yerine ornek deger koyup dogrular', () => {
      expect(() => sablonuDogrula('https://{host}.t.com/pb')).not.toThrow();
    });
  });
});

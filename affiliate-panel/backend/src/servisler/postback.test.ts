import { describe, expect, it } from 'vitest';
import { genelIpMi, sablonuDogrula } from './postback.js';

/**
 * Postback adresini ORTAK yaziyor ve istegi BIZIM sunucumuz atiyor.
 * Bu testler SSRF kapisinin testleri; gecen her satir bir saldiri
 * yolunu kapatiyor.
 */
describe('genel IP kontrolu', () => {
  it('geri donguyu reddeder', () => {
    expect(genelIpMi('127.0.0.1')).toBe(false);
    expect(genelIpMi('::1')).toBe(false);
  });

  it('bulut meta-veri adresini reddeder', () => {
    expect(genelIpMi('169.254.169.254')).toBe(false);
  });

  it('ozel araliklari reddeder', () => {
    ['10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1', '100.64.0.1'].forEach((ip) => {
      expect(genelIpMi(ip), ip).toBe(false);
    });
  });

  /** Yalnizca metne bakan bir kontrol bu bicimi kacirir. */
  it('IPv4 eslemeli IPv6 ile geri donguye cikis vermez', () => {
    expect(genelIpMi('::ffff:127.0.0.1')).toBe(false);
    expect(genelIpMi('::ffff:10.0.0.5')).toBe(false);
  });

  it('IPv6 yerel araliklarini reddeder', () => {
    ['fe80::1', 'fc00::1', 'fd00::1', 'ff02::1'].forEach((ip) => {
      expect(genelIpMi(ip), ip).toBe(false);
    });
  });

  it('genel adresleri kabul eder', () => {
    expect(genelIpMi('8.8.8.8')).toBe(true);
    expect(genelIpMi('2606:4700::1111')).toBe(true);
  });

  it('bos ve bozuk degeri reddeder', () => {
    expect(genelIpMi('')).toBe(false);
    expect(genelIpMi('999.1.1.1')).toBe(false);
  });
});

describe('sablon dogrulama', () => {
  it('https sablonu kabul eder ve makrolari cikarir', () => {
    const { makrolar } = sablonuDogrula('https://t.example/pb?c={clickid}&p={payout}');
    expect(makrolar).toEqual(['clickid', 'payout']);
  });

  /** http, ortagin izleme verisini de aciga cikarir. */
  it('http sablonu reddeder', () => {
    expect(() => sablonuDogrula('http://t.example/pb')).toThrow(/https/);
  });

  it('bos sablonu reddeder', () => {
    expect(() => sablonuDogrula('   ')).toThrow();
  });

  /**
   * Makrolar ORNEK DEGERLE doldurulup dogrulaniyor; ham `{clickid}`
   * iceren metin gecerli bir adres olmayabilir.
   */
  it('makro iceren sablonu ornek degerle dogrular', () => {
    expect(() => sablonuDogrula('https://{alan}.example/pb')).not.toThrow();
  });

  it('adres uretmeyen sablonu reddeder', () => {
    expect(() => sablonuDogrula('bu bir adres degil')).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { Buffer } from 'node:buffer';
import {
  base32Coz,
  hotpKodu,
  kalanSaniye,
  totpAlgoritmasi,
  totpKodu,
  totpSirriniCozumle,
  TotpHatasi,
} from './totp.js';

/**
 * Bu modul giris akisinin kalbinde: kod yanlissa panel Lynon'a hic
 * baglanamaz. Bu yuzden dogrulama RFC 6238'in KENDI test vektorleriyle
 * yapiliyor -- kendi ciktimizi kendimize dogrulatmak, ortak bir hatayi
 * iki yerde birden tekrarlamaktan baska bir sey kanitlamaz.
 *
 * RFC 6238 Appendix B. Sirlar ASCII; base32'ye cevrilmis hallerini
 * kullaniyoruz cunku fonksiyon base32 bekliyor.
 */
const b32 = (ascii: string) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const b of Buffer.from(ascii, 'ascii')) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return out;
};

const SIR_SHA1 = b32('12345678901234567890');
const SIR_SHA256 = b32('12345678901234567890123456789012');
const SIR_SHA512 = b32('1234567890123456789012345678901234567890123456789012345678901234');

describe('RFC 6238 test vektörleri', () => {
  const vektorler: Array<[number, string, 'sha1' | 'sha256' | 'sha512', string]> = [
    [59, SIR_SHA1, 'sha1', '94287082'],
    [59, SIR_SHA256, 'sha256', '46119246'],
    [59, SIR_SHA512, 'sha512', '90693936'],
    [1111111109, SIR_SHA1, 'sha1', '07081804'],
    [1111111111, SIR_SHA1, 'sha1', '14050471'],
    [1234567890, SIR_SHA1, 'sha1', '89005924'],
    [2000000000, SIR_SHA1, 'sha1', '69279037'],
    [20000000000, SIR_SHA1, 'sha1', '65353130'], // 32 bit sayaci asar
    [1111111109, SIR_SHA256, 'sha256', '68084774'],
    [1111111109, SIR_SHA512, 'sha512', '25091201'],
  ];

  for (const [saniye, sir, alg, beklenen] of vektorler) {
    it(`t=${saniye} ${alg} -> ${beklenen}`, () => {
      const { kod } = totpKodu(sir, { algorithm: alg, digits: 8, periodSeconds: 30 }, saniye * 1000);
      expect(kod).toBe(beklenen);
    });
  }
});

describe('sır çözümleme', () => {
  it('otpauth:// URL\'inden sırrı ve seçenekleri çıkarır', () => {
    const url = 'otpauth://totp/Lynon:admin?secret=' + SIR_SHA1 + '&algorithm=SHA256&digits=8&period=60';
    const { secret, options } = totpSirriniCozumle(url);
    expect(secret).toBe(SIR_SHA1);
    expect(options).toEqual({ algorithm: 'sha256', digits: 8, periodSeconds: 60 });
  });

  it('URL içindeki ayar dışarıdan verilen varsayılanı EZER', () => {
    // Sirrin kendi tarifi panel ayarindan daha guveniliridir.
    const url = 'otpauth://totp/x?secret=' + SIR_SHA1 + '&digits=8';
    const { options } = totpSirriniCozumle(url, { digits: 6 });
    expect(options.digits).toBe(8);
  });

  it('düz sırda dışarıdan verilen seçenekler geçerli', () => {
    const { options } = totpSirriniCozumle(SIR_SHA1, { algorithm: 'sha512', periodSeconds: 60 });
    expect(options.algorithm).toBe('sha512');
    expect(options.periodSeconds).toBe(60);
  });

  it('bozuk URL sırrın kendisi sayılır, hata atmaz', () => {
    const { secret } = totpSirriniCozumle('otpauth://[bozuk');
    expect(secret).toBe('otpauth://[bozuk');
  });

  it('boşluk, tire ve = dolgusu temizlenir', () => {
    // Authenticator ciktilari bunlari sik iceriyor; hata degil.
    expect(base32Coz('JBSW Y3DP-EHPK3PXP==')).toEqual(base32Coz('JBSWY3DPEHPK3PXP'));
  });

  it('Base32 dışı karakterde TotpHatasi', () => {
    expect(() => base32Coz('bu-bir-sir-degil!')).toThrow(TotpHatasi);
    expect(() => base32Coz('')).toThrow(TotpHatasi);
  });
});

describe('anlık kod kestirmesi', () => {
  it('6 haneli sayı doğrudan kod sayılır', () => {
    // Operator bazen kalici sir yerine anlik kodu yapistiriyor.
    const sonuc = totpKodu('123456');
    expect(sonuc.kod).toBe('123456');
    expect(sonuc.kaynak).toBe('anlikKod');
  });

  it('gerçek sırda kaynak "sir" olur', () => {
    expect(totpKodu(SIR_SHA1, undefined, 59_000).kaynak).toBe('sir');
  });

  it('5 veya 7 hane kestirmeye girmez', () => {
    expect(() => totpKodu('12345')).toThrow(TotpHatasi);
    expect(() => totpKodu('1234567')).toThrow(TotpHatasi);
  });
});

describe('seçenek sınırları', () => {
  it('algoritma adı normalize edilir', () => {
    expect(totpAlgoritmasi('SHA-256')).toBe('sha256');
    expect(totpAlgoritmasi('sha512')).toBe('sha512');
    expect(totpAlgoritmasi('bilinmeyen')).toBe('sha1');
    expect(totpAlgoritmasi(undefined)).toBe('sha1');
  });

  it('hane ve periyot RFC dışı değerlerde sınırlanır', () => {
    const { options } = totpSirriniCozumle(SIR_SHA1, { digits: 99, periodSeconds: 1 });
    expect(options.digits).toBe(10);
    expect(options.periodSeconds).toBe(10);
  });
});

describe('kalanSaniye', () => {
  it('periyot başında tam periyot döner', () => {
    expect(kalanSaniye(30, 0)).toBe(30);
    expect(kalanSaniye(30, 30_000)).toBe(30);
  });

  it('periyot içinde azalır', () => {
    expect(kalanSaniye(30, 1_000)).toBe(29);
    expect(kalanSaniye(30, 29_000)).toBe(1);
  });

  it('60 saniyelik periyotta da doğru', () => {
    expect(kalanSaniye(60, 10_000)).toBe(50);
  });
});

describe('hotpKodu', () => {
  it('RFC 4226 HOTP vektörleri', () => {
    const sir = base32Coz(SIR_SHA1);
    const opts = { algorithm: 'sha1' as const, digits: 6, periodSeconds: 30 };
    expect(hotpKodu(sir, 0, opts)).toBe('755224');
    expect(hotpKodu(sir, 1, opts)).toBe('287082');
    expect(hotpKodu(sir, 9, opts)).toBe('520489');
  });
});

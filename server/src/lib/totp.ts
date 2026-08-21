/**
 * TOTP (RFC 6238) — saf hesap katmani.
 *
 * Bu kod once `lynonAuth.ts` icinde gomuluydu ve sirri DOGRUDAN
 * `lynonCfg()`ten okuyordu. Yani "su anki kod nedir?" sorusu yalnizca
 * calisan kiracinin yapilandirmasi icin yanitlanabiliyordu; Master
 * panelinden bir sitenin sirrini dogrulamanin yolu yoktu -- operator
 * sirri kaydediyor, dogru olup olmadigini ancak bir sonraki gercek
 * girisin dusmesiyle ogreniyordu.
 *
 * Burasi hicbir yapilandirma OKUMAZ: sir ve secenekler disaridan gelir.
 * Boylece hem giris akisi hem de Master panelindeki onizleme AYNI
 * hesabi kullanir. Iki ayri uygulama olsaydi biri dogru kod uretip
 * digeri uretmeyebilirdi ve fark ancak canlida gorunurdu.
 */

import { Buffer } from 'node:buffer';
import { createHmac } from 'node:crypto';

export type TotpSecenekleri = {
  algorithm: 'sha1' | 'sha256' | 'sha512';
  digits: number;
  periodSeconds: number;
};

/**
 * Sir cozulemedi. Cagiran taraf kendi hata tipine cevirir.
 *
 * `kod` alani var cunku lynonAuth iki durumu FARKLI mesajla bildiriyor
 * ve bu mesajlar operatore ne yapacagini soyluyor. Ayrimi hata metnine
 * bakarak yapmak, metni degistiren ilk kisi icin sessiz bir tuzak olurdu.
 */
export type TotpHataKodu = 'gecersizKarakter' | 'bos';

export class TotpHatasi extends Error {
  readonly kod: TotpHataKodu;
  constructor(kod: TotpHataKodu, message: string) {
    super(message);
    this.name = 'TotpHatasi';
    this.kod = kod;
  }
}

export const TOTP_VARSAYILANI: TotpSecenekleri = {
  algorithm: 'sha1',
  digits: 6,
  periodSeconds: 30,
};

export function totpAlgoritmasi(value: unknown): TotpSecenekleri['algorithm'] {
  const normalized = String(value ?? '').trim().toLowerCase().replace('-', '');
  if (normalized === 'sha256') return 'sha256';
  if (normalized === 'sha512') return 'sha512';
  return 'sha1';
}

/** Sinirlar RFC disi degerlerin sessizce gecmesini engelliyor. */
function haneSayisi(value: unknown, varsayilan: number): number {
  return Math.max(4, Math.min(10, Number(value) || varsayilan));
}
function periyot(value: unknown, varsayilan: number): number {
  return Math.max(10, Number(value) || varsayilan);
}

export function secenekleriNormalize(ham: Partial<TotpSecenekleri> | undefined): TotpSecenekleri {
  return {
    algorithm: totpAlgoritmasi(ham?.algorithm ?? TOTP_VARSAYILANI.algorithm),
    digits: haneSayisi(ham?.digits, TOTP_VARSAYILANI.digits),
    periodSeconds: periyot(ham?.periodSeconds, TOTP_VARSAYILANI.periodSeconds),
  };
}

/**
 * Sir bir `otpauth://` URL'i olabilir: authenticator uygulamalari QR
 * kodunu bu bicimde veriyor ve operator cogu zaman tamamini yapistiriyor.
 * URL icindeki algorithm/digits/period, disaridan verilen varsayilani
 * EZER -- sirrin kendi tarifi, panel ayarindan daha guveniliridir.
 */
export function totpSirriniCozumle(
  secret: string,
  varsayilan: Partial<TotpSecenekleri> | undefined = undefined,
): { secret: string; options: TotpSecenekleri } {
  const trimmed = String(secret ?? '').trim();
  const taban = secenekleriNormalize(varsayilan);

  if (!trimmed.toLowerCase().startsWith('otpauth://')) {
    return { secret: trimmed, options: taban };
  }

  try {
    const url = new URL(trimmed);
    return {
      secret: url.searchParams.get('secret') ?? trimmed,
      options: {
        algorithm: totpAlgoritmasi(url.searchParams.get('algorithm') ?? taban.algorithm),
        digits: haneSayisi(url.searchParams.get('digits'), taban.digits),
        periodSeconds: periyot(url.searchParams.get('period'), taban.periodSeconds),
      },
    };
  } catch {
    return { secret: trimmed, options: taban };
  }
}

export function base32Coz(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  // Bosluk, tire ve dolgu '=' karakterleri authenticator ciktilarinda
  // sik gorulur; hata degil, temizlenir.
  const normalized = String(secret ?? '').replace(/[\s-]/g, '').replace(/=+$/g, '').toUpperCase();
  const invalid = Array.from(new Set(normalized.split('').filter((char) => !alphabet.includes(char))));
  if (invalid.length > 0) {
    throw new TotpHatasi('gecersizKarakter', 'Base32 dışı karakter: ' + invalid.join(', '));
  }

  let bits = '';
  const bytes: number[] = [];
  for (const char of normalized) {
    const value = alphabet.indexOf(char);
    if (value === -1) continue;
    bits += value.toString(2).padStart(5, '0');
    while (bits.length >= 8) {
      bytes.push(parseInt(bits.slice(0, 8), 2));
      bits = bits.slice(8);
    }
  }

  if (bytes.length === 0) throw new TotpHatasi('bos', 'Sır boş.');
  return Buffer.from(bytes);
}

export function hotpKodu(secret: Buffer, counter: number, options: TotpSecenekleri): string {
  const buf = Buffer.alloc(8);
  // Sayac 32 biti asabilir (uzak gelecekteki zaman adimlari); ust ve alt
  // kelime ayri yaziliyor.
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  buf.writeUInt32BE(high, 0);
  buf.writeUInt32BE(low, 4);

  const digest = createHmac(options.algorithm, secret).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = (
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  ) % (10 ** options.digits);

  return String(code).padStart(options.digits, '0');
}

/**
 * Sirdan su anki kodu uretir.
 *
 * Sir zaten 6 haneli bir SAYIYSA oldugu gibi doner: operator bazen
 * kalici sir yerine anlik kodu yapistiriyor ve bu, kisa omurlu de olsa
 * gecerli bir giristir.
 */
export function totpKodu(
  secret: string,
  varsayilan: Partial<TotpSecenekleri> | undefined = undefined,
  nowMs: number = Date.now(),
): { kod: string; options: TotpSecenekleri; kaynak: 'anlikKod' | 'sir' } {
  const ham = String(secret ?? '').trim();
  if (/^\d{6}$/.test(ham)) {
    return { kod: ham, options: secenekleriNormalize(varsayilan), kaynak: 'anlikKod' };
  }
  const { secret: cozulen, options } = totpSirriniCozumle(ham, varsayilan);
  const bytes = base32Coz(cozulen);
  const sayac = Math.floor(nowMs / 1000 / options.periodSeconds);
  return { kod: hotpKodu(bytes, sayac, options), options, kaynak: 'sir' };
}

/** Gecerli kodun bitmesine kalan saniye — geri sayim gostergesi icin. */
export function kalanSaniye(periodSeconds: number, nowMs: number = Date.now()): number {
  const p = periyot(periodSeconds, TOTP_VARSAYILANI.periodSeconds);
  return p - Math.floor((nowMs / 1000) % p);
}

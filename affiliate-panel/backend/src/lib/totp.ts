import { createHmac } from 'crypto';

/**
 * TOTP ÜRETİMİ.
 *
 * Backoffice'ler panel kullanıcısında iki adımlı doğrulama zorunlu
 * kılıyor. Bu panel bir BOT olarak giriş yaptığı için kodu kendisi
 * üretmek zorunda: her senkron turunda bir insanın telefonuna bakması
 * beklenemez.
 *
 * Bu, iki adımlı doğrulamanın güvenlik değerini düşürüyor — secret ile
 * parola aynı yerde duruyor. Karşılığında secret şifreli saklanıyor
 * (bkz. `sifre.ts`) ve panelin kendi girişinde ayrı bir doğrulama var.
 * Alternatif, otomatik senkronu tamamen bırakmaktı.
 */

export interface TotpSecenekleri {
  algoritma: 'sha1' | 'sha256' | 'sha512';
  hane: number;
  periyotSaniye: number;
}

export const VARSAYILAN_TOTP: TotpSecenekleri = { algoritma: 'sha1', hane: 6, periyotSaniye: 30 };

function algoritmaNormalle(deger: unknown): TotpSecenekleri['algoritma'] {
  const n = String(deger ?? '').trim().toLowerCase().replace('-', '');
  if (n === 'sha256') return 'sha256';
  if (n === 'sha512') return 'sha512';
  return 'sha1';
}

/** `otpauth://` URI'si de kabul ediliyor; kullanıcı QR'dan kopyalayabilsin. */
export function secretCoz(ham: string): { secret: string; secenekler: TotpSecenekleri } {
  const metin = String(ham ?? '').trim();
  if (!metin.toLowerCase().startsWith('otpauth://')) {
    return { secret: metin, secenekler: { ...VARSAYILAN_TOTP } };
  }
  try {
    const url = new URL(metin);
    return {
      secret: url.searchParams.get('secret') ?? metin,
      secenekler: {
        algoritma: algoritmaNormalle(url.searchParams.get('algorithm')),
        hane: Math.max(4, Math.min(10, Number(url.searchParams.get('digits')) || 6)),
        periyotSaniye: Math.max(10, Number(url.searchParams.get('period')) || 30),
      },
    };
  } catch {
    return { secret: metin, secenekler: { ...VARSAYILAN_TOTP } };
  }
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Coz(secret: string): Buffer {
  const normal = secret.replace(/[\s-]/g, '').replace(/=+$/g, '').toUpperCase();
  const gecersiz = [...new Set([...normal].filter((k) => !BASE32.includes(k)))];
  if (gecersiz.length) {
    throw new Error('TOTP secret geçerli bir Base32 değeri değil (A-Z, 2-7).');
  }
  let bitler = '';
  const baytlar: number[] = [];
  for (const karakter of normal) {
    bitler += BASE32.indexOf(karakter).toString(2).padStart(5, '0');
    while (bitler.length >= 8) {
      baytlar.push(parseInt(bitler.slice(0, 8), 2));
      bitler = bitler.slice(8);
    }
  }
  if (!baytlar.length) throw new Error('TOTP secret boş.');
  return Buffer.from(baytlar);
}

function hotp(secret: Buffer, sayac: number, secenekler: TotpSecenekleri): string {
  const tampon = Buffer.alloc(8);
  tampon.writeUInt32BE(Math.floor(sayac / 0x100000000), 0);
  tampon.writeUInt32BE(sayac >>> 0, 4);

  const ozet = createHmac(secenekler.algoritma, secret).update(tampon).digest();
  const kayma = ozet[ozet.length - 1] & 0x0f;
  const kod = (
    ((ozet[kayma] & 0x7f) << 24) |
    ((ozet[kayma + 1] & 0xff) << 16) |
    ((ozet[kayma + 2] & 0xff) << 8) |
    (ozet[kayma + 3] & 0xff)
  ) % (10 ** secenekler.hane);

  return String(kod).padStart(secenekler.hane, '0');
}

/**
 * Anlık kodu üretir.
 *
 * Değer zaten 6 haneli bir sayıysa olduğu gibi döner: kullanıcı
 * secret'ı veremiyorsa (bazı backoffice'ler göstermiyor) anlık kodu
 * elle yapıştırıp tek seferlik bağlanabilsin.
 *
 * `anMs` dışarıdan verilebiliyor; sunucunun saati kaymışsa karşı
 * tarafın `Date` başlığı kullanılabilir.
 */
export function totpUret(ham: string, anMs: number = Date.now()): string {
  const metin = String(ham ?? '').trim();
  if (/^\d{6}$/.test(metin)) return metin;
  const { secret, secenekler } = secretCoz(metin);
  if (/^\d{6}$/.test(secret)) return secret;
  return hotp(base32Coz(secret), Math.floor(anMs / 1000 / secenekler.periyotSaniye), secenekler);
}

import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * SIRLARIN ŞİFRELENMESİ VE PAROLA ÖZETİ.
 *
 * Panel, bağlandığı backoffice'in kullanıcı adı/parolası ve TOTP
 * secret'ını saklamak zorunda — bot her istekte kendi giriş yapıyor.
 * Bu değerler düz saklanırsa bir veritabanı sızıntısı doğrudan
 * backoffice erişimine dönüşür.
 *
 * ── Anahtar yoksa YAZMAYI REDDEDİYORUZ ──
 *
 * Sessizce düz metne düşmek en kötü seçenek: kurulum çalışıyor
 * görünür, sır düz yazılır ve kimse fark etmez. Kurulum hatası
 * kurulum anında patlamalı.
 */

const ONEK = 'v1.gcm.';

function anahtarUret(): Buffer | null {
  const ham = String(process.env.AFF_SECRET_KEY || '').trim();
  if (!ham) return null;

  if (/^[0-9a-fA-F]{64}$/.test(ham)) return Buffer.from(ham, 'hex');
  const b64 = Buffer.from(ham, 'base64');
  if (b64.length === 32) return b64;
  // Parola cumlesi de kabul: kullanicinin 64 haneli hex uretmek zorunda
  // kalmasi, pratikte anahtari hic ayarlamamasina yol aciyor.
  if (ham.length >= 16) return createHash('sha256').update(ham).digest();
  return null;
}

export function sifrelemeHazirMi(): boolean {
  return anahtarUret() !== null;
}

/** Anahtarın parmak izi; hangi anahtarla şifrelendiğini loglamak için. */
export function anahtarParmakIzi(): string | null {
  const anahtar = anahtarUret();
  return anahtar ? createHash('sha256').update(anahtar).digest('hex').slice(0, 12) : null;
}

export function sifreliMi(deger: unknown): boolean {
  return typeof deger === 'string' && deger.startsWith(ONEK);
}

export function sifrele(duz: string): string {
  if (!duz) return duz;
  if (sifreliMi(duz)) return duz;
  const anahtar = anahtarUret();
  if (!anahtar) {
    throw new Error('AFF_SECRET_KEY tanımlı değil; sır düz metin olarak yazılmayacak.');
  }
  const iv = randomBytes(12);
  const sifreleyici = createCipheriv('aes-256-gcm', anahtar, iv);
  const govde = Buffer.concat([sifreleyici.update(duz, 'utf8'), sifreleyici.final()]);
  const etiket = sifreleyici.getAuthTag();
  return ONEK + Buffer.concat([iv, etiket, govde]).toString('base64');
}

/**
 * Çözer. Anahtar döndürüldüyse ya da kayıt bozulduysa `null` döner,
 * FIRLATMAZ: tek bir çözülemeyen kayıt yüzünden panelin tamamının
 * açılmaması orantısız olurdu. Çağıran "bağlantı yeniden girilmeli"
 * diyebilir.
 */
export function coz(deger: string): string | null {
  if (!sifreliMi(deger)) return deger;
  const anahtar = anahtarUret();
  if (!anahtar) return null;
  try {
    const ham = Buffer.from(deger.slice(ONEK.length), 'base64');
    const iv = ham.subarray(0, 12);
    const etiket = ham.subarray(12, 28);
    const govde = ham.subarray(28);
    const cozucu = createDecipheriv('aes-256-gcm', anahtar, iv);
    cozucu.setAuthTag(etiket);
    return Buffer.concat([cozucu.update(govde), cozucu.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Panelde göstermek için: son 4 hane dışında maskeler. */
export function maskele(deger: string | null | undefined): string {
  const metin = String(deger ?? '');
  if (!metin) return '';
  if (metin.length <= 4) return '•'.repeat(metin.length);
  return '•'.repeat(Math.min(12, metin.length - 4)) + metin.slice(-4);
}

/**
 * PAROLA ÖZETİ — scrypt.
 *
 * Node'un kendi `crypto`'sunda; bcrypt bağımlılığı eklemeye gerek yok.
 * Parametreler OWASP'ın scrypt önerisine yakın tutuldu (N=2^15).
 */
export function parolaOzeti(parola: string): string {
  const tuz = randomBytes(16);
  const ozet = scryptSync(parola, tuz, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$8$1$${tuz.toString('base64')}$${ozet.toString('base64')}`;
}

export function parolaDogrula(parola: string, kayit: string): boolean {
  const parcalar = String(kayit ?? '').split('$');
  if (parcalar.length !== 6 || parcalar[0] !== 'scrypt') return false;
  const [, n, r, p, tuzB64, ozetB64] = parcalar;
  try {
    const beklenen = Buffer.from(ozetB64, 'base64');
    const hesaplanan = scryptSync(parola, Buffer.from(tuzB64, 'base64'), beklenen.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
    });
    // Sabit zamanli karsilastirma: uzunluk esitse baytlari sizdirmayan
    // karsilastirma, degilse dogrudan false.
    return hesaplanan.length === beklenen.length && timingSafeEqual(hesaplanan, beklenen);
  } catch {
    return false;
  }
}

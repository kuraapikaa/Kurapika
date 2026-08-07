import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * TENANT SIRLARI İÇİN ŞİFRELEME KUTUSU.
 *
 * Alt sitelerin Lynon/backoffice kimlik bilgileri master panelden
 * girilebilsin diye artık ortam değişkeni dışında da saklanıyorlar.
 * Bu, `config.ts`'teki "credentials are read only from env" kararını
 * bilerek gevşetiyor; karşılığında sırlar veritabanına DÜZ METİN
 * yazılmıyor.
 *
 * Şifresiz saklama YOK: anahtar tanımlı değilse yazma reddedilir.
 * Sessizce düz metne düşmek, bu değişikliği yapmanın en kötü yolu
 * olurdu — panelde "kaydedildi" yazarken şifreler okunabilir dururdu.
 */

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'v1.gcm.';

/** Anahtar `TENANT_SECRET_KEY`'ten gelir: 64 karakter hex, base64 veya serbest metin. */
function anahtar(): Buffer | null {
  const ham = (process.env.TENANT_SECRET_KEY || '').trim();
  if (!ham) return null;

  if (/^[0-9a-fA-F]{64}$/.test(ham)) return Buffer.from(ham, 'hex');

  const base64 = Buffer.from(ham, 'base64');
  if (base64.length === 32) return base64;

  // Serbest metin parola: sabit türetme. Yeterince uzun olmasını şart
  // koşuyoruz, yoksa "1234" gibi bir değerle şifreleme tiyatroya döner.
  if (ham.length < 16) return null;
  return createHash('sha256').update(ham, 'utf8').digest();
}

export function sifrelemeHazirMi(): boolean {
  return anahtar() !== null;
}

/** Anahtarın parmak izi; panelde "hangi anahtarla şifrelendi" teşhisi için. */
export function anahtarParmakIzi(): string | null {
  const key = anahtar();
  if (!key) return null;
  return createHash('sha256').update(key).digest('hex').slice(0, 12);
}

export function sifrele(dumduz: string): string {
  const key = anahtar();
  if (!key) {
    throw new Error('TENANT_SECRET_KEY tanımlı değil; tenant sırları şifrelenemediği için kaydedilmedi.');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const govde = Buffer.concat([cipher.update(dumduz, 'utf8'), cipher.final()]);
  const etiket = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}.${etiket.toString('base64url')}.${govde.toString('base64url')}`;
}

export function sifreliMi(deger: unknown): deger is string {
  return typeof deger === 'string' && deger.startsWith(PREFIX);
}

/**
 * Çözemezse `null` döner, fırlatmaz.
 *
 * Anahtar döndürüldüğünde eski kayıtlar çözülemez hale gelir; bu durumda
 * tüm paneli 500'le düşürmek yerine o tenant'ın bağlantısı
 * "yapılandırılmamış" sayılır ve master panelde yeniden girilmesi istenir.
 */
export function coz(sifreli: string): string | null {
  const key = anahtar();
  if (!key || !sifreliMi(sifreli)) return null;
  const parcalar = sifreli.slice(PREFIX.length).split('.');
  if (parcalar.length !== 3) return null;
  try {
    const [ivB64, etiketB64, govdeB64] = parcalar;
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(etiketB64, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(govdeB64, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Panele geri dönen değerlerde sırrı gizler; varlığı görünür, içeriği değil. */
export function maskele(deger: string | undefined | null): string {
  const metin = String(deger ?? '');
  if (!metin) return '';
  if (metin.length <= 4) return '••••';
  return `${'•'.repeat(8)}${metin.slice(-2)}`;
}

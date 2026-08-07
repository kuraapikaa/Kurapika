import { createHmac, timingSafeEqual } from 'crypto';

/**
 * LYNON WEBHOOK İMZA DOĞRULAMASI.
 *
 * Bu uç dışarıya açık ve gelen olaylar sonunda paraya dönüşüyor
 * (yatırım, bahis, kazanç → GGR → hakediş). İmza doğrulanmazsa herkes
 * istediği ortağa istediği geliri yazdırabilir.
 *
 * ── HAM GÖVDE ÜZERİNDEN İMZA ──
 *
 * İmza, JSON'un ÇÖZÜLMÜŞ hâlinden değil ham metninden hesaplanıyor.
 * Çözüp yeniden diziye çevirmek anahtar sırasını, boşlukları ve sayı
 * biçimini değiştirir; imza geçerli olsa bile tutmaz. Bu, imza
 * doğrulamalarında en sık yapılan hata.
 *
 * ── ZAMAN DAMGASI NEDEN İMZAYA DAHİL ──
 *
 * Yalnızca gövde imzalansaydı, bir kez yakalanan geçerli istek sonsuza
 * kadar tekrar gönderilebilirdi (replay). Zaman damgası imzalı metnin
 * içinde: saldırgan zamanı değiştirirse imza bozulur, değiştirmezse
 * istek pencere dışında kalıp reddedilir.
 */

/** İmza ve zaman başlıkları. Lynon farklı ad kullanıyorsa yalnızca burası değişir. */
export const IMZA_BASLIGI = 'x-lynon-imza';
export const ZAMAN_BASLIGI = 'x-lynon-zaman';

/**
 * Kabul edilen zaman sapması.
 *
 * Dar tutmak, saatleri birkaç saniye kayan sunucularda geçerli
 * istekleri düşürür; geniş tutmak yakalanan bir isteğin tekrar
 * gönderilebileceği süreyi uzatır. Beş dakika ikisinin arasında
 * yerleşik bir denge.
 */
export const ZAMAN_PENCERESI_SN = 300;

export type ImzaSonucu =
  | { gecerli: true; zaman: number }
  | { gecerli: false; sebep: 'imza-yok' | 'zaman-yok' | 'zaman-disi' | 'imza-tutmadi' | 'sir-yok' };

const metin = (deger: unknown): string => (typeof deger === 'string' ? deger.trim() : '');

/** `sha256=abc...` ya da düz `abc...` kabul ediliyor. */
function imzayiAyikla(ham: string): string {
  const temiz = ham.toLowerCase();
  return temiz.startsWith('sha256=') ? temiz.slice(7) : temiz;
}

export function imzaHesapla(sir: string, zaman: string | number, hamGovde: string): string {
  return createHmac('sha256', sir).update(`${zaman}.${hamGovde}`, 'utf8').digest('hex');
}

export function imzayiDogrula(
  sir: string | null,
  basliklar: Record<string, unknown>,
  hamGovde: string,
  simdi = new Date(),
): ImzaSonucu {
  if (!sir) return { gecerli: false, sebep: 'sir-yok' };

  const sunulan = imzayiAyikla(metin(basliklar[IMZA_BASLIGI]));
  if (!sunulan) return { gecerli: false, sebep: 'imza-yok' };

  const zamanMetni = metin(basliklar[ZAMAN_BASLIGI]);
  const zaman = Number(zamanMetni);
  if (!zamanMetni || !Number.isFinite(zaman)) return { gecerli: false, sebep: 'zaman-yok' };

  const sapma = Math.abs(Math.floor(simdi.getTime() / 1000) - zaman);
  if (sapma > ZAMAN_PENCERESI_SN) return { gecerli: false, sebep: 'zaman-disi' };

  const beklenen = imzaHesapla(sir, zamanMetni, hamGovde);
  const a = Buffer.from(beklenen, 'hex');
  const b = Buffer.from(sunulan, 'hex');
  // Uzunluk farkliysa `timingSafeEqual` firlatiyor; bozuk bir baslik
  // istisnaya degil redde donusmeli.
  if (a.length !== b.length || a.length === 0) return { gecerli: false, sebep: 'imza-tutmadi' };
  if (!timingSafeEqual(a, b)) return { gecerli: false, sebep: 'imza-tutmadi' };

  return { gecerli: true, zaman };
}

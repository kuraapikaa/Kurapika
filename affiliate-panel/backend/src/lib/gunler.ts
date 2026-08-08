/**
 * GÜN ANAHTARLARI — İş günü Türkiye saatiyle.
 *
 * Ölçümler `YYYY-MM-DD` anahtarıyla saklanıyor ve bu anahtar UTC'ye
 * göre üretilirse gün, Türkiye saatiyle 03:00'te başlar. Gece
 * 00:00–03:00 arasındaki bütün trafik bir önceki güne yazılır ve
 * rakamlar backoffice arayüzüyle tutmaz. Bu, ölçülebilir ve
 * kanıtlanabilir bir hata; UTC "yeterince yakın" değil.
 */

export const VARSAYILAN_DILIM = 'Europe/Istanbul';

function dilim(): string {
  return String(process.env.AFF_ZAMAN_DILIMI || VARSAYILAN_DILIM);
}

/** Verilen anın yerel gün anahtarı. */
export function gunAnahtari(an: Date = new Date()): string {
  // `en-CA` bicimi zaten YYYY-MM-DD; elle parcalamaya gerek yok.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: dilim(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(an);
}

export function gunGecerliMi(gun: unknown): boolean {
  return typeof gun === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(gun);
}

/**
 * Bir gün anahtarının (`YYYY-MM-DD`) o günün SONUNU temsil eden anı.
 *
 * Zaman aralığı sorgularında kullanıcı gün seçiyor, an değil:
 * `end=2026-08-07` o günün TAMAMINI kapsamalı. Ham `new Date(end)`
 * gün 00:00'da kesilir ve o günün tüm kayıtları sorgudan düşer.
 *
 * Tıklama ve oyuncu eşleşme depoları aynı mantığı ayrı ayrı yazmak
 * yerine buradan paylaşıyor — ikisi de gün sınırını farklı yorumlarsa
 * "aynı aralık" iki farklı sonuç üretir.
 */
export function bitisGunSonuAni(end: string): Date {
  const son = new Date(end);
  son.setUTCHours(23, 59, 59, 999);
  return son;
}

/**
 * Gün anahtarına gün ekler/çıkarır.
 *
 * Hesap ÖĞLEN UTC üzerinden yapılıyor: gece yarısından hesaplamak,
 * yaz saati geçişlerinde bir günü kaydırabilir. Öğlen, her iki yönde
 * de 12 saatlik pay bırakır.
 */
export function gunEkle(gun: string, fark: number): string {
  if (!gunGecerliMi(gun)) throw new Error(`Geçersiz gün: ${gun}`);
  const [y, a, g] = gun.split('-').map(Number);
  const d = new Date(Date.UTC(y, a - 1, g + fark, 12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** İki gün arasındaki (uçlar dahil) gün listesi; en fazla `sinir` adet. */
export function gunAraligi(baslangic: string, bitis: string, sinir = 366): string[] {
  if (!gunGecerliMi(baslangic) || !gunGecerliMi(bitis)) {
    throw new Error('Geçersiz tarih aralığı.');
  }
  const gunler: string[] = [];
  for (let g = baslangic; g <= bitis && gunler.length < sinir; g = gunEkle(g, 1)) gunler.push(g);
  return gunler;
}

/** Ayın ilk günü; komisyon dönemleri ay bazlı kapanıyor. */
export function ayinIlkGunu(gun: string): string {
  if (!gunGecerliMi(gun)) throw new Error(`Geçersiz gün: ${gun}`);
  return `${gun.slice(0, 7)}-01`;
}

export function ayAnahtari(gun: string): string {
  if (!gunGecerliMi(gun)) throw new Error(`Geçersiz gün: ${gun}`);
  return gun.slice(0, 7);
}

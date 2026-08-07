import pg from 'pg';

/**
 * Her test dosyasına KENDİ veritabanı.
 *
 * Vitest test dosyalarını paralel koşuyor. Aynı veritabanını paylaşan
 * iki dosya, birbirinin tablolarını temizleyerek rastgele düşüyordu --
 * üstelik tek tek koşturulduklarında ikisi de geçtiği için hata
 * testlerde değil, "bazen kırmızı" olarak görünüyordu.
 *
 * Ayrı veritabanı, `beforeEach` temizliğini de dosyanın kendi işi
 * hâline getiriyor; testler paralel kalabiliyor.
 */
export async function testVeritabaniAc(ad: string): Promise<string | null> {
  const url = String(process.env.TEST_DATABASE_URL || '').trim();
  if (!url) return null;

  // Ad koddan geliyor ama tanimlayicilar parametrelenemedigi icin yine
  // de dogrulaniyor; kazara bir sey enjekte edilmesin.
  if (!/^[a-z0-9_]+$/.test(ad)) throw new Error(`Geçersiz test veritabanı adı: ${ad}`);

  const yonetim = new pg.Client({ connectionString: url });
  await yonetim.connect();
  try {
    await yonetim.query(`DROP DATABASE IF EXISTS ${ad}`);
    await yonetim.query(`CREATE DATABASE ${ad}`);
  } finally {
    await yonetim.end();
  }

  return url.replace(/\/[^/?]*(\?|$)/, `/${ad}$1`);
}

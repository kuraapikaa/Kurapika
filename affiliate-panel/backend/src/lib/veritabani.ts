import pg from 'pg';

/**
 * İSTEĞE BAĞLI POSTGRES.
 *
 * `DATABASE_URL` verilirse belgeler Postgres'te, verilmezse diskte
 * JSON dosyası olarak tutuluyor. İkisi arasında seçim yapmayı
 * zorunlu kılmamak bilinçli: panel tek bir konteynerde, kalıcı disk
 * olmadan da ayağa kalkabilmeli (deneme kurulumu), ama üretimde
 * Railway'in yeniden dağıtımı diski sıfırladığı için veritabanı şart.
 *
 * Şema TEK TABLO: `(kiraci, alan, veri jsonb)`. Her servis kendi
 * alanını (namespace) yazıyor. İlişkisel bir şema kurmak, bu
 * boyuttaki bir panelde her alan değişikliğini bir migrasyona
 * bağlardı; belge modeli değişimi ücretsiz kılıyor. Sorgu ihtiyacı
 * doğduğunda `jsonb` indekslenebilir.
 */

let havuz: pg.Pool | null = null;
let hazir = false;

export function veritabaniHazirMi(): boolean {
  return hazir;
}

export async function veritabaniniBaslat(): Promise<boolean> {
  const url = String(process.env.DATABASE_URL || '').trim();
  if (!url) return false;

  havuz = new pg.Pool({
    connectionString: url,
    // Railway/Heroku tipi yonetilen Postgres kendinden imzali sertifika
    // kullaniyor; dogrulamayi acmak baglantiyi kirar.
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX) || 5,
  });

  await havuz.query(`
    CREATE TABLE IF NOT EXISTS aff_belgeler (
      kiraci TEXT NOT NULL,
      alan   TEXT NOT NULL,
      veri   JSONB NOT NULL,
      guncellendi TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (kiraci, alan)
    )
  `);

  hazir = true;
  return true;
}

export async function belgeOku<T>(kiraci: string, alan: string): Promise<T | undefined> {
  if (!havuz) return undefined;
  const sonuc = await havuz.query<{ veri: T }>(
    'SELECT veri FROM aff_belgeler WHERE kiraci = $1 AND alan = $2',
    [kiraci, alan],
  );
  return sonuc.rows.length ? sonuc.rows[0].veri : undefined;
}

export async function belgeYaz(kiraci: string, alan: string, veri: unknown): Promise<void> {
  if (!havuz) throw new Error('Veritabanı hazır değil.');
  await havuz.query(
    `INSERT INTO aff_belgeler (kiraci, alan, veri, guncellendi)
     VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (kiraci, alan) DO UPDATE SET veri = EXCLUDED.veri, guncellendi = now()`,
    [kiraci, alan, JSON.stringify(veri)],
  );
}

/** Kayıtlı tüm kiracı anahtarları; işlerin kimin için çalışacağını belirler. */
export async function kiracilariListele(): Promise<string[]> {
  if (!havuz) return [];
  const sonuc = await havuz.query<{ kiraci: string }>('SELECT DISTINCT kiraci FROM aff_belgeler');
  return sonuc.rows.map((r) => r.kiraci);
}

export async function veritabaniniKapat(): Promise<void> {
  await havuz?.end();
  havuz = null;
  hazir = false;
}

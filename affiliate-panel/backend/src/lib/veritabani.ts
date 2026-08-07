import path from 'path';
import { fileURLToPath } from 'url';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as sema from './sema.js';

/**
 * İSTEĞE BAĞLI POSTGRES.
 *
 * `DATABASE_URL` verilirse belgeler Postgres'te, verilmezse diskte
 * JSON dosyası olarak tutuluyor. İkisi arasında seçim yapmayı
 * zorunlu kılmamak bilinçli: panel tek bir konteynerde, kalıcı disk
 * olmadan da ayağa kalkabilmeli (deneme kurulumu), ama üretimde
 * Railway'in yeniden dağıtımı diski sıfırladığı için veritabanı şart.
 *
 * ── İKİ DEPOLAMA BİÇİMİ BİR ARADA ──
 *
 * `aff_belgeler` (kiraci, alan, veri jsonb): sınırlı boyuttaki her şey.
 * Ortaklar, planlar, medya, kademeler. Belge modeli burada şema
 * değişimini ücretsiz kılıyor ve hiçbir şey kaybettirmiyor.
 *
 * `sema.ts`'teki İLİŞKİSEL TABLOLAR: sınırsız büyüyen ve tarih
 * aralığıyla sorgulanan tıklamalar ve ölçümler.
 *
 * `aff_belgeler` bilerek migrasyon şemasının DIŞINDA. Tablo üretimde
 * çoktan var; migrasyon geçmişi ise boş. Şemaya dahil edilseydi ilk
 * migrasyon "zaten var" diye düşer ve açılışı kilitlerdi. Kendi
 * idempotent DDL'iyle kurulmaya devam ediyor.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Migrasyon dosyaları derlemeye girmiyor, imaja ayrıca kopyalanıyor
 * (bkz. Dockerfile). Yol iki ortamda da aynı yere çıkıyor:
 * `src/lib/../..` → `backend/`, `dist/lib/../..` → `/uygulama`.
 */
const MIGRASYON_DIZINI = path.join(__dirname, '..', '..', 'drizzle');

let havuz: pg.Pool | null = null;
let vt: NodePgDatabase<typeof sema> | null = null;
let hazir = false;

/**
 * Drizzle örneği; veritabanı yoksa `null`.
 *
 * Çağıranın `null` durumunu ele alması ZORUNLU — panel Postgres'siz de
 * çalışabildiği için bu bir istisna değil, normal bir hâl.
 */
export function veritabani(): NodePgDatabase<typeof sema> | null {
  return vt;
}

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

  vt = drizzle(havuz, { schema: sema });
  await migrate(vt, { migrationsFolder: MIGRASYON_DIZINI });

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
  vt = null;
  hazir = false;
}

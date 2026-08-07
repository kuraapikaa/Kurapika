import { rm } from 'fs/promises';
import path from 'path';

/**
 * Test veri dizinini TEK YERDEN temizler.
 *
 * Her test dosyasının kendi `afterAll`'ında silmesi yarış üretiyordu:
 * dosyalar paralel çalışıyor ve biri dizini silerken diğeri hâlâ
 * yazıyor — `ENOTEMPTY`. Temizlik koşuya ait, dosyaya değil.
 */
const DIZIN = path.resolve(process.env.AFF_VERI_DIZINI || '.test-veri');

export async function setup(): Promise<void> {
  await rm(DIZIN, { recursive: true, force: true });
}

export async function teardown(): Promise<void> {
  await rm(DIZIN, { recursive: true, force: true });
}

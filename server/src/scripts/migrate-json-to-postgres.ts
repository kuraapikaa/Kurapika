import dotenv from 'dotenv';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: resolve(__dirname, '..', '..', '..', '.env'), override: true });

const { closeDatabase, getDatabaseDocument, initializeDatabase, isDatabaseReady, putDatabaseDocument } = await import('../lib/database.js');

const dataDir = resolve(__dirname, '..', 'data');
const force = process.argv.includes('--force');
let imported = 0;
let skipped = 0;
let failed = 0;

async function readJson(filePath: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    console.warn(`[migrate-storage] Okunamadı: ${filePath}`, error instanceof Error ? error.message : error);
    failed += 1;
    return undefined;
  }
}

async function importDocument(tenantKey: string, namespace: string, filePath: string): Promise<void> {
  if (!existsSync(filePath)) return;
  const existing = await getDatabaseDocument(tenantKey, namespace);
  if (existing !== undefined && !force) {
    skipped += 1;
    return;
  }
  const payload = await readJson(filePath);
  if (payload === undefined) return;
  await putDatabaseDocument(tenantKey, namespace, payload);
  imported += 1;
  console.log(`[migrate-storage] ${tenantKey}/${namespace} <- ${filePath}`);
}

async function importDirectory(directory: string, namespace: string): Promise<void> {
  const fullPath = join(dataDir, directory);
  if (!existsSync(fullPath)) return;
  const entries = await readdir(fullPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const tenantKey = entry.name.slice(0, -5);
    await importDocument(tenantKey, namespace, join(fullPath, entry.name));
  }
}

await initializeDatabase();
if (!isDatabaseReady()) {
  throw new Error('PostgreSQL bağlantısı kurulamadı. DATABASE_URL değerini kontrol edin.');
}

try {
  await importDocument('_system', 'tenants', join(dataDir, 'tenants.json'));

  const directoryMappings: Array<[string, string]> = [
    ['rules', 'bonus-rules'],
    ['game-settings', 'game-settings'],
    ['wheel-codes', 'wheel-codes'],
    ['wheel-claims', 'wheel-claims'],
    ['prediction-entries', 'prediction-entries'],
    ['prediction-settlements', 'prediction-settlements'],
    ['engagement', 'engagement-claims'],
    ['forms-data', 'forms-data'],
    ['forms-settings', 'forms-settings'],
    ['player-loyalty', 'player-loyalty'],
    ['tournaments', 'tournaments'],
    ['promo-overrides', 'promo-overrides'],
    ['next-day-bonus-runs', 'next-day-bonus-runs'],
  ];

  for (const [directory, namespace] of directoryMappings) {
    await importDirectory(directory, namespace);
  }

  const legacyMappings: Array<[string, string]> = [
    ['game-settings.json', 'game-settings'],
    ['wheel-codes.json', 'wheel-codes'],
    ['forms-data.json', 'forms-data'],
    ['forms-settings.json', 'forms-settings'],
    ['player-loyalty.json', 'player-loyalty'],
    ['tournaments.json', 'tournaments'],
  ];
  for (const [fileName, namespace] of legacyMappings) {
    await importDocument('default', namespace, join(dataDir, fileName));
  }

  console.log(`[migrate-storage] Tamamlandı. imported=${imported} skipped=${skipped} failed=${failed} force=${force}`);
  if (failed > 0) process.exitCode = 1;
} finally {
  await closeDatabase();
}
/**
 * Tenant Sifre Migrasyon Scripti
 *
 * Mevcut tenants.json'daki duz metin (adminPassword) sifreleri
 * bcrypt hash'lerine (adminPasswordHash) donusturur.
 *
 * Kullanim:
 *   npx tsx src/scripts/migrate-tenant-passwords.ts
 *
 * Guvenlik:
 *   - Orijinal dosya .bak olarak yedeklenir
 *   - Duz metin sifre korunur (gecis sureci - adminPassword)
 *   - Zaten hash'lenmis tenant'lar atlanir
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { resolve } from 'path';
import { hash } from 'bcryptjs';

const BCRYPT_ROUNDS = 12;
const TENANTS_PATH = resolve(process.cwd(), 'src', 'data', 'tenants.json');

interface TenantRecord {
  id: string;
  siteName: string;
  adminEmail: string;
  adminPassword?: string;
  adminPasswordHash?: string;
  [key: string]: unknown;
}

async function migrate(): Promise<void> {
  console.log('========================================================');
  console.log('  Tenant Sifre Migrasyon (plaintext -> bcrypt)');
  console.log('========================================================');
  console.log();

  // 1. Dosyayi oku
  if (!existsSync(TENANTS_PATH)) {
    console.error('HATA: tenants.json bulunamadi:', TENANTS_PATH);
    process.exit(1);
  }

  const raw = readFileSync(TENANTS_PATH, 'utf-8');
  let tenants: TenantRecord[];
  try {
    tenants = JSON.parse(raw) as TenantRecord[];
  } catch (err) {
    console.error('HATA: tenants.json parse hatasi:', err);
    process.exit(1);
  }

  if (!Array.isArray(tenants) || tenants.length === 0) {
    console.log('INFO: Tenant bulunamadi. Islem yapilacak bir sey yok.');
    return;
  }

  console.log(`${tenants.length} tenant bulundu.\n`);

  // 2. Yedek al
  const backupPath = `${TENANTS_PATH}.bak.${Date.now()}`;
  copyFileSync(TENANTS_PATH, backupPath);
  console.log(`Yedek alindi: ${backupPath}\n`);

  // 3. Migrate
  let migratedCount = 0;
  let skippedCount = 0;

  for (const tenant of tenants) {
    const label = `[${tenant.siteName}] (${tenant.adminEmail})`;

    // Zaten hash'lenmis mi?
    if (tenant.adminPasswordHash) {
      console.log(`SKIP: ${label} - Zaten hash'lenmis, atlaniyor.`);
      skippedCount++;
      continue;
    }

    // Duz metin sifre var mi?
    if (!tenant.adminPassword) {
      console.warn(`WARN: ${label} - Sifre yok (adminPassword bos), atlaniyor.`);
      skippedCount++;
      continue;
    }

    // Hash'le
    const plaintext = tenant.adminPassword;
    const hashed = await hash(plaintext, BCRYPT_ROUNDS);
    tenant.adminPasswordHash = hashed;

    console.log(`OK:   ${label} - Hash olusturuldu (${BCRYPT_ROUNDS} rounds)`);
    console.log(`      Duz metin: ${plaintext.slice(0, 3)}${'*'.repeat(Math.max(0, plaintext.length - 3))}`);
    console.log(`      Hash:      ${hashed.slice(0, 30)}...`);
    migratedCount++;
  }

  // 4. Kaydet
  if (migratedCount > 0) {
    writeFileSync(TENANTS_PATH, JSON.stringify(tenants, null, 2), 'utf-8');
    console.log(`\n${TENANTS_PATH} guncellendi.`);
  }

  console.log('\n=======================================');
  console.log(`  Migrate edilen: ${migratedCount}`);
  console.log(`  Atlanan:        ${skippedCount}`);
  console.log(`  Toplam:         ${tenants.length}`);
  console.log('=======================================');

  if (migratedCount > 0) {
    console.log('\nONEMLI: adminPassword alanlari gecis surecinde korundu.');
    console.log('Tum kullanicilarin girisi test edildikten sonra');
    console.log('adminPassword alanlarini elle silebilirsiniz.');
    console.log('\nDogrulama sirasi: adminPasswordHash (bcrypt) -> adminPassword (legacy)');
  }
}

migrate().catch((err) => {
  console.error('Migrasyon hatasi:', err);
  process.exit(1);
});

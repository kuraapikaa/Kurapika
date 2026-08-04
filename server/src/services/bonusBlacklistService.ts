import path from 'path';
import { fileURLToPath } from 'url';
import { safeTenantKey } from '../lib/tenant.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';

/**
 * Bonus talebinden men edilen oyuncular.
 *
 * Hesap kilitlemekten (IsLocked) FARKLI: oyuncu siteyi ve bakiyesini
 * normal kullanmaya devam eder, yalnızca bonus/çark/kazı-kazan gibi
 * promosyon taleplerinden dışlanır — kötüye kullanım (çoklu hesap,
 * bonus abuse) tespit edildiğinde hesabı tamamen durdurmadan alınacak
 * en hafif önlem budur.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLACKLIST_DIR = path.join(__dirname, '..', 'data', 'bonus-blacklist');

export type BlacklistKaydi = {
  login: string;
  neden: string | null;
  ekleyen: string;
  eklendi: string;
};

function blacklistPath(tenantKey: string): string {
  return path.join(BLACKLIST_DIR, `${safeTenantKey(tenantKey)}.json`);
}

/** Login karşılaştırmaları Türkçe yerelinde yapılır: "I" ve "İ" ayrımı önemli. */
function normalizeLogin(login: unknown): string {
  return String(login ?? '').trim().toLocaleLowerCase('tr-TR');
}

export async function readBonusBlacklist(tenantKey: string): Promise<BlacklistKaydi[]> {
  const data = await readStoredDocument<BlacklistKaydi[]>({
    tenantKey: safeTenantKey(tenantKey),
    namespace: 'bonus-blacklist',
    filePath: blacklistPath(tenantKey),
    fallback: () => [],
  });
  return Array.isArray(data) ? data : [];
}

async function writeBonusBlacklist(tenantKey: string, kayitlar: BlacklistKaydi[]): Promise<void> {
  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: 'bonus-blacklist', filePath: blacklistPath(tenantKey) },
    kayitlar,
  );
}

export async function bonusBlacklisteEkle(
  tenantKey: string,
  login: string,
  ekleyen: string,
  neden?: string | null,
): Promise<BlacklistKaydi[]> {
  const kayitlar = await readBonusBlacklist(tenantKey);
  const temizLogin = String(login ?? '').trim();
  if (!temizLogin) return kayitlar;
  const filtreli = kayitlar.filter((k) => normalizeLogin(k.login) !== normalizeLogin(temizLogin));
  filtreli.push({
    login: temizLogin,
    neden: neden?.trim() || null,
    ekleyen,
    eklendi: new Date().toISOString(),
  });
  await writeBonusBlacklist(tenantKey, filtreli);
  return filtreli;
}

export async function bonusBlacklistindenCikar(tenantKey: string, login: string): Promise<BlacklistKaydi[]> {
  const kayitlar = await readBonusBlacklist(tenantKey);
  const kalanlar = kayitlar.filter((k) => normalizeLogin(k.login) !== normalizeLogin(login));
  await writeBonusBlacklist(tenantKey, kalanlar);
  return kalanlar;
}

export async function bonusBlacklisteMi(tenantKey: string, login: string): Promise<BlacklistKaydi | null> {
  if (!login) return null;
  const kayitlar = await readBonusBlacklist(tenantKey);
  return kayitlar.find((k) => normalizeLogin(k.login) === normalizeLogin(login)) ?? null;
}

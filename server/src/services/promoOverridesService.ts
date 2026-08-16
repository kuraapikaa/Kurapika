import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OVERRIDES_DIR = join(__dirname, '..', 'data', 'promo-overrides');

function safeTenantKey(tenantKey: string) {
  const k = String(tenantKey || 'default').trim() || 'default';
  return k.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function overridesPathForTenant(tenantKey: string) {
  return join(OVERRIDES_DIR, `${safeTenantKey(tenantKey)}.json`);
}

export type PromoOverride = {
  title?: string;
  image?: string;
  detailHtml?: string;
  /**
   * LOBIDEKI SIRA. Kucuk once gelir; tanimsiz olanlar sirali olanlarin
   * ARDINDAN, katalog sirasini koruyarak dizilir.
   *
   * Gorunum ayarlarinin yaninda duruyor cunku sira da bir gorunum karari:
   * hangi bonusun once cikacagi kampanyanin kendi tanimini degistirmez.
   */
  sortOrder?: number;
};

export type PromoOverridesFile = {
  byExternalId: Record<string, PromoOverride>;
};

const emptyOverrides: PromoOverridesFile = { byExternalId: {} };

export async function getPromoOverrides(tenantKey: string): Promise<PromoOverridesFile> {
  const key = safeTenantKey(tenantKey);
  const json = await readStoredDocument<PromoOverridesFile>({
    tenantKey: key,
    namespace: 'promo-overrides',
    filePath: overridesPathForTenant(key),
    fallback: emptyOverrides,
  });
  return {
    byExternalId: json?.byExternalId && typeof json.byExternalId === 'object' ? json.byExternalId : {},
  };
}

export async function setPromoOverride(tenantKey: string, externalId: number, override: PromoOverride | null): Promise<void> {
  const p = overridesPathForTenant(tenantKey);
  const current = await getPromoOverrides(tenantKey);
  const key = String(externalId);
  const next: PromoOverridesFile = { byExternalId: { ...(current.byExternalId || {}) } };
  if (!override) {
    delete next.byExternalId[key];
  } else {
    next.byExternalId[key] = override;
  }
  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: 'promo-overrides', filePath: p },
    next,
  );
}


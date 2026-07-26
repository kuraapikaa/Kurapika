import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { Tenant } from '../types/betconstruct.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TENANTS_PATH = join(__dirname, '..', 'data', 'tenants.json');

export async function loadTenants(): Promise<Tenant[]> {
  const value = await readStoredDocument<Tenant[]>({
    tenantKey: '_system',
    namespace: 'tenants',
    filePath: TENANTS_PATH,
    fallback: [],
  });
  return Array.isArray(value) ? value : [];
}

export async function saveTenants(tenants: Tenant[]): Promise<void> {
  await writeStoredDocument(
    { tenantKey: '_system', namespace: 'tenants', filePath: TENANTS_PATH },
    tenants,
  );
}
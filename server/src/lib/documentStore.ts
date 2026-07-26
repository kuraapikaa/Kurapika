import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { getDatabaseDocument, isDatabaseReady, putDatabaseDocument } from './database.js';

interface StoredDocumentOptions<T> {
  tenantKey: string;
  namespace: string;
  filePath?: string;
  fallback: T | (() => T | Promise<T>);
}

async function fallbackValue<T>(fallback: T | (() => T | Promise<T>)): Promise<T> {
  return typeof fallback === 'function'
    ? await (fallback as () => T | Promise<T>)()
    : fallback;
}

async function readFileValue<T>(filePath: string | undefined): Promise<T | undefined> {
  if (!filePath) return undefined;
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

async function writeFileAtomic(filePath: string, payload: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf8');
  await rename(tempPath, filePath);
}

export async function readStoredDocument<T>(options: StoredDocumentOptions<T>): Promise<T> {
  if (isDatabaseReady()) {
    const stored = await getDatabaseDocument<T>(options.tenantKey, options.namespace);
    if (stored !== undefined) return stored;

    const imported = (await readFileValue<T>(options.filePath)) ?? await fallbackValue(options.fallback);
    await putDatabaseDocument(options.tenantKey, options.namespace, imported);
    return imported;
  }

  return (await readFileValue<T>(options.filePath)) ?? await fallbackValue(options.fallback);
}

export async function writeStoredDocument<T>(
  options: Omit<StoredDocumentOptions<T>, 'fallback'>,
  payload: T,
): Promise<void> {
  if (isDatabaseReady()) {
    await putDatabaseDocument(options.tenantKey, options.namespace, payload);
    const mirror = ['1', 'true', 'yes', 'on'].includes(String(process.env.JSON_MIRROR_WRITES || '').toLowerCase());
    if (mirror && options.filePath) await writeFileAtomic(options.filePath, payload);
    return;
  }

  if (!options.filePath) throw new Error(`Dosya fallback yolu yok: ${options.tenantKey}/${options.namespace}`);
  await writeFileAtomic(options.filePath, payload);
}
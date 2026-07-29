import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { safeTenantKey } from '../lib/tenant.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';

/**
 * Oyuncu login'i ↔ Telegram kullanıcı kimliği eşlemesi.
 *
 * Bu depo daha önce routes/games.ts içinde özel fonksiyonlardı. Bonus uygunluk
 * kuralı (requiresTelegramMember) da erişmek zorunda olduğu için servise
 * taşındı; rota dosyası artık buradan okuyor.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TELEGRAM_LINKS_DIR = path.join(__dirname, '..', 'data', 'telegram-links');

export type TelegramLink = {
  login: string;
  telegramUserId: number;
  telegramUsername: string | null;
  linkedAt: string;
};

export function ensureTelegramLinkDir(): void {
  fs.mkdirSync(TELEGRAM_LINKS_DIR, { recursive: true });
}

function telegramLinksPath(tenantKey: string): string {
  return path.join(TELEGRAM_LINKS_DIR, `${safeTenantKey(tenantKey)}.json`);
}

/** Login karşılaştırmaları Türkçe yerelinde yapılır: "I" ve "İ" ayrımı önemli. */
function normalizeLogin(login: string): string {
  return String(login ?? '').trim().toLocaleLowerCase('tr-TR');
}

export async function readTelegramLinks(tenantKey: string): Promise<TelegramLink[]> {
  const data = await readStoredDocument<TelegramLink[]>({
    tenantKey: safeTenantKey(tenantKey),
    namespace: 'telegram-links',
    filePath: telegramLinksPath(tenantKey),
    fallback: () => [],
  });
  return Array.isArray(data) ? data : [];
}

export async function writeTelegramLinks(links: TelegramLink[], tenantKey: string): Promise<void> {
  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: 'telegram-links', filePath: telegramLinksPath(tenantKey) },
    links,
  );
}

export async function linkTelegramAccount(
  tenantKey: string,
  login: string,
  telegramUserId: number,
  telegramUsername?: string | null,
): Promise<void> {
  const links = await readTelegramLinks(tenantKey);
  const filtered = links.filter((item) => normalizeLogin(item.login) !== normalizeLogin(login));
  filtered.push({
    login,
    telegramUserId,
    telegramUsername: telegramUsername ?? null,
    linkedAt: new Date().toISOString(),
  });
  await writeTelegramLinks(filtered, tenantKey);
}

export async function getLinkedTelegramUserId(tenantKey: string, login: string): Promise<number | null> {
  const links = await readTelegramLinks(tenantKey);
  const found = links.find((item) => normalizeLogin(item.login) === normalizeLogin(login));
  return found?.telegramUserId ?? null;
}

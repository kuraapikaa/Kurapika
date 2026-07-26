import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = join(__dirname, '..', '.backoffice-auth.json');
const DASHBOARD_AUTH_FILE = join(__dirname, '..', '.dashboard-auth.json');

type AuthData = { token?: string };

function read(): AuthData {
  if (!existsSync(AUTH_FILE)) return {};
  try {
    const raw = readFileSync(AUTH_FILE, 'utf-8');
    return JSON.parse(raw) as AuthData;
  } catch {
    return {};
  }
}

function readDashboard(): { token?: string } {
  if (!existsSync(DASHBOARD_AUTH_FILE)) return {};
  try {
    const raw = readFileSync(DASHBOARD_AUTH_FILE, 'utf-8');
    return JSON.parse(raw) as { token?: string };
  } catch {
    return {};
  }
}

function getEnvBackofficeToken(): string {
  return (
    process.env.BACKOFFICE_AUTH?.trim() ||
    process.env.DASHBOARD_AUTH?.trim() ||
    process.env.AUTH_TOKEN?.trim() ||
    ''
  );
}

function getEnvDashboardToken(): string {
  return (
    process.env.DASHBOARD_AUTH?.trim() ||
    process.env.AUTH_TOKEN?.trim() ||
    process.env.BACKOFFICE_AUTH?.trim() ||
    ''
  );
}

/** Önce .env (DASHBOARD_AUTH / AUTH_TOKEN / BACKOFFICE_AUTH), yoksa .dashboard-auth.json dosyası. */
export function getDashboardToken(): string {
  const fromEnv = getEnvDashboardToken();
  if (fromEnv) return fromEnv;
  return readDashboard().token?.trim() || read().token?.trim() || '';
}

/** Önce .env (BACKOFFICE_AUTH / DASHBOARD_AUTH / AUTH_TOKEN), yoksa .backoffice-auth.json dosyası. */
export function getBackofficeToken(): string {
  const fromEnv = getEnvBackofficeToken();
  if (fromEnv) return fromEnv;
  return read().token?.trim() || '';
}

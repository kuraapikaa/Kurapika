import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tenantConnectionOverride } from './tenantRuntimeConfig.js';

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

/**
 * Tenant'ın master panelden girilmiş token'ı; hepsinden önce gelir.
 *
 * `.env` ve `.backoffice-auth.json` SÜREÇ GENELİNDE tek bir token
 * tutuyor. Çok kiracılı kurulumda bu, ikinci sitenin isteklerini birinci
 * sitenin token'ıyla imzalamak demekti. Tenant'ın kendi kaydı varsa o
 * kazanır; yoksa eski sıra (ENV, sonra dosya) aynen korunur.
 */
function tenantToken(alan: 'authToken' | 'dashboardAuthToken'): string {
  return tenantConnectionOverride()?.backoffice?.[alan]?.trim() || '';
}

/** Önce tenant kaydı, sonra .env (DASHBOARD_AUTH / AUTH_TOKEN / BACKOFFICE_AUTH), sonra .dashboard-auth.json. */
export function getDashboardToken(): string {
  return (
    tenantToken('dashboardAuthToken') ||
    getEnvDashboardToken() ||
    readDashboard().token?.trim() ||
    read().token?.trim() ||
    ''
  );
}

/** Önce tenant kaydı, sonra .env (BACKOFFICE_AUTH / DASHBOARD_AUTH / AUTH_TOKEN), sonra .backoffice-auth.json. */
export function getBackofficeToken(): string {
  return tenantToken('authToken') || getEnvBackofficeToken() || read().token?.trim() || '';
}

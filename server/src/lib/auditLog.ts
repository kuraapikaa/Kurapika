import { appendFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { appendDatabaseAudit, isDatabaseReady, readDatabaseAudit } from './database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_PATH = join(__dirname, '..', '..', 'audit.log');

export type AuditAction =
  | 'login'
  // CRM temas kaydi: kimin hangi oyuncuyla ne zaman temas ettigi denetlenebilir
  // olmali — musteri iletisimi bir islem, sessizce yapilmamali.
  | 'crm_temas'
  | 'logout'
  | 'lead_create'
  | 'lead_update'
  | 'lead_delete'
  | 'message_add'
  | 'agent_create'
  | 'agent_update'
  | 'agent_delete'
  | 'bonus_charge'
  | 'lynon_campaign_assignment'
  | 'lynon_campaign_update'
  | 'bonus_check'
  | 'bonus_charge_as_cash'
  | 'manual_adjustment'
  | 'withdrawal_resolve';

export interface AuditEntry {
  at: string;
  user: string;
  role: string;
  action: AuditAction;
  resource?: string;
  detail?: string;
}

function line(entry: AuditEntry): string {
  return JSON.stringify(entry) + '\n';
}

export function audit(user: string, role: string, action: AuditAction, resource?: string, detail?: string): void {
  const entry: AuditEntry = {
    at: new Date().toISOString(),
    user,
    role,
    action,
    resource,
    detail,
  };

  try {
    appendFileSync(LOG_PATH, line(entry), 'utf-8');
  } catch (error) {
    console.error('[audit] file write failed', error);
  }

  void appendDatabaseAudit({
    actor: user,
    actorRole: role,
    action,
    target: resource,
    metadata: detail ? { detail } : {},
  }).catch((error) => console.error('[audit] database write failed', error));
}

function readAuditFile(limit = 500): AuditEntry[] {
  if (!existsSync(LOG_PATH)) return [];
  try {
    const content = readFileSync(LOG_PATH, 'utf-8');
    const entries = content.trim().split('\n').filter(Boolean).map((raw) => {
      try { return JSON.parse(raw) as AuditEntry; } catch { return null; }
    }).filter((entry): entry is AuditEntry => entry !== null);
    return entries.slice(-limit).reverse();
  } catch {
    return [];
  }
}

export async function readAuditLog(limit = 500): Promise<AuditEntry[]> {
  if (isDatabaseReady()) return await readDatabaseAudit(limit) as AuditEntry[];
  return readAuditFile(limit);
}
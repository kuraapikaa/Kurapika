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
  // Ortak hesabi kimlik dogrulama verisi ve komisyon orani tutuyor; kimin
  // hangi orani degistirdigi denetlenebilir olmali — bu bir odeme karari.
  | 'affiliate_hesap_create'
  | 'affiliate_hesap_update'
  | 'affiliate_hesap_delete'
  // Odeme kaydi para hareketi; kimin hangi donemi odedigi denetlenebilir olmali.
  | 'affiliate_odeme_create'
  | 'affiliate_odeme_update'
  | 'logout'
  | 'lead_create'
  | 'lead_update'
  | 'lead_delete'
  | 'message_add'
  | 'agent_create'
  | 'agent_update'
  | 'agent_delete'
  | 'bonus_charge'
  // Oyuncu bonus taleplerinden men ediliyor/men kaldiriliyor — kim, ne
  // zaman, hangi gerekceyle men etti denetlenebilir olmali.
  | 'bonus_blacklist_ekle'
  | 'bonus_blacklist_cikar'
  | 'lynon_campaign_assignment'
  | 'lynon_campaign_update'
  | 'bonus_check'
  | 'bonus_charge_as_cash'
  | 'manual_adjustment'
  // Oyun odulleri (cark, kazi kazan, Telegram, gorev, skor tahmin)
  // denetime HIC yazilmiyordu; para sizintilarinin cogu o yollardan
  // gecti ve geriye donuk bakilacak tek kayit Lynon tarafiydi.
  | 'oyun_odulu'
  // Trafik kaydinda govde yakalama oyuncu verisini gorunur kiliyor;
  // kimin ne zaman actigi denetlenebilir olmali.
  | 'api_trafik_yakalama'
  | 'api_trafik_temizle'
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
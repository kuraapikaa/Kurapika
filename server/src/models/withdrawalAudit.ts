import { appendFile, readFile } from 'fs/promises';
import { join } from 'path';

export interface AuditRecord {
  timestamp: string;
  action: 'check' | 'execute' | 'auto-check';
  accountId?: number | string;
  promoId?: number;
  payload?: Record<string, unknown>;
  outcome?: unknown;
}

const LOG_PATH = join(process.cwd(), 'agent-tools', 'withdrawal-audit.log');

export async function writeAudit(rec: AuditRecord) {
  const line = JSON.stringify(rec) + '\n';
  try {
    await appendFile(LOG_PATH, line, { encoding: 'utf8' });
  } catch (err) {
    console.error('Audit write failed', err);
  }
}

export interface LastAutoRunResult {
  lastRunAt: string | null;
  payload: {
    message?: string;
    requestsCount?: number;
    uniqueClients?: number;
    checkedClients?: number;
    errors?: string[];
  } | null;
}

/** Son "Otomatik çekim kontrolü tamamlandı" kaydını bulur. */
export async function readLastAutoRun(): Promise<LastAutoRunResult> {
  try {
    const content = await readFile(LOG_PATH, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const rec = JSON.parse(lines[i]) as AuditRecord;
      if (rec.action === 'auto-check' && rec.payload && typeof rec.payload === 'object') {
        const pl = rec.payload as Record<string, unknown>;
        if (pl.message === 'Otomatik çekim kontrolü tamamlandı') {
          return {
            lastRunAt: rec.timestamp,
            payload: {
              message: pl.message as string,
              requestsCount: pl.requestsCount as number,
              uniqueClients: pl.uniqueClients as number,
              checkedClients: pl.checkedClients as number,
              errors: pl.errors as string[] | undefined,
            },
          };
        }
      }
    }
  } catch {
    // file missing or empty
  }
  return { lastRunAt: null, payload: null };
}


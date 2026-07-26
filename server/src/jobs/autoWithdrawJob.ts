import type { Config } from '../config.js';
import { clientBatchDelay } from '../lib/humanDelay.js';
import { getAllPromosNormalized } from '../services/promosService.js';
import {
  evaluateForAccount,
  evaluateWithdrawalRules,
  evaluateRiskAnalysis,
  evaluateWagerSummary,
  evaluateBonusRules,
  getRulesForTenant,
} from '../services/withdrawalEngine.js';
import { buildAccountSnapshotFromClientId } from '../services/accountSnapshotService.js';
import { fetchWithdrawalRequestsToday } from '../services/withdrawalRequestsService.js';
import { getSameIPClientsCount } from '../services/sameIPCheckService.js';
import { writeAudit } from '../models/withdrawalAudit.js';

export interface RunAutoWithdrawOptions {
  config: Config;
  getBackofficeToken: () => string;
}

/** Aynı çalıştırmada aynı clientId için tekrar işlem yapılmasını engeller (çift çekim kontrolü). */
const processedInRun = new Set<number>();

/**
 * Otomatik çekim kontrolü:
 * - Bugünkü çekim taleplerini çeker
 * - Her benzersiz oyuncu için bir kez checklist hesaplar (çift işlem yok)
 * - Hata yönetimi, loglama ve audit yazar
 */
export async function runAutoWithdrawJob(opts: RunAutoWithdrawOptions): Promise<{
  ok: boolean;
  checkedClients: number;
  errors?: string[];
}> {
  const { config, getBackofficeToken } = opts;
  processedInRun.clear();
  const authToken = getBackofficeToken();
  const errors: string[] = [];
  const runId = `run-${Date.now()}`;
  const tenantKey = (process.env.TENANT_KEY || 'default').trim() || 'default';
  const specs = await getRulesForTenant(tenantKey);

  const log = (level: 'info' | 'warn' | 'error', msg: string, meta?: Record<string, unknown>) => {
    const entry = { level, msg, runId, ...meta };
    console.log(`[auto-withdraw][${level}]`, JSON.stringify(entry));
  };

  try {
    if (!authToken?.trim()) {
      log('warn', 'Otomatik çekim atlandı: token yok');
      await writeAudit({
        timestamp: new Date().toISOString(),
        action: 'auto-check',
        payload: { runId, error: 'Auth token missing', message: 'Token yok' },
      });
      return { ok: false, checkedClients: 0, errors: ['Auth token missing'] };
    }

    let promos: Awaited<ReturnType<typeof getAllPromosNormalized>>;
    try {
      promos = await getAllPromosNormalized();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log('error', 'Promos yüklenemedi', { error: msg });
      await writeAudit({
        timestamp: new Date().toISOString(),
        action: 'auto-check',
        payload: { runId, error: msg, stage: 'promos' },
      });
      return { ok: false, checkedClients: 0, errors: [msg] };
    }

    let requests: Awaited<ReturnType<typeof fetchWithdrawalRequestsToday>>;
    try {
      requests = await fetchWithdrawalRequestsToday(config, authToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log('error', 'Çekim talepleri alınamadı', { error: msg });
      await writeAudit({
        timestamp: new Date().toISOString(),
        action: 'auto-check',
        payload: { runId, error: msg, stage: 'fetch-requests' },
      });
      return { ok: false, checkedClients: 0, errors: [msg] };
    }

    const clientIds = [...new Set(requests.map((r) => r.ClientId).filter((id): id is number => typeof id === 'number' && id > 0))];

    if (clientIds.length === 0) {
      log('info', 'Bugün çekim talebi yok', { promosCount: promos.length });
      await writeAudit({
        timestamp: new Date().toISOString(),
        action: 'auto-check',
        payload: { runId, message: 'Bugün çekim talebi yok', promosCount: promos.length },
      });
      return { ok: true, checkedClients: 0 };
    }

    log('info', 'Otomatik çekim kontrolü başladı', { uniqueClients: clientIds.length, requestCount: requests.length });

    let checked = 0;
    for (let i = 0; i < clientIds.length; i++) {
      if (i > 0) await clientBatchDelay();
      const clientId = clientIds[i];

      if (processedInRun.has(clientId)) {
        log('warn', 'Çift işlem engellendi', { clientId });
        continue;
      }
      processedInRun.add(clientId);

      try {
        // Bu çekim talebi adına: çekim verilen tarih = bu talebin tarihi; baz yatırım = o tarihten önceki son yatırım. Tüm kontrol mantığı (çevrim, bonus, wager, kurallar) buna göre.
        const clientRequest = requests.find((r) => r.ClientId === clientId);
        const withdrawalDateLocal =
          clientRequest?.RequestTimeLocal ?? clientRequest?.RequestTime ?? undefined;
        const account = await buildAccountSnapshotFromClientId(clientId, config, authToken, {
          withdrawalDateLocal: withdrawalDateLocal ?? undefined,
        });
        try {
          const ipCheck = await getSameIPClientsCount(clientId, config, authToken);
          account.clientLoginIP = ipCheck.clientLoginIP ?? undefined;
          account.sameIPClientsCount = ipCheck.sameIPClientsCount;
        } catch {
          account.sameIPClientsCount = 0;
        }
        const checklists = await Promise.all(promos.map((p) => evaluateForAccount(account, p, specs)));
        const withdrawalRulesCheck = evaluateWithdrawalRules(account);
        const riskAnalysis = evaluateRiskAnalysis(account);
        const wagerSummary = evaluateWagerSummary(account);
        const bonusRules = evaluateBonusRules(account, specs);
        const withdrawalOk = withdrawalRulesCheck.overallOk;
        const riskOk = riskAnalysis.overallOk;
        const wagerOk = wagerSummary.overallOk;
        const bonusOk = bonusRules.overallOk;
        const overallAllPass =
          checklists.every((c) => c.overallOk) && withdrawalOk && riskOk && wagerOk && bonusOk;
        await writeAudit({
          timestamp: new Date().toISOString(),
          action: 'auto-check',
          payload: {
            runId,
            clientId,
            clientLogin: account.ClientLogin,
            checklistsCount: checklists.length,
            overallAllPass,
            promosOk: checklists.filter((c) => c.overallOk).length,
            promosFail: checklists.filter((c) => !c.overallOk).length,
            withdrawalRulesOk: withdrawalOk,
            riskOk,
            wagerOk,
            bonusRulesOk: bonusOk,
          },
        });
        checked++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`clientId ${clientId}: ${msg}`);
        log('error', 'Oyuncu kontrolü hata', { clientId, error: msg });
        await writeAudit({
          timestamp: new Date().toISOString(),
          action: 'auto-check',
          payload: { runId, clientId, error: msg },
        });
      }
    }

    await writeAudit({
      timestamp: new Date().toISOString(),
      action: 'auto-check',
      payload: {
        runId,
        message: 'Otomatik çekim kontrolü tamamlandı',
        requestsCount: requests.length,
        uniqueClients: clientIds.length,
        checkedClients: checked,
        errors: errors.length ? errors : undefined,
      },
    });

    log('info', 'Otomatik çekim kontrolü tamamlandı', {
      checkedClients: checked,
      uniqueClients: clientIds.length,
      errorCount: errors.length,
    });

    return { ok: errors.length === 0, checkedClients: checked, errors: errors.length ? errors : undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('error', 'Otomatik çekim job hatası', { error: msg });
    await writeAudit({
      timestamp: new Date().toISOString(),
      action: 'auto-check',
      payload: { runId, error: msg },
    });
    return { ok: false, checkedClients: 0, errors: [msg] };
  }
}

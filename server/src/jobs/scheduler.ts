import { config } from '../config.js';
import { getBackofficeToken } from '../lib/authStore.js';

interface ScheduledJob {
  name: string;
  intervalMs: number;
  handler: () => Promise<void>;
  timer?: ReturnType<typeof setInterval>;
  isRunning: boolean;
  lastRunAt: string | null;
  lastResult: 'success' | 'error' | null;
  lastError: string | null;
  runCount: number;
}

/**
 * Background Job Scheduler
 * - Job'ları izole eder: bir job hata verse diğerleri çalışmaya devam eder
 * - Eş zamanlı çalışmayı engeller (aynı job paralel çalışmaz)
 * - Health check için durum bilgisi sunar
 */
class JobScheduler {
  private jobs = new Map<string, ScheduledJob>();
  private started = false;

  /**
   * Yeni bir background job kaydet.
   * Scheduler başlatıldığında otomatik çalışmaya başlar.
   */
  register(name: string, intervalMs: number, handler: () => Promise<void>): void {
    if (this.jobs.has(name)) {
      console.warn(`[scheduler] Job zaten kayıtlı: ${name}`);
      return;
    }

    const job: ScheduledJob = {
      name,
      intervalMs,
      handler,
      isRunning: false,
      lastRunAt: null,
      lastResult: null,
      lastError: null,
      runCount: 0,
    };

    this.jobs.set(name, job);
    console.log(`[scheduler] Job kaydedildi: ${name} (her ${intervalMs / 1000}s)`);

    // Scheduler zaten başladıysa hemen schedule et
    if (this.started) {
      this.scheduleJob(job);
    }
  }

  /**
   * Tüm kayıtlı job'ları başlat.
   * Her job ilk çalışmasını startDelayMs sonra yapar.
   */
  start(startDelayMs: number = 10000): void {
    if (this.started) {
      console.warn('[scheduler] Zaten çalışıyor');
      return;
    }

    this.started = true;
    console.log(`[scheduler] ${this.jobs.size} job başlatılıyor (ilk çalışma ${startDelayMs / 1000}s sonra)...`);

    for (const job of this.jobs.values()) {
      this.scheduleJob(job, startDelayMs);
    }
  }

  /**
   * Tüm job'ları durdur.
   */
  stop(): void {
    for (const job of this.jobs.values()) {
      if (job.timer) {
        clearInterval(job.timer);
        job.timer = undefined;
      }
    }
    this.started = false;
    console.log('[scheduler] Tüm job\'lar durduruldu');
  }

  /**
   * Health check için tüm job durumlarını döndür.
   */
  getStatus(): Record<string, {
    intervalMs: number;
    isRunning: boolean;
    lastRunAt: string | null;
    lastResult: string | null;
    lastError: string | null;
    runCount: number;
  }> {
    const result: Record<string, any> = {};
    for (const [name, job] of this.jobs) {
      result[name] = {
        intervalMs: job.intervalMs,
        isRunning: job.isRunning,
        lastRunAt: job.lastRunAt,
        lastResult: job.lastResult,
        lastError: job.lastError,
        runCount: job.runCount,
      };
    }
    return result;
  }

  private scheduleJob(job: ScheduledJob, initialDelay?: number): void {
    const runSafe = async () => {
      // Eş zamanlı çalışmayı engelle
      if (job.isRunning) {
        console.log(`[scheduler] ${job.name}: önceki çalışma henüz bitmedi, atlanıyor`);
        return;
      }

      job.isRunning = true;
      const startTime = Date.now();

      try {
        await job.handler();
        job.lastResult = 'success';
        job.lastError = null;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        job.lastResult = 'error';
        job.lastError = msg;
        console.error(`[scheduler] ${job.name} HATA:`, msg);
      } finally {
        job.isRunning = false;
        job.lastRunAt = new Date().toISOString();
        job.runCount++;
        const elapsed = Date.now() - startTime;
        console.log(`[scheduler] ${job.name}: ${job.lastResult} (${elapsed}ms)`);
      }
    };

    // İlk çalışma
    setTimeout(runSafe, initialDelay ?? 10000);

    // Periyodik çalışma
    job.timer = setInterval(runSafe, job.intervalMs);
  }
}

// Singleton instance
export const scheduler = new JobScheduler();

/**
 * Otomatik çekim job'unu scheduler'a kaydet.
 * Eski autoWithdrawJob.ts'i wrapper olarak kullanır.
 */
export async function registerAutoWithdrawJob(): Promise<void> {
  const intervalMs = config.autoWithdrawIntervalMs ?? 0;
  const backofficeToken = getBackofficeToken();

  if (intervalMs <= 0) {
    console.log('[scheduler] Otomatik çekim kontrolü kapalı (AUTO_WITHDRAW_INTERVAL_MS=0)');
    return;
  }

  if (!backofficeToken) {
    console.warn('[scheduler] Backoffice token yok; otomatik çekim kontrolü atlandı.');
    return;
  }

  const { runAutoWithdrawJob } = await import('../jobs/autoWithdrawJob.js');

  scheduler.register('auto-withdraw', intervalMs, async () => {
    const result = await runAutoWithdrawJob({ config, getBackofficeToken });
    if (result.checkedClients > 0 || (result.errors && result.errors.length > 0)) {
      console.log(`[auto-withdraw] Kontrol tamamlandı: ${result.checkedClients} oyuncu${result.errors?.length ? `, ${result.errors.length} hata` : ''}`);
    }
  });
}

/** Türkiye saatiyle 00:15 başlayan, idempotent ertesi gün bonus otomasyonu. */
export async function registerNextDayBonusJob(): Promise<void> {
  if (!config.lynon.enabled) {
    console.log('[scheduler] Ertesi gün bonusu Lynon kapalı olduğu için atlandı.');
    return;
  }
  const { runNextDayBonusJob } = await import('./nextDayBonusJob.js');
  scheduler.register('next-day-bonus-0015', 60_000, async () => {
    const result = await runNextDayBonusJob();
    if (!result.skipped) {
      console.log(`[next-day-bonus] ${result.dateKey}: ${result.players} oyuncu, ${result.granted} ekleme, ${result.errors} hata`);
    }
  });
}
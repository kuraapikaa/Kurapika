import { config } from '../config.js';
import { getBackofficeToken } from '../lib/authStore.js';
import { herTenantIcin } from '../lib/tenantFanout.js';

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
    await herTenantIcin('auto-withdraw', async (tenantKey) => {
      const result = await runAutoWithdrawJob({ config, getBackofficeToken });
      if (result.checkedClients > 0 || (result.errors && result.errors.length > 0)) {
        console.log(`[auto-withdraw] ${tenantKey}: ${result.checkedClients} oyuncu${result.errors?.length ? `, ${result.errors.length} hata` : ''}`);
      }
    });
  });
}

/**
 * Ertesi gün bonus otomasyonu — her aktif site için.
 *
 * Lynon kapalı olsa bile KAYDEDİLİR: `enabled` artık tenant başına bir
 * ayar ve süreç açılışındaki tek bir ENV değerine bakıp işi hiç
 * kaydetmemek, Lynon'u açık olan alt sitelerin bonusunu sessizce
 * öldürüyordu. Hangi sitenin çalışacağına işin kendisi karar verir.
 */
export async function registerNextDayBonusJob(): Promise<void> {
  const { runNextDayBonusJob } = await import('./nextDayBonusJob.js');
  scheduler.register('next-day-bonus', 60_000, async () => {
    await herTenantIcin('next-day-bonus', async (tenantKey) => {
      const result = await runNextDayBonusJob(tenantKey);
      if (!result.skipped) {
        console.log(`[next-day-bonus] ${tenantKey} ${result.dateKey}: ${result.players} oyuncu, ${result.granted} ekleme, ${result.errors} hata`);
      }
    });
  });
}

/**
 * Hedef bakiyeye ulaşan Telegram FS oyuncusunun bahis yetkisini kapatır.
 *
 * Gerçek oyuncuyu etkileyen bir iş; kapsamı hedef kampanyanın son
 * birkaç günkü alıcılarıyla sınırlı ve `HEDEF_BAKIYE_KURU=1` ile
 * yazmadan izlenebilir.
 */
export async function registerHedefBakiyeJob(): Promise<void> {
  if (!config.lynon.enabled) {
    console.log('[scheduler] Hedef bakiye kilidi Lynon kapalı olduğu için atlandı.');
    return;
  }
  if (!config.hedefBakiye.aktif) {
    console.log('[scheduler] Hedef bakiye kilidi kapalı (HEDEF_BAKIYE_KILIDI=0).');
    return;
  }
  const { runHedefBakiyeJob } = await import('./hedefBakiyeJob.js');
  scheduler.register('hedef-bakiye-kilidi', config.hedefBakiye.aralikMs, async () => {
    await herTenantIcin('hedef-bakiye', async (tenantKey) => {
      const sonuc = await runHedefBakiyeJob();
      if (sonuc.kapatilan > 0 || sonuc.hata > 0) {
        console.log(`[hedef-bakiye] ${tenantKey}: ${sonuc.kontrol} kontrol, ${sonuc.kapatilan} kapatıldı, ${sonuc.hata} hata`);
      }
    });
  });
}

/**
 * Otomatik oyuncu kategorileme (saatte bir).
 *
 * Yazma varsayılan olarak KAPALI: kategori yazma ucu henüz
 * gözlemlenmedi. `OTOMATIK_KATEGORI=1` ile açılır; kapalıyken de
 * öneriler üretilip panelde görünür.
 */
export async function registerOtomatikKategoriJob(): Promise<void> {
  if (!config.lynon.enabled) {
    console.log('[scheduler] Otomatik kategorileme Lynon kapalı olduğu için atlandı.');
    return;
  }
  const { runOtomatikKategoriJob, yazmaAcikMi } = await import('./otomatikKategoriJob.js');
  if (!yazmaAcikMi()) {
    console.log('[scheduler] Otomatik kategorileme yazması kapalı (OTOMATIK_KATEGORI=1 ile açılır).');
    return;
  }
  scheduler.register('otomatik-kategori', 60 * 60 * 1000, async () => {
    await herTenantIcin('otomatik-kategori', async (tenantKey) => {
      const sonuc = await runOtomatikKategoriJob();
      if (sonuc.uygulanan > 0 || sonuc.hata > 0) {
        console.log(`[otomatik-kategori] ${tenantKey}: ${sonuc.uygulanan} uygulandı, ${sonuc.hata} hata (${sonuc.oneri} öneri)`);
      }
    });
  });
}

/**
 * Anlık rapor Telegram botu: kasa özeti, yatırım, çekim, düzeltme, bonus.
 *
 * Sohbet kimliği tanımlı değilse kaydedilmez — varsayılan bir sohbete
 * kasa raporu göndermek en kötü türden hata olurdu.
 *
 * TENANT'A YAYILMIYOR. Sohbet kimlikleri ortam değişkeninde, yani süreç
 * genelinde TEK. Bu işi her site için çalıştırmak aynı Telegram grubuna
 * her turda N ayrı sitenin kasa raporunu, hangisinin hangisi olduğu
 * belirsiz halde düşürürdü. Alt siteler için Telegram akışı ancak sohbet
 * kimlikleri de tenant kaydına taşındığında açılmalı; aynısı mutabakat ve
 * anlık bakiye botu için de geçerli.
 */
export async function registerTelegramRaporJob(): Promise<void> {
  if (!config.lynon.enabled) {
    console.log('[scheduler] Telegram rapor botu Lynon kapalı olduğu için atlandı.');
    return;
  }
  if (!config.telegram.botToken || !config.telegram.raporChatId) {
    console.log('[scheduler] Telegram rapor botu kapalı (TELEGRAM_RAPOR_CHAT_ID tanımlı değil).');
    return;
  }
  const { runTelegramRaporJob } = await import('./telegramRaporJob.js');
  scheduler.register('telegram-rapor', config.telegram.raporAralikMs, async () => {
    const sonuc = await runTelegramRaporJob();
    if (sonuc.gonderilen > 0 || sonuc.hata > 0) {
      console.log(`[telegram-rapor] ${sonuc.gonderilen} mesaj, ${sonuc.hata} hata`);
    }
  });
}

/**
 * Aylık mutabakat: her gün Türkiye saatiyle 00:00'da tek sohbete.
 *
 * İş dakikada bir uyanıp saate bakar; gönderilen gün kaydedilir, böylece
 * süreç yeniden başlasa da aynı gün ikinci kez gitmez.
 */
export async function registerMutabakatJob(): Promise<void> {
  if (!config.lynon.enabled) {
    console.log('[scheduler] Mutabakat Lynon kapalı olduğu için atlandı.');
    return;
  }
  if (!config.telegram.botToken || !config.telegram.mutabakatChatId) {
    console.log('[scheduler] Mutabakat kapalı (TELEGRAM_CHAT_MUTABAKAT tanımlı değil).');
    return;
  }
  const { runMutabakatJob } = await import('./mutabakatJob.js');
  scheduler.register('aylik-mutabakat', 60_000, async () => {
    const sonuc = await runMutabakatJob();
    if (sonuc.gonderildi) console.log(`[mutabakat] ${sonuc.gun} mutabakatı gönderildi.`);
  });
}

/**
 * Anlık oyuncu bakiye botu: her ~7.5 dakikada bir toplam gerçek/bonus/
 * toplam oyuncu bakiyesini (rapor 1843) tek bir Telegram sohbetine atar.
 *
 * Diğer akış sohbetlerinin aksine `raporChatId`'ye DÜŞMEZ — bu kadar sık
 * (7.5 dakikada bir) gelen bir mesajı genel sohbete karıştırmak istenmeyen
 * bir gürültü olurdu; yalnızca `TELEGRAM_CHAT_BAKIYE` tanımlıysa çalışır.
 */
export async function registerOyuncuBakiyeJob(): Promise<void> {
  if (!config.lynon.enabled) {
    console.log('[scheduler] Anlık oyuncu bakiye botu Lynon kapalı olduğu için atlandı.');
    return;
  }
  if (!config.telegram.botToken || !config.telegram.bakiyeOzetiChatId) {
    console.log('[scheduler] Anlık oyuncu bakiye botu kapalı (TELEGRAM_CHAT_BAKIYE tanımlı değil).');
    return;
  }
  const { runOyuncuBakiyeJob } = await import('./oyuncuBakiyeJob.js');
  // Dakikada bir uyanip aralik dolup dolmadigina bakar — mutabakat/kasa
  // ozeti ile ayni desen (`ozetZamaniMi`).
  scheduler.register('oyuncu-bakiyesi', 60_000, async () => {
    const sonuc = await runOyuncuBakiyeJob();
    if (sonuc.gonderildi) console.log('[oyuncu-bakiyesi] Gönderildi.');
  });
}

/** Ard arda giriş yapmayan sadakat oyuncuları için 2. gün SMS, 3. gün puan silme kontrolü (her 6 saatte bir). */
export async function registerLoyaltyRetentionJob(): Promise<void> {
  const { runLoyaltyRetentionSweep } = await import('./loyaltyRetentionJob.js');
  scheduler.register('loyalty-retention', 6 * 60 * 60 * 1000, async () => {
    await herTenantIcin('loyalty-retention', async (tenantKey) => {
      const result = await runLoyaltyRetentionSweep(tenantKey);
      if (result.reminded > 0 || result.reset > 0 || result.errors > 0) {
        console.log(`[loyalty-retention] ${tenantKey}: SMS ${result.reminded}, puan silme ${result.reset}, hata ${result.errors}`);
      }
    });
  });
}
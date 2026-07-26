/**
 * Config Hot-Reload
 *
 * rules.json ve tenants.json değişikliklerini dosya sistemi
 * watch ile otomatik algılar ve sunucu restart'ı olmadan yeniler.
 */
import { watch, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { createLogger } from './logger.js';

const log = createLogger('configWatcher');

type ReloadCallback = (filename: string, data: unknown) => void;

interface WatchedFile {
  path: string;
  label: string;
  lastModified: number;
  debounceTimer: ReturnType<typeof setTimeout> | null;
}

const watchedFiles = new Map<string, WatchedFile>();
const DEBOUNCE_MS = 500; // Aynı dosya için ardışık değişiklikleri birleştir

/**
 * Bir JSON dosyasını izlemeye alır.
 * Dosya değiştiğinde callback çağrılır.
 *
 * @example
 * ```ts
 * watchConfigFile('src/data/rules.json', 'rules', (filename, data) => {
 *   refreshRules(); // rules cache'ini güncelle
 * });
 * ```
 */
export function watchConfigFile(relativePath: string, label: string, callback: ReloadCallback): void {
  const fullPath = resolve(process.cwd(), relativePath);

  if (!existsSync(fullPath)) {
    log.warn(`Dosya bulunamadı, izleme atlanıyor: ${fullPath}`, { label });
    return;
  }

  const entry: WatchedFile = {
    path: fullPath,
    label,
    lastModified: Date.now(),
    debounceTimer: null,
  };
  watchedFiles.set(fullPath, entry);

  try {
    watch(fullPath, (eventType) => {
      if (eventType !== 'change') return;

      // Debounce: editörler dosyayı birden fazla kez yazabilir
      if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
      entry.debounceTimer = setTimeout(() => {
        try {
          if (!existsSync(fullPath)) return;
          const raw = readFileSync(fullPath, 'utf-8');
          const data = JSON.parse(raw);
          entry.lastModified = Date.now();

          log.info(`Dosya değişti, yeniden yüklendi`, {
            label,
            path: fullPath,
            size: raw.length,
          });

          callback(label, data);
        } catch (err) {
          log.error(`Dosya yeniden yüklenirken hata`, {
            label,
            path: fullPath,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }, DEBOUNCE_MS);
    });

    log.info(`Dosya izlemeye alındı`, { label, path: fullPath });
  } catch (err) {
    log.error(`Dosya izleme başlatılamadı`, {
      label,
      path: fullPath,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** İzlenen dosyaların durumunu döndür (health check için). */
export function getWatcherStatus(): Record<string, { path: string; lastModified: string }> {
  const result: Record<string, { path: string; lastModified: string }> = {};
  for (const [, entry] of watchedFiles) {
    result[entry.label] = {
      path: entry.path,
      lastModified: new Date(entry.lastModified).toISOString(),
    };
  }
  return result;
}

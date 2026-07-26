import { createClient, type RedisClientType } from 'redis';

let client: RedisClientType | null = null;
let initialized = false;
let lastError: string | null = null;

function flag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

export function isRedisConfigured(): boolean {
  return Boolean(String(process.env.REDIS_URL || '').trim());
}

export function isRedisReady(): boolean {
  return Boolean(initialized && client?.isReady);
}

export async function initializeRedis(): Promise<void> {
  if (initialized) return;
  const url = String(process.env.REDIS_URL || '').trim();
  const required = flag('REDIS_REQUIRED', process.env.NODE_ENV === 'production');

  if (!url) {
    if (required) throw new Error('REDIS_URL production ortamında zorunludur.');
    console.warn('[redis] REDIS_URL yok; development memory session/cache kullanılacak.');
    initialized = true;
    return;
  }

  const redis = createClient({
    url,
    socket: {
      connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 10_000,
      reconnectStrategy: (retries) => Math.min(250 * 2 ** retries, 10_000),
    },
  });
  redis.on('error', (error) => {
    lastError = error.message;
    console.error('[redis] connection error:', error.message);
  });

  try {
    await redis.connect();
    await redis.ping();
    client = redis as RedisClientType;
    initialized = true;
    lastError = null;
    console.log('[redis] Session ve ortak cache bağlantısı hazır.');
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    await redis.disconnect().catch(() => undefined);
    if (required) throw error;
    initialized = true;
    console.warn(`[redis] Bağlantı kurulamadı; development memory fallback aktif: ${lastError}`);
  }
}

function cacheKey(key: string): string {
  const prefix = String(process.env.REDIS_KEY_PREFIX || 'bugs-panel').replace(/:+$/, '');
  return `${prefix}:cache:${key}`;
}

export async function getCachedJson<T>(key: string): Promise<T | undefined> {
  if (!isRedisReady() || !client) return undefined;
  const raw = await client.get(cacheKey(key));
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    await client.del(cacheKey(key));
    return undefined;
  }
}

export async function setCachedJson(key: string, value: unknown, ttlMs: number): Promise<void> {
  if (!isRedisReady() || !client) return;
  await client.set(cacheKey(key), JSON.stringify(value), { PX: Math.max(1000, ttlMs) });
}

export function createRedisSessionStore(ttlMs: number) {
  if (!isRedisReady() || !client) return undefined;
  const redis = client;
  const prefix = `${String(process.env.REDIS_KEY_PREFIX || 'bugs-panel').replace(/:+$/, '')}:session:`;

  return {
    set(sessionId: string, session: unknown, callback: (error?: Error | null) => void) {
      redis.set(`${prefix}${sessionId}`, JSON.stringify(session), { PX: ttlMs })
        .then(() => callback(null))
        .catch((error) => callback(error instanceof Error ? error : new Error(String(error))));
    },
    get(sessionId: string, callback: (error: Error | null, session?: unknown | null) => void) {
      redis.get(`${prefix}${sessionId}`)
        .then((raw) => {
          if (!raw) return callback(null, null);
          try {
            callback(null, JSON.parse(raw));
          } catch (error) {
            callback(error instanceof Error ? error : new Error(String(error)));
          }
        })
        .catch((error) => callback(error instanceof Error ? error : new Error(String(error))));
    },
    destroy(sessionId: string, callback: (error?: Error | null) => void) {
      redis.del(`${prefix}${sessionId}`)
        .then(() => callback(null))
        .catch((error) => callback(error instanceof Error ? error : new Error(String(error))));
    },
  };
}

export function getRedisStatus() {
  return {
    configured: isRedisConfigured(),
    ready: isRedisReady(),
    driver: 'redis',
    lastError,
  };
}

export async function closeRedis(): Promise<void> {
  const current = client;
  client = null;
  initialized = false;
  if (current?.isOpen) await current.quit();
}
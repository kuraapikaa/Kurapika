/**
 * HTTP İstemcisi — Retry + Circuit Breaker
 *
 * BetConstruct API çağrılarında:
 * - Otomatik retry (exponential backoff) — 429, 502, 503, 504 hatalarında
 * - Circuit breaker — ardışık hatalardan sonra kısa devre açar
 * - Merkezi timeout yönetimi
 * - Standart header enjeksiyonu
 */

// ─── Sabitler ────────────────────────────────────────────────────────────────

export const DASHBOARD_HEADERS: Record<string, string> = {
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://backoffice.betconstruct.com',
  Referer: 'https://backoffice.betconstruct.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
};

export const BACKOFFICE_HEADERS: Record<string, string> = {
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://backoffice.betconstruct.com',
  Referer: 'https://backoffice.betconstruct.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
};

export const UNAUTHORIZED_HINT =
  " Token süresi dolmuş olabilir; BetConstruct'ta yeniden giriş yapıp F12 → Network → \"authentication\" header değerini .env AUTH_TOKEN olarak güncelleyin.";

export const FORBIDDEN_HINT =
  " Bu endpoint için backoffice hesabınızda yetki olmayabilir; farklı bir token veya yetkili kullanici ile deneyin.";

export function backofficeHeaders(authToken: string): Record<string, string> {
  return {
    ...BACKOFFICE_HEADERS,
    authentication: authToken.trim(),
    'Content-Type': 'application/json;charset=UTF-8',
  };
}

export function dashboardHeaders(authToken: string): Record<string, string> {
  return {
    ...DASHBOARD_HEADERS,
    authentication: authToken.trim(),
    'Content-Type': 'application/json',
  };
}

/** Boş veya geçersiz JSON yanıtta exception atmamak için önce text al, sonra parse et. */
export async function parseResponseJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { AlertMessage: 'Harici API geçersiz JSON döndü.', Message: text.slice(0, 200) };
  }
}

// ─── Circuit Breaker ─────────────────────────────────────────────────────────

interface CircuitState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const circuits = new Map<string, CircuitState>();

const CIRCUIT_THRESHOLD = 5;       // Ardışık 5 hatadan sonra devre açılır
const CIRCUIT_RESET_MS = 30_000;   // 30 saniye sonra half-open dene
const CIRCUIT_HALF_OPEN_MAX = 1;   // Half-open'da max 1 istek dene

function getCircuit(key: string): CircuitState {
  if (!circuits.has(key)) {
    circuits.set(key, { failures: 0, lastFailure: 0, state: 'closed' });
  }
  return circuits.get(key)!;
}

function recordSuccess(key: string): void {
  const c = getCircuit(key);
  c.failures = 0;
  c.state = 'closed';
}

function recordFailure(key: string): void {
  const c = getCircuit(key);
  c.failures++;
  c.lastFailure = Date.now();
  if (c.failures >= CIRCUIT_THRESHOLD) {
    c.state = 'open';
    console.warn(`[circuit-breaker] ${key}: Devre AÇILDI (${c.failures} ardışık hata)`);
  }
}

function canRequest(key: string): boolean {
  const c = getCircuit(key);
  if (c.state === 'closed') return true;
  if (c.state === 'open') {
    if (Date.now() - c.lastFailure > CIRCUIT_RESET_MS) {
      c.state = 'half-open';
      console.log(`[circuit-breaker] ${key}: Half-open deneme`);
      return true;
    }
    return false;
  }
  // half-open
  return true;
}

/** Circuit breaker durumlarını döndür (health check için). */
export function getCircuitBreakerStatus(): Record<string, { state: string; failures: number; lastFailure: string | null }> {
  const result: Record<string, { state: string; failures: number; lastFailure: string | null }> = {};
  for (const [key, c] of circuits) {
    result[key] = {
      state: c.state,
      failures: c.failures,
      lastFailure: c.lastFailure ? new Date(c.lastFailure).toISOString() : null,
    };
  }
  return result;
}

// ─── Retry Logic ─────────────────────────────────────────────────────────────

/** Retry yapılacak HTTP status kodları. */
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Ana HTTP İstemci ────────────────────────────────────────────────────────

export interface HttpClientOptions {
  /** İstek tipi. */
  method?: 'GET' | 'POST';
  /** İstek gövdesi (POST). */
  body?: Record<string, unknown> | string;
  /** Özel header'lar. */
  headers?: Record<string, string>;
  /** Timeout (ms). Varsayılan: 15000. */
  timeoutMs?: number;
  /** Max retry denemesi. Varsayılan: 2. */
  maxRetries?: number;
  /** Circuit breaker anahtarı (domain bazlı). Boş = devre dışı. */
  circuitKey?: string;
  /** İlk retry bekleme süresi (ms). Varsayılan: 1000. */
  initialRetryDelayMs?: number;
}

export interface HttpClientResult {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
  retries: number;
}

/**
 * Merkezi HTTP istemcisi.
 * - Retry: exponential backoff ile retryable status kodlarında
 * - Circuit Breaker: ardışık hatalarda devre açarak istekleri engeller
 * - Timeout: AbortController ile
 */
export async function httpRequest(url: string, options: HttpClientOptions = {}): Promise<HttpClientResult> {
  const {
    method = 'POST',
    body,
    headers = {},
    timeoutMs = 15_000,
    maxRetries = 2,
    circuitKey,
    initialRetryDelayMs = 1000,
  } = options;

  // Circuit breaker kontrolü
  if (circuitKey && !canRequest(circuitKey)) {
    return {
      ok: false,
      status: 503,
      data: {
        HasError: true,
        AlertMessage: `Servis geçici olarak devre dışı (circuit breaker açık: ${circuitKey}). ${(CIRCUIT_RESET_MS / 1000).toFixed(0)}s sonra tekrar deneyin.`,
      },
      retries: 0,
    };
  }

  let lastError: Error | null = null;
  let retries = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      retries++;
      const backoff = initialRetryDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * backoff * 0.3;
      const waitMs = Math.min(backoff + jitter, 10_000);
      console.log(`[http-client] Retry ${attempt}/${maxRetries} (${url.split('?')[0]}) — ${waitMs.toFixed(0)}ms bekleniyor`);
      await delay(waitMs);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const fetchOptions: RequestInit = {
        method,
        signal: controller.signal,
        headers,
      };

      if (body && method === 'POST') {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      const data = await parseResponseJson(response);

      if (!response.ok) {
        // Retryable?
        if (RETRYABLE_STATUS.has(response.status) && attempt < maxRetries) {
          lastError = new Error(`API ${response.status}`);
          continue;
        }

        // 401/403 → retry yapmayacağız
        if (circuitKey) recordFailure(circuitKey);

        return { ok: false, status: response.status, data, retries };
      }

      // Başarılı
      if (circuitKey) recordSuccess(circuitKey);
      return { ok: true, status: response.status, data, retries };

    } catch (err) {
      clearTimeout(timeoutId);
      const error = err as Error & { name?: string };

      if (error.name === 'AbortError') {
        lastError = new Error(`API yanıt vermedi (${timeoutMs / 1000}s zaman aşımı)`);
        // Timeout'lar retry edilebilir
        if (attempt < maxRetries) continue;
      } else {
        lastError = error;
        // Network hataları retry edilebilir
        if (attempt < maxRetries) continue;
      }
    }
  }

  // Tüm retry'lar tükendi
  if (circuitKey) recordFailure(circuitKey);

  return {
    ok: false,
    status: lastError?.message?.includes('zaman aşımı') ? 504 : 502,
    data: {
      HasError: true,
      AlertMessage: lastError?.message || 'API isteği başarısız (tüm retry denemeleri tükendi)',
    },
    retries,
  };
}

// ─── Kolaylık Fonksiyonları ──────────────────────────────────────────────────

/**
 * Backoffice API'ye POST isteği (retry + circuit breaker ile).
 */
export async function backofficePost(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  authToken: string,
  opts?: { timeoutMs?: number; maxRetries?: number }
): Promise<HttpClientResult> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/${path.replace(/^\//, '')}`;
  const circuitKey = new URL(url).hostname;

  return httpRequest(url, {
    method: 'POST',
    body,
    headers: backofficeHeaders(authToken),
    timeoutMs: opts?.timeoutMs ?? 15_000,
    maxRetries: opts?.maxRetries ?? 2,
    circuitKey,
  });
}

/**
 * Backoffice API'ye GET isteği (retry + circuit breaker ile).
 */
export async function backofficeGet(
  baseUrl: string,
  path: string,
  query: string,
  authToken: string,
  opts?: { timeoutMs?: number; maxRetries?: number }
): Promise<HttpClientResult> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/${path.replace(/^\//, '')}${query ? `?${query}` : ''}`;
  const circuitKey = new URL(url).hostname;

  return httpRequest(url, {
    method: 'GET',
    headers: backofficeHeaders(authToken),
    timeoutMs: opts?.timeoutMs ?? 15_000,
    maxRetries: opts?.maxRetries ?? 2,
    circuitKey,
  });
}

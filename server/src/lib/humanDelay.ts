/**
 * İstekler arası insan benzeri gecikme; bot tespitini azaltmak için.
 * REQUEST_DELAY_MIN_MS / REQUEST_DELAY_MAX_MS (env) veya varsayılan aralık kullanılır.
 */

const DEFAULT_MIN = 1200;
const DEFAULT_MAX = 2500;

function getConfig(): { minMs: number; maxMs: number } {
  const minMs = Number(process.env.REQUEST_DELAY_MIN_MS);
  const maxMs = Number(process.env.REQUEST_DELAY_MAX_MS);
  if (minMs <= 0 && maxMs <= 0) return { minMs: 0, maxMs: 0 };
  return {
    minMs: minMs > 0 ? minMs : DEFAULT_MIN,
    maxMs: maxMs > 0 ? maxMs : DEFAULT_MAX,
  };
}

/** minMs–maxMs arası rastgele bekler (dakika cinsinden env: REQUEST_DELAY_MIN_MS, REQUEST_DELAY_MAX_MS). 0 ise beklemez. */
export function humanDelay(minMs?: number, maxMs?: number): Promise<void> {
  const cfg = getConfig();
  const lo = minMs ?? cfg.minMs;
  const hi = maxMs ?? cfg.maxMs;
  if (lo <= 0 && hi <= 0) return Promise.resolve();
  const ms = Math.min(lo, hi) + Math.random() * Math.abs(hi - lo);
  return new Promise((resolve) => setTimeout(resolve, Math.round(ms)));
}

/** Otomatik işte oyuncular arası gecikme (CLIENT_BATCH_DELAY_MIN_MS / _MAX_MS). Varsayılan 1–3 sn. */
export function clientBatchDelay(): Promise<void> {
  const minMs = Number(process.env.CLIENT_BATCH_DELAY_MIN_MS) || 1000;
  const maxMs = Number(process.env.CLIENT_BATCH_DELAY_MAX_MS) || 3000;
  if (minMs <= 0 && maxMs <= 0) return Promise.resolve();
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, Math.round(ms)));
}

import fetch from 'node-fetch';
import { config } from '../config.js';
import { humanDelay } from '../lib/humanDelay.js';
import { parsePromoContent, type NormalizedPromo } from '../lib/promosParser.js';

let cache: { ts: number; promos: NormalizedPromo[] } | null = null;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

let lastFetchError: string | null = null;

export async function fetchRawPromotions(): Promise<any[]> {
  const { promosApi } = config;
  if (!promosApi.baseUrl) {
    lastFetchError = 'Promos API base URL is not configured';
    return [];
  }
  const base = promosApi.baseUrl.replace(/\/$/, '');
  const path = promosApi.path.replace(/^\//, '');
  const url = `${base}/${path}?${promosApi.query}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), promosApi.timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const msg = `Promos API ${res.status}: ${res.statusText}`;
      lastFetchError = msg;
      throw new Error(msg);
    }
    const json = (await res.json()) as { data?: { data?: any[] } };
    lastFetchError = null;
    return json?.data?.data ?? [];
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : String(err);
    lastFetchError = msg;
    throw err;
  }
}

/** Son promos fetch hatası (log/debug için). */
export function getLastPromosError(): string | null {
  return lastFetchError;
}

export async function getAllPromosNormalized(force = false): Promise<NormalizedPromo[]> {
  if (!force && cache && (Date.now() - cache.ts) < CACHE_TTL) return cache.promos;
  try {
    await humanDelay();
    const raws = await fetchRawPromotions();
    const parsed: NormalizedPromo[] = raws.map((p: any) =>
      parsePromoContent(p.id, p.title ?? '', p.content ?? '')
    );
    cache = { ts: Date.now(), promos: parsed };
    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[promosService] Promos alınamadı, boş liste dönülüyor:', msg);
    if (cache) return cache.promos;
    return [];
  }
}

export function clearPromosCache() {
  cache = null;
}


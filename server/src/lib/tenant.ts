import type { FastifyRequest } from 'fastify';
import { loadTenants } from '../repositories/tenantRepository.js';
import { safeTenantKey } from './tenantContext.js';

// `safeTenantKey` artık `tenantContext` içinde yaşıyor: Lynon oturumu ve
// yapılandırma katmanı da aynı normalizasyona ihtiyaç duyuyor ve bu
// dosya Fastify tiplerine bağlı olduğu için oradan içe aktarılamazdı.
export { safeTenantKey };

/**
 * Tenant/site resolution strategy:
 * - Prefer explicit `?tenantId=` when caller is master (checked at route-level).
 * - Otherwise resolve by Host / X-Forwarded-Host against `server/src/data/tenants.json` domains.
 * - Fallback: env `TENANT_KEY`, else `default`.
 */

export function getRequestHost(req: FastifyRequest): string {
  const xfHost = (req.headers['x-forwarded-host'] as string | undefined) ?? undefined;
  const host = xfHost ?? (req.headers['host'] as string | undefined) ?? '';
  return String(host).split(',')[0]?.trim()?.replace(/:\d+$/, '') ?? '';
}

function normalizeDomain(s: string): string {
  return String(s || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

/**
 * Domain eşlemesi için kısa ömürlü liste önbelleği.
 *
 * Bu çözümleme artık HER `/api` isteğinde çalışıyor. Önbelleksiz her
 * istek `tenants.json`'ı (veritabanı kuruluysa bir SQL sorgusunu) tekrar
 * okurdu. Ömür kasıtlı olarak çok kısa: master panelden eklenen bir site
 * saniyeler içinde tanınmalı, elle bir geçersiz kılma adımı gerekmemeli.
 */
const LISTE_OMRU_MS = 5_000;
let listeOnbellek: { at: number; tenants: Array<{ id: string; domain?: string; isActive?: boolean }> } | null = null;

async function tenantListesi(): Promise<Array<{ id: string; domain?: string; isActive?: boolean }>> {
  const simdi = Date.now();
  if (listeOnbellek && simdi - listeOnbellek.at < LISTE_OMRU_MS) return listeOnbellek.tenants;
  const tenants = await loadTenants() as Array<{ id: string; domain?: string; isActive?: boolean }>;
  listeOnbellek = { at: simdi, tenants };
  return tenants;
}

export async function resolveTenantKeyFromHost(req: FastifyRequest): Promise<string> {
  const fallback = (process.env.TENANT_KEY || 'default').trim() || 'default';
  const host = normalizeDomain(getRequestHost(req));
  if (!host) return fallback;

  try {
    const tenants = await tenantListesi();
    const active = Array.isArray(tenants) ? tenants.filter((tenant) => tenant?.id && tenant.isActive !== false) : [];
    const match = active.find((tenant) => {
      const domain = normalizeDomain(tenant.domain || '');
      if (!domain) return false;
      return host === domain || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`);
    });
    return match?.id || fallback;
  } catch {
    return fallback;
  }
}

export async function resolveTenantKeyForRequest(req: FastifyRequest & { session?: any; query?: any }): Promise<string> {
  const sessionTenant = req.session?.user?.tenantId ? String(req.session.user.tenantId).trim() : '';
  if (sessionTenant) return safeTenantKey(sessionTenant);

  const isMaster = Boolean(req.session?.isMaster);
  const tenantIdFromQuery = req.query?.tenantId != null ? String(req.query.tenantId).trim() : '';
  if (isMaster && tenantIdFromQuery) return safeTenantKey(tenantIdFromQuery);

  return safeTenantKey(await resolveTenantKeyFromHost(req));
}


import { loadTenants } from '../repositories/tenantRepository.js';
import { runWithTenant, safeTenantKey, varsayilanTenantKey } from './tenantContext.js';
import { ensureTenantRuntime } from './tenantRuntimeConfig.js';

/**
 * ARKA PLAN İŞLERİNİ TÜM SİTELER İÇİN ÇALIŞTIRMA.
 *
 * İşlerin hiçbirinde istek yok, dolayısıyla tenant bağlamı da yoktu:
 * hepsi sabit `'default'` okuyordu. Sonuç, panelde ikinci bir site
 * tanımlandığında sessizce ortaya çıkıyordu — o sitenin ertesi gün
 * bonusu, sadakat taraması ve otomatik çekimi HİÇ çalışmıyordu, hata da
 * vermiyordu.
 *
 * `herTenantIcin` sıralı çalışır: aynı anda on siteye Lynon girişi
 * yapmak hem uçta oran sınırına takılır hem de hangi sitenin hata
 * verdiğini logdan okumayı imkânsızlaştırır.
 */

/** Varsayılan (ENV) tenant + tenants.json'daki aktif kayıtlar, tekilleştirilmiş. */
export async function aktifTenantAnahtarlari(): Promise<string[]> {
  const anahtarlar = new Set<string>([varsayilanTenantKey()]);
  try {
    for (const tenant of await loadTenants()) {
      if (!tenant?.id || tenant.isActive === false) continue;
      anahtarlar.add(safeTenantKey(tenant.id));
    }
  } catch {
    // Tenant listesi okunamadıysa en azından varsayılan site çalışsın.
  }
  return [...anahtarlar];
}

export interface TenantSonucu<T> {
  tenantKey: string;
  sonuc?: T;
  hata?: string;
}

/**
 * Her aktif tenant için sırayla çalıştırır.
 *
 * Bir sitenin hatası diğerlerini DURDURMAZ — tek bir sitenin süresi
 * dolmuş Lynon parolası yüzünden diğer dokuz sitenin gecelik bonusunun
 * dağıtılmaması, düzeltilen hatanın ta kendisi olurdu.
 */
export async function herTenantIcin<T>(
  isim: string,
  calistir: (tenantKey: string) => Promise<T>,
): Promise<Array<TenantSonucu<T>>> {
  const sonuclar: Array<TenantSonucu<T>> = [];
  for (const tenantKey of await aktifTenantAnahtarlari()) {
    try {
      await ensureTenantRuntime(tenantKey);
      const sonuc = await runWithTenant(tenantKey, () => calistir(tenantKey));
      sonuclar.push({ tenantKey, sonuc });
    } catch (error) {
      const hata = error instanceof Error ? error.message : String(error);
      console.error(`[${isim}] ${tenantKey}: ${hata}`);
      sonuclar.push({ tenantKey, hata });
    }
  }
  return sonuclar;
}

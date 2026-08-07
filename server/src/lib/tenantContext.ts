import { AsyncLocalStorage } from 'async_hooks';

/**
 * ÇALIŞAN İSTEĞİN/İŞİN TENANT'I.
 *
 * Panel çok kiracılı hale gelirken tek bir sorun her şeyi kilitliyordu:
 * `lynonBackofficeService` 3900 satır ve içindeki 90'dan fazla çağrı
 * `config.lynon` sabitini SENKRON okuyor. Bu fonksiyonların hepsine
 * `tenantKey` parametresi eklemek, çağıran her rotayı ve her testi
 * dokunulmuş hale getiren, incelenemez bir yama olurdu.
 *
 * Bunun yerine tenant, isteğin/işin YÜRÜTME BAĞLAMINDA taşınıyor.
 * `runWithTenant` ile bir kez sarılır (istekte tek kanca, işlerde tek
 * döngü), altındaki tüm eşzamansız zincir `currentTenantKey()` ile aynı
 * cevabı okur. Böylece Lynon oturumu, kimlik bilgileri ve kural dosyası
 * imza değiştirmeden tenant'a bağlanabiliyor.
 *
 * Bağlam YOKSA `TENANT_KEY` ortam değişkenine, o da yoksa `default`'a
 * düşer — tek siteli mevcut kurulum hiçbir şey değişmemiş gibi çalışır.
 */

export const VARSAYILAN_TENANT = 'default';

interface TenantStore {
  tenantKey: string;
}

const storage = new AsyncLocalStorage<TenantStore>();

/**
 * Tenant kimliğini dosya adı ve veritabanı anahtarı olarak güvenli hale
 * getirir. Kimlikler master panelde `crypto.randomUUID()` ile üretiliyor
 * ama domain eşleşmesi ve ortam değişkeni yoluyla dışarıdan da
 * gelebiliyor; yol ayracı içeren bir değer dosya deposunda dizin dışına
 * çıkardı.
 */
export function safeTenantKey(tenantKey: string): string {
  return String(tenantKey || VARSAYILAN_TENANT).trim().replace(/[^a-zA-Z0-9_-]/g, '_') || VARSAYILAN_TENANT;
}

/** Bağlam dışı çalışırken kullanılacak tenant (tek siteli kurulum). */
export function varsayilanTenantKey(): string {
  return safeTenantKey(process.env.TENANT_KEY?.trim() || VARSAYILAN_TENANT);
}

/** İçinde bulunulan isteğin/işin tenant'ı. */
export function currentTenantKey(): string {
  return storage.getStore()?.tenantKey ?? varsayilanTenantKey();
}

/** Bağlamın açıkça kurulmuş olup olmadığı; teşhis ve uyarı için. */
export function tenantBaglamiVarMi(): boolean {
  return storage.getStore() !== undefined;
}

/** Verilen tenant bağlamında çalıştırır; iç içe çağrılarda en içteki kazanır. */
export function runWithTenant<T>(tenantKey: string, fn: () => T): T {
  return storage.run({ tenantKey: safeTenantKey(tenantKey) }, fn);
}

/**
 * PROMOSYON İÇERİĞİ — DOSYADAN POSTGRES'E.
 *
 * ── Bildirilen vaka ───────────────────────────────────────────────────
 *
 * `/api/promos/list` üretimde sürekli 404 veriyordu:
 *
 *   {"AlertMessage":"promotions-data.json not found. Run: npm run fetch-promos-details"}
 *
 * ── Mekanizma ─────────────────────────────────────────────────────────
 *
 * Dosya `npm run fetch-promos-details` ile üretiliyor ve konteynerin
 * diskinde duruyordu. Railway'de `railway.json` hiçbir volume tanımlamıyor,
 * yani disk her deploy'da sıfırlanıyor. Dosya depoda da yok, imaja da
 * gömülmüyor — dolayısıyla HER DEPLOY'DA siliniyordu. Bu bir kereye mahsus
 * bir arıza değil, yapısal: gün içinde beş deploy yapılırsa beş kez
 * kayboluyordu.
 *
 * ── Çözüm ─────────────────────────────────────────────────────────────
 *
 * Diğer her şey gibi belge deposunda (`app_documents`) tutuluyor. Eski
 * dosya `filePath` olarak veriliyor: veritabanında kayıt yoksa ilk okumada
 * dosyadan İÇE AKTARILIP yazılıyor, yani mevcut kurulumda veri kaybı yok
 * ve elle taşıma gerekmiyor.
 *
 * Yenileme artık deploy gerektirmiyor; `/api/admin/promos/refresh` ucu
 * kaynaktan çekip veritabanına yazıyor.
 */
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';
import { currentTenantKey, safeTenantKey } from '../lib/tenantContext.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * ESKİ DOSYA YOLU — yalnızca TOHUM.
 *
 * Kodda iki FARKLI yol kullanılıyordu: `server/promotions-data.json` ve
 * `process.cwd()/promotions-data.json`. Üretimde bunlar ayrı dizinler;
 * biri dosyayı bulurken diğeri bulamıyordu. Tek yolda birleştirildi.
 */
export const ESKI_PROMO_DOSYASI = join(__dirname, '..', '..', 'promotions-data.json');

const NAMESPACE = 'promotions-data';

export type PromoDeposu = {
  fetchedAt?: string;
  source?: string;
  count?: number;
  promotions: unknown[];
};

const BOS: PromoDeposu = { promotions: [] };

/** Kayıtlı promosyon içeriği. Veritabanı yoksa dosyaya düşer. */
export async function promoVerisiOku(tenantKey = currentTenantKey()): Promise<PromoDeposu> {
  const veri = await readStoredDocument<PromoDeposu>({
    tenantKey: safeTenantKey(tenantKey),
    namespace: NAMESPACE,
    filePath: ESKI_PROMO_DOSYASI,
    fallback: BOS,
  });
  // Bozuk/eksik belge gelse bile çağıran taraf dizi bekliyor.
  return { ...veri, promotions: Array.isArray(veri?.promotions) ? veri.promotions : [] };
}

/** Promosyon içeriğini kaydeder; `count` ve `fetchedAt` burada damgalanır. */
export async function promoVerisiYaz(veri: PromoDeposu, tenantKey = currentTenantKey()): Promise<PromoDeposu> {
  const promotions = Array.isArray(veri?.promotions) ? veri.promotions : [];
  const kayit: PromoDeposu = {
    ...veri,
    promotions,
    count: promotions.length,
    fetchedAt: veri.fetchedAt ?? new Date().toISOString(),
  };
  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: NAMESPACE, filePath: ESKI_PROMO_DOSYASI },
    kayit,
  );
  return kayit;
}

/**
 * Kayıtlı içerikte bir promosyonu id ya da başlıkla bulur.
 *
 * Başlık eşleşmesi iki yönlü: kayıtlı başlık aranan metnin İÇİNDE de
 * geçebilir (kampanya adları platformda ek ibare taşıyabiliyor).
 */
export function promoBul(promotions: unknown[], bonusId?: unknown, bonusName?: unknown): any {
  const id = bonusId != null && String(bonusId).trim() !== '' ? String(bonusId).trim() : null;
  const ad = String(bonusName ?? '').trim().toLocaleLowerCase('tr-TR');

  return (Array.isArray(promotions) ? promotions : []).find((p: any) => {
    if (id && String(p?.id) === id) return true;
    if (!ad) return false;
    const baslik = String(p?.title ?? '').trim().toLocaleLowerCase('tr-TR');
    if (!baslik) return false;
    return baslik === ad || ad.includes(baslik);
  }) ?? null;
}

import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { safeTenantKey } from '../lib/tenant.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';

/**
 * BugsCRM — kendi affiliate izleme entegrasyonumuz.
 *
 * ── Neden ayrı bir sistem, mevcut affiliate (BTag) modeline eklenmedi ──
 *
 * `affiliateAccountService.ts` Lynon'un BTag'ine bağlı ortakları modelliyor;
 * Lynon BTag'i oyuncu kaydında KENDİ tarafında yakalıyor, bu depo onu
 * yalnızca rapordan okuyor. BugsCRM'in tıklama/dönüşüm kaydı BAMBAŞKA bir
 * sistem — kendi clickId'siyle çalışıyor ve bize yalnızca postback (S2S)
 * ile haber veriyor. İkisini aynı modele sıkıştırmak, ikisinin de
 * anahtarını (BTag vs clickId) bozar. Bu yüzden ayrı depo, ayrı servis.
 *
 * ── Kimlik bilgileri neden yalnızca ENV'den ──
 *
 * Lynon config'indeki aynı disiplin: ApiKey sizin sisteminizin BugsCRM'e
 * kimliğini kanıtladığı sır, admin panelinden düzenlenebilir olması
 * (veritabanında açık metin durması, ekrana yazdırılabilmesi) gereksiz
 * risk. Panel yalnızca bağlantı durumunu gösterir, tıklama/dönüşüm
 * kayıtlarını listeler.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUGSCRM_DIR = path.join(__dirname, '..', 'data', 'bugscrm');

export type BugscrmOlayTuru = 'tiklama' | 'kayit' | 'yatirim' | 'ozel';

export type BugscrmKaydi = {
  /** BugsCRM'in ürettiği tıklama kimliği — tüm eşleştirme bunun üzerinden. */
  clickId: string;
  /** BugsCRM tarafında bu trafiği tanımlayan alt kimlik (varsa). */
  subId: string | null;
  olayTuru: BugscrmOlayTuru;
  /** Dönüşüm anında bildirilen oyuncu login'i (varsa) — Lynon eşleştirmesi için. */
  playerLogin: string | null;
  tutar: number | null;
  paraBirimi: string | null;
  alindi: string;
  /** Ham postback gövdesi — şema genişleyince yeniden işlenebilsin diye saklanır. */
  ham: Record<string, unknown>;
};

function bugscrmPath(tenantKey: string): string {
  return path.join(BUGSCRM_DIR, `${safeTenantKey(tenantKey)}.json`);
}

export async function readBugscrmKayitlari(tenantKey: string): Promise<BugscrmKaydi[]> {
  const data = await readStoredDocument<BugscrmKaydi[]>({
    tenantKey: safeTenantKey(tenantKey),
    namespace: 'bugscrm-kayitlari',
    filePath: bugscrmPath(tenantKey),
    fallback: () => [],
  });
  return Array.isArray(data) ? data : [];
}

/** Depoda tutulan azami kayıt sayısı — sınırsız büyümeyi önler. */
const AZAMI_KAYIT = 5000;

/**
 * BugsCRM'den gelen postback'i kaydeder.
 *
 * Aynı `clickId` + `olayTuru` ikilisi TEKRAR gelirse (at-least-once
 * teslimat/yeniden deneme olağan) üzerine yazılır, çoğaltılmaz —
 * postback idempotent işlenmeli.
 */
export async function bugscrmPostbackKaydet(
  tenantKey: string,
  girdi: Omit<BugscrmKaydi, 'alindi'>,
): Promise<BugscrmKaydi[]> {
  const kayitlar = await readBugscrmKayitlari(tenantKey);
  const yeniKayit: BugscrmKaydi = { ...girdi, alindi: new Date().toISOString() };
  const filtreli = kayitlar.filter(
    (k) => !(k.clickId === yeniKayit.clickId && k.olayTuru === yeniKayit.olayTuru),
  );
  const guncel = [yeniKayit, ...filtreli].slice(0, AZAMI_KAYIT);
  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: 'bugscrm-kayitlari', filePath: bugscrmPath(tenantKey) },
    guncel,
  );
  return guncel;
}

export function bugscrmYapilandirilmisMi(): boolean {
  return config.bugscrm.enabled && Boolean(config.bugscrm.apiKey && config.bugscrm.productId && config.bugscrm.endpointUrl);
}

export type BugscrmBaglantiDurumu =
  | { ok: true; durum: 'yapilandirildi' }
  | { ok: false; durum: 'kapali' | 'eksik-yapilandirma' | 'baglanti-hatasi'; mesaj: string };

/**
 * Bağlantıyı test eder.
 *
 * `endpointUrl` kök adresine kimlikli bir GET atılır; 2xx/401/403 dışı
 * her şey "sunucuya ulaşılamadı" sayılır. Bu yalnızca "sunucu ayakta ve
 * ulaşılabilir mi" sorusuna cevap verir, "hesap/anahtar geçerli mi"
 * sorusuna değil — o doğrulama gerçek dönüşüm/postback trafiğiyle olur.
 */
export async function bugscrmBaglantisiniTestEt(): Promise<BugscrmBaglantiDurumu> {
  if (!config.bugscrm.enabled) return { ok: false, durum: 'kapali', mesaj: 'BugsCRM entegrasyonu kapalı (BUGSCRM_ENABLED).' };
  if (!bugscrmYapilandirilmisMi()) {
    return { ok: false, durum: 'eksik-yapilandirma', mesaj: 'BUGSCRM_API_KEY, BUGSCRM_PRODUCT_ID ve BUGSCRM_ENDPOINT_URL tanımlı değil.' };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.bugscrm.timeoutMs);
    const res = await fetch(config.bugscrm.endpointUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.bugscrm.apiKey}`,
        'X-Product-Id': config.bugscrm.productId,
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    // 401/403 dahi sunucunun ulaşılabilir ve kimlik başlıklarını okuduğu
    // anlamına gelir; asıl aranan "ağ/DNS/timeout" hatası değil.
    if (res.status >= 500) {
      return { ok: false, durum: 'baglanti-hatasi', mesaj: `BugsCRM sunucusu ${res.status} döndü.` };
    }
    return { ok: true, durum: 'yapilandirildi' };
  } catch (err) {
    return {
      ok: false,
      durum: 'baglanti-hatasi',
      mesaj: err instanceof Error ? err.message : 'BugsCRM sunucusuna ulaşılamadı.',
    };
  }
}

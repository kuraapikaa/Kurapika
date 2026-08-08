/**
 * Nakit bonus defteri — YEREL, birinci sınıf "bugün verildi" kaydı.
 *
 * ── Neden gerekli: mevcut kontrol neden yetersiz kaldı ─────────────────
 *
 * `/admin/bonus/charge` şu ana kadar "bugün verildi mi" sorusunu Lynon'un
 * balanceCorrections listesini GERİYE OKUYUP not metninden çıkararak
 * cevaplıyordu (bkz. nakitBonusGecmisi.ts). Bu, iki dış bağımlılığa
 * muhtaç: Lynon'un az önce yazılan düzeltmeyi bir sonraki okumada
 * göstermesi (okuma-sonrası-yazma tutarlılığı) VE not metninin doğru
 * ayrıştırılması.
 *
 * GÖZLENEN VAKA: oyuncu 2492369, 2026-08-03 22:01–22:03 arasında AYNI
 * %30 KAYIP BONUSU'nu (kural 1874) üç kez aldı — her seferinde 2.500 TRY,
 * toplam 7.500 TRY. Denemeler arasında TAM BİR DAKİKA vardı; bu, aynı
 * anda çakışan iki istek değil, personelin "Ver" işlemini birkaç kez
 * tekrarladığı ve her seferinde kontrolün "bugün verilmemiş" görmesi.
 *
 * Bu modül, kaynağı hangisi olursa olsun (okuma gecikmesi, not eşleşmesi,
 * ya da başka bir sebep), BİZİM YAZDIĞIMIZ her nakit bonusu KENDİ
 * defterimize KAYDEDİYOR ve kontrolü oradan yapıyor — dış bir sistemin
 * okuma tutarlılığına bağlı kalmadan.
 *
 * Lynon-türetilmiş kontrol (`nakitBonusGecmisi.ts`) KALDIRILMADI: bu
 * rotanın dışında (örn. Lynon panelinden elle) yapılan bir düzeltmeyi
 * yalnızca o yakalayabilir. İkisi birlikte, ayrı ayrı eksik kaldıkları
 * yerleri kapatıyor.
 *
 * ── Rezerve-sonra-ver ──────────────────────────────────────────────────
 *
 * Kayıt Lynon'a yazmadan ÖNCE 'pending' olarak ekleniyor, yazma
 * başarılı olunca 'granted'e dönüyor, başarısız olursa siliniyor. Aynı
 * desen games.ts'teki günlük görev talebinde de kullanılıyor: rezervasyon
 * yazma başarısız istekte otomatik geri alınıyor, oyuncu tekrar
 * deneyebiliyor.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';
import { istanbulDateKey } from '../lib/istanbulGunu.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFTER_DIZINI = path.join(__dirname, '..', 'data', 'nakit-bonus-defteri');

function safeTenantKey(tenantKey: string): string {
  return String(tenantKey || 'default').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
}

function defterYolu(tenantKey: string): string {
  return path.join(DEFTER_DIZINI, `${safeTenantKey(tenantKey)}.json`);
}

export type NakitBonusKaydi = {
  id: string;
  playerId: string;
  kuralAnahtari: string;
  tutar: number;
  dateKey: string;
  verildi: string;
  durum: 'pending' | 'granted';
};

type Defter = { kayitlar: NakitBonusKaydi[] };

async function defteriOku(tenantKey: string): Promise<Defter> {
  const data = await readStoredDocument<Defter>({
    tenantKey: safeTenantKey(tenantKey),
    namespace: 'nakit-bonus-defteri',
    filePath: defterYolu(tenantKey),
    fallback: { kayitlar: [] },
  });
  return { kayitlar: Array.isArray(data?.kayitlar) ? data.kayitlar : [] };
}

async function defteriYaz(tenantKey: string, defter: Defter): Promise<void> {
  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: 'nakit-bonus-defteri', filePath: defterYolu(tenantKey) },
    defter,
  );
}

const hedef = (kuralAnahtari: string) => String(kuralAnahtari ?? '').trim().toLocaleLowerCase('tr-TR');

/**
 * Bugün (İstanbul günü) bu oyuncuya bu kural zaten VERİLMİŞ Mİ?
 *
 * Yalnızca 'granted' durumundaki kayıtlar sayılır — 'pending' bir kayıt
 * henüz Lynon'a yazılmadı, engelleyici olmamalı (yazma başarısız olup
 * geri alınabilir).
 */
export async function bugunYerelVerilmisMi(
  tenantKey: string,
  playerId: string | number,
  kuralAnahtari: string,
  simdi: Date = new Date(),
): Promise<boolean> {
  const defter = await defteriOku(tenantKey);
  const gun = istanbulDateKey(simdi);
  const oyuncu = String(playerId);
  const hedefAnahtar = hedef(kuralAnahtari);
  return defter.kayitlar.some(
    (k) => k.durum === 'granted' && k.dateKey === gun && String(k.playerId) === oyuncu
      && hedef(k.kuralAnahtari) === hedefAnahtar,
  );
}

/** Rezervasyon oluşturur; kayıt kimliğini döner. */
export async function rezerveEt(
  tenantKey: string,
  playerId: string | number,
  kuralAnahtari: string,
  tutar: number,
  simdi: Date = new Date(),
): Promise<string> {
  const defter = await defteriOku(tenantKey);
  const id = `${istanbulDateKey(simdi)}-${String(playerId)}-${hedef(kuralAnahtari)}-${simdi.getTime()}`;
  defter.kayitlar.push({
    id,
    playerId: String(playerId),
    kuralAnahtari: String(kuralAnahtari),
    tutar,
    dateKey: istanbulDateKey(simdi),
    verildi: simdi.toISOString(),
    durum: 'pending',
  });
  await defteriYaz(tenantKey, defter);
  return id;
}

export async function tamamlandiIsaretle(tenantKey: string, id: string): Promise<void> {
  const defter = await defteriOku(tenantKey);
  const kayit = defter.kayitlar.find((k) => k.id === id);
  if (kayit) kayit.durum = 'granted';
  await defteriYaz(tenantKey, defter);
}

/** Yazma başarısız olduğunda rezervasyonu kaldırır ki oyuncu tekrar deneyebilsin. */
export async function rezervasyonuKaldir(tenantKey: string, id: string): Promise<void> {
  const defter = await defteriOku(tenantKey);
  defter.kayitlar = defter.kayitlar.filter((k) => k.id !== id);
  await defteriYaz(tenantKey, defter);
}

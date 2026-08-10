import path from 'path';
import { fileURLToPath } from 'url';
import { safeTenantKey } from '../lib/tenant.js';
import { readStoredDocument, writeStoredDocument } from '../lib/documentStore.js';

/**
 * ÖDEME YÖNTEMİ AYARLARI (komisyon + teslimat + takviye).
 *
 * Mutabakat bugüne kadar yalnızca "sağlayıcıdan ne kadar geçti"
 * gösteriyordu. Ama sağlayıcı o paranın tamamını bize vermiyor:
 * yöntem başına bir komisyon kesiyor. Oran panelde tanımlı olmadığı
 * için kasaya GERÇEKTE ne gireceği hiçbir yerde görünmüyordu; fark
 * ancak sağlayıcı ekstresi geldiğinde ortaya çıkıyordu.
 *
 * ── Oran iki parçalı ──
 *
 * Sağlayıcılar genelde hem yüzde hem işlem başına sabit ücret alıyor
 * ("%2.5 + 1,50 TL"). Yalnızca yüzde tutmak, küçük tutarlı çok sayıda
 * işlemde bariz sapma üretirdi.
 *
 * ── Yatırım ve çekim AYRI ──
 *
 * Aynı yöntemin yatırım ve çekim komisyonu neredeyse hiç aynı değil.
 * Tek oran tutmak, iki yönden birini sistematik olarak yanlış
 * hesaplamak olurdu.
 *
 * ── Teslimat / takviye NEDEN serbest metin ──
 *
 * Her sağlayıcının kasa mutabakatıyla ilgisi olan operasyonel kuralı
 * farklı ("her Pazartesi elden teslim", "T+2 banka mutabakatı",
 * "50.000 TL altına düşünce X'i ara"). Bunu sabit bir şemaya
 * sıkıştırmak (örn. yalnızca haftalık/aylık seçenek) gerçek kuralı
 * ya eksik ya da yanlış temsil ederdi; serbest metin + isteğe bağlı
 * bir takviye eşiği (sayı), panelin dışına taşmadan operasyonu
 * olduğu gibi kaydetmeye yetiyor. Bu alanlar komisyon hesabına
 * KATILMIYOR — yalnızca bilgi amaçlı, mutabakat rakamlarını
 * değiştirmiyorlar.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERI_DIZINI = path.join(__dirname, '..', 'data', 'yontem-komisyonu');

export interface YontemKomisyonu {
  /** `mutabakatSatiri.anahtar` ile aynı biçim: "HemenOde · Havale". */
  anahtar: string;
  /** Yatırımdan kesilen yüzde (0-100). */
  yatirimYuzde: number;
  /** Yatırımda işlem başına sabit ücret. */
  yatirimSabit: number;
  cekimYuzde: number;
  cekimSabit: number;
  /** Bu yöntemin parası ne zaman/nasıl teslim ediliyor -- serbest metin ("T+2", "Her Pazartesi elden"...). */
  teslimatKurali: string | null;
  /** Kasa bu tutarın altına düşünce takviye (para ekleme) gerekir. Tanımsızsa eşik izlenmiyor demektir. */
  takviyeEsigi: number | null;
  /** Takviyenin nasıl/kimden yapılacağına dair not. */
  takviyeNotu: string | null;
  not: string | null;
  updatedAt: string;
}

type Depo = { version: 1; oranlar: YontemKomisyonu[] };
const bosDepo = (): Depo => ({ version: 1, oranlar: [] });

export class YontemKomisyonuHatasi extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'YontemKomisyonuHatasi';
  }
}

function depoYolu(tenantKey: string): string {
  return path.join(VERI_DIZINI, `${safeTenantKey(tenantKey)}.json`);
}

async function depoOku(tenantKey: string): Promise<Depo> {
  const kayit = await readStoredDocument<Partial<Depo>>({
    tenantKey: safeTenantKey(tenantKey),
    namespace: 'yontem-komisyonu',
    filePath: depoYolu(tenantKey),
    fallback: bosDepo,
  });
  // Teslimat/takviye alanlari SONRADAN eklendi -- bu alanlar olmadan
  // kaydedilmis eski kayitlar `undefined` donerdi, `string | null`
  // sozlesmesini bozardi.
  const oranlar = (Array.isArray(kayit.oranlar) ? kayit.oranlar : []).map((o) => ({
    ...o,
    teslimatKurali: o.teslimatKurali ?? null,
    takviyeEsigi: o.takviyeEsigi ?? null,
    takviyeNotu: o.takviyeNotu ?? null,
  }));
  return { version: 1, oranlar };
}

async function depoYaz(tenantKey: string, depo: Depo): Promise<void> {
  await writeStoredDocument(
    { tenantKey: safeTenantKey(tenantKey), namespace: 'yontem-komisyonu', filePath: depoYolu(tenantKey) },
    depo,
  );
}

function yuzde(deger: unknown, alan: string): number {
  const n = Number(deger ?? 0);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new YontemKomisyonuHatasi(`${alan} 0 ile 100 arasında olmalı.`);
  }
  return n;
}

function sabit(deger: unknown, alan: string): number {
  const n = Number(deger ?? 0);
  if (!Number.isFinite(n) || n < 0) throw new YontemKomisyonuHatasi(`${alan} negatif olamaz.`);
  return n;
}

/** `sabit()`den farkı: değer BOŞSA (izlenmiyor) `null`, doluysa doğrulanmış sayı döner. */
function sabitYaNull(deger: unknown, alan: string): number | null {
  if (deger === undefined || deger === null || deger === '') return null;
  const n = Number(deger);
  if (!Number.isFinite(n) || n < 0) throw new YontemKomisyonuHatasi(`${alan} negatif olamaz.`);
  return n;
}

function metinYaNull(deger: unknown): string | null {
  return String(deger ?? '').trim() || null;
}

export async function komisyonOranlari(tenantKey: string): Promise<YontemKomisyonu[]> {
  return (await depoOku(tenantKey)).oranlar;
}

export async function komisyonOraniKaydet(
  tenantKey: string,
  girdi: Partial<YontemKomisyonu> & { anahtar?: string },
  simdi = new Date(),
): Promise<YontemKomisyonu> {
  const anahtar = String(girdi.anahtar ?? '').trim();
  if (!anahtar) throw new YontemKomisyonuHatasi('anahtar zorunlu.');

  const oran: YontemKomisyonu = {
    anahtar,
    yatirimYuzde: yuzde(girdi.yatirimYuzde, 'yatirimYuzde'),
    yatirimSabit: sabit(girdi.yatirimSabit, 'yatirimSabit'),
    cekimYuzde: yuzde(girdi.cekimYuzde, 'cekimYuzde'),
    cekimSabit: sabit(girdi.cekimSabit, 'cekimSabit'),
    teslimatKurali: metinYaNull(girdi.teslimatKurali),
    takviyeEsigi: sabitYaNull(girdi.takviyeEsigi, 'takviyeEsigi'),
    takviyeNotu: metinYaNull(girdi.takviyeNotu),
    not: metinYaNull(girdi.not),
    updatedAt: simdi.toISOString(),
  };

  const depo = await depoOku(tenantKey);
  const indeks = depo.oranlar.findIndex((o) => o.anahtar === anahtar);
  if (indeks >= 0) depo.oranlar[indeks] = oran;
  else depo.oranlar.push(oran);
  await depoYaz(tenantKey, depo);
  return oran;
}

export async function komisyonOraniSil(tenantKey: string, anahtar: string): Promise<void> {
  const depo = await depoOku(tenantKey);
  const once = depo.oranlar.length;
  depo.oranlar = depo.oranlar.filter((o) => o.anahtar !== anahtar);
  if (depo.oranlar.length === once) throw new YontemKomisyonuHatasi('Oran bulunamadı.', 404);
  await depoYaz(tenantKey, depo);
}

export interface KomisyonHesabi {
  anahtar: string;
  /** Oran tanımlı mı; tanımsızsa komisyon 0 sayılır ama bu BELİRTİLİR. */
  oranTanimli: boolean;
  yatirimKomisyonu: number;
  cekimKomisyonu: number;
  toplamKomisyon: number;
  /** Komisyon düşüldükten sonra kasaya kalan net. */
  netYatirim: number;
}

/**
 * Bir mutabakat satırının komisyonunu hesaplar.
 *
 * `islemSayisi` verilmezse sabit ücret UYGULANMAZ. Uydurmak yerine
 * atlamak doğru: sabit ücret işlem başına ve işlem sayısı bilinmiyorsa
 * tahmin edilen her değer sistematik bir sapma üretir. Panel bu durumda
 * yalnızca yüzde bileşenini gösterir.
 */
export function komisyonHesapla(
  oran: YontemKomisyonu | undefined,
  satir: { anahtar: string; yatirim: number; cekim: number; islemSayisi?: number | null },
): KomisyonHesabi {
  const yatirim = Number(satir.yatirim) || 0;
  const cekim = Number(satir.cekim) || 0;

  if (!oran) {
    return {
      anahtar: satir.anahtar,
      oranTanimli: false,
      yatirimKomisyonu: 0,
      cekimKomisyonu: 0,
      toplamKomisyon: 0,
      netYatirim: yatirim,
    };
  }

  const adet = Number.isFinite(Number(satir.islemSayisi)) && Number(satir.islemSayisi) > 0
    ? Number(satir.islemSayisi)
    : 0;

  const kurusa = (n: number) => Math.round(n * 100) / 100;
  const yatirimKomisyonu = kurusa((yatirim * oran.yatirimYuzde) / 100 + adet * oran.yatirimSabit);
  const cekimKomisyonu = kurusa((cekim * oran.cekimYuzde) / 100 + adet * oran.cekimSabit);

  return {
    anahtar: satir.anahtar,
    oranTanimli: true,
    yatirimKomisyonu,
    cekimKomisyonu,
    toplamKomisyon: kurusa(yatirimKomisyonu + cekimKomisyonu),
    netYatirim: kurusa(yatirim - yatirimKomisyonu),
  };
}

/** Satır listesine oranları uygular; oran haritası anahtara göre kurulur. */
export function komisyonlariUygula(
  oranlar: YontemKomisyonu[],
  satirlar: Array<{ anahtar: string; yatirim: number; cekim: number; islemSayisi?: number | null }>,
): { hesaplar: KomisyonHesabi[]; toplamKomisyon: number; oransizSatir: string[] } {
  const harita = new Map(oranlar.map((o) => [o.anahtar, o]));
  const hesaplar = satirlar.map((s) => komisyonHesapla(harita.get(s.anahtar), s));
  return {
    hesaplar,
    toplamKomisyon: Math.round(hesaplar.reduce((t, h) => t + h.toplamKomisyon, 0) * 100) / 100,
    // Oransiz satirlar ayrica donuyor: komisyonu 0 gostermek ile "oran
    // girilmemis" arasindaki farki panel soyleyebilsin.
    oransizSatir: hesaplar.filter((h) => !h.oranTanimli).map((h) => h.anahtar),
  };
}

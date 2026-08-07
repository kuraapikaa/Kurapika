import { randomUUID } from 'crypto';
import { degistir, diziOku, kayitOku, oku } from '../lib/depo.js';

/**
 * KOMİSYON PLANLARI VE HAKEDİŞ.
 *
 * Üç model destekleniyor; sektörde kullanılan da bunlar:
 *
 *   GELİR PAYI (RevShare) — net gelirin yüzdesi. Riski paylaşır;
 *   oyuncu kaybettirdiğinde ortak da kazanmaz.
 *
 *   CPA — ilk yatırım yapan oyuncu başına sabit tutar. Ortak için
 *   öngörülebilir, site için riskli: kalitesiz trafik de ödeme alır.
 *
 *   HİBRİT — ikisi birlikte, genelde düşürülmüş oranlarla.
 *
 * ── CPA ve ÖLÇÜLEMEYEN FTD ──
 *
 * CPA, ilk yatırım (FTD) sayısına dayanıyor. Toplam düzeyinde rapor
 * veren backoffice'lerde bu sayı GELMİYOR (bkz. `HamOlcum.ftdSayisi`).
 * Bu durumda CPA bileşeni SIFIR yazılmıyor, HESAPLANAMADI olarak
 * işaretleniyor. Sıfır yazmak ortağa "hiç ilk yatırım getirmedin"
 * demek olurdu; oysa doğrusu "biz ölçemiyoruz" ve bu bir ödeme
 * anlaşmazlığına dönüşürdü.
 *
 * ── NEGATİF DEVİR ──
 *
 * Bir ay net gelir eksiye düşerse (büyük kazanan oyuncu), zarar
 * varsayılan olarak SONRAKİ AYA devrediliyor. Devretmemek, ortağın
 * kayıp ayı görmezden gelip kazançlı ayların tamamını almasına yol
 * açar; uzun vadede sürekli zarar eden bir ortak bile pozitif
 * hakediş üretir. Devri kapatmak plan bazında mümkün — bazı
 * anlaşmalar gerçekten böyle yapılıyor.
 */

const ALAN = 'komisyon-planlari';

export type KomisyonTuru = 'gelir-payi' | 'cpa' | 'hibrit';
export const KOMISYON_TURLERI: KomisyonTuru[] = ['gelir-payi', 'cpa', 'hibrit'];

export interface KomisyonPlani {
  id: string;
  ad: string;
  tur: KomisyonTuru;
  /** Net gelirin yüzdesi (gelir-payi ve hibrit). */
  gelirPayiYuzde: number;
  /** İlk yatırım başına sabit tutar (cpa ve hibrit). */
  cpaTutari: number;
  /**
   * Net geliri bulmak için brüt gelirden düşülen işletme payı.
   *
   * Ödeme sağlayıcı komisyonu, oyun sağlayıcı payı ve platform ücreti
   * gerçek giderler; ortağa brüt üzerinden pay vermek bunları tamamen
   * siteye yükler. Sözleşmede genelde tek bir yüzde olarak geçer.
   */
  yonetimGideriYuzde: number;
  /** Bu tutarın altındaki hakediş ödenmez, sonraki aya devreder. */
  asgariOdeme: number;
  negatifDevir: boolean;
  varsayilan: boolean;
  createdAt: string;
  updatedAt: string;
}

type Depo = { version: 1; planlar: KomisyonPlani[] };
const cozDepo = (ham: unknown): Depo => ({ version: 1, planlar: diziOku<KomisyonPlani>(kayitOku(ham).planlar) });

export class KomisyonHatasi extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'KomisyonHatasi';
  }
}

const kurusa = (n: number): number => Math.round(n * 100) / 100;

function yuzdeOku(deger: unknown, alan: string): number {
  const n = Number(deger ?? 0);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new KomisyonHatasi(`${alan} 0 ile 100 arasında olmalı.`);
  return n;
}

function tutarOku(deger: unknown, alan: string): number {
  const n = Number(deger ?? 0);
  if (!Number.isFinite(n) || n < 0) throw new KomisyonHatasi(`${alan} negatif olamaz.`);
  return n;
}

export async function planlariListele(kiraci: string): Promise<KomisyonPlani[]> {
  return (await oku<Depo>(kiraci, ALAN, cozDepo)).planlar;
}

export async function planBul(kiraci: string, planId: string | null): Promise<KomisyonPlani | null> {
  const planlar = await planlariListele(kiraci);
  if (planId) {
    const plan = planlar.find((p) => p.id === planId);
    if (plan) return plan;
  }
  // Ortagin plani silinmisse varsayilana dusuyoruz; hakedisi hic
  // hesaplamamak, ortagin kazancini sessizce sifirlamak olurdu.
  return planlar.find((p) => p.varsayilan) ?? null;
}

export interface PlanGirdisi {
  ad?: string;
  tur?: string;
  gelirPayiYuzde?: unknown;
  cpaTutari?: unknown;
  yonetimGideriYuzde?: unknown;
  asgariOdeme?: unknown;
  negatifDevir?: boolean;
  varsayilan?: boolean;
}

function planGovdesi(girdi: PlanGirdisi): Omit<KomisyonPlani, 'id' | 'createdAt' | 'updatedAt' | 'varsayilan'> {
  const ad = String(girdi.ad ?? '').trim();
  if (!ad) throw new KomisyonHatasi('ad zorunlu.');
  const tur = String(girdi.tur ?? '') as KomisyonTuru;
  if (!KOMISYON_TURLERI.includes(tur)) {
    throw new KomisyonHatasi(`tur şunlardan biri olmalı: ${KOMISYON_TURLERI.join(', ')}`);
  }

  const gelirPayiYuzde = yuzdeOku(girdi.gelirPayiYuzde, 'gelirPayiYuzde');
  const cpaTutari = tutarOku(girdi.cpaTutari, 'cpaTutari');

  // Turune gore anlamli olmayan bir plan, ay sonunda sifir hakedis
  // uretir ve sebebi hicbir yerde gorunmez. Kurulumda yakalanmali.
  if ((tur === 'gelir-payi' || tur === 'hibrit') && gelirPayiYuzde <= 0) {
    throw new KomisyonHatasi('Gelir payı planında gelirPayiYuzde sıfırdan büyük olmalı.');
  }
  if ((tur === 'cpa' || tur === 'hibrit') && cpaTutari <= 0) {
    throw new KomisyonHatasi('CPA planında cpaTutari sıfırdan büyük olmalı.');
  }

  return {
    ad,
    tur,
    gelirPayiYuzde,
    cpaTutari,
    yonetimGideriYuzde: yuzdeOku(girdi.yonetimGideriYuzde, 'yonetimGideriYuzde'),
    asgariOdeme: tutarOku(girdi.asgariOdeme, 'asgariOdeme'),
    negatifDevir: girdi.negatifDevir !== false,
  };
}

export async function planOlustur(kiraci: string, girdi: PlanGirdisi, simdi = new Date()): Promise<KomisyonPlani> {
  const govde = planGovdesi(girdi);
  return degistir<Depo, KomisyonPlani>(kiraci, ALAN, cozDepo, (depo) => {
    const plan: KomisyonPlani = {
      id: randomUUID(),
      ...govde,
      // Ilk plan her zaman varsayilan olur: varsayilani olmayan bir
      // sistemde plansiz ortagin hakedisi hic hesaplanmaz.
      varsayilan: girdi.varsayilan === true || depo.planlar.length === 0,
      createdAt: simdi.toISOString(),
      updatedAt: simdi.toISOString(),
    };
    if (plan.varsayilan) depo.planlar.forEach((p) => { p.varsayilan = false; });
    depo.planlar.push(plan);
    return plan;
  });
}

export async function planGuncelle(
  kiraci: string,
  id: string,
  girdi: PlanGirdisi,
  simdi = new Date(),
): Promise<KomisyonPlani> {
  return degistir<Depo, KomisyonPlani>(kiraci, ALAN, cozDepo, (depo) => {
    const plan = depo.planlar.find((p) => p.id === id);
    if (!plan) throw new KomisyonHatasi('Plan bulunamadı.', 404);

    const govde = planGovdesi({ ...plan, ...girdi });
    Object.assign(plan, govde, { updatedAt: simdi.toISOString() });

    if (girdi.varsayilan === true) {
      depo.planlar.forEach((p) => { p.varsayilan = p.id === id; });
    }
    return plan;
  });
}

export async function planSil(kiraci: string, id: string): Promise<void> {
  await degistir<Depo, void>(kiraci, ALAN, cozDepo, (depo) => {
    const plan = depo.planlar.find((p) => p.id === id);
    if (!plan) throw new KomisyonHatasi('Plan bulunamadı.', 404);
    if (plan.varsayilan && depo.planlar.length > 1) {
      throw new KomisyonHatasi('Varsayılan plan silinemez; önce başka bir planı varsayılan yapın.', 409);
    }
    depo.planlar = depo.planlar.filter((p) => p.id !== id);
  });
}

export interface HakedisGirdisi {
  ggr: number;
  /** `null` = ölçülemedi. CPA bileşeni bu durumda hesaplanamaz. */
  ftdSayisi: number | null;
  /**
   * Önceki dönemden devreden ZARAR (net gelir birimi, negatif ya da 0).
   *
   * Ödeme devriyle AYNI ŞEY DEĞİL ve karıştırmak sessiz bir hata
   * üretir: biri gelir tabanına giriyor ve yüzdeyle çarpılıyor, diğeri
   * zaten hesaplanmış bir ödeme. Tek alanda toplamak, birikmiş ödemeyi
   * bir kez daha yüzdeye tabi tutardı.
   */
  devredenZarar?: number;
  /** Önceki dönemde asgari ödemenin altında kaldığı için ödenmemiş tutar. */
  devredenOdeme?: number;
}

export interface Hakedis {
  brutGelir: number;
  yonetimGideri: number;
  netGelir: number;
  /** Devreden zarar uygulandıktan sonraki gelir tabanı. */
  hesapTabani: number;
  gelirPayi: number;
  cpaPayi: number;
  /** CPA bileşeni ölçülemediyse dolu; panelde sebep olarak gösterilir. */
  cpaHesaplanamadiSebebi: string | null;
  /** Bu dönemin kazancı + devreden ödeme. */
  toplam: number;
  /** Ödenecek tutar; asgari ödemenin altındaysa 0. */
  odenecek: number;
  sonrakiDevredenZarar: number;
  sonrakiDevredenOdeme: number;
}

/**
 * Bir dönemin hakedişini hesaplar.
 *
 * Sıra önemli: önce işletme payı düşülüyor, sonra devreden zarar
 * uygulanıyor, en sonda ortağın yüzdesi. Zararı yüzdeden SONRA
 * uygulamak, geçen ayın zararını ortağın payından değil brütten
 * silmek olurdu ve zararın tamamı ortağa yüklenirdi.
 */
export function hakedisHesapla(plan: KomisyonPlani, girdi: HakedisGirdisi): Hakedis {
  const brutGelir = Number(girdi.ggr) || 0;
  const yonetimGideri = kurusa(Math.max(0, brutGelir) * (plan.yonetimGideriYuzde / 100));
  const netGelir = kurusa(brutGelir - yonetimGideri);
  // Devreden zarar yalnizca NEGATIF olabilir; pozitif bir deger gelirse
  // yok sayiliyor, aksi halde gecmis bir ay ortaga iki kez kazanc yazardi.
  const devredenZarar = Math.min(0, Number(girdi.devredenZarar) || 0);
  const devredenOdeme = Math.max(0, Number(girdi.devredenOdeme) || 0);
  const hesapTabani = kurusa(netGelir + devredenZarar);

  const gelirPayliMi = plan.tur === 'gelir-payi' || plan.tur === 'hibrit';
  const cpaliMi = plan.tur === 'cpa' || plan.tur === 'hibrit';

  const gelirPayi = gelirPayliMi && hesapTabani > 0
    ? kurusa(hesapTabani * (plan.gelirPayiYuzde / 100))
    : 0;

  let cpaPayi = 0;
  let cpaHesaplanamadiSebebi: string | null = null;
  if (cpaliMi) {
    if (girdi.ftdSayisi === null) {
      cpaHesaplanamadiSebebi =
        'İlk yatırım (FTD) sayısı bu backoffice bağlantısından ölçülemiyor; CPA bileşeni hesaplanamadı.';
    } else {
      cpaPayi = kurusa(Math.max(0, girdi.ftdSayisi) * plan.cpaTutari);
    }
  }

  const toplam = kurusa(gelirPayi + cpaPayi + devredenOdeme);
  const asgariAltinda = toplam < plan.asgariOdeme;

  return {
    brutGelir,
    yonetimGideri,
    netGelir,
    hesapTabani,
    gelirPayi,
    cpaPayi,
    cpaHesaplanamadiSebebi,
    toplam,
    odenecek: asgariAltinda ? 0 : toplam,
    // Taban negatifse ortak sifir alir ama zarar KAYBOLMAZ: devir aciksa
    // sonraki doneme tasinir.
    sonrakiDevredenZarar: hesapTabani < 0 && plan.negatifDevir ? hesapTabani : 0,
    // Asgarinin altindaki kazanc SILINMIYOR, biriksin diye devrediyor.
    // Silmek, dusuk hacimli bir ortagin hicbir zaman odeme alamamasi
    // demek olurdu.
    sonrakiDevredenOdeme: asgariAltinda ? toplam : 0,
  };
}

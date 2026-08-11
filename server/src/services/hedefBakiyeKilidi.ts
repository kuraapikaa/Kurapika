/**
 * Hedef bakiyeye ulasan Telegram freespin oyuncusunun bahis yetkisi.
 *
 * ── Istenen kural ─────────────────────────────────────────────────────
 *
 * "100 Telegram Freespin ile bakiye 2500₺'yi gectigi an oyuncu bahis
 * yetkisi kapatilsin, cunku hedef bakiyeye ulasmis oluyor."
 *
 * 100 FS Telegram Katil Bonusu bir KAZANIM TAVANI olan promosyon:
 * oyuncuya bedava donus verilir, tavana ulastiginda promosyon amacina
 * ulasmis olur ve bakiye cekime hazir hale gelir. Tavandan sonra
 * oynamaya devam etmek bonusun maliyetini ongorulemez kiliyor.
 *
 * ── Bu dosya ne yapar ─────────────────────────────────────────────────
 *
 * Yalnizca KARARI verir. Lynon'a istek atmaz, saat okumaz, log yazmaz.
 * Boylece kural tek basina test edilebilir; asil risk zaten kararin
 * kendisinde: yanlis karar gercek bir oyuncunun bahsini kapatir.
 *
 * ── Uc ────────────────────────────────────────────────────────────────
 *
 *   GET/PUT /api/limit/api/v1.0/userSettings/userSettings/{siteId}/{playerId}/restrictions
 *
 * GET yaniti: { restrictions: [{ restriction, isRestricted, lastNote, ... }] }
 * Kisit adlari: casinoBet, sportsBet, withdraw, deposit, promotions.
 *
 * DIKKAT: `withdraw` ve `deposit` bu akista ASLA kapatilmaz. Hedefe
 * ulasan oyuncunun parasini cekebilmesi gerekir; cekimi kapatmak
 * promosyonun amacina da mevzuata da aykiri olur.
 */

export type Kisit = {
  restriction?: unknown;
  isRestricted?: unknown;
  lastNote?: unknown;
  updatedAt?: unknown;
};

/** Bu akista kapatilmasina izin verilen kisitlar. Beyaz liste, kara liste degil. */
export const IZINLI_KISITLAR = ['casinoBet', 'sportsBet'] as const;
export type IzinliKisit = (typeof IZINLI_KISITLAR)[number];

export function izinliKisitMi(ad: string): ad is IzinliKisit {
  return (IZINLI_KISITLAR as readonly string[]).includes(ad);
}

/** Verilen kisit su an acik mi? Kayit yoksa "kisitli degil" sayilir. */
export function kisitliMi(kisitlar: Kisit[] | null | undefined, ad: string): boolean {
  const satir = (kisitlar ?? []).find(
    (k) => String(k?.restriction ?? '').trim().toLowerCase() === ad.trim().toLowerCase(),
  );
  return satir?.isRestricted === true;
}

export type HedefKarari =
  | { kapat: true; neden: string }
  | { kapat: false; neden: string };

/**
 * Bahis yetkisi kapatilsin mi?
 *
 * Bakiye BILINMIYORSA (null) karar HAYIR'dir. Okunamayan bakiyeyi sifir
 * saymak burada tehlikesiz gorunur ama tersi de dogru degil: eksik veriyle
 * kisit acmak, olcmeden ceza kesmektir.
 */
export function hedefKarari(input: {
  bakiye: number | null;
  esik: number;
  zatenKisitli: boolean;
}): HedefKarari {
  const { bakiye, esik, zatenKisitli } = input;

  if (zatenKisitli) return { kapat: false, neden: 'Bahis yetkisi zaten kapalı.' };
  if (bakiye === null || !Number.isFinite(bakiye)) {
    return { kapat: false, neden: 'Bakiye okunamadı; ölçülmeden kısıt açılmaz.' };
  }
  if (!Number.isFinite(esik) || esik <= 0) {
    return { kapat: false, neden: 'Hedef eşiği geçersiz.' };
  }
  // "Geçtiği an" — eşiğe eşit olmak yetmez, GEÇMESİ gerekir.
  if (bakiye <= esik) {
    return { kapat: false, neden: `Bakiye ${bakiye} ₺, hedef ${esik} ₺ henüz aşılmadı.` };
  }
  return { kapat: true, neden: `Bakiye ${bakiye} ₺ hedef ${esik} ₺'yi aştı.` };
}

/** Lynon not alani kisa; 50 karakter uzerini kirp. */
export function hedefNotu(esik: number, bakiye: number): string {
  return `Hedef ${esik} TRY asildi (${Math.round(bakiye)})`.slice(0, 50);
}

/**
 * Esigi asan bakiyeyi SABIT bir degere indirmek icin gereken tutar.
 *
 * Negatif donmez: bakiye zaten hedefin altindaysa (bir onceki turda
 * indirilmis olabilir) 0 doner — `lynonAdjustPlayerMainAccount` pozitif
 * olmayan tutari reddeder, bu yuzden cagiran taraf 0 iken istek atmamali.
 */
export function hedefBakiyeDuzeltmeTutari(bakiye: number, hedefBakiye: number): number {
  if (!Number.isFinite(bakiye) || !Number.isFinite(hedefBakiye)) return 0;
  return Math.max(0, Math.round((bakiye - hedefBakiye) * 100) / 100);
}

/** Bakiye duzeltmesi icin Lynon not alani; 50 karakter uzerini kirp. */
export function hedefBakiyeDuzeltmeNotu(hedefBakiye: number, oncekiBakiye: number): string {
  return `Bakiye ${hedefBakiye} TRY'ye sabitlendi (${Math.round(oncekiBakiye)})`.slice(0, 50);
}

export type BonusOturumu = {
  playerId?: unknown;
  campaignId?: unknown;
  bonusId?: unknown;
  assignedDate?: unknown;
  claimedDate?: unknown;
};

/**
 * Kontrol edilecek oyuncular.
 *
 * Yalnizca HEDEF KAMPANYANIN bonusunu almis oyuncular. Kampanya ya da
 * bonus kimligi eslesmiyorsa oyuncu listeye girmez — kural sitenin
 * tamamina degil, bu promosyona ait.
 *
 * `gunPenceresi` eski verilislere geri donup bugun kisit acmayi engeller;
 * gecmise donuk toplu kisitlama bu isin en tehlikeli yan etkisi olurdu.
 */
export function kilitAdaylari(
  oturumlar: BonusOturumu[] | null | undefined,
  secenek: {
    campaignId?: number | null;
    bonusId?: number | null;
    gunPenceresi: number;
    simdi?: number;
  },
): number[] {
  const { campaignId, bonusId, gunPenceresi } = secenek;
  const simdi = secenek.simdi ?? Date.now();
  const enEski = simdi - Math.max(0, gunPenceresi) * 86_400_000;

  const kimlikler = new Set<number>();
  for (const oturum of oturumlar ?? []) {
    if (!oturum) continue;

    const kampanya = Number(oturum.campaignId);
    const bonus = Number(oturum.bonusId);
    const kampanyaEslesir = campaignId != null && Number.isFinite(kampanya) && kampanya === campaignId;
    const bonusEslesir = bonusId != null && Number.isFinite(bonus) && bonus === bonusId;
    // Ikisinden biri yeter; Lynon kampanyayi klonlarsa bonus kimligi,
    // bonusu degistirirse kampanya kimligi yakalar.
    if (!kampanyaEslesir && !bonusEslesir) continue;

    const zaman = Date.parse(String(oturum.claimedDate ?? oturum.assignedDate ?? ''));
    if (!Number.isFinite(zaman) || zaman < enEski) continue;

    const playerId = Number(oturum.playerId);
    if (!Number.isFinite(playerId) || playerId <= 0) continue;
    kimlikler.add(playerId);
  }
  return [...kimlikler];
}

/**
 * Oyuncunun TUM bonus gecmisinde (gun penceresi sinirlamasi OLMADAN)
 * yalnizca hedef kampanya/bonus mu goruluyor?
 *
 * "Sadece Telegram Katil Bonusu" saflik filtresi: bu bonus disinda HIC
 * bonus almamis oyuncu bir bonus-avcisi hesabi olma ihtimali yuksek;
 * baska kampanyalari da olan (gercek katilim gecmisi olan) bir oyuncuya
 * bakiye sabitleme/kisit UYGULANMAMALI — tek bir bedava bonus icin
 * gelmis birinden farkli.
 *
 * `kilitAdaylari`'nin aksine gun penceresi kullanmaz: bu bir ORTALIK
 * ozelligi (omur boyu bonus cesitliligi), "yakin zamanda ne aldi"
 * degil.
 */
export function sadeceHedefBonusuVarMi(
  oturumlar: BonusOturumu[] | null | undefined,
  playerId: number,
  secenek: { campaignId?: number | null; bonusId?: number | null },
): boolean {
  const { campaignId, bonusId } = secenek;
  let hedefBulundu = false;

  for (const oturum of oturumlar ?? []) {
    if (!oturum) continue;
    if (Number(oturum.playerId) !== playerId) continue;

    const kampanya = Number(oturum.campaignId);
    const bonus = Number(oturum.bonusId);
    const kampanyaEslesir = campaignId != null && Number.isFinite(kampanya) && kampanya === campaignId;
    const bonusEslesir = bonusId != null && Number.isFinite(bonus) && bonus === bonusId;

    if (kampanyaEslesir || bonusEslesir) {
      hedefBulundu = true;
    } else {
      // Baska bir kampanya/bonus goruldu — "sadece" kosulu bozuldu.
      return false;
    }
  }
  return hedefBulundu;
}

/**
 * PUT govdesi.
 *
 * Lynon'un yazma sozlesmesi belgelenmemis; GET yanitinin sekli tek
 * ipucu. Iki aday govde uretilir ve is akisi birincisi reddedilirse
 * ikincisini dener. Tahmini tek govdeye gomup sessizce basarisiz olmak
 * yerine, denenen sekiller burada acikca duruyor.
 */
export function kisitGovdeleri(ad: string, kisitli: boolean, not: string): Array<Record<string, unknown>> {
  return [
    { restriction: ad, isRestricted: kisitli, note: not },
    { restrictions: [{ restriction: ad, isRestricted: kisitli, note: not }] },
  ];
}

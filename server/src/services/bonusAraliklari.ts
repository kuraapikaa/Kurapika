/**
 * TEK KURAL, BIRDEN FAZLA BONUS ID — YATIRIM ARALIGINA GORE.
 *
 * ── Ihtiyac ───────────────────────────────────────────────────────────
 *
 * Lynon tarafinda ayni kampanyanin kademeleri AYRI bonus tanimlari
 * olarak duruyor (500-4.999 icin bir ID, 5.000-19.999 icin baska bir ID).
 * Kural Merkezi ise kural basina TEK `partnerBonusId` tutuyordu; ayni
 * kampanyayi uc kademeyle vermek icin uc ayri kural acmak, uc ayri
 * limit/kosul seti bakimini yapmak ve oyuncuya listede uc satir
 * gostermek gerekiyordu.
 *
 * Artik bir kural birden fazla bonus ID tasiyabiliyor; hangisinin
 * verilecegini oyuncunun YATIRIM TUTARI belirliyor. Oyuncu listede tek
 * bir bonus goruyor, kademeler kuralin icinde kaliyor.
 *
 * ── Kasitli kararlar ──────────────────────────────────────────────────
 *
 * 1. HIC ARALIK TUTMAZSA BONUS VERILMEZ (`null` doner).
 *    Kural duzeyindeki eski `partnerBonusId`'ye SESSIZCE dusulmuyor:
 *    aralik listesi tanimlanmissa niyet acik, bosluga denk gelen bir
 *    yatirima "herhangi bir bonus" vermek yanlis bonus vermektir.
 *    Aralik tanimli DEGILSE eski davranis aynen surer.
 *
 * 2. ARALIKLAR CAKISAMAZ. Cakisma kaydetme aninda reddedilir; calisma
 *    aninda "once eslesen kazanir" gibi sirali bir kural olsaydi
 *    listenin sirasi para anlamina gelirdi ve editorde gorunmezdi.
 *
 * 3. LIMITLER KURAL DUZEYINDE. Uc ID tek bir bonus sayilir; `perDayLimit`
 *    kuralin tamamina uygulanir. Aksi halde oyuncu ayni gun once dusuk
 *    kademeyi, sonra yuksek kademeyi alabilirdi.
 *
 * 4. TABAN, mevcut `minDepositAmount`/`maxDepositAmount` ile AYNI:
 *    `depositBasis()` (son yatirim tutari). Iki ayri taban olsaydi ayni
 *    ekranda iki farkli "yatirim" kavrami dolasirdi.
 */

/** Bir bonus ID'sinin gecerli oldugu yatirim araligi. */
export type PartnerBonusAraligi = {
  /** Alt sinir, dahil. */
  min: number;
  /** Ust sinir, dahil. Verilmezse ust sinir yoktur. */
  max?: number | null;
  /** Bu aralikta verilecek Lynon bonus tanimi. */
  partnerBonusId: string;
};

type AralikTasiyan = {
  partnerBonusId?: string;
  partnerBonusRanges?: PartnerBonusAraligi[] | null;
};

function sayi(deger: unknown): number | null {
  if (deger === null || deger === undefined || deger === '') return null;
  const n = Number(deger);
  return Number.isFinite(n) ? n : null;
}

/** Ham girdiyi (panelden string gelebilir) normalize eder; bozuk satirlar duser. */
export function araliklariNormalize(ham: unknown): PartnerBonusAraligi[] {
  if (!Array.isArray(ham)) return [];
  const cikti: PartnerBonusAraligi[] = [];

  for (const satir of ham) {
    if (!satir || typeof satir !== 'object') continue;
    const kayit = satir as Record<string, unknown>;
    const id = String(kayit.partnerBonusId ?? '').trim();
    const min = sayi(kayit.min);
    const maxHam = sayi(kayit.max);

    // ID'siz ya da alt sinirsiz satir anlamsiz; ust sinir istege bagli.
    if (!id) continue;
    if (min === null || min < 0) continue;
    if (maxHam !== null && maxHam < min) continue;

    cikti.push({ min, max: maxHam, partnerBonusId: id });
  }

  return cikti.sort((a, b) => a.min - b.min);
}

/**
 * Aralik listesini dogrular. Kaydetme aninda cagrilir — calisma aninda
 * cakismayi cozmeye calismak yerine hic olusmasina izin vermiyoruz.
 */
export function araliklariDogrula(araliklar: PartnerBonusAraligi[]): { gecerli: boolean; hata?: string } {
  if (araliklar.length === 0) return { gecerli: true };

  const sirali = [...araliklar].sort((a, b) => a.min - b.min);

  for (let i = 0; i < sirali.length; i++) {
    const su = sirali[i];
    if (su.max != null && su.max < su.min) {
      return { gecerli: false, hata: `Aralik ust siniri alt sinirdan kucuk: ${su.min}–${su.max}` };
    }

    const sonraki = sirali[i + 1];
    if (!sonraki) continue;

    // Ust siniri olmayan bir aralik kendisinden sonraki her seyi yutar.
    if (su.max == null) {
      return {
        gecerli: false,
        hata: `${su.min} ve uzeri araligi ust sinirsiz; sonrasinda baska aralik tanimlanamaz.`,
      };
    }
    if (sonraki.min <= su.max) {
      return {
        gecerli: false,
        hata: `Araliklar cakisiyor: ${su.min}–${su.max} ile ${sonraki.min}–${sonraki.max ?? '∞'}`,
      };
    }
  }

  return { gecerli: true };
}

/**
 * Verilen yatirim tutari icin hangi bonus ID verilecek?
 *
 * - Aralik tanimli degilse: kuralin kendi `partnerBonusId`'si (eski davranis).
 * - Aralik tanimliysa ve tutar bir araliga dusuyorsa: o araligin ID'si.
 * - Aralik tanimli ama tutar hicbirine dusmuyorsa: `null` (bonus yok).
 */
export function araligaGorePartnerBonusId(spec: AralikTasiyan | undefined | null, tutar: number): string | null {
  const araliklar = araliklariNormalize(spec?.partnerBonusRanges);

  if (araliklar.length === 0) {
    const varsayilan = String(spec?.partnerBonusId ?? '').trim();
    return varsayilan || null;
  }

  if (!Number.isFinite(tutar)) return null;

  const eslesen = araliklar.find((a) => tutar >= a.min && (a.max == null || tutar <= a.max));
  return eslesen ? eslesen.partnerBonusId : null;
}

/**
 * Kuralin sahiplendigi TUM bonus ID'leri.
 *
 * Kampanya -> kural aramasi bunu kullanir: oyuncu hangi kademeye tiklarsa
 * tiklasin ayni kurala ulasmali. Tekil ve sirali doner.
 */
export function specPartnerBonusIdleri(spec: AralikTasiyan | undefined | null): string[] {
  const kume = new Set<string>();

  const varsayilan = String(spec?.partnerBonusId ?? '').trim();
  if (varsayilan) kume.add(varsayilan);

  for (const aralik of araliklariNormalize(spec?.partnerBonusRanges)) {
    kume.add(aralik.partnerBonusId);
  }

  return [...kume];
}

/** Kural verilen bonus ID'yi sahipleniyor mu? */
export function specBonusIdSahipleniyorMu(spec: AralikTasiyan | undefined | null, bonusId: unknown): boolean {
  const aranan = String(bonusId ?? '').trim();
  if (!aranan) return false;
  return specPartnerBonusIdleri(spec).includes(aranan);
}

/** Panelde gosterilecek ozet: "500–4.999 → 5001, 5.000+ → 5002". */
export function araliklariOzetle(araliklar: PartnerBonusAraligi[]): string {
  return araliklariNormalize(araliklar)
    .map((a) => `${a.min}–${a.max ?? '∞'} → ${a.partnerBonusId}`)
    .join(' · ');
}

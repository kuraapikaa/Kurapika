/**
 * BİR BONUSUN KURALINI BAŞKA BİR BONUSA KOPYALAMA.
 *
 * İşin tamamı şu ayrımda: bir kuralın hangi alanları o bonusun KİMLİĞİ,
 * hangileri taşınabilir AYARI.
 *
 * Kimlik alanlarını da kopyalamak sessiz ve pahalı bir hata olurdu:
 * `partnerBonusId` taşınsaydı yapıştırılan bonus, kopyalandığı bonusun
 * Lynon kampanyasını dağıtmaya başlardı -- panelde her şey doğru
 * görünürken oyunculara yanlış bonus giderdi.
 *
 * Yaklaşım BİLEREK kara liste: amaç "iki kural aynı olsun". Beyaz liste
 * kullanılsaydı `PromoSpec`e sonradan eklenen her ayar sessizce
 * kopyalanmaz, operatör yapıştırdığını sanarken iki kural birbirinden
 * ayrı kalırdı. Yeni bir KİMLİK alanı eklendiğinde aşağıdaki listeye de
 * yazılması gerekiyor.
 */

/** `PromoSpec`in kopyalanmayan alanları ve sebepleri. */
export const KOPYALANMAYAN: Record<string, string> = {
  title: 'Kuralın kendi adı; hedef bonusun adı korunur.',
  partnerBonusId:
    'Lynon kampanya kimliği. Taşınsaydı hedef bonus, kopyalandığı bonusun kampanyasını dağıtırdı.',
  partnerBonusRanges:
    'Aralıkların her biri bir kampanya kimliği taşıyor; eşikleri kimliksiz taşımak hiçbir yere işaret etmeyen aralıklar bırakırdı.',
  enabled:
    'Bonusun açık/kapalı olması. Kopyalansaydı kapalı bir bonus yapıştırmayla sessizce yayına girebilirdi.',
  type: 'Bonusun dağıtım türü (partner/nakit/çark); hedefin kendi türüne bağlı.',
  assignmentValues:
    'Lynon atama parametreleri kampanyaya özel; başka kampanyaya taşımak geçersiz atama üretir.',
  /*
   * FREESPİN GRUBUNUN TAMAMI kimlik sayılıyor ve grup BÖLÜNMÜYOR.
   *
   * Oyun seçimi (id + sağlayıcı) kampanyanın kendi freespin bloğuna ait;
   * başka kampanyaya taşımak freespin'i yanlış oyunda tanımlar ya da
   * Lynon atamayı reddeder.
   *
   * Sayıyı/bahis seviyesini oyunsuz taşımak ise daha da kötü: sunucu
   * `BetLevel`/`RoundCount` doluyken geçerli bir `Game` arıyor
   * (rulesService `saveRules`) ve KAYDI REDDEDİYOR -- yani yapıştırma
   * hiç çalışmazdı. Hedefin kendi freespin ayarı olduğu gibi kalıyor.
   */
  freespinGame: 'Freespin oyunu kampanyaya özel; hedefin kendi ayarı korunur.',
  freespinGameId: 'Freespin oyun kimliği kampanyaya özel.',
  freespinGameProviderId: 'Freespin sağlayıcı kimliği kampanyaya özel.',
  freespinBetLevel: 'Freespin bahis seviyesi oyundan ayrı taşınamaz (sunucu kaydı reddeder).',
  freespinCount: 'Freespin adedi oyundan ayrı taşınamaz (sunucu kaydı reddeder).',
};

export type KuralFarki = {
  /** Yapıştırma sonrası değeri değişecek alanlar. */
  degisen: Array<{ alan: string; onceki: unknown; yeni: unknown }>;
  /** Kaynakta olup hedefte olmayan, eklenecek alanlar. */
  eklenen: string[];
  /** Hedefte olup kaynakta olmayan, TEMİZLENECEK alanlar. */
  temizlenen: string[];
  /** Kimlik olduğu için hiç dokunulmayan alanlar. */
  atlanan: string[];
};

function kimlikMi(alan: string): boolean {
  return Object.prototype.hasOwnProperty.call(KOPYALANMAYAN, alan);
}

/** İki değerin panelde aynı sayılıp sayılmayacağı. */
export function ayniDegerMi(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // `undefined` ile "hiç yok" panelde aynı şey; null da öyle.
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Kuralın taşınabilir kısmını çıkarır.
 * Sonuç KOPYA -- kaynak kural sonradan düzenlense de pano bozulmaz.
 */
export function kuralKopyasiCikar<T extends Record<string, any>>(kural: T | null | undefined): Record<string, unknown> {
  const kaynak = (kural ?? {}) as Record<string, unknown>;
  const cikti: Record<string, unknown> = {};
  for (const alan of Object.keys(kaynak)) {
    if (kimlikMi(alan)) continue;
    if (kaynak[alan] === undefined) continue;
    cikti[alan] = derinKopya(kaynak[alan]);
  }
  return cikti;
}

/**
 * Yapıştırma sonucu.
 *
 * Taşınabilir alanlar DEĞİŞTİRİLİYOR, birleştirilmiyor: amaç iki kuralın
 * gerçekten aynı olması. Birleştirseydik kaynakta olmayan ama hedefte
 * duran bir ayar (ör. hedefteki `perDayLimit`) yerinde kalır, operatör
 * kuralları eşitlediğini sanırken aralarında görünmez bir fark kalırdı.
 *
 * Kimlik alanları hedefte olduğu gibi korunuyor.
 */
export function kuraliYapistir<T extends Record<string, any>>(
  hedef: T | null | undefined,
  kopya: Record<string, unknown> | null | undefined,
): T & Record<string, unknown> {
  const mevcut = (hedef ?? {}) as Record<string, unknown>;
  const gelen = (kopya ?? {}) as Record<string, unknown>;

  const sonuc: Record<string, unknown> = {};
  for (const alan of Object.keys(mevcut)) {
    if (kimlikMi(alan)) sonuc[alan] = mevcut[alan];
  }
  for (const alan of Object.keys(gelen)) {
    if (kimlikMi(alan)) continue;
    sonuc[alan] = derinKopya(gelen[alan]);
  }
  return sonuc as T & Record<string, unknown>;
}

/**
 * Yapıştırmadan ÖNCE gösterilecek fark.
 *
 * Canlı bir bonusun kuralını körlemesine ezmek geri alması zor bir iş;
 * operatör neyin değişeceğini, neyin silineceğini ve neye hiç
 * dokunulmadığını görmeden onaylamamalı.
 */
export function yapistirmaFarki(
  hedef: Record<string, any> | null | undefined,
  kopya: Record<string, unknown> | null | undefined,
): KuralFarki {
  const mevcut = (hedef ?? {}) as Record<string, unknown>;
  const gelen = (kopya ?? {}) as Record<string, unknown>;

  const degisen: KuralFarki['degisen'] = [];
  const eklenen: string[] = [];
  const temizlenen: string[] = [];

  for (const alan of Object.keys(gelen)) {
    if (kimlikMi(alan)) continue;
    if (ayniDegerMi(mevcut[alan], gelen[alan])) continue;
    degisen.push({ alan, onceki: mevcut[alan], yeni: gelen[alan] });
    if (mevcut[alan] === undefined) eklenen.push(alan);
  }

  for (const alan of Object.keys(mevcut)) {
    if (kimlikMi(alan)) continue;
    if (mevcut[alan] === undefined) continue;
    if (Object.prototype.hasOwnProperty.call(gelen, alan)) continue;
    temizlenen.push(alan);
    degisen.push({ alan, onceki: mevcut[alan], yeni: undefined });
  }

  const atlanan = Object.keys(KOPYALANMAYAN).filter(
    (alan) => mevcut[alan] !== undefined || gelen[alan] !== undefined,
  );

  return { degisen, eklenen, temizlenen, atlanan };
}

function derinKopya<T>(deger: T): T {
  if (deger === null || typeof deger !== 'object') return deger;
  try {
    return JSON.parse(JSON.stringify(deger)) as T;
  } catch {
    return deger;
  }
}

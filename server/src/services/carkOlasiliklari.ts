/**
 * Cark olasilik analizi.
 *
 * ── Bildirilen sorun ──────────────────────────────────────────────────
 *
 * "Cark neden surekli pas donderiyor?"
 *
 * Iki ayri sebep var ve ikincisi sessiz.
 *
 * ── 1. Varsayilan yapilandirma ────────────────────────────────────────
 *
 * Varsayilan carkta kayip dilimi ("Tekrar Dene") %97, tek gercek odul
 * olan 500 TL Freebet %3. Kalan on dilimin olasiligi SIFIR. Yani cark
 * tasarim geregi yuz turun doksan yedisinde pas donuyor.
 *
 * ── 2. Yapilandirilmamis dilimler SESSIZCE devre disi ─────────────────
 *
 * `cekilebilirMi` uc dilimi cekilise sokmuyor:
 *   • `requiresConfiguration: true` — Lynon teslimatina baglanmamis
 *   • `type: 'physical'` — fiziksel odul carkta dagitilmiyor
 *   • `type: 'cash'` ve tutar > 1000 — yuksek nakit carkta dagitilmiyor
 *
 * Bu dogru bir koruma: teslim edilemeyecek bir odulu "kazandiniz" deyip
 * ardindan hata gostermek en kotu sonuc. AMA operator admin panelinde o
 * dilimlere olasilik verebiliyor ve HICBIR UYARI GORMUYOR.
 *
 * Sonuc su: operator "150 TL Nakit"e %30 verip pasi %67'ye dusurdugunde,
 * motor nakit dilimini atiyor, toplam agirlik 70'e duyuyor ve pas
 * ORANI ARTIYOR — %67 sandigi sey %95,7 oluyor. Olasiligi dusurmek
 * pasi cogaltiyor. Bu dosya tam olarak bu celiskiyi olcup adlandiriyor.
 *
 * Burasi KARAR VERMEZ, yalnizca olcer; cekilis mantigi `games.ts` icinde.
 */

export type CarkDilimi = {
  id?: unknown;
  label?: unknown;
  probability?: unknown;
  type?: unknown;
  amount?: unknown;
  isLoss?: unknown;
  requiresConfiguration?: unknown;
  stock?: unknown;
};

/** Bu tutarin uzerindeki nakit oduller carkta dagitilmiyor. */
export const YUKSEK_NAKIT_ESIGI = 1000;

export type DisaridaKalmaNedeni =
  | 'yapilandirilmamis'
  | 'fiziksel'
  | 'yuksek-nakit'
  | 'olasilik-sifir';

export const NEDEN_ACIKLAMASI: Record<DisaridaKalmaNedeni, string> = {
  'yapilandirilmamis': 'Lynon teslimatına bağlanmamış (requiresConfiguration).',
  'fiziksel': 'Fiziksel ödüller çarkta dağıtılmıyor.',
  'yuksek-nakit': `Nakit tutarı ${YUKSEK_NAKIT_ESIGI} TL üzerinde; çarkta dağıtılmıyor.`,
  'olasilik-sifir': 'Olasılığı sıfır.',
};

function sayi(deger: unknown): number {
  const n = Number(deger);
  return Number.isFinite(n) ? n : 0;
}

function kayipMi(dilim: CarkDilimi): boolean {
  return dilim?.type === 'none' || dilim?.isLoss === true;
}

/**
 * Bir dilim neden cekilise girmiyor? Giriyorsa null.
 *
 * `games.ts` icindeki `cekilebilirMi` ile AYNI kurallari uygular;
 * aradaki fark, buranin gerekceyi de dondurmesi.
 */
export function disaridaKalmaNedeni(dilim: CarkDilimi): DisaridaKalmaNedeni | null {
  if (!dilim) return 'yapilandirilmamis';
  if (!kayipMi(dilim)) {
    if (dilim.requiresConfiguration === true) return 'yapilandirilmamis';
    if (dilim.type === 'physical') return 'fiziksel';
    if (dilim.type === 'cash' && sayi(dilim.amount) > YUKSEK_NAKIT_ESIGI) return 'yuksek-nakit';
  }
  if (sayi(dilim.probability) <= 0) return 'olasilik-sifir';
  return null;
}

export type DisKalan = {
  id: string;
  label: string;
  /** Operatorun panelde girdigi olasilik. */
  ayarlananOlasilik: number;
  neden: DisaridaKalmaNedeni;
  aciklama: string;
};

export type CarkAnalizi = {
  /** Cekilise giren dilim sayisi. */
  etkinDilim: number;
  /** Cekilise giren agirliklarin toplami. */
  toplamAgirlik: number;
  /** Pasin GERCEK yuzdesi (motorun uygulayacagi). */
  gercekPasYuzdesi: number | null;
  /** Operatorun panelde gordugu pas yuzdesi. */
  ayarlananPasYuzdesi: number | null;
  /**
   * Cekilise giremeyen ama olasilik ATANMIS dilimlerin toplam payi.
   * Bu pay kaybolmuyor, digerlerine — ozellikle pasa — dagiliyor.
   */
  kaybolanPay: number;
  disaridaKalanlar: DisKalan[];
  uyarilar: string[];
  /** Cekilise giren her dilimin gercek yuzdesi. */
  gercekDagilim: Array<{ id: string; label: string; yuzde: number }>;
};

/**
 * Carkin GERCEK davranisi.
 *
 * Panelde gorunen olasilik ile motorun uyguladigi olasilik arasindaki
 * farki hesaplar. Bu fark, "surekli pas donuyor" sikayetinin olculebilir
 * halidir.
 */
export function carkAnalizi(dilimler: CarkDilimi[] | null | undefined): CarkAnalizi {
  const liste = Array.isArray(dilimler) ? dilimler : [];

  const etkin: Array<{ dilim: CarkDilimi; agirlik: number }> = [];
  const disaridaKalanlar: DisKalan[] = [];
  let kaybolanPay = 0;

  for (const dilim of liste) {
    const neden = disaridaKalmaNedeni(dilim);
    const olasilik = Math.max(0, sayi(dilim?.probability));
    if (neden === null) {
      etkin.push({ dilim, agirlik: olasilik });
      continue;
    }
    /**
     * Olasiligi SIFIR olan dilim hicbir sey kaybettirmiyor; disarida
     * kalma sebebi ne olursa olsun raporlanmaz.
     *
     * Sebebe bakmak yetmiyordu: varsayilan carktaki on dilim hem
     * `requiresConfiguration: true` hem de olasilik 0. `disaridaKalmaNedeni`
     * once yapilandirmaya baktigi icin 'olasilik-sifir' donmuyor ve on
     * dilim birden "sorun" gibi listeleniyordu. Operatorun bakacagi liste
     * yalnizca GERCEKTEN pay kaybettiren dilimleri icermeli.
     */
    if (olasilik <= 0) continue;
    kaybolanPay += olasilik;
    disaridaKalanlar.push({
      id: String(dilim?.id ?? ''),
      label: String(dilim?.label ?? ''),
      ayarlananOlasilik: olasilik,
      neden,
      aciklama: NEDEN_ACIKLAMASI[neden],
    });
  }

  const toplamAgirlik = etkin.reduce((t, e) => t + e.agirlik, 0);
  const ayarlananToplam = liste.reduce((t, d) => t + Math.max(0, sayi(d?.probability)), 0);

  const pasAgirligi = etkin.filter((e) => kayipMi(e.dilim)).reduce((t, e) => t + e.agirlik, 0);
  const ayarlananPas = liste.filter(kayipMi).reduce((t, d) => t + Math.max(0, sayi(d?.probability)), 0);

  const gercekPasYuzdesi = toplamAgirlik > 0 ? (pasAgirligi / toplamAgirlik) * 100 : null;
  const ayarlananPasYuzdesi = ayarlananToplam > 0 ? (ayarlananPas / ayarlananToplam) * 100 : null;

  const gercekDagilim = etkin
    .filter((e) => e.agirlik > 0)
    .map((e) => ({
      id: String(e.dilim?.id ?? ''),
      label: String(e.dilim?.label ?? ''),
      yuzde: toplamAgirlik > 0 ? (e.agirlik / toplamAgirlik) * 100 : 0,
    }))
    .sort((a, b) => b.yuzde - a.yuzde);

  const uyarilar: string[] = [];

  if (toplamAgirlik <= 0) {
    uyarilar.push('Hiçbir dilim çekilişe giremiyor; çark her turda hata döndürür.');
  }

  if (kaybolanPay > 0) {
    const yuzde = ayarlananToplam > 0 ? (kaybolanPay / ayarlananToplam) * 100 : 0;
    uyarilar.push(
      `Çekilişe giremeyen dilimlere toplam %${yuzde.toFixed(1)} olasılık atanmış. ` +
      'Bu pay ödüle gitmiyor; kalan dilimlere — ağırlıklı olarak kayıp dilimine — dağılıyor.',
    );
  }

  if (
    gercekPasYuzdesi !== null &&
    ayarlananPasYuzdesi !== null &&
    gercekPasYuzdesi - ayarlananPasYuzdesi > 0.5
  ) {
    uyarilar.push(
      `Panelde kayıp oranı %${ayarlananPasYuzdesi.toFixed(1)} görünüyor ama gerçekte ` +
      `%${gercekPasYuzdesi.toFixed(1)} uygulanıyor. Olasılığı düşürmek pası çoğaltıyor.`,
    );
  }

  if (gercekPasYuzdesi !== null && gercekPasYuzdesi >= 100) {
    uyarilar.push('Çekilişe giren tek dilim kayıp dilimi; çark her turda pas döndürür.');
  } else if (gercekPasYuzdesi !== null && gercekPasYuzdesi >= 90) {
    uyarilar.push(`Turların %${gercekPasYuzdesi.toFixed(1)}'i pas dönüyor.`);
  }

  return {
    etkinDilim: etkin.filter((e) => e.agirlik > 0).length,
    toplamAgirlik,
    gercekPasYuzdesi,
    ayarlananPasYuzdesi,
    kaybolanPay,
    disaridaKalanlar,
    uyarilar,
    gercekDagilim,
  };
}

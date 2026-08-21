/**
 * BONUS TALEBININ GIRDI DOGRULAMASI.
 *
 * Neden ayri bir dosya: bu kural rota govdesine gomuluyken canlida bir
 * hata olarak yasandi ve testi yoktu.
 *
 * ── Yasanan ───────────────────────────────────────────────────────────
 *
 * `/admin/bonus/charge` girdiyi soyle eliyordu:
 *
 *   if (!Number.isFinite(Number(ClientId)) || !Number.isFinite(Number(BonusId)))
 *
 * BonusId'nin her zaman Lynon kampanya ID'si (sayi) oldugu varsayilmisti.
 * Oysa NAKIT bonuslarin Lynon karsiligi YOK; `sanalNakitBonuslar` onlari
 * kural tanimindan uretiyor ve `backofficeId` olarak KURAL ANAHTARINI
 * veriyor. Canlida o anahtar "kayip-bonusu" idi:
 *
 *   Number('kayip-bonusu') -> NaN -> 400
 *
 * Sonuc: nakit bonuslarin TAMAMI talep edilemiyordu. Uygunluk ekrani
 * "hesabiniz bu bonus icin uygun gorunuyor" diyor, oyuncu talebi
 * gonderiyor, istek 3ms icinde reddediliyordu. Uc ms, hicbir dis servise
 * gidilmedigin isareti — hata Lynon'da degil, kapida.
 *
 * ── Kural ─────────────────────────────────────────────────────────────
 *
 * ClientId GERCEKTEN sayi olmali: Lynon'a oyuncu kimligi olarak gidiyor.
 * BonusId icin tek sart bos olmamasi. Gecerli bir kurala karsilik gelip
 * gelmedigi burada DEGIL, `resolveBonusRule` ile belirlenir ve oyuncuya
 * 409 + acik gerekce olarak doner. Bu ayrim onemli: "bicimsiz istek"
 * (400) ile "boyle bir kural yok" (409) ayni sey degil.
 */

export type BonusTalepGirdisi = {
  ClientId?: unknown;
  BonusId?: unknown;
};

export type GirdiSonucu =
  | { gecerli: true; oyuncuId: number; bonusKimligi: string }
  | { gecerli: false; sebep: 'oyuncu' | 'bonus' };

export function bonusTalepGirdisiniDogrula(govde: BonusTalepGirdisi): GirdiSonucu {
  const oyuncuId = Number(govde?.ClientId);
  if (!Number.isFinite(oyuncuId)) return { gecerli: false, sebep: 'oyuncu' };

  // `String(null)` -> "null" tuzagina dusmemek icin once null/undefined
  // eleniyor; aksi halde bos govde gecerli sayilirdi.
  const ham = govde?.BonusId;
  if (ham === null || ham === undefined) return { gecerli: false, sebep: 'bonus' };

  const bonusKimligi = String(ham).trim();
  if (!bonusKimligi) return { gecerli: false, sebep: 'bonus' };

  return { gecerli: true, oyuncuId, bonusKimligi };
}

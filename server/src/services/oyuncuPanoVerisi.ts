/**
 * Oyuncu pano verisi.
 *
 *   GET /api/report/api/v1.0/dashboardData/player/{siteId}/{playerId}/dashboard/{currency}
 *
 * Site panosunun oyuncu karsiligi. Degerler "9.52 TRY" gibi birim ekli
 * METIN ya da duz sayi olabiliyor; tarih alanlari `null` gelebiliyor.
 *
 * ── Neden ayri bir modul ──────────────────────────────────────────────
 *
 * `lynonPlayerKpi` bu ucu okuyor ama cikisini eski BetConstruct alan
 * adlarina (`TotalCasinoStakes`, `ProfitAndLose`…) cevirip bir kismini
 * kaybediyor. Cekim degerlendirmesinde asil lazim olan ayrimlar orada
 * eziliyordu: casino ile spor, gercek ile bonus, freespin kazanci.
 *
 * Burada alanlar OLDUGU GIBI, etiketli ve emojili olarak cikiyor.
 *
 * ── Sifir ile yokluk ayrimi ───────────────────────────────────────────
 *
 * Ornek yanitta `"TOTAL DEPOSITS AMOUNT": "0 TRY"` ve
 * `"LAST DEPOSIT DATE": null` birlikte geliyor: oyuncu HIC yatirim
 * yapmamis ama bakiyesi 9.52 ve freespin kazanci 47.4. Yani "0" gercek
 * bir olcum, `null` ise olcum yoklugu. Ikisini ayni gostermek, hic
 * yatirim yapmamis bir oyuncunun cekim talebini sirada normal
 * gosterirdi.
 */

type AnyRecord = Record<string, any>;

/**
 * "9.52 TRY" / "0 TRY" / 0 → sayi.
 *
 * Alan yanitta YOKSA ya da cozulemezse `null`; sifir DEGIL.
 */
export function panoSayisi(deger: unknown): number | null {
  if (deger === null || deger === undefined || deger === '') return null;
  if (typeof deger === 'number') return Number.isFinite(deger) ? deger : null;
  const temiz = String(deger).replace(/[^\d.,+-]/g, '').replace(/,/g, '');
  if (temiz === '' || temiz === '-' || temiz === '+') return null;
  const sayi = Number(temiz);
  return Number.isFinite(sayi) ? sayi : null;
}

export type OyuncuPanosu = {
  playerId: string;
  paraBirimi: string;
  // ── Bakiye
  toplamBakiye: number | null;
  gercekBakiye: number | null;
  bonusBakiye: number | null;
  // ── Para hareketi
  toplamYatirim: number | null;
  yatirimAdedi: number | null;
  sonYatirimTutari: number | null;
  sonYatirimTarihi: string | null;
  toplamCekim: number | null;
  cekimAdedi: number | null;
  sonCekimTutari: number | null;
  sonCekimTarihi: string | null;
  // ── Oyun
  toplamBahis: number | null;
  toplamKazanc: number | null;
  ggr: number | null;
  casinoBahis: number | null;
  casinoKazanc: number | null;
  casinoGgr: number | null;
  sporBahis: number | null;
  sporKazanc: number | null;
  sporGgr: number | null;
  // ── Bonus
  bonusBahis: number | null;
  bonusKazanc: number | null;
  freespinKazanc: number | null;
  bonusOdeme: number | null;
  cashback: number | null;
};

/** Ham yaniti etiketli yapiya cevirir. Eksik alan `null` kalir. */
export function oyuncuPanosu(ham: AnyRecord | null | undefined): OyuncuPanosu {
  const k = ham ?? {};
  const s = (alan: string) => panoSayisi(k[alan]);
  const t = (alan: string) => {
    const deger = k[alan];
    return deger === null || deger === undefined || deger === '' ? null : String(deger);
  };

  return {
    playerId: String(k['Player ID'] ?? ''),
    paraBirimi: String(k.Currency ?? 'TRY'),
    toplamBakiye: s('TOTAL BALANCE'),
    gercekBakiye: s('REAL BALANCE'),
    bonusBakiye: s('BONUS BALANCE'),
    toplamYatirim: s('TOTAL DEPOSITS AMOUNT'),
    yatirimAdedi: s('TOTAL DEPOSITS COUNT'),
    sonYatirimTutari: s('LAST DEPOSIT AMOUNT'),
    sonYatirimTarihi: t('LAST DEPOSIT DATE'),
    toplamCekim: s('TOTAL WITHDRAWALS AMOUNT'),
    cekimAdedi: s('TOTAL WITHDRAWALS COUNT'),
    sonCekimTutari: s('LAST WITHDRAWAL AMOUNT'),
    sonCekimTarihi: t('LAST WITHDRAWAL DATE'),
    toplamBahis: s('TOTAL BET AMOUNT'),
    toplamKazanc: s('TOTAL WIN AMOUNT'),
    ggr: s('GGR'),
    casinoBahis: s('CASINO REAL BETS'),
    casinoKazanc: s('CASINO REAL WINS'),
    casinoGgr: s('CASINO GGR'),
    sporBahis: s('SPORT REAL BETS'),
    sporKazanc: s('SPORT REAL WINS'),
    sporGgr: s('SPORT GGR'),
    bonusBahis: s('TOTAL BONUS BET'),
    bonusKazanc: s('TOTAL BONUS WIN'),
    freespinKazanc: s('FREE SPIN WIN'),
    bonusOdeme: s('BONUS PAYOUT'),
    cashback: s('CASHBACK BONUS'),
  };
}

/**
 * Oyuncu hic yatirim yapmadan bakiye biriktirmis mi?
 *
 * Ornek oyuncu tam olarak bu: sifir yatirim, 9.52 bakiye, 47.4 freespin
 * kazanci. Cekim talebinde bu, bakilmasi gereken ilk sey.
 *
 * "Bilinmiyor" durumunda FALSE doner — olcum yoklugunu suphe olarak
 * raporlamak yanlis alarm uretir.
 */
export function yatirimsizBakiyeMi(pano: OyuncuPanosu): boolean {
  if (pano.toplamYatirim === null) return false;
  if (pano.toplamYatirim > 0) return false;
  const bakiye = pano.toplamBakiye ?? pano.gercekBakiye;
  return bakiye !== null && bakiye > 0;
}

/** Oyuncunun kasaya karsi durumu: pozitifse kasa kazanmis. */
export function oyuncuGgr(pano: OyuncuPanosu): number | null {
  if (pano.ggr !== null) return pano.ggr;
  if (pano.toplamBahis === null || pano.toplamKazanc === null) return null;
  return pano.toplamBahis - pano.toplamKazanc;
}

/**
 * Bonus kaynakli kazanc toplami.
 *
 * Kalemlerin hicbiri bilinmiyorsa `null`; bilinmeyeni sifir sayip
 * "bonus kazanci yok" demek, bonus avciligini gizler.
 */
export function bonusKaynakliKazanc(pano: OyuncuPanosu): number | null {
  const kalemler = [pano.freespinKazanc, pano.bonusKazanc, pano.bonusOdeme, pano.cashback];
  if (kalemler.every((k) => k === null)) return null;
  return kalemler.reduce<number>((t, k) => t + (k ?? 0), 0);
}

/**
 * Affiliate turetilmis metrikleri.
 *
 * lynonAffiliateSummary zaten BTag basina yatirim/cekim/GGR/aktif oyuncu
 * donuyordu, ama ekran yalnizca toplamlarini gosteriyordu. "Hangi affiliate
 * gercekten kazandiriyor" sorusunun cevabi bu ham sayilarda degil,
 * aralarindaki oranlarda.
 *
 * Saf fonksiyon: ag yok, tarih yok. Bu sayilar odeme ve is ortakligi
 * kararlarini etkiliyor, sessizce kaymamali.
 */

export type AffiliateSatir = {
  bTag: string;
  totalPlayers?: number | null;
  activePlayers?: number | null;
  totalDeposits?: number | null;
  totalWithdrawals?: number | null;
  netRevenue?: number | null;
  conversionRate?: number | null;
};

export type AffiliateMetrik = AffiliateSatir & {
  /** Yatirim - cekim. Kasaya kalan gercek para. */
  netPozisyon: number;
  /** Aktif oyuncu basina net gelir. Kucuk ama karli affiliate'i gorunur kilar. */
  oyuncuBasiGelir: number;
  /** Aktif oyuncu basina yatirim. */
  oyuncuBasiYatirim: number;
  /** Toplam net gelirin yuzde kaci bu BTag'den. */
  gelirPayi: number;
  /** Cekim / yatirim orani. 1'in ustu: bu kanal para kaybettiriyor. */
  cekimOrani: number;
};

function sayi(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function bol(pay: number, payda: number): number {
  return payda > 0 ? pay / payda : 0;
}

export function affiliateMetrikleri(satirlar: AffiliateSatir[]): {
  satirlar: AffiliateMetrik[];
  toplam: {
    bTagSayisi: number;
    oyuncu: number;
    aktifOyuncu: number;
    yatirim: number;
    cekim: number;
    netGelir: number;
    netPozisyon: number;
    ortalamaDonusum: number;
  };
} {
  const liste = satirlar ?? [];
  const toplamNetGelir = liste.reduce((t, s) => t + sayi(s.netRevenue), 0);

  const zenginlestirilmis: AffiliateMetrik[] = liste.map((satir) => {
    const yatirim = sayi(satir.totalDeposits);
    const cekim = sayi(satir.totalWithdrawals);
    const netGelir = sayi(satir.netRevenue);
    const aktif = sayi(satir.activePlayers);

    return {
      ...satir,
      netPozisyon: yatirim - cekim,
      oyuncuBasiGelir: bol(netGelir, aktif),
      oyuncuBasiYatirim: bol(yatirim, aktif),
      // Pay hesabinda mutlak deger tabani kullaniliyor: bazi BTag'ler negatif
      // gelir uretebiliyor ve toplam sifira yaklasinca yuzde patlıyordu.
      gelirPayi: bol(netGelir, liste.reduce((t, s) => t + Math.abs(sayi(s.netRevenue)), 0)) * 100,
      cekimOrani: bol(cekim, yatirim),
    };
  });

  const toplamOyuncu = liste.reduce((t, s) => t + sayi(s.totalPlayers), 0);
  const toplamAktif = liste.reduce((t, s) => t + sayi(s.activePlayers), 0);
  const toplamYatirim = liste.reduce((t, s) => t + sayi(s.totalDeposits), 0);
  const toplamCekim = liste.reduce((t, s) => t + sayi(s.totalWithdrawals), 0);

  return {
    satirlar: zenginlestirilmis,
    toplam: {
      bTagSayisi: liste.length,
      oyuncu: toplamOyuncu,
      aktifOyuncu: toplamAktif,
      yatirim: toplamYatirim,
      cekim: toplamCekim,
      netGelir: toplamNetGelir,
      netPozisyon: toplamYatirim - toplamCekim,
      // Toplam donusum, BTag ortalamasi DEGIL: kucuk BTag'ler ortalamayi
      // carpitirdi. Aktif oyuncu / toplam oyuncu olarak hesaplaniyor.
      ortalamaDonusum: bol(toplamAktif, toplamOyuncu) * 100,
    },
  };
}

export type AffiliateSiralama = 'netPozisyon' | 'netRevenue' | 'totalPlayers' | 'oyuncuBasiGelir' | 'cekimOrani';

export function affiliateSirala(satirlar: AffiliateMetrik[], alan: AffiliateSiralama): AffiliateMetrik[] {
  const deger = (s: AffiliateMetrik): number => {
    if (alan === 'netRevenue') return sayi(s.netRevenue);
    if (alan === 'totalPlayers') return sayi(s.totalPlayers);
    return sayi((s as unknown as Record<string, unknown>)[alan]);
  };
  // cekimOrani disinda hepsi "buyuk iyidir"; cekim oraninda dusuk iyidir ama
  // sorunlu kanali gormek istedigimiz icin yine buyukten kucuge siraliyoruz.
  return [...satirlar].sort((a, b) => deger(b) - deger(a));
}

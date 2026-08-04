/**
 * Anlik oyuncu bakiye ozeti — rapor 1843 ("Player Balance").
 *
 * Uc, o an aktif her oyuncuyu (Player ID, Full Name, Username, bakiye
 * alanlari) tek tek donduruyor — 1000+ satir olabiliyor. Telegram'a
 * satir satir atmak ne okunabilir ne de anlamli; istenen "kasada su an
 * toplam ne kadar oyuncu bakiyesi var" sorusunun cevabi. Bu yuzden bu
 * modul yalnizca TOPLAMI (`reportsSummary`) cikarir ve bicimler; tekil
 * oyuncu satirlari hic tasinmaz.
 */

type AnyRecord = Record<string, any>;

export type OyuncuBakiyeOzeti = {
  gun: string;
  saat: string | null;
  /** Rapor kac oyuncu dondurdu — satir listesi yoksa olculemez, null. */
  oyuncuSayisi: number | null;
  gercekBakiye: number | null;
  bonusBakiye: number | null;
  toplamBakiye: number | null;
};

function sayi(deger: unknown): number {
  if (deger === null || deger === undefined || deger === '') return 0;
  const n = Number(deger);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Rapor govdesini ozetler.
 *
 * `reportsSummary` varsa ORADAN okunur — 1000+ satiri toplamak yerine
 * ucun kendi ozetine guvenmek, sayfalamadan kaynakli fark riskini
 * ortadan kaldirir (`mutabakatToplami` ile ayni yaklasim). Ozet yoksa
 * satirlardan toplanir. Ne ozet ne satir varsa TUM alanlar null —
 * "bakiye sıfır" ile "ölçülemedi" farkli seyler.
 */
export function oyuncuBakiyeOzetiCikar(
  data: AnyRecord | null | undefined,
  gun: string,
  saat: string | null = null,
): OyuncuBakiyeOzeti {
  const govde = (data ?? {}) as AnyRecord;
  const satirlar: AnyRecord[] = Array.isArray(govde.reports) ? govde.reports : [];
  const ozet: AnyRecord | null =
    govde.reportsSummary && typeof govde.reportsSummary === 'object' ? govde.reportsSummary : null;

  const olculebiliyor = ozet !== null || satirlar.length > 0;

  const alanOku = (anahtar: string): number | null => {
    if (!olculebiliyor) return null;
    if (ozet && ozet[anahtar] !== undefined && ozet[anahtar] !== null && ozet[anahtar] !== '') {
      return sayi(ozet[anahtar]);
    }
    return satirlar.reduce((toplam, satir) => toplam + sayi(satir[anahtar]), 0);
  };

  return {
    gun,
    saat,
    oyuncuSayisi: satirlar.length > 0 ? satirlar.length : null,
    gercekBakiye: alanOku('Total Real Balance (TRY)'),
    bonusBakiye: alanOku('Total Bonus Balance (TRY)'),
    toplamBakiye: alanOku('Total Balance (TRY)'),
  };
}

const TL = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });

function para(deger: number | null): string {
  return deger === null ? '—' : `${TL.format(deger)} TRY`;
}

/**
 * Onceki ozete gore trend oku. Ikisinden biri bilinmiyorsa BOS DONER —
 * `telegramRaporu.kasaMesaji`daki ayni mantik: karisik trend okumaktansa
 * hic gostermemek daha dogru.
 */
function trendYaz(simdi: number | null, onceki: number | null | undefined): string {
  if (simdi === null || onceki === null || onceki === undefined) return '';
  const fark = simdi - onceki;
  if (fark === 0) return ' ▪️0';
  return fark > 0 ? ` ▲${TL.format(fark)}` : ` ▼${TL.format(Math.abs(fark))}`;
}

/**
 * Telegram mesaji.
 *
 * `onceki` verilirse bir onceki gonderime gore trend oku eklenir — 7.5
 * dakikada bir gelen bir mesajda "yon" bir bakista gorulsun diye.
 */
export function oyuncuBakiyeMesaji(ozet: OyuncuBakiyeOzeti, onceki?: OyuncuBakiyeOzeti | null): string {
  return [
    `👛 ANLIK OYUNCU BAKİYESİ · ${ozet.gun}${ozet.saat ? ` · ${ozet.saat}` : ''}`,
    '━━━━━━━━━━━━━━━━━━',
    `👥 Oyuncu: ${ozet.oyuncuSayisi === null ? '—' : ozet.oyuncuSayisi}`,
    `💰 Gerçek bakiye: ${para(ozet.gercekBakiye)}${trendYaz(ozet.gercekBakiye, onceki?.gercekBakiye)}`,
    `🎁 Bonus bakiye:  ${para(ozet.bonusBakiye)}${trendYaz(ozet.bonusBakiye, onceki?.bonusBakiye)}`,
    `⚖️ Toplam bakiye: ${para(ozet.toplamBakiye)}${trendYaz(ozet.toplamBakiye, onceki?.toplamBakiye)}`,
  ].join('\n');
}

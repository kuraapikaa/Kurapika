/**
 * Denetim kaydina yazilan bonus aciklamasi.
 *
 * ── Onceki durum ──────────────────────────────────────────────────────
 *
 * Panel bonus verdiginde denetime su dusuyordu:
 *
 *   "RuleId: kayip-bonusu, Amount: 2500"
 *   "CampaignId: 1885, RuleId: 30 kayıp bonusu"
 *
 * Bu kayittan sonradan sunlar OKUNAMIYORDU: bonusun adi, nakit mi
 * kampanya mi oldugu, tutarin nereden hesaplandigi (kural mi yazdi,
 * operator elle mi girdi), hangi yatirima karsilik verildigi.
 * "2492369 neden bir surü %30 kayıp bonusu almis" gibi bir soruyu
 * denetim kaydiyla cevaplamak mumkun degildi; her seferinde Lynon'a
 * bakmak gerekiyordu.
 *
 * Dahasi OYUN ODULLERI (cark, kazi kazan, Telegram katilim, gunluk
 * gorev, skor tahmin) denetime HIC yazilmiyordu -- `games.ts` icinde tek
 * bir `audit()` cagrisi yoktu. Para sizintilarinin cogu tam olarak o
 * yollardan gecti.
 */

export type BonusDenetimGirdisi = {
  /** 'nakit' | 'kampanya' | 'oyun' */
  tur?: unknown;
  /** Kuralin ya da odulun gorunen adi. */
  baslik?: unknown;
  /** PROMO_SPECS anahtari ya da odul kimligi. */
  kuralAnahtari?: unknown;
  /** Lynon kampanya kimligi (kampanya atamalarinda). */
  kampanyaId?: unknown;
  tutar?: unknown;
  /** Tutar kuraldan mi hesaplandi yoksa elle mi girildi? */
  tutarKaynagi?: 'kural' | 'elle' | unknown;
  /** Hakkin baglandigi yatirim. */
  yatirimId?: unknown;
  yatirimTutari?: unknown;
  /** Oyun odullerinde kaynak: cark / kazı kazan / telegram … */
  kaynak?: unknown;
  /** Atama sonucu. */
  sonuc?: 'basarili' | 'basarisiz' | 'belirsiz' | unknown;
  /** Basarisizsa sebep. */
  mesaj?: unknown;
};

/** Denetim satiri okunabilir kalmali; asiri uzun detay listede kesilir. */
const AZAMI = 500;

function metin(value: unknown): string {
  return String(value ?? '').trim();
}

function tutarYaz(value: unknown): string | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `${n.toLocaleString('tr-TR')} TRY` : null;
}

const TUR_ADI: Record<string, string> = {
  nakit: 'Nakit (bakiye düzeltmesi)',
  kampanya: 'Lynon kampanyası',
  oyun: 'Oyun ödülü',
};

/**
 * Insan tarafindan okunabilir tek satir uretir.
 *
 * Bos alanlar atlanir; "Yatırım: -" gibi bilgi tasimayan parcalar
 * satiri uzatip okunurlugu dusurur.
 */
export function bonusDenetimAciklamasi(girdi: BonusDenetimGirdisi): string {
  const parcalar: string[] = [];

  const tur = metin(girdi.tur);
  if (tur) parcalar.push(TUR_ADI[tur] ?? tur);

  const baslik = metin(girdi.baslik);
  const anahtar = metin(girdi.kuralAnahtari);
  if (baslik && anahtar && baslik !== anahtar) parcalar.push(`${baslik} (${anahtar})`);
  else if (baslik || anahtar) parcalar.push(baslik || anahtar);

  const kampanya = metin(girdi.kampanyaId);
  if (kampanya) parcalar.push(`Kampanya #${kampanya}`);

  const kaynak = metin(girdi.kaynak);
  if (kaynak) parcalar.push(`Kaynak: ${kaynak}`);

  const tutar = tutarYaz(girdi.tutar);
  if (tutar) {
    const kaynagi = metin(girdi.tutarKaynagi);
    // Tutarin kuraldan mi elle mi geldigi denetimin can alici bilgisi:
    // elle girilen tutar operator karari, kural tutari otomatik.
    parcalar.push(kaynagi ? `Tutar: ${tutar} (${kaynagi === 'kural' ? 'kural hesapladı' : 'elle girildi'})` : `Tutar: ${tutar}`);
  }

  const yatirimId = metin(girdi.yatirimId);
  if (yatirimId) {
    const yatirimTutari = tutarYaz(girdi.yatirimTutari);
    parcalar.push(yatirimTutari ? `Yatırım: #${yatirimId} (${yatirimTutari})` : `Yatırım: #${yatirimId}`);
  }

  const sonuc = metin(girdi.sonuc);
  if (sonuc && sonuc !== 'basarili') {
    const mesaj = metin(girdi.mesaj);
    parcalar.push(sonuc === 'belirsiz' ? `SONUÇ BELİRSİZ${mesaj ? `: ${mesaj}` : ''}` : `BAŞARISIZ${mesaj ? `: ${mesaj}` : ''}`);
  }

  return parcalar.join(' · ').slice(0, AZAMI);
}

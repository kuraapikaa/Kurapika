/**
 * Bir yatirim = ayni bonustan bir kez.
 *
 * ── Neden gerekti ─────────────────────────────────────────────────────
 *
 * Kampanya atama yolunda (dashboard `charge`) MUKERRER KORUMASI YOKTU.
 * Nakit yolunda `bugunVerilmisMi` var, ertesi gun isinde
 * `cashAlreadyCredited` var; kampanya yolunda hicbir sey yok. Tek engel
 * `perDayLimit`/`perWeekLimit`, onlar da kuralda ACIKCA ayarlanmadikca
 * hic calismiyor (checkUsageLimits ilk satirda cikiyor).
 *
 * Sonucu "100 FS - Telegram Katil Bonusu" ornegi gosteriyor: kuralin tek
 * sarti `requiresTelegramMember`. Oyuncu kanala bir kez katiliyor, bu
 * sart sonsuza kadar dogru kaliyor ve bonusu istedigi kadar aliyor.
 * `checkSingleInvestmentUsage` ise opt-in ve yanlis soruyu soruyor: son
 * yatirimdan sonra HERHANGI bir bonus alinmis mi diye bakiyor, ayni
 * bonusun tekrarina degil.
 *
 * ── Kural ─────────────────────────────────────────────────────────────
 *
 * Ayni bonus ikinci kez ancak ARAYA YENI BIR BASARILI YATIRIM girdiyse
 * verilir. Yatirim hic yoksa kural dogal olarak "omurde bir kez"e doner;
 * Telegram katil bonusu gibi yatirim sarti olmayan bonuslari kapatan da
 * budur.
 *
 * Cark bu kurala GIRMEZ: cark odulleri `chargeBonusToPlayer` uzerinden
 * gidiyor, kural degerlendirmesinden hic gecmiyor ve kendi hak sayaci
 * var (`yatirimHakki`). Kural bazinda `allowMultiplePerDeposit: true`
 * ile de muafiyet verilebilir.
 *
 * Kontrol iki kaynagi birden okur: kampanya atamalari (`account.bonuses`)
 * ve nakit bonuslarin yazildigi bakiye duzeltmeleri. Tek kaynaga bakmak
 * bu panelde tekrar tekrar delik uretti.
 */

export type AtamaSatiri = {
  Id?: unknown;
  Name?: unknown;
  CreatedLocal?: unknown;
  Note?: unknown;
};

export type YatirimSatiri = {
  /** Islem turu — yalnizca yatirim turleri sayilir. */
  DocumentTypeName?: unknown;
  CreatedLocal?: unknown;
  Id?: unknown;
};

export type NakitKullanim = {
  kuralAnahtari: string;
  zaman: number;
};

const YATIRIM_TURLERI = ['yatırım', 'deposit', 'yatırım talebi ödemesi'];

function kucuk(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('tr-TR');
}

function zaman(value: unknown, coz: (s: string) => number): number {
  const s = String(value ?? '').trim();
  if (!s) return 0;
  return coz(s) || 0;
}

/** Bu satir bir yatirim mi? */
export function yatirimMi(satir: YatirimSatiri): boolean {
  return YATIRIM_TURLERI.includes(kucuk(satir?.DocumentTypeName));
}

export type HakSonucu =
  | { uygun: true; sonVerme: number | null }
  | { uygun: false; neden: string; sonVerme: number };

/**
 * Ayni bonus tekrar verilebilir mi?
 *
 * @param atamalar  Kampanya atamalari (account.bonuses).
 * @param nakit     Nakit kullanimlar (nakitKullanimlari ciktisi).
 * @param yatirimlar Odeme hareketleri (account.profileTransactions).
 * @param promo     Bu bonusun kimligi ve basligi.
 * @param coz       Tarih cozucu (parseDateToTime).
 */
export function yeniYatirimGerekiyorMu(input: {
  atamalar: AtamaSatiri[];
  nakit: NakitKullanim[];
  yatirimlar: YatirimSatiri[];
  promo: { id?: unknown; title?: unknown; kuralAnahtari?: unknown };
  coz: (s: string) => number;
}): HakSonucu {
  const { atamalar, nakit, yatirimlar, promo, coz } = input;

  const promoId = promo.id != null && String(promo.id).trim() !== '' ? Number(promo.id) : null;
  const promoBaslik = kucuk(promo.title);
  const kuralAnahtari = kucuk(promo.kuralAnahtari ?? promo.id);

  // Ayni bonusun onceki verilislerini bul — iki kaynaktan.
  const zamanlar: number[] = [];

  for (const satir of atamalar ?? []) {
    if (!satir) continue;
    const ad = kucuk(satir.Name);
    const id = satir.Id != null && String(satir.Id).trim() !== '' ? Number(satir.Id) : null;
    const eslesir =
      (promoId != null && Number.isFinite(promoId) && id != null && Number.isFinite(id) && id === promoId) ||
      (promoBaslik !== '' && ad !== '' && (ad.includes(promoBaslik) || promoBaslik.includes(ad)));
    if (!eslesir) continue;
    const t = zaman(satir.CreatedLocal, coz);
    if (t > 0) zamanlar.push(t);
  }

  for (const kullanim of nakit ?? []) {
    if (!kullanim) continue;
    if (kucuk(kullanim.kuralAnahtari) !== kuralAnahtari || kuralAnahtari === '') continue;
    if (kullanim.zaman > 0) zamanlar.push(kullanim.zaman);
  }

  if (zamanlar.length === 0) return { uygun: true, sonVerme: null };

  const sonVerme = Math.max(...zamanlar);

  // Verilisten SONRA yapilmis basarili yatirim var mi?
  const yeniYatirim = (yatirimlar ?? []).some((satir) => {
    if (!satir || !yatirimMi(satir)) return false;
    return zaman(satir.CreatedLocal, coz) > sonVerme;
  });

  if (yeniYatirim) return { uygun: true, sonVerme };

  return {
    uygun: false,
    sonVerme,
    neden: 'RED: Bu bonus zaten alınmış; tekrar alabilmek için yeni yatırım gerekiyor.',
  };
}

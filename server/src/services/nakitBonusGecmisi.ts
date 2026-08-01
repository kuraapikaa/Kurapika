/**
 * Nakit bonus gecmisi — bakiye duzeltmelerinden.
 *
 * ── Neden gerekli ─────────────────────────────────────────────────────
 * Nakit (`type: 'cash'`) bonuslar Lynon'a KAMPANYA olarak atanmiyor;
 * Player Main hesabina `crediting` bakiye duzeltmesi olarak yaziliyor.
 *
 * Ama perDayLimit / perWeekLimit kontrolleri `account.bonuses` listesinden
 * sayiyor — orasi Lynon KAMPANYA atamalarinin listesi. Bakiye duzeltmeleri
 * o listede HIC gorunmuyor.
 *
 * Sonuc: nakit bonuslarda gunluk ve haftalik limitler YAPISAL OLARAK KOR.
 * Her zaman "0 kullanim" goruyorlar ve hicbir seyi engelleyemiyorlar.
 * Oyuncu bonusu alip kaybediyor, bakiye tekrar esigin altina duruyor ve
 * ayni bonusu tekrar tekrar alabiliyor — her seferinde yeni bir correction.
 *
 * Bu modul duzeltme gecmisinden nakit bonus kullanimlarini cikariyor ki
 * limitler nakit bonuslarda da calissin.
 */

/** Charge yolunun yazdigi not bicimi: "Bonus <kuralAnahtari> / <kullanici>". */
const NOT_ONEKI = 'Bonus ';

export type DuzeltmeSatiri = {
  /** Duzeltme notu. */
  not: string;
  tutar: number;
  /** ISO ya da yerel tarih dizesi. */
  tarih: string;
  /** 'crediting' | 'debiting' — yalnizca crediting sayilir. */
  tur?: string;
};

export type NakitKullanim = {
  kuralAnahtari: string;
  tutar: number;
  zaman: number;
};

function zaman(deger: unknown): number {
  const t = Date.parse(String(deger ?? ''));
  return Number.isFinite(t) ? t : 0;
}

/**
 * Nottan kural anahtarini cikarir.
 *
 * "Bonus kayip-bonusu / destek1" -> "kayip-bonusu"
 * Eslesmeyen not (elle yazilmis duzeltme) null doner ve sayilmaz —
 * operatorun elle verdigi para bonus kullanimi degil.
 */
export function nottanKuralAnahtari(not: unknown): string | null {
  const metin = String(not ?? '').trim();
  if (!metin.startsWith(NOT_ONEKI)) return null;
  const kalan = metin.slice(NOT_ONEKI.length);
  const anahtar = kalan.split('/')[0]?.trim();
  return anahtar ? anahtar : null;
}

/** Duzeltme satirlarindan nakit bonus kullanimlarini cikarir. */
export function nakitKullanimlari(satirlar: DuzeltmeSatiri[]): NakitKullanim[] {
  const sonuc: NakitKullanim[] = [];
  for (const satir of satirlar ?? []) {
    if (!satir) continue;
    // Yalnizca hesaba PARA EKLEYEN duzeltmeler. Tur belirtilmemisse
    // (eski kayit) tutarin isaretine bakiyoruz.
    const tur = String(satir.tur ?? '').toLowerCase();
    const tutar = Number(satir.tutar);
    if (!Number.isFinite(tutar)) continue;
    if (tur === 'debiting') continue;
    if (!tur && tutar <= 0) continue;

    const anahtar = nottanKuralAnahtari(satir.not);
    if (!anahtar) continue;

    const an = zaman(satir.tarih);
    if (!an) continue;

    sonuc.push({ kuralAnahtari: anahtar, tutar: Math.abs(tutar), zaman: an });
  }
  return sonuc;
}

/**
 * Belirli bir kuralin verilen pencerede kac kez kullanildigi.
 *
 * Kural anahtari karsilastirmasi buyuk/kucuk harf duyarsiz: not elle
 * duzenlenebiliyor.
 */
export function kullanimSayisi(
  kullanimlar: NakitKullanim[],
  kuralAnahtari: string,
  pencereBaslangici: number,
): number {
  const hedef = String(kuralAnahtari ?? '').trim().toLocaleLowerCase('tr-TR');
  if (!hedef) return 0;
  return kullanimlar.filter(
    (k) => k.zaman >= pencereBaslangici && k.kuralAnahtari.toLocaleLowerCase('tr-TR') === hedef,
  ).length;
}

/**
 * Ayni kural bugun zaten verilmis mi?
 *
 * Charge yolunda mukerrer korumasi icin. Ertesi gun isi bunu zaten
 * yapiyordu (cashAlreadyCredited); oyuncuya acik charge yolunda yoktu.
 */
export function bugunVerilmisMi(
  kullanimlar: NakitKullanim[],
  kuralAnahtari: string,
  gunBaslangici: number,
): boolean {
  return kullanimSayisi(kullanimlar, kuralAnahtari, gunBaslangici) > 0;
}

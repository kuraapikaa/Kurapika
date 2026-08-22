/**
 * Yatırım aralığı kademesinin okunur özeti.
 *
 * Editörde üç kutu var (alt sınır, üst sınır, bonus ID) ve üçü birlikte
 * bir cümle kuruyor: "5.000 ₺ ve üzeri yatırımda 1952 numaralı bonus".
 * Kutulara bakıp bu cümleyi kafada kurmak, özellikle üst sınır boşken
 * ("sınırsız" mı, "hata" mı?) kolayca yanlış anlaşılıyordu.
 *
 * Biçimlendirme kuralları burada çünkü tam da sessizce bozulan türden:
 * boş üst sınırın "ve üzeri" demek olduğu, 0'ın geçerli bir alt sınır
 * olduğu, `max < min` yazılmışsa bunun kaydederken reddedileceği.
 */

const sayiBicimi = new Intl.NumberFormat('tr-TR');

/** Metin ya da sayı olabilen alanı sayıya çevirir; boşsa `null`. */
export function aralikSayisi(deger: unknown): number | null {
  if (deger === null || deger === undefined) return null;
  const metin = String(deger).trim();
  if (metin === '') return null;
  const sayi = Number(metin);
  return Number.isFinite(sayi) ? sayi : null;
}

export type AralikDurumu = 'eksik' | 'gecersiz' | 'tamam';

export type AralikOzeti = {
  durum: AralikDurumu;
  /** Ekranda gösterilecek cümle. */
  metin: string;
};

/**
 * Bir kademenin özeti.
 *
 * `durum`:
 *   · `eksik`    — henüz doldurulmamış alan var
 *   · `gecersiz` — üst sınır alt sınırdan küçük (kaydederken reddedilir)
 *   · `tamam`    — okunabilir bir kural
 */
export function aralikOzeti(aralik: {
  min?: unknown;
  max?: unknown;
  partnerBonusId?: unknown;
}): AralikOzeti {
  const min = aralikSayisi(aralik?.min);
  const max = aralikSayisi(aralik?.max);
  const bonusId = String(aralik?.partnerBonusId ?? '').trim();

  if (min === null || !bonusId) {
    return { durum: 'eksik', metin: 'Alt sınır ve bonus ID zorunlu.' };
  }
  if (max !== null && max < min) {
    return { durum: 'gecersiz', metin: 'Üst sınır alt sınırdan küçük olamaz.' };
  }

  const aralikMetni = max === null
    // Boş üst sınır bir eksiklik değil, "tavan yok" demek. Bunu yazmak,
    // operatörün boş kutuyu unutulmuş sanmasını önlüyor.
    ? `${sayiBicimi.format(min)} ₺ ve üzeri`
    : `${sayiBicimi.format(min)} – ${sayiBicimi.format(max)} ₺`;

  return { durum: 'tamam', metin: `${aralikMetni} yatırımda → ${bonusId}` };
}

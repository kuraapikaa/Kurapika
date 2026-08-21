/**
 * TELEGRAM RAPOR BOTU HANGI KOSULDA CALISMALI?
 *
 * ── Bildirilen vaka ───────────────────────────────────────────────────
 *
 * "TELEGRAM_RAPOR_CHAT_ID ne alaka, zaten bot tokenini verdim ve her
 * grubun farkli chat id'si var."
 *
 * Hakli. Operator uc kanali (bonus, yatirim, correction) dogru tanimlamis
 * ama hicbiri calismiyordu.
 *
 * ── Niyet ile uygulama ayrismis ───────────────────────────────────────
 *
 * `telegramRaporJob` dosya basindaki not sunu diyor:
 *
 *   "Hicbir sohbet kimligi tanimli degilse bot HIC calismaz. Varsayilan
 *    bir sohbet uydurmak, kasa raporunu yanlis yere gondermek olur."
 *
 * Isin kendisi de buna uygun: her akis KENDI kanalina gidiyor,
 * `raporChatId` yalnizca tanimlanmamis olanlar icin YEDEK —
 *
 *   sohbetSec(anahtar) => raporChatIdleri[anahtar] || raporChatId
 *
 * Ama `scheduler.ts` isi kaydederken YALNIZCA `raporChatId`'ye bakiyordu.
 * Yani yedegi tanimlamamak, kendi kanali tanimli olan bildirimleri de
 * susturuyordu. Kosul niyetten daha katiydi.
 *
 * Artik soru dogru soruluyor: gonderilecek EN AZ BIR kanal var mi?
 */

/** Rapor botunun bilebilecegi tum sohbet kimlikleri. */
export type KanalHaritasi = {
  raporChatId?: string;
  raporChatIdleri?: Record<string, string | undefined>;
};

/**
 * Bot calismali mi? Yedek ya da herhangi bir kanal yeterli.
 *
 * Bos dizge tanimsiz sayilir: Railway'de degisken "var ama bos" olarak
 * birakildiginda bu, tanimlanmamis olmasindan farksizdir.
 */
export function gonderilecekKanalVarMi(telegram: KanalHaritasi | undefined | null): boolean {
  if (!telegram) return false;
  if (String(telegram.raporChatId ?? '').trim()) return true;
  return Object.values(telegram.raporChatIdleri ?? {})
    .some((deger) => String(deger ?? '').trim() !== '');
}

/** Tanimli kanallarin adlari — aciliste log'a yazilir, "neden sessiz" sorusu sorulmasin. */
export function tanimliKanallar(telegram: KanalHaritasi | undefined | null): string[] {
  const adlar = Object.entries(telegram?.raporChatIdleri ?? {})
    .filter(([, deger]) => String(deger ?? '').trim() !== '')
    .map(([ad]) => ad);
  if (String(telegram?.raporChatId ?? '').trim()) adlar.push('varsayilan');
  return adlar.sort();
}

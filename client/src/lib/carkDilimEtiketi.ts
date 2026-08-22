/**
 * Çark diliminin ÇARKTA GÖRÜNEN yazısı ile ÖDÜL BAĞLANTISI ayrı iki şey.
 *
 * Panelde tek bir alan ikisini birden tutuyordu:
 *   `value={slice.bonusId ? String(slice.bonusId) : slice.label}`
 * Yani dilim bir Lynon kampanyasına bağlandığı anda alan kampanya
 * ID'sini gösteriyor, yazı ne görünüyor ne de düzenlenebiliyordu.
 * Yazıyı değiştirmeye çalışmak da bağlantıyı koparıyordu.
 *
 * Artık iki ayrı alan var. Buradaki kural, kampanya değiştirildiğinde
 * yazının ne olacağını belirliyor.
 */

/** Yeni dilim eklenirken konan yer tutucu. */
export const VARSAYILAN_ETIKET = 'Yeni Ödül';

/**
 * Kampanya seçildiğinde etiketin üzerine yazılmalı mı?
 *
 * ELLE YAZILMIŞ bir etiketin üzerine yazılmıyor: operatör "500 ₺
 * Freespin Paketi" diye kısaltmışsa, kampanyayı düzeltmek için tekrar
 * seçtiğinde emeğinin silinmesi sürpriz olurdu.
 *
 * Otomatik doldurulmuş sayılan durumlar:
 *   · boş
 *   · hâlâ yer tutucu ("Yeni Ödül")
 *   · listedeki kampanyalardan birinin adı (yani daha önce buradan geldi)
 *   · yalnızca rakam (ham bir ID; çarkta gösterilecek bir şey değil)
 */
export function etiketUzerineYazilsinMi(mevcut: unknown, bilinenAdlar: readonly string[]): boolean {
  const etiket = String(mevcut ?? '').trim();
  if (!etiket) return true;
  if (etiket === VARSAYILAN_ETIKET) return true;
  if (/^\d+$/.test(etiket)) return true;
  return bilinenAdlar.some((ad) => String(ad ?? '').trim() === etiket);
}

/** Kampanya seçildikten sonra dilimde duracak etiket. */
export function yeniEtiket(
  mevcut: unknown,
  kampanyaAdi: unknown,
  bilinenAdlar: readonly string[],
): string {
  const ad = String(kampanyaAdi ?? '').trim();
  const etiket = String(mevcut ?? '').trim();
  if (!ad) return etiket;
  return etiketUzerineYazilsinMi(etiket, bilinenAdlar) ? ad : etiket;
}

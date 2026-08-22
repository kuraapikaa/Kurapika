import { friendlyBonusEligibilityMessage, type FriendlyBonusEligibilityMessage } from './bonusEligibilityMessages';

/**
 * TALEP ANINDA REDDEDİLEN BONUSUN SEBEPLERİ.
 *
 * Oyuncu "Talep Et"e bastığında sunucu uygunluğu YENİDEN değerlendiriyor
 * ve reddederse tam kontrol listesini `Data.specificBonusCheck` içinde
 * geri gönderiyor. İstemci bu listeyi hiç okumuyordu; hata metnine
 * bakıp iki hazır cümleden birini gösteriyordu:
 *
 *   "Bonus talebiniz şu anda tamamlanamadı. Lütfen kısa süre sonra
 *    tekrar deneyin."
 *
 * Oyuncu neden reddedildiğini öğrenemiyor, dolayısıyla ne yapacağını da
 * bilmiyordu -- oysa cevabın kendisi zaten gelen yanıtın içindeydi.
 *
 * Burası o listeyi oyuncunun okuyabileceği cümlelere çeviriyor.
 */

export type RedSebebi = FriendlyBonusEligibilityMessage & { id: string };

type KontrolMaddesi = { id?: unknown; label?: unknown; ok?: unknown; reason?: unknown };

/**
 * Yanıttan reddi açıklayan maddeleri çıkarır.
 *
 * Yalnızca `ok === false` olan maddeler alınıyor: uygun geçen kontrolleri
 * de göstermek listeyi okunmaz yapardı ve oyuncu asıl engeli kaçırırdı.
 */
export function redSebepleri(yanit: unknown, enFazla = 3): RedSebebi[] {
  const kontrol = (yanit as any)?.Data?.specificBonusCheck ?? (yanit as any)?.specificBonusCheck;
  const maddeler: KontrolMaddesi[] = Array.isArray(kontrol?.items) ? kontrol.items : [];

  const gorulen = new Set<string>();
  const sebepler: RedSebebi[] = [];

  for (const madde of maddeler) {
    if (madde?.ok !== false) continue;
    const id = String(madde?.id ?? '').trim();
    if (!id) continue;
    // Aynı sebep birden fazla kez düşebiliyor; oyuncuya bir kez yazılır.
    if (gorulen.has(id)) continue;
    gorulen.add(id);
    sebepler.push({
      id,
      ...friendlyBonusEligibilityMessage({
        id,
        label: typeof madde.label === 'string' ? madde.label : undefined,
        reason: typeof madde.reason === 'string' ? madde.reason : undefined,
      }),
    });
    if (sebepler.length >= enFazla) break;
  }

  return sebepler;
}

/**
 * Reddin tek satırlık özeti; sebep çıkarılamazsa güvenli genel metin.
 *
 * Genel metin bilerek KORUNUYOR: sunucu bazen gerçekten teknik bir hata
 * (ağ, oturum) döndürüyor ve o durumda "koşulu tamamlayın" demek yanlış
 * yönlendirme olurdu.
 */
export const GENEL_RED_METNI =
  'Bonus talebiniz şu anda tamamlanamadı. Lütfen kısa süre sonra tekrar deneyin.';

export function redOzeti(yanit: unknown): { baslik: string; metin: string; sebepler: RedSebebi[] } {
  const sebepler = redSebepleri(yanit);
  if (sebepler.length === 0) {
    return { baslik: 'Talep tamamlanamadı', metin: GENEL_RED_METNI, sebepler: [] };
  }
  if (sebepler.length === 1) {
    return { baslik: sebepler[0].title, metin: sebepler[0].message, sebepler };
  }
  return {
    baslik: 'Talep tamamlanamadı',
    metin: 'Bu bonus için aşağıdaki koşullar henüz tamamlanmamış:',
    sebepler,
  };
}

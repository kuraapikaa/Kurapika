/**
 * Sadakat seviyesi ilerlemesi.
 *
 * Sunucudaki formul: level = floor(xp/1000)+1 (loyaltyService.calculateLevel),
 * yani her seviye 1000 XP. Seviye sunucudan geliyorsa ona guveniyoruz; yoksa
 * XP'den turetiyoruz ki iki taraf ayrisirsa ekranda tutarsizlik olmasin.
 */
export const SEVIYE_BASINA_XP = 1000;

export function sadakatIlerlemesi(
  xpGirdi: unknown,
  seviyeGirdi?: unknown,
): { seviye: number; yuzde: number; kalan: number } {
  const xpHam = Number(xpGirdi);
  const xp = Number.isFinite(xpHam) && xpHam > 0 ? Math.floor(xpHam) : 0;

  const seviyeHam = Number(seviyeGirdi);
  const seviye = Number.isFinite(seviyeHam) && seviyeHam >= 1
    ? Math.floor(seviyeHam)
    : Math.floor(xp / SEVIYE_BASINA_XP) + 1;

  const seviyeIci = xp % SEVIYE_BASINA_XP;
  const yuzde = Math.max(0, Math.min(100, Math.round((seviyeIci / SEVIYE_BASINA_XP) * 100)));
  // Tam seviye sinirinda "0 XP kaldi" yerine tam bir seviye gostermek yaniltici
  // olurdu; sinirda zaten yeni seviyenin basindayiz, kalan tam 1000.
  const kalan = SEVIYE_BASINA_XP - seviyeIci;

  return { seviye, yuzde, kalan };
}

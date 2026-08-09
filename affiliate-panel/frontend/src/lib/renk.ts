/**
 * HEX → HSL — kiracı marka rengi tek bir hex olarak geliyor
 * (`/api/marka`'nın `vurgu` alanı), ama Shadcn token'ları `H S% L%`
 * (hsl() gövdesi) bekliyor. Derleme anında değil ÇALIŞMA ANINDA
 * çevriliyor çünkü kiracı rengi sunucudan geliyor — build'de bilinmiyor.
 */
export function hexToHsl(hex: string): { triple: string; l: number } | null {
  const temiz = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(temiz)) return null;

  const r = parseInt(temiz.slice(0, 2), 16) / 255;
  const g = parseInt(temiz.slice(2, 4), 16) / 255;
  const b = parseInt(temiz.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
  }

  const lYuzde = Math.round(l * 100);
  return { triple: `${Math.round(h)} ${Math.round(s * 100)}% ${lYuzde}%`, l: lYuzde };
}

/** Verilen acikliğe (L, 0-100) göre okunur metin rengi: koyu zeminde beyaz, açık zeminde neredeyse siyah. */
export function tercihEdilenMetinRengi(lYuzde: number): string {
  return lYuzde < 60 ? '0 0% 100%' : '240 3% 12%';
}

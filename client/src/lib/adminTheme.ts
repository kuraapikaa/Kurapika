import type { CSSProperties } from 'react';

/**
 * Yönetim paneli tasarım sistemi.
 *
 * Lobiden BİLEREK ayrı. Lobi oyuncuya bakan marka yüzeyi (sıcak siyah + altın);
 * burası bir çalışma aracı: soğuk, sistem yerlisi, yüksek okunabilirlik. İki
 * yüzeyi tek palete zorlamak ikisini de zayıflatırdı.
 *
 * Renkler tasarım dosyasından (Admin Panel.html) çıkarıldı.
 */
export type AdminTheme = 'light' | 'dark';

/**
 * Açık tema paleti.
 *
 * Koyu temanın ters çevrilmişi DEĞİL. Zemin nötr-soğuk gri, yüzeyler saf
 * beyaz; kartlar zeminden öne çıkıyor (koyu temada tam tersi çalışıyor).
 * Durum renkleri beyaz üzerinde okunacak şekilde koyulaştırıldı —
 * #30d158 açık zeminde ~1.6:1 kontrastla okunmuyordu.
 */
export const ADMIN_COLORS_LIGHT = {
  bg: '#f4f6fa',
  surface: 'rgba(255, 255, 255, 0.72)',
  surfaceStrong: '#ffffff',

  text: '#0f172a',
  textDim: '#33415a',
  muted: '#5b6b86',
  mutedDeep: '#6b7a94',
  faint: '#7c8aa3',

  accent: '#0a6ed1',
  accentDeep: '#0b5aa8',

  success: '#15803d',
  info: '#0891b2',
  warning: '#b45309',
  danger: '#b91c1c',
  special: '#7e22ce',
} as const;

export const ADMIN_COLORS = {
  /** Zemin ve yüzeyler. */
  bg: '#050609',
  surface: 'rgba(242, 244, 248, 0.028)',
  surfaceStrong: 'rgba(242, 244, 248, 0.05)',

  /** Metin — üç kademe. Dördüncü bir gri eklemeyin, hiyerarşi bulanıklaşıyor. */
  text: '#f2f4f8',
  textDim: '#c8cdd5',
  muted: '#8a919c',
  mutedDeep: '#6e7683',
  faint: '#5c6470',

  /** Birincil aksiyon ve seçili durum. */
  accent: '#0a84ff',
  accentDeep: '#0060df',

  /** Durum renkleri. Anlamları sabit: veri gösteriminde de bunlar kullanılır. */
  success: '#30d158',
  info: '#64d2ff',
  warning: '#ff9f0a',
  danger: '#ff453a',
  special: '#bf5af2',
} as const;

export function adminPalette(theme: AdminTheme = 'dark') {
  return theme === 'light' ? ADMIN_COLORS_LIGHT : ADMIN_COLORS;
}

/**
 * Kenarlıklar metin renginin düşük alfası; ayrı bir gri tonu getirilmiyor.
 *
 * Açık temada aynı kural ters yönde işler: kenarlık METİN rengiyle
 * (koyu lacivert) çizilir. Zemin rengiyle çizmek beyaz üstüne beyaz
 * demek olurdu.
 */
export function adminBorder(alpha: number, theme: AdminTheme = 'dark'): string {
  return theme === 'light' ? `rgba(15, 23, 42, ${alpha})` : `rgba(242, 244, 248, ${alpha})`;
}

export const ADMIN_TOKENS = {
  radius: { pill: '9999px', control: '10px', card: '12px', panel: '16px' },
  /** Büyük harf mikro etiketler; tablo başlıkları ve rozetler. */
  tracking: { label: '0.14em', tight: '0.1em' },
  /** Sayısal sütunlar hizalansın diye tablo ve KPI'larda tabular-nums. */
  numeric: { fontVariantNumeric: 'tabular-nums' } as CSSProperties,
} as const;

/**
 * Panel kökünde bir kez tanımlanır; alt bileşenler var(--adm-*) ile okur.
 * Bu sayede 65 dosyaya tek tek renk gömmek gerekmiyor.
 */
export function adminCssVars(theme: AdminTheme = 'dark'): CSSProperties {
  const c = adminPalette(theme);
  return {
    backgroundColor: c.bg,
    color: c.text,
    '--adm-bg': c.bg,
    '--adm-surface': c.surface,
    '--adm-surface-strong': c.surfaceStrong,
    '--adm-text': c.text,
    '--adm-text-dim': c.textDim,
    '--adm-muted': c.muted,
    '--adm-muted-deep': c.mutedDeep,
    '--adm-faint': c.faint,
    '--adm-accent': c.accent,
    '--adm-accent-deep': c.accentDeep,
    '--adm-success': c.success,
    '--adm-info': c.info,
    '--adm-warning': c.warning,
    '--adm-danger': c.danger,
    '--adm-special': c.special,
    '--adm-border': adminBorder(theme === 'light' ? 0.12 : 0.1, theme),
  } as CSSProperties;
}

/** Tepedeki soğuk hâle — tasarım dosyasındaki iki elips. */
export function adminBackgroundStyle(theme: AdminTheme = 'dark'): CSSProperties {
  const c = adminPalette(theme);
  // Açık zeminde aynı alfa neredeyse görünmez kalıyor; hale yumuşatıldı.
  const [accentAlfa, specialAlfa] = theme === 'light' ? ['12', '0d'] : ['24', '17'];
  return {
    background: [
      `radial-gradient(ellipse 1000px 600px at 17% -60px, ${c.accent}${accentAlfa}, transparent 70%)`,
      `radial-gradient(ellipse 840px 560px at 88% 200px, ${c.special}${specialAlfa}, transparent 70%)`,
      c.bg,
    ].join(', '),
  };
}

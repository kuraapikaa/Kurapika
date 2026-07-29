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

/** Kenarlıklar metin renginin düşük alfası; ayrı bir gri tonu getirilmiyor. */
export function adminBorder(alpha: number): string {
  return `rgba(242, 244, 248, ${alpha})`;
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
export function adminCssVars(): CSSProperties {
  return {
    backgroundColor: ADMIN_COLORS.bg,
    color: ADMIN_COLORS.text,
    '--adm-bg': ADMIN_COLORS.bg,
    '--adm-surface': ADMIN_COLORS.surface,
    '--adm-surface-strong': ADMIN_COLORS.surfaceStrong,
    '--adm-text': ADMIN_COLORS.text,
    '--adm-text-dim': ADMIN_COLORS.textDim,
    '--adm-muted': ADMIN_COLORS.muted,
    '--adm-muted-deep': ADMIN_COLORS.mutedDeep,
    '--adm-faint': ADMIN_COLORS.faint,
    '--adm-accent': ADMIN_COLORS.accent,
    '--adm-accent-deep': ADMIN_COLORS.accentDeep,
    '--adm-success': ADMIN_COLORS.success,
    '--adm-info': ADMIN_COLORS.info,
    '--adm-warning': ADMIN_COLORS.warning,
    '--adm-danger': ADMIN_COLORS.danger,
    '--adm-special': ADMIN_COLORS.special,
    '--adm-border': adminBorder(0.1),
  } as CSSProperties;
}

/** Tepedeki soğuk hâle — tasarım dosyasındaki iki elips. */
export function adminBackgroundStyle(): CSSProperties {
  return {
    background: [
      `radial-gradient(ellipse 1000px 600px at 17% -60px, ${ADMIN_COLORS.accent}24, transparent 70%)`,
      `radial-gradient(ellipse 840px 560px at 88% 200px, ${ADMIN_COLORS.special}17, transparent 70%)`,
      ADMIN_COLORS.bg,
    ].join(', '),
  };
}

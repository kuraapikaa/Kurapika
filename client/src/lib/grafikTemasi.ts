import { usePanelTheme } from '../store/panelTheme';

/**
 * GRAFİK RENKLERİ TEMAYA GÖRE.
 *
 * Recharts renkleri prop olarak, JavaScript'ten alıyor — CSS değişkeni
 * okumuyor. Bu yüzden panelin geri kalanını çeviren `--panel-*`
 * token'ları grafiklere hiç ulaşmıyordu ve açık temada üç şey birden
 * bozuluyordu:
 *
 *   - Izgara çizgileri `rgba(255,255,255,0.03)` ve `#ffffff10` idi:
 *     beyaz zeminde tamamen görünmez.
 *   - Eksen etiketleri `#8a919c` ile ~2.6:1 kontrast veriyordu.
 *   - İpucu kutusu `#0b0d12` ile açık sayfanın ortasında siyah bir
 *     dikdörtgen olarak kalıyordu.
 *
 * Seri renkleri (mavi/yeşil/kırmızı) iki temada da okunuyor ve anlam
 * taşıyor; yalnızca açık temada bir tık koyulaştırılıyorlar.
 */
export interface GrafikRenkleri {
  izgara: string;
  eksen: string;
  eksenYazi: string;
  ipucuZemin: string;
  ipucuKenar: string;
  ipucuYazi: string;
  seri: { mavi: string; yesil: string; kirmizi: string; mor: string };
}

const KOYU: GrafikRenkleri = {
  izgara: 'rgba(255, 255, 255, 0.06)',
  eksen: '#5c6470',
  eksenYazi: '#8a919c',
  ipucuZemin: '#0b0d12',
  ipucuKenar: 'rgba(255, 255, 255, 0.08)',
  ipucuYazi: '#f2f4f8',
  seri: { mavi: '#0a84ff', yesil: '#30d158', kirmizi: '#ff453a', mor: '#bf5af2' },
};

const ACIK: GrafikRenkleri = {
  izgara: 'rgba(15, 23, 42, 0.09)',
  eksen: '#94a3b8',
  eksenYazi: '#5b6b86',
  ipucuZemin: '#ffffff',
  ipucuKenar: 'rgba(15, 23, 42, 0.12)',
  ipucuYazi: '#0f172a',
  seri: { mavi: '#0a6ed1', yesil: '#15803d', kirmizi: '#b91c1c', mor: '#7e22ce' },
};

export function grafikRenkleri(theme: 'light' | 'dark'): GrafikRenkleri {
  return theme === 'light' ? ACIK : KOYU;
}

export function useGrafikRenkleri(): GrafikRenkleri {
  return grafikRenkleri(usePanelTheme((s) => s.theme));
}

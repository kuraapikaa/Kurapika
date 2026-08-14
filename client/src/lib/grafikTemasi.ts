/**
 * GRAFİK RENKLERİ.
 *
 * Recharts renkleri prop olarak, JavaScript'ten alıyor — CSS değişkeni
 * okumuyor. Bu yüzden panelin geri kalanını süren `--panel-*` token'ları
 * grafiklere hiç ulaşmıyor; palet burada elle tutuluyor.
 *
 * Panel tek temaya (Premium Dark Glassmorphism) indiği için açık varyant
 * kaldırıldı. Seri renkleri tasarım sistemindeki neon aksanlarla
 * hizalandı: mor / zümrüt / gül. Anlamları sabit — yeşil artı, kırmızı
 * eksi — tema değişse de değişmemeli.
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
  // Cam yüzey: ipucu kutusu da panelin geri kalanı gibi saydam-koyu.
  ipucuZemin: 'rgba(11, 10, 16, 0.92)',
  ipucuKenar: 'rgba(255, 255, 255, 0.08)',
  ipucuYazi: '#f2f4f8',
  seri: { mavi: '#38bdf8', yesil: '#34d399', kirmizi: '#fb7185', mor: '#a855f7' },
};

export function grafikRenkleri(): GrafikRenkleri {
  return KOYU;
}

export function useGrafikRenkleri(): GrafikRenkleri {
  return KOYU;
}

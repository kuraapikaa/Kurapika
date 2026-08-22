/**
 * PANELDE AÇIK OLAN SİTENİN KİMLİĞİ.
 *
 * Panel çok kiracılı; aynı kurulumdan farklı siteler yönetiliyor
 * (narcosbahis, tacobahis …). Sağ üstteki rozetin tek işi hangi sitenin
 * açık olduğunu söylemek.
 *
 * ── `adminTitle` neden kullanılmıyor ──────────────────────────────────
 * `adminTitle` panelin MARKASI ("Arwen Software Solutions") ve bütün
 * kiracılarda aynı olabiliyor. Önce onu tercih eden bir sıralama
 * yazılmıştı ve sonuç şuydu: hangi kiracıya girilirse girilsin rozette
 * aynı isim çıkıyor, yani rozet hiçbir şey söylemiyordu.
 *
 * Kimlik sırası: oturumun kendi kaydı → sitenin adı → alan adı →
 * kiracı anahtarı. Sonuncusu bile ("default") bir kimlik; markadan
 * iyidir.
 */

export type KimlikKaynagi = {
  /** Girişte oturuma yazılan site adı. */
  oturumSiteAdi?: unknown;
  /** Çözülen kiracı kaydı. */
  tenant?: { siteName?: unknown; domain?: unknown; id?: unknown } | null;
  /** Çözülen kiracı anahtarı (ör. "default"). */
  anahtar?: unknown;
};

function metin(deger: unknown): string {
  return String(deger ?? '').trim();
}

export function siteKimligi(kaynak: KimlikKaynagi): string {
  return (
    metin(kaynak?.oturumSiteAdi) ||
    metin(kaynak?.tenant?.siteName) ||
    metin(kaynak?.tenant?.domain) ||
    metin(kaynak?.tenant?.id) ||
    metin(kaynak?.anahtar)
  );
}

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
 * ── Neden "listedeki ilk kiracı" da yok ───────────────────────────────
 * Sonraki denemede, çözülen anahtara karşılık bir kiracı KAYDI yoksa
 * listedeki ilk etkin kiracıya düşülüyordu. Bu daha kötüsünü yaptı:
 * env yöneticisiyle (`ADMIN_USER`) girildiğinde oturumda `tenantId`
 * olmadığı için anahtar `default` çözülüyor, `default` adında bir kayıt
 * bulunmadığı için rozet ALAKASIZ bir kiracının adını yazıyordu --
 * veriler `default` kiracısından okunurken ekranda "Tacobahis".
 *
 * Yanlış kiracı adı göstermek, hiç göstermemekten tehlikeli: operatör
 * başka bir sitenin panelinde olduğunu sanarak ayar değiştirebilir.
 *
 * Kimlik sırası: oturumun kendi kaydı → ÇÖZÜLEN kiracının kaydı →
 * isteğin host'u → kiracı anahtarı. Hepsi gerçekten açık olan kiracıyı
 * anlatır; hiçbiri "başka bir kiracı" değildir.
 */

export type KimlikKaynagi = {
  /** Girişte oturuma yazılan site adı. */
  oturumSiteAdi?: unknown;
  /** ÇÖZÜLEN anahtara karşılık gelen kiracı kaydı (başkası değil). */
  tenant?: { siteName?: unknown; domain?: unknown; id?: unknown } | null;
  /** İsteğin host'u — env yöneticisinde en anlamlı kimlik budur. */
  host?: unknown;
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
    metin(kaynak?.host) ||
    metin(kaynak?.anahtar)
  );
}

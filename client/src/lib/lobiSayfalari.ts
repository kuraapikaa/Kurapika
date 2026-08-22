/**
 * LOBİDEKİ HAZIR SAYFALAR — tek kaynak.
 *
 * Bu liste üç ayrı yerde kopyalanmıştı: sunucu varsayılanı, oyuncu
 * lobisinin yedeği ve lobi tasarım yöneticisinin varsayılanı. Üçü zamanla
 * ayrıştı; sonuncusu "Şans Kasaları" ve "Özel Oranlar" sayfalarını hiç
 * öğrenemedi.
 *
 * ── Sessiz kaybın mekaniği ────────────────────────────────────────────
 * Sunucu, kayıtlı `quickAccess` dizisini varsayılanlarla BİRLEŞTİRMİYOR;
 * dizi varsa olduğu gibi kullanıyor. Kiracı lobisini bu iki sayfa
 * eklenmeden önce kaydettiyse kartlar ona hiç görünmüyor -- panelde de
 * listelenmediği için eksik oldukları fark edilmiyor.
 *
 * Birleştirme yapmak cazip ama YANLIŞ olurdu: panelde kart silmek
 * mümkün, dolayısıyla bilinçli olarak kaldırılmış bir kart her açılışta
 * geri gelirdi. Bunun yerine panel eksik sayfaları GÖSTERİYOR ve ekleme
 * kararını operatöre bırakıyor.
 *
 * ── Kimlik neden önemli ───────────────────────────────────────────────
 * Kart görseli `LobiKartAkisi`de kimliğe göre eşleşiyor. Panelden elle
 * eklenen kart `custom-1787...` kimliği aldığı için görseli asla
 * bulunamıyordu; buradan eklenince kimlik doğru oluyor.
 */

export type LobiSayfasi = {
  id: string;
  label: string;
  desc: string;
  to: string;
  icon: string;
  accentColor: string;
  enabled: boolean;
};

/** Sunucu varsayılanının aynası (`server/src/routes/games.ts`). */
export const LOBI_SAYFALARI: LobiSayfasi[] = [
  { id: 'bonus', label: 'Bonus Talep', desc: 'Kampanya ve freespin', to: '/bonus-talep', icon: 'gift', accentColor: '#fb7185', enabled: true },
  { id: 'wheel', label: 'Şans Çarkı', desc: 'Çevir, ödül kazan', to: '/cark', icon: 'zap', accentColor: '#d4af37', enabled: true },
  { id: 'kasa', label: 'Şans Kasaları', desc: 'Kasayı aç, ödülü al', to: '/kasa', icon: 'package', accentColor: '#f59e0b', enabled: true },
  { id: 'ozel-oran', label: 'Özel Oranlar', desc: 'Yükseltilmiş oranlar', to: '/ozel-oran', icon: 'trending-up', accentColor: '#f59e0b', enabled: true },
  { id: 'scratch', label: 'Kazı Kazan', desc: 'Kartını kazı', to: '/kazi-kazan', icon: 'sparkles', accentColor: '#f4d36f', enabled: true },
  { id: 'prediction', label: 'Narcos Skor Tahmin', desc: 'Maç skoru bil', to: '/skor-tahmin', icon: 'goal', accentColor: '#6ee7b7', enabled: true },
  { id: 'daily-tasks', label: 'Günlük Görevler', desc: 'API ilerleme', to: '/gorevler', icon: 'list-checks', accentColor: '#7dd3fc', enabled: true },
  { id: 'tournament', label: 'Turnuva', desc: 'Sıralamaya gir', to: '/turnuva/gunluk', icon: 'trophy', accentColor: '#facc15', enabled: true },
  { id: 'loyalty', label: 'Sadakat', desc: 'XP ve ödüller', to: '/sadakat', icon: 'star', accentColor: '#facc15', enabled: true },
  { id: 'millionaires', label: 'Milyonerler', desc: 'Büyük kazançlar', to: '/milyonerler', icon: 'crown', accentColor: '#facc15', enabled: true },
  { id: 'vip', label: 'VIP', desc: 'Özel üyelik', to: '/vip', icon: 'shield', accentColor: '#d4af37', enabled: true },
  { id: 'partner', label: 'İş Birliği', desc: 'Partner ol', to: '/ortaklik', icon: 'handshake', accentColor: '#7dd3fc', enabled: true },
  { id: 'call-me', label: 'Aranma Talep', desc: '7/24 destek', to: '/beni-ara', icon: 'phone', accentColor: '#7dd3fc', enabled: true },
];

/** Yeni bir yapılandırma için varsayılan liste (kopyası; paylaşılan nesne değil). */
export function varsayilanLobiSayfalari(): LobiSayfasi[] {
  return LOBI_SAYFALARI.map((sayfa) => ({ ...sayfa }));
}

/**
 * Kayıtlı listede BULUNMAYAN hazır sayfalar.
 *
 * Karşılaştırma yalnızca kimliğe göre: operatör kartın adını ya da
 * rengini değiştirmiş olabilir, o kart yine de "var" sayılır. Ada göre
 * karşılaştırsaydık yeniden adlandırılmış her kart "eksik" görünürdü.
 */
export function eksikLobiSayfalari(
  mevcut: ReadonlyArray<{ id?: unknown }> | null | undefined,
): LobiSayfasi[] {
  const kimlikler = new Set(
    (Array.isArray(mevcut) ? mevcut : [])
      .map((kart) => String(kart?.id ?? '').trim())
      .filter(Boolean),
  );
  return LOBI_SAYFALARI.filter((sayfa) => !kimlikler.has(sayfa.id)).map((sayfa) => ({ ...sayfa }));
}

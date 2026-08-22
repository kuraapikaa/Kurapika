import { SEVIYE_BASINA_XP } from './sadakatIlerlemesi';

/**
 * VIP SEVİYELERİ — tek kaynak.
 *
 * Önce iki ayrı VIP merdiveni vardı ve birbirlerinden habersizdiler:
 *   · `tiers` — pazarlama kartları (Prestij/Champion/Elite/Master).
 *     Hiçbir eşiği yoktu; seviye BAŞVURU formuyla, elle veriliyordu.
 *   · `ranks` — XP merdiveni (Bronz…Efsane). Panelden düzenlenemiyordu,
 *     hep varsayılan listeyle çalışıyordu.
 *
 * Oyuncu VIP sayfasında ikisini birden görüyordu: biri "başvur" diyen dört
 * kart, diğeri XP'ye göre ilerleyen yedi basamak. Hangisinin gerçek olduğu
 * belli değildi.
 *
 * Artık tek liste var ve ölçüsü XP. Seviye eşiği `minLevel` üzerinden
 * yazılıyor, gereken XP ondan TÜRETİLİYOR -- ikisi ayrı ayrı girilseydi
 * biri değişip diğeri kalınca merdiven kendi içinde çelişirdi.
 */

export type VipSeviye = {
  id: string;
  label: string;
  /** Bu seviyenin başladığı sadakat seviyesi (1 = herkes). */
  minLevel: number;
  /** Logo yüklenmemişse gösterilen simge. */
  badge?: string;
  /** Panelden yüklenen özel logo (küçültülmüş data URI). */
  logoUrl?: string;
  perks: string[];
  /** Sayfada öne çıkarılan kart. */
  oneCikan?: boolean;
};

export const VARSAYILAN_SEVIYELER: VipSeviye[] = [
  { id: 'bronz', label: 'Bronz', minLevel: 1, badge: '🥉', perks: ['Hoş geldin paketi', 'Standart cashback'] },
  { id: 'gumus', label: 'Gümüş', minLevel: 6, badge: '🥈', perks: ['Haftalık cashback', 'Doğum günü bonusu'] },
  { id: 'altin', label: 'Altın', minLevel: 16, badge: '🥇', perks: ['Öncelikli destek', 'Artırılmış çekim limiti'], oneCikan: true },
  { id: 'platin', label: 'Platin', minLevel: 26, badge: '💠', perks: ['Hızlandırılmış çekim', 'Özel promosyonlar'] },
  { id: 'elmas', label: 'Elmas', minLevel: 36, badge: '💎', perks: ['Kişisel VIP asistanı', 'Yükseltilmiş cashback'] },
  { id: 'sampiyon', label: 'Şampiyon', minLevel: 46, badge: '🏆', perks: ['Özel etkinlik davetleri', 'Turnuva öncelikleri'] },
  { id: 'efsane', label: 'Efsane', minLevel: 56, badge: '👑', perks: ['Limitsiz ayrıcalık', 'Kişisel VIP koordinatörü'] },
];

/** Seviyenin gerektirdiği toplam XP — `minLevel`den türetiliyor. */
export function seviyeXp(seviye: Pick<VipSeviye, 'minLevel'>): number {
  return Math.max(0, (Math.max(1, Math.floor(Number(seviye?.minLevel) || 1)) - 1) * SEVIYE_BASINA_XP);
}

export function seviyeleriSirala(liste: VipSeviye[]): VipSeviye[] {
  return liste.slice().sort((a, b) => a.minLevel - b.minLevel);
}

/**
 * Oyuncunun bulunduğu seviyenin sırası; hiçbirine girmiyorsa -1.
 * Sunucu `level = floor(xp/1000)+1` diyor; burada aynı ölçü kullanılıyor.
 */
export function oyuncununSeviyesi(sadakatSeviyesi: number, liste: VipSeviye[]): number {
  const seviye = Math.floor(Number(sadakatSeviyesi) || 0);
  return seviyeleriSirala(liste).reduce((bulunan, s, i) => (seviye >= s.minLevel ? i : bulunan), -1);
}

function metin(deger: unknown, yedek = ''): string {
  const s = String(deger ?? '').trim();
  return s || yedek;
}

function perkListesi(deger: unknown): string[] {
  if (!Array.isArray(deger)) return [];
  return deger.map((p) => metin(p)).filter(Boolean);
}

/**
 * Eski `tiers` listesini seviyelere çevirir.
 *
 * Kartların hiçbir eşiği yoktu (seviye elle veriliyordu), dolayısıyla
 * eşikler burada ÜRETİLİYOR: varsayılan merdivenin basamakları, yetmezse
 * onar seviyelik aralıklar. Bu bir tahmin ve panelde düzeltilmesi
 * bekleniyor -- ama içeriği (ad, simge, avantajlar) kaybetmemek, sıfırdan
 * başlatmaktan iyidir.
 */
export function tierlerdenSeviyeler(tiers: unknown): VipSeviye[] {
  if (!Array.isArray(tiers) || tiers.length === 0) return [];
  return tiers.map((tier: any, i: number) => ({
    id: metin(tier?.id, `seviye-${i + 1}`),
    label: metin(tier?.label, `Seviye ${i + 1}`),
    minLevel: VARSAYILAN_SEVIYELER[i]?.minLevel ?? i * 10 + 1,
    badge: metin(tier?.badge) || undefined,
    logoUrl: metin(tier?.logoUrl) || undefined,
    perks: perkListesi(tier?.perks),
    oneCikan: Boolean(tier?.popular ?? tier?.oneCikan),
  }));
}

/** Tek bir kaydı güvenli hale getirir. */
export function seviyeyiNormalize(ham: unknown, sira: number): VipSeviye {
  const kayit = (ham ?? {}) as any;
  const minLevelHam = Number(kayit.minLevel);
  return {
    id: metin(kayit.id, `seviye-${sira + 1}`),
    label: metin(kayit.label, `Seviye ${sira + 1}`),
    minLevel: Number.isFinite(minLevelHam) ? Math.max(1, Math.floor(minLevelHam)) : 1,
    badge: metin(kayit.badge) || undefined,
    logoUrl: metin(kayit.logoUrl) || undefined,
    // Eski `perk` (tekil) alanı da okunuyor: rütbe merdiveninde öyleydi.
    perks: perkListesi(kayit.perks).length ? perkListesi(kayit.perks) : [metin(kayit.perk)].filter(Boolean),
    oneCikan: Boolean(kayit.oneCikan ?? kayit.popular),
  };
}

/**
 * VIP yapılandırmasından seviye listesini çıkarır.
 * Sıra: `ranks` → eski `tiers` → varsayılanlar.
 */
export function seviyeleriNormalize(vip: unknown): VipSeviye[] {
  const kayit = (vip ?? {}) as any;
  if (Array.isArray(kayit.ranks) && kayit.ranks.length) {
    return seviyeleriSirala(kayit.ranks.map(seviyeyiNormalize));
  }
  const gocmus = tierlerdenSeviyeler(kayit.tiers);
  if (gocmus.length) return seviyeleriSirala(gocmus);
  return VARSAYILAN_SEVIYELER.map((s) => ({ ...s, perks: [...s.perks] }));
}

/**
 * Kaydetmeden önce gösterilen uyarılar.
 *
 * Hepsi oyuncunun gördüğü şeyi sessizce bozan durumlar: panelde bir hata
 * mesajı çıkmaz, sadece seviye hiç açılmaz ya da iki seviye üst üste
 * biner. Bu yüzden kaydı engellemiyor, ama açıkça yazıyor.
 */
export function seviyeUyarilari(liste: VipSeviye[]): string[] {
  const uyarilar: string[] = [];
  if (liste.length === 0) return ['Hiç VIP seviyesi yok; oyuncu sayfasında merdiven boş görünür.'];

  const sirali = seviyeleriSirala(liste);

  if (sirali[0].minLevel > 1) {
    uyarilar.push(
      `En düşük seviye ${sirali[0].minLevel}. seviyeden başlıyor; yeni oyuncular hiçbir VIP seviyesinde görünmez.`,
    );
  }

  for (let i = 1; i < sirali.length; i += 1) {
    if (sirali[i].minLevel === sirali[i - 1].minLevel) {
      uyarilar.push(
        `"${sirali[i - 1].label}" ve "${sirali[i].label}" aynı seviyeden (${sirali[i].minLevel}) başlıyor; ikincisine hiçbir oyuncu ulaşamaz.`,
      );
    }
  }

  const adsiz = sirali.filter((s) => !s.label.trim());
  if (adsiz.length) uyarilar.push(`${adsiz.length} seviyenin adı boş.`);

  const kimliksiz = new Set(sirali.map((s) => s.id));
  if (kimliksiz.size !== sirali.length) {
    uyarilar.push('Aynı kimliğe sahip birden fazla seviye var; kayıt sırasında biri diğerini ezebilir.');
  }

  return uyarilar;
}

/**
 * ADMIN ROTALARININ TEK KAYNAĞI.
 *
 * Önceden aynı bilgi `App.tsx` içinde DÖRT ayrı haritaya dağılmıştı ve
 * hepsi `TabId` union'ıyla anahtarlanıyordu:
 *
 *   TAB_META         → başlık ve eyebrow
 *   TAB_DESCRIPTIONS → açıklama metni
 *   TAB_PERMISSION   → yetki anahtarı
 *   NAV_GROUPS       → menü etiketi, yol, ikon
 *
 * Yeni bir ekran eklemek dört yeri birden düzenlemek demekti; biri
 * unutulduğunda ekran ya menüde görünmüyor ya başlıksız açılıyor ya da
 * yetki kontrolünden kaçıyordu. `vipSettings` ve `dailyTasks` girdileri
 * bu yüzden iki haritada satır sonuna sıkışmış halde duruyordu.
 *
 * Artık her rota TEK bir kayıt. Menü bu diziden türetiliyor, başlık ve
 * yetki de buradan okunuyor; dizide olmayan bir rota menüde de yok.
 *
 * Yol (`path`) birincil anahtar — `TabId` değil. `id` yalnızca
 * `data-tab` özniteliği ve hata ayıklama için duruyor.
 */
import {
  LayoutDashboard,
  Gift,
  Users,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart2,
  ListOrdered,
  Zap,
  Radar,
  UserCog,
  Gamepad2,
  ListChecks,
  Mailbox,
  Trophy,
  Code2,
  Star,
  Target,
  Ticket,
  Palette,
  Crown,
  LineChart,
  Scale,
  SlidersHorizontal,
  ClipboardList,
  ScrollText,
  Sparkles,
  CalendarDays,
  type LucideIcon,
} from 'lucide-react';
import { matchPath } from 'react-router-dom';

export type NavGroupLabel = 'Bugün' | 'Para' | 'Oyuncular' | 'Bonus' | 'Oyunlar' | 'Denetim' | 'Site';

export type RouteMeta = {
  /** Yalnızca `data-tab` ve hata ayıklama için; eşleştirme `path` ile yapılır. */
  id: string;
  path: string;
  /** Yoksa herkes erişebilir. `admin` rolü her zaman erişir. */
  permission?: string;
  eyebrow: string;
  title: string;
  description: string;
  /** Başlıkta ve mobil dock'ta tarih aralığı çubuğu gösterilsin mi? */
  dateFilters?: boolean;
  /**
   * Sayfayı saran kutunun ek sınıfları. Kendi içinde dikey kaydıran
   * ekranlar (`min-h-0 flex-1` olmadan taşarlar) bunu kullanıyor.
   */
  icerikSinifi?: string;
  /** Menüde görünmeyen rotalarda yok (ör. oyuncu profili). */
  nav?: { group: NavGroupLabel; label: string; icon: LucideIcon; end?: boolean };
};

/**
 * Sol menü gruplama.
 *
 * ── Önceki gruplama ───────────────────────────────────────────────────
 *
 * Gruplar özelliğin TÜRÜNE göreydi (Genel / Finans / Analiz / Deneyim /
 * Oyun Yönetimi / Sistem) ve aynı iş üç ayrı yere dağılmıştı:
 *
 *   Bonus merkezi   → Deneyim
 *   Bonus raporu    → Analiz
 *   Bonus kuralları → Sistem
 *
 * Bonus sızıntısı araştırırken operatör üç farklı grup arasında gidip
 * geliyordu. Aynı şey raporlar için de geçerliydi: sağlayıcı raporu
 * Analiz'de, Lynon API dökümanı ve API trafiği Sistem'deydi.
 *
 * Yeni gruplama operatörün İŞİNE göre: bir konuyla uğraşırken ihtiyacın
 * olan her şey tek grupta.
 *
 * ── İkonlar ───────────────────────────────────────────────────────────
 *
 * Üç ikon çift kullanılıyordu — Gift (bonus merkezi + bonus raporu),
 * Crown (kazanç vitrini + VIP), FileText (audit + Lynon dökümanı). Aynı
 * ikon iki ayrı yere gidiyorsa ikon iş görmüyor demektir. Hepsi tekil.
 */
const NAV_GROUP_ORDER: NavGroupLabel[] = [
  'Bugün',
  'Para',
  'Oyuncular',
  'Bonus',
  'Oyunlar',
  'Denetim',
  'Site',
];

/**
 * Sıra ÖNEMLİ: menü grupları bu dizinin sırasından türetiliyor.
 */
export const ADMIN_ROUTES: RouteMeta[] = [
  // ── Bugün ───────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    path: '/',
    permission: 'dashboard',
    eyebrow: 'Command center',
    title: 'Genel görünüm',
    description: 'Finansal akışı, oyuncu hareketlerini ve operasyon sağlığını tek görünümde izleyin.',
    dateFilters: true,
    nav: { group: 'Bugün', label: 'Genel görünüm', icon: LayoutDashboard, end: true },
  },
  {
    id: 'liveRadar',
    icerikSinifi: 'mt-4 min-h-0 flex-1',
    path: '/canli-radar',
    permission: 'reports',
    eyebrow: 'İstihbarat',
    title: 'Canlı radar',
    description: 'Canlı oyuncu ve işlem sinyallerini anlık olarak takip edin.',
    nav: { group: 'Bugün', label: 'Canlı radar', icon: Radar },
  },
  {
    id: 'registrationStats',
    path: '/kayit-istatistikleri',
    permission: 'players',
    eyebrow: 'CRM',
    title: 'Kayıt istatistikleri',
    description: 'Yeni kayıtların kaynak, zaman ve dönüşüm performansını karşılaştırın.',
    dateFilters: true,
    nav: { group: 'Bugün', label: 'Kayıt analizi', icon: LineChart },
  },

  // ── Para ────────────────────────────────────────────────────────────
  {
    id: 'deposits',
    path: '/para-yatirmalar',
    permission: 'finance',
    eyebrow: 'Finans',
    title: 'Yatırımlar',
    description: 'Yatırım hareketlerini, ödeme kanallarını ve işlem detaylarını takip edin.',
    dateFilters: true,
    nav: { group: 'Para', label: 'Yatırımlar', icon: ArrowDownToLine },
  },
  {
    id: 'withdrawals',
    path: '/para-cekme-talepleri',
    permission: 'finance',
    eyebrow: 'Finans',
    title: 'Çekim talepleri',
    description: 'Çekim taleplerini durum, tutar ve risk sinyalleriyle birlikte değerlendirin.',
    dateFilters: true,
    nav: { group: 'Para', label: 'Çekim talepleri', icon: ArrowUpFromLine },
  },
  {
    id: 'autoWithdraw',
    icerikSinifi: 'mt-4 min-h-0 flex-1',
    path: '/admin/auto-withdraw',
    permission: 'finance',
    eyebrow: 'Otomasyon',
    title: 'Otomatik çekim',
    description: 'Otomatik çekim kurallarını ve operasyon kuyruğunu merkezi olarak yönetin.',
    dateFilters: true,
    nav: { group: 'Para', label: 'Otomatik çekim', icon: Zap },
  },
  {
    id: 'transactions',
    path: '/islemler',
    permission: 'finance',
    eyebrow: 'Operasyon',
    title: 'İşlemler',
    description: 'Tüm finansal hareketlerde gelişmiş filtrelerle detaylı inceleme yapın.',
    dateFilters: true,
    nav: { group: 'Para', label: 'Tüm işlemler', icon: ListOrdered },
  },
  {
    id: 'topluIslemOzeti',
    path: '/toplu-islem-ozeti',
    permission: 'finance',
    eyebrow: 'Operasyon',
    title: 'Toplu yatırım / çekim',
    description: 'Kullanıcı adı listesi yapıştırın; her biri için toplam yatırımı ve çekimi ayrı tarih aralıklarıyla görün.',
    // Tarih filtreleri sayfanın KENDİ içinde: yatırım ve çekim ayrı
    // aralık kullanıyor, üstteki tek aralık ikisini de yönetemezdi.
    nav: { group: 'Para', label: 'Toplu sorgu', icon: Users },
  },

  // ── Oyuncular ───────────────────────────────────────────────────────
  {
    id: 'players',
    path: '/oyuncular',
    permission: 'players',
    eyebrow: 'CRM',
    title: 'Oyuncular',
    description: 'Oyuncu portföyünde arama yapın, segmentleri ve hesap performansını inceleyin.',
    nav: { group: 'Oyuncular', label: 'Oyuncu listesi', icon: Users },
  },
  {
    id: 'userSystem',
    path: '/admin/kullanici-sistemi',
    permission: 'system',
    eyebrow: 'Erişim',
    title: 'Kullanıcı sistemi',
    description: 'Çalışan alt panellerini açın, rollerini ve modül yetkilerini yönetin.',
    nav: { group: 'Oyuncular', label: 'Kullanıcı sistemi', icon: UserCog },
  },

  // ── Bonus ───────────────────────────────────────────────────────────
  // Bonusla ilgili her sey TEK grupta: verme, kural, rapor.
  {
    id: 'bonuses',
    path: '/bonuslar',
    permission: 'bonuses',
    eyebrow: 'Promosyonlar',
    title: 'Bonus yönetimi',
    description: 'Aktif kampanyaları, free spin tekliflerini ve arşivlenmiş bonusları yönetin.',
    nav: { group: 'Bonus', label: 'Bonus merkezi', icon: Gift },
  },
  {
    id: 'rules',
    path: '/bonus-kurallari',
    permission: 'bonuses',
    eyebrow: 'Yapılandırma',
    title: 'Bonus kuralları',
    description: 'Bonus uygunluk ve çevrim kurallarını merkezi olarak yapılandırın.',
    nav: { group: 'Bonus', label: 'Kural merkezi', icon: SlidersHorizontal },
  },
  {
    id: 'bonusReport',
    icerikSinifi: 'mt-4 min-h-0 flex-1',
    path: '/tum-bonus-raporu',
    permission: 'reports',
    eyebrow: 'Raporlar',
    title: 'Bonus raporu',
    description: 'Dağıtılan bonusların kullanımını, maliyetini ve performansını ölçün.',
    dateFilters: true,
    nav: { group: 'Bonus', label: 'Bonus raporu', icon: ClipboardList },
  },
  {
    id: 'loyaltySettings',
    path: '/loyalty-ayarlari',
    permission: 'experience',
    eyebrow: 'Yapılandırma',
    title: 'Sadakat ayarları',
    description: 'Sadakat seviyelerini, puan ekonomisini ve ödül kataloğunu yönetin.',
    nav: { group: 'Bonus', label: 'Sadakat sistemi', icon: Star },
  },
  {
    id: 'vipSettings',
    path: '/admin/vip-ayarlari',
    permission: 'system',
    eyebrow: 'Yapılandırma',
    title: 'VIP Ayarları',
    description: 'VIP kademelerini, avantajları, SSS ve başvuru formunu özelleştirin.',
    nav: { group: 'Bonus', label: 'VIP ayarları', icon: Crown },
  },

  // ── Oyunlar ─────────────────────────────────────────────────────────
  {
    id: 'wheelManager',
    path: '/admin/sans-carki',
    permission: 'experience',
    eyebrow: 'Oyun Yönetimi',
    title: 'Şans Çarkı',
    description: 'Şans çarkı dilimlerini, oranları ve görsel temasını yapılandırın.',
    nav: { group: 'Oyunlar', label: 'Şans çarkı', icon: Target },
  },
  {
    id: 'scratchManager',
    path: '/admin/kazi-kazan-yonetimi',
    permission: 'experience',
    eyebrow: 'Oyun Yönetimi',
    title: 'Kazı Kazan',
    description: 'Kazı kazan kartlarının ödüllerini, katmanlarını ve kurallarını düzenleyin.',
    nav: { group: 'Oyunlar', label: 'Kazı kazan', icon: Ticket },
  },
  {
    id: 'predictionLeague',
    path: '/admin/skor-tahmin-yonetimi',
    permission: 'experience',
    eyebrow: 'Oyun Yönetimi',
    title: 'Skor Tahmin',
    description: 'Skor tahmin ligindeki maç listesini ve tahmin koşullarını yönetin.',
    nav: { group: 'Oyunlar', label: 'Skor tahmin', icon: CalendarDays },
  },
  {
    id: 'millionaireShowcase',
    path: '/admin/kazanc-vitrini',
    permission: 'experience',
    eyebrow: 'Oyun Yönetimi',
    title: 'Kazanç Vitrini',
    description: 'Büyük kazançları ve video içeriklerini vitrin alanında sergileyin.',
    nav: { group: 'Oyunlar', label: 'Kazanç vitrini', icon: Sparkles },
  },
  {
    id: 'dailyTasks',
    path: '/admin/gunluk-gorevler',
    permission: 'experience',
    eyebrow: 'Etkinlik Yönetimi',
    title: 'Günlük Görevler',
    description: 'API metrikleriyle tamamlanan günlük görevleri, XP değerlerini ve ödülleri yönetin.',
    nav: { group: 'Oyunlar', label: 'Günlük görevler', icon: ListChecks },
  },
  {
    id: 'tournament',
    path: '/turnuva-ayarlari',
    permission: 'experience',
    eyebrow: 'Yapılandırma',
    title: 'Turnuva ayarları',
    description: 'Turnuva zamanlamalarını, ödülleri ve katılım koşullarını belirleyin.',
    nav: { group: 'Oyunlar', label: 'Turnuvalar', icon: Trophy },
  },
  {
    id: 'games',
    path: '/admin/oyun-ayarlari',
    permission: 'experience',
    eyebrow: 'Yapılandırma',
    title: 'Oyun ayarları',
    description: 'Oyuncu deneyimindeki oyun modüllerini ve ödül yapılarını yapılandırın.',
    nav: { group: 'Oyunlar', label: 'Oyun ayarları', icon: Gamepad2 },
  },

  // ── Denetim ─────────────────────────────────────────────────────────
  // Denetim ve teshis: "ne oldu" sorusunun sorulacagi yer.
  {
    id: 'providerReport',
    path: '/saglayici-raporu',
    permission: 'reports',
    eyebrow: 'Raporlar',
    title: 'Sağlayıcı performansı',
    description: 'Sağlayıcı cirolarını, RTP değerlerini ve tahmini maliyetleri analiz edin.',
    dateFilters: true,
    nav: { group: 'Denetim', label: 'Sağlayıcı raporu', icon: BarChart2 },
  },
  {
    id: 'manuelDuzeltmeler',
    icerikSinifi: 'mt-4 min-h-0 flex-1',
    path: '/manuel-duzeltmeler',
    permission: 'reports',
    eyebrow: 'Denetim',
    title: 'Manuel düzeltmeler',
    description: 'Lynon arayüzünden elle yapılan bakiye eklemeleri; hangi yönetici, hangi hesap, hangi gerekçe.',
    nav: { group: 'Denetim', label: 'Manuel düzeltmeler', icon: Scale },
  },
  {
    id: 'audit',
    path: '/audit',
    permission: 'reports',
    eyebrow: 'Güvenlik',
    title: 'Audit kayıtları',
    description: 'Panelde gerçekleşen kritik kullanıcı ve sistem işlemlerini denetleyin.',
    nav: { group: 'Denetim', label: 'Audit kayıtları', icon: ScrollText },
  },

  // ── Site ────────────────────────────────────────────────────────────
  {
    id: 'lobbyDesign',
    path: '/admin/lobi-tasarimi',
    permission: 'system',
    eyebrow: 'Sistem',
    title: 'Lobi Tasarımı',
    description: 'Her siteye özel lobi renklerini, arkaplan görselini ve yatay banner alanını yönetin.',
    nav: { group: 'Site', label: 'Lobi tasarımı', icon: Palette },
  },
  {
    id: 'forms',
    path: '/admin/formlar',
    permission: 'forms',
    eyebrow: 'Yapılandırma',
    title: 'Talep formları',
    description: 'Kullanıcı talep formlarını ve operasyon durumlarını düzenleyin.',
    nav: { group: 'Site', label: 'Talep formları', icon: Mailbox },
  },
  {
    id: 'iframeGen',
    path: '/admin/iframe-generator',
    permission: 'system',
    eyebrow: 'Entegrasyon',
    title: 'iFrame oluşturucu',
    description: 'Dış kanallar için güvenli ve markalı entegrasyon kodları üretin.',
    nav: { group: 'Site', label: 'iFrame entegrasyonu', icon: Code2 },
  },

  // ── Menüde yer almayan rotalar ──────────────────────────────────────
  {
    // Oyuncu listesinden, çekim/yatırım tablolarından ve BTag raporundan
    // tıklanarak açılır; menüde girişi yok.
    id: 'profile',
    path: '/oyuncu/:id/:login',
    permission: 'players',
    eyebrow: 'CRM',
    title: 'Oyuncu profili',
    description: 'Oyuncunun finansal geçmişini, oyun davranışını ve risk profilini analiz edin.',
  },
];

/** Adres çubuğundaki yola karşılık gelen rota kaydı. */
export function findRouteMeta(pathname: string): RouteMeta | undefined {
  return ADMIN_ROUTES.find((route) => matchPath({ path: route.path, end: true }, pathname));
}

/**
 * `admin` rolü her şeyi görür. Yetki anahtarı olmayan rota herkese açık.
 * (Eski `canAccessTab` ile aynı mantık; anahtar `TabId` yerine yetki adı.)
 */
export function canAccessRoute(user: any, permission?: string): boolean {
  if (!user || user.role === 'admin') return true;
  if (!permission) return true;
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
}

export type NavGroup = {
  label: NavGroupLabel;
  items: Array<RouteMeta & { nav: NonNullable<RouteMeta['nav']> }>;
};

/**
 * Menü, rota dizisinden türetilir — ayrı bir liste tutulmaz. Kullanıcının
 * yetkisi olmayan rota menüye hiç girmez, boş kalan grup düşer.
 */
export function buildNavGroups(user: any): NavGroup[] {
  const withNav = ADMIN_ROUTES.filter(
    (route): route is RouteMeta & { nav: NonNullable<RouteMeta['nav']> } => !!route.nav,
  );
  return NAV_GROUP_ORDER.map((label) => ({
    label,
    items: withNav.filter((route) => route.nav.group === label && canAccessRoute(user, route.permission)),
  })).filter((group) => group.items.length > 0);
}

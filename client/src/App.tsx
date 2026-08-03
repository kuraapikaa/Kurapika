import { useState, useRef, useCallback, Suspense, lazy, useEffect } from 'react';
import { matchesTr } from './lib/turkishSearch';
import { GlobalNotifications } from './components/GlobalNotifications';
import { useMemo } from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  LogOut,
  Menu,
  X,
  Gamepad2,
  ListChecks,
  Mailbox,
  Trophy,
  Code2,
  Star,
  ShieldCheck,
  CalendarDays,
  RefreshCw,
  Target,
  Ticket,
  Palette,
  Crown,
  Handshake,
  Activity,
  LineChart,
  Layers,
  Scale,
  ShieldAlert,
  SlidersHorizontal,
  ClipboardList,
  ScrollText,
  BookOpen,
  Sparkles,
  type LucideIcon, ChevronLeft, ChevronRight, Search} from 'lucide-react';
import { cn } from './lib/utils';
import { LoadingState } from './components/ui/LoadingState';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DateRangeBar } from './components/DateRangeBar';
import { DateRangePresets } from './components/DateRangePresets';
import { SummaryCards } from './components/SummaryCards';

import { RulesManager } from './components/RulesManager';
import { PartnerProfit } from './components/PartnerProfit';
import { TopSports } from './components/TopSports';
import { TopCasinoGames } from './components/TopCasinoGames';
import { SportbookOverview } from './components/SportbookOverview';
import { BonusList } from './components/BonusList';
import { FreeBetBonusList } from './components/FreeBetBonusList';
import { AllPlayersList } from './components/AllPlayersList';
import { WithdrawalRequestsList } from './components/WithdrawalRequestsList';
import { DepositsList } from './components/DepositsList';
import { StatusBar } from './components/StatusBar';
import { useDashboardData } from './hooks/useDashboardData';
import { useDateRange } from './context/DateRangeContext';

import { dashboardApi } from './api/client';
import { NotificationCenter } from './components/NotificationCenter';
import { LoginPage } from './components/LoginPage';

const PlayerProfile = lazy(() => import('./components/PlayerProfile').then(m => ({ default: m.PlayerProfile })));
const TransactionsList = lazy(() => import('./components/TransactionsList').then(m => ({ default: m.TransactionsList })));
const AutoWithdrawPanel = lazy(() => import('./components/admin/AutoWithdrawPanel').then(m => ({ default: m.AutoWithdrawPanel })));
const RiskAnalysisPage = lazy(() => import('./components/RiskAnalysisPage').then(m => ({ default: m.RiskAnalysisPage })));
const OyuncuKategorileme = lazy(() => import('./components/OyuncuKategorileme').then(m => ({ default: m.OyuncuKategorileme })));
const ManuelDuzeltmeler = lazy(() => import('./components/ManuelDuzeltmeler').then(m => ({ default: m.ManuelDuzeltmeler })));
const LiveRadar = lazy(() => import('./components/LiveRadar').then(m => ({ default: m.LiveRadar })));
const RegistrationStats = lazy(() => import('./components/RegistrationStats').then(m => ({ default: m.RegistrationStats })));
const ProviderReport = lazy(() => import('./components/ProviderReport').then(m => ({ default: m.ProviderReport })));
const ClientBonusReport = lazy(() => import('./components/ClientBonusReport').then(m => ({ default: m.ClientBonusReport })));
const AuditLogPage = lazy(() => import('./components/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const AdminGames = lazy(() => import('./components/admin/AdminGames').then(m => ({ default: m.AdminGames })));
const AdminForms = lazy(() => import('./components/admin/AdminForms').then(m => ({ default: m.AdminForms })));
const IFrameGenerator = lazy(() => import('./components/admin/IFrameGenerator').then(m => ({ default: m.IFrameGenerator })));
const LoyaltySettings = lazy(() => import('./components/admin/LoyaltySettings').then(m => ({ default: m.LoyaltySettings })));
const UserSystem = lazy(() => import('./components/admin/UserSystem').then(m => ({ default: m.UserSystem })));
const VIPSettings = lazy(() => import('./components/admin/VIPSettings').then(m => ({ default: m.VIPSettings })));
const AffiliatePanel = lazy(() => import('./components/admin/AffiliatePanel').then(m => ({ default: m.AffiliatePanel })));
// recharts ~200 kB; STATIK import edildiginde ana pakete giriyordu ve
// lobiye giren oyuncu bile indiriyordu. Yalnizca finans sekmesi acildiginda yuklensin.
const DashboardCharts = lazy(() => import('./components/DashboardCharts').then(m => ({ default: m.DashboardCharts })));

const BonusTalepSayfasi = lazy(() => import('./components/pages/BonusTalepSayfasi').then(m => ({ default: m.BonusTalepSayfasi })));
const PlayerLobby = lazy(() => import('./components/pages/PlayerLobby').then(m => ({ default: m.PlayerLobby })));
const MillionaireShowcasePage = lazy(() => import('./components/pages/MillionaireShowcasePage').then(m => ({ default: m.MillionaireShowcasePage })));
const CarkSayfasi = lazy(() => import('./components/pages/CarkSayfasi').then(m => ({ default: m.CarkSayfasi })));
const KaziKazanSayfasi = lazy(() => import('./components/pages/KaziKazanSayfasi').then(m => ({ default: m.KaziKazanSayfasi })));
const BeniAraSayfasi = lazy(() => import('./components/pages/BeniAraSayfasi').then(m => ({ default: m.BeniAraSayfasi })));
const OrtaklikSayfasi = lazy(() => import('./components/pages/OrtaklikSayfasi').then(m => ({ default: m.OrtaklikSayfasi })));
const YaziTuraSayfasi = lazy(() => import('./components/pages/YaziTuraSayfasi').then(m => ({ default: m.YaziTuraSayfasi })));
const TasKagitMakasSayfasi = lazy(() => import('./components/pages/TasKagitMakasSayfasi').then(m => ({ default: m.TasKagitMakasSayfasi })));
const SkorTahminSayfasi = lazy(() => import('./components/pages/SkorTahminSayfasi').then(m => ({ default: m.SkorTahminSayfasi })));
const DailyTasksPage = lazy(() => import('./components/pages/DailyTasksPage').then(m => ({ default: m.DailyTasksPage })));
const GunlukTurnuva = lazy(() => import('./components/pages/GunlukTurnuva').then(m => ({ default: m.GunlukTurnuva })));
const HaftalikTurnuva = lazy(() => import('./components/pages/HaftalikTurnuva').then(m => ({ default: m.HaftalikTurnuva })));
const AylikTurnuva = lazy(() => import('./components/pages/AylikTurnuva').then(m => ({ default: m.AylikTurnuva })));
const LoyaltyHub = lazy(() => import('./components/pages/LoyaltyHub').then(m => ({ default: m.LoyaltyHub })));
const VipSayfasi = lazy(() => import('./components/pages/VipSayfasi').then(m => ({ default: m.VipSayfasi })));
const AdminTournamentSettings = lazy(() => import('./components/admin/AdminTournamentSettings').then(m => ({ default: m.AdminTournamentSettings })));

const MasterLogin = lazy(() => import('./components/master/MasterLogin').then(m => ({ default: m.MasterLogin })));
const MasterPanel = lazy(() => import('./components/master/MasterPanel').then(m => ({ default: m.MasterPanel })));
const LynonApiDocs = lazy(() => import('./components/LynonApiDocs').then(m => ({ default: m.LynonApiDocs })));
const ApiTrafik = lazy(() => import('./components/ApiTrafik').then(m => ({ default: m.ApiTrafik })));

type TabId = 'dashboard' | 'bonuses' | 'players' | 'withdrawals' | 'deposits' | 'profile' | 'transactions' | 'autoWithdraw' | 'riskAnalizi' | 'oyuncuKategorileme' | 'manuelDuzeltmeler' | 'liveRadar' | 'registrationStats' | 'providerReport' | 'bonusReport' | 'audit' | 'rules' | 'games' | 'forms' | 'master' | 'tournament' | 'iframeGen' | 'loyaltySettings' | 'userSystem' | 'wheelManager' | 'scratchManager' | 'predictionLeague' | 'millionaireShowcase' | 'lobbyDesign' | 'dailyTasks' | 'vipSettings' | 'affiliate' | 'lynonDocs' | 'apiTrafik';

function pathToTab(pathname: string): TabId {
  if (pathname === '/bonuslar') return 'bonuses';
  if (pathname === '/oyuncular') return 'players';
  if (pathname === '/para-cekme-talepleri') return 'withdrawals';
  if (pathname === '/para-yatirmalar') return 'deposits';
  if (pathname === '/turnuva-ayarlari') return 'tournament';
  if (pathname === '/loyalty-ayarlari') return 'loyaltySettings';
  if (pathname === '/islemler') return 'transactions';
  if (pathname === '/admin/auto-withdraw') return 'autoWithdraw';
  if (pathname === '/risk-analizi') return 'riskAnalizi';
  if (pathname === '/oyuncu-kategorileme') return 'oyuncuKategorileme';
  if (pathname === '/manuel-duzeltmeler') return 'manuelDuzeltmeler';
  if (pathname === '/canli-radar') return 'liveRadar';
  if (pathname === '/kayit-istatistikleri') return 'registrationStats';
  if (pathname === '/saglayici-raporu') return 'providerReport';
  if (pathname === '/tum-bonus-raporu') return 'bonusReport';
  if (pathname === '/bonus-kurallari') return 'rules';
  if (pathname === '/lynon-docs') return 'lynonDocs';
  if (pathname === '/api-trafigi') return 'apiTrafik';
  if (pathname === '/audit') return 'audit';
  if (pathname === '/admin/oyun-ayarlari') return 'games';
  if (pathname === '/admin/formlar') return 'forms';
  if (pathname === '/admin/kullanici-sistemi') return 'userSystem';
  if (pathname === '/admin/iframe-generator') return 'iframeGen';
  if (pathname === '/admin/sans-carki') return 'wheelManager';
  if (pathname === '/admin/kazi-kazan-yonetimi') return 'scratchManager';
  if (pathname === '/admin/skor-tahmin-yonetimi') return 'predictionLeague';
  if (pathname === '/admin/kazanc-vitrini') return 'millionaireShowcase';
  if (pathname === '/admin/lobi-tasarimi') return 'lobbyDesign';
  if (pathname === '/admin/gunluk-gorevler') return 'dailyTasks';
  if (pathname === '/admin/vip-ayarlari') return 'vipSettings';
  if (pathname === '/affiliate') return 'affiliate';
  if (pathname.startsWith('/master')) return 'master';
  if (pathname.startsWith('/oyuncu')) return 'profile';
  return 'dashboard';
}

function isSessionExpiredError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  const message = String((error as { message?: string } | null)?.message || '').toLowerCase();
  return status === 401 && message.includes('oturum');
}

const adminDateLabel = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
}).format(new Date());

const tabStyle = (isActive: boolean) =>
  `group relative flex min-h-8 items-center gap-2 rounded-lg px-2 py-1 text-[11.5px] font-semibold transition-colors duration-150 touch-manipulation ${
    isActive ? 'text-white' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200'
  }`;

const ActiveTabIndicator = () => (
  <motion.div
    layoutId="activeTab"
    className="absolute inset-0 rounded-lg border border-blue-400/20 bg-blue-400/[0.11]"
  >
    <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-blue-300" />
  </motion.div>
);

const TAB_META: Record<TabId, { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: 'Command center', title: 'Genel görünüm' },
  bonuses: { eyebrow: 'Promosyonlar', title: 'Bonus yönetimi' },
  players: { eyebrow: 'CRM', title: 'Oyuncular' },
  withdrawals: { eyebrow: 'Finans', title: 'Çekim talepleri' },
  deposits: { eyebrow: 'Finans', title: 'Yatırımlar' },
  profile: { eyebrow: 'CRM', title: 'Oyuncu profili' },
  transactions: { eyebrow: 'Operasyon', title: 'İşlemler' },
  autoWithdraw: { eyebrow: 'Otomasyon', title: 'Otomatik çekim' },
  riskAnalizi: { eyebrow: 'İstihbarat', title: 'Risk analizi' },
  oyuncuKategorileme: { eyebrow: 'İstihbarat', title: 'Otomatik kategorileme' },
  manuelDuzeltmeler: { eyebrow: 'Denetim', title: 'Manuel düzeltmeler' },
  liveRadar: { eyebrow: 'İstihbarat', title: 'Canlı radar' },
  registrationStats: { eyebrow: 'CRM', title: 'Kayıt istatistikleri' },
  providerReport: { eyebrow: 'Raporlar', title: 'Sağlayıcı performansı' },
  bonusReport: { eyebrow: 'Raporlar', title: 'Bonus raporu' },
  audit: { eyebrow: 'Güvenlik', title: 'Audit kayıtları' },
  rules: { eyebrow: 'Yapılandırma', title: 'Bonus kuralları' },
  games: { eyebrow: 'Yapılandırma', title: 'Oyun ayarları' },
  forms: { eyebrow: 'Yapılandırma', title: 'Talep formları' },
  userSystem: { eyebrow: 'Erişim', title: 'Kullanıcı sistemi' },
  master: { eyebrow: 'Sistem', title: 'Master panel' },
  tournament: { eyebrow: 'Yapılandırma', title: 'Turnuva ayarları' },
  iframeGen: { eyebrow: 'Entegrasyon', title: 'iFrame oluşturucu' },
  loyaltySettings: { eyebrow: 'Yapılandırma', title: 'Sadakat ayarları' },
  wheelManager: { eyebrow: 'Oyun Yönetimi', title: 'Şans Çarkı' },
  scratchManager: { eyebrow: 'Oyun Yönetimi', title: 'Kazı Kazan' },
  predictionLeague: { eyebrow: 'Oyun Yönetimi', title: 'Skor Tahmin' },
  millionaireShowcase: { eyebrow: 'Oyun Yönetimi', title: 'Kazanç Vitrini' },
  lobbyDesign: { eyebrow: 'Sistem', title: 'Lobi Tasarımı' },
  dailyTasks: { eyebrow: 'Etkinlik Yönetimi', title: 'Günlük Görevler' },  vipSettings: { eyebrow: 'Yapılandırma', title: 'VIP Ayarları' },
  affiliate: { eyebrow: 'CRM & Affiliate', title: 'Affiliate Merkezi' },
  lynonDocs: { eyebrow: 'Entegrasyon & API', title: 'Lynon API Dökümantasyonu' },
  apiTrafik: { eyebrow: 'Entegrasyon & API', title: 'API Trafiği' },
};

const TAB_DESCRIPTIONS: Record<TabId, string> = {
  dashboard: 'Finansal akışı, oyuncu hareketlerini ve operasyon sağlığını tek görünümde izleyin.',
  bonuses: 'Aktif kampanyaları, free spin tekliflerini ve arşivlenmiş bonusları yönetin.',
  players: 'Oyuncu portföyünde arama yapın, segmentleri ve hesap performansını inceleyin.',
  withdrawals: 'Çekim taleplerini durum, tutar ve risk sinyalleriyle birlikte değerlendirin.',
  deposits: 'Yatırım hareketlerini, ödeme kanallarını ve işlem detaylarını takip edin.',
  profile: 'Oyuncunun finansal geçmişini, oyun davranışını ve risk profilini analiz edin.',
  transactions: 'Tüm finansal hareketlerde gelişmiş filtrelerle detaylı inceleme yapın.',
  autoWithdraw: 'Otomatik çekim kurallarını ve operasyon kuyruğunu merkezi olarak yönetin.',
  riskAnalizi: 'Şüpheli davranışları ve finansal anomalileri öncelik sırasına göre inceleyin.',
  oyuncuKategorileme: 'Seviye eşikleri Lynon kategori açıklamalarından okunur; risk ve durgunluk kararı bekletebilir.',
  manuelDuzeltmeler: 'Lynon arayüzünden elle yapılan bakiye eklemeleri; hangi yönetici, hangi hesap, hangi gerekçe.',
  liveRadar: 'Canlı oyuncu ve işlem sinyallerini anlık olarak takip edin.',
  registrationStats: 'Yeni kayıtların kaynak, zaman ve dönüşüm performansını karşılaştırın.',
  providerReport: 'Sağlayıcı cirolarını, RTP değerlerini ve tahmini maliyetleri analiz edin.',
  bonusReport: 'Dağıtılan bonusların kullanımını, maliyetini ve performansını ölçün.',
  audit: 'Panelde gerçekleşen kritik kullanıcı ve sistem işlemlerini denetleyin.',
  rules: 'Bonus uygunluk ve çevrim kurallarını merkezi olarak yapılandırın.',
  games: 'Oyuncu deneyimindeki oyun modüllerini ve ödül yapılarını yapılandırın.',
  forms: 'Kullanıcı talep formlarını ve operasyon durumlarını düzenleyin.',
  userSystem: 'Çalışan alt panellerini açın, rollerini ve modül yetkilerini yönetin.',
  master: 'Tenant, erişim ve sistem düzeyi yapılandırmaları yönetin.',
  tournament: 'Turnuva zamanlamalarını, ödülleri ve katılım koşullarını belirleyin.',
  iframeGen: 'Dış kanallar için güvenli ve markalı entegrasyon kodları üretin.',
  loyaltySettings: 'Sadakat seviyelerini, puan ekonomisini ve ödül kataloğunu yönetin.',
  wheelManager: 'Şans çarkı dilimlerini, oranları ve görsel temasını yapılandırın.',
  scratchManager: 'Kazı kazan kartlarının ödüllerini, katmanlarını ve kurallarını düzenleyin.',
  predictionLeague: 'Skor tahmin ligindeki maç listesini ve tahmin koşullarını yönetin.',
  millionaireShowcase: 'Büyük kazançları ve video içeriklerini vitrin alanında sergileyin.',
  lobbyDesign: 'Her siteye özel lobi renklerini, arkaplan görselini ve yatay banner alanını yönetin.',
  dailyTasks: 'API metrikleriyle tamamlanan günlük görevleri, XP değerlerini ve ödülleri yönetin.',  vipSettings: 'VIP kademelerini, avantajları, SSS ve başvuru formunu özelleştirin.',
  affiliate: 'BTag kaynaklarını, bağlı oyuncuları ve affiliate performansını tek merkezden takip edin.',
  lynonDocs: 'Lynon Backoffice API uçlarını, metot parametrelerini ve proxy isteklerini anlık olarak inceleyin.',
  apiTrafik: 'Panelin gelen ve giden tüm API isteklerini headers, payload, preview ve response görünümleriyle canlı inceleyin.',
};



/**
 * Sol menü.
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
 *
 * Ayrıca RİSK ANALİZİ ekranının menüde girişi hiç yoktu; sayfa vardı,
 * `/risk-analizi` çalışıyordu ama oraya ancak adresi bilerek
 * gidilebiliyordu.
 */
type SidebarItem = {
  id: TabId;
  label: string;
  path: string;
  icon: LucideIcon;
  end?: boolean;
};

const NAV_GROUPS: Array<{ label: string; items: SidebarItem[] }> = [
  {
    label: 'Bugün',
    items: [
      { id: 'dashboard', label: 'Genel görünüm', path: '/', icon: LayoutDashboard, end: true },
      { id: 'liveRadar', label: 'Canlı radar', path: '/canli-radar', icon: Radar },
      { id: 'registrationStats', label: 'Kayıt analizi', path: '/kayit-istatistikleri', icon: LineChart },
    ],
  },
  {
    label: 'Para',
    items: [
      { id: 'deposits', label: 'Yatırımlar', path: '/para-yatirmalar', icon: ArrowDownToLine },
      { id: 'withdrawals', label: 'Çekim talepleri', path: '/para-cekme-talepleri', icon: ArrowUpFromLine },
      { id: 'autoWithdraw', label: 'Otomatik çekim', path: '/admin/auto-withdraw', icon: Zap },
      { id: 'transactions', label: 'Tüm işlemler', path: '/islemler', icon: ListOrdered },
    ],
  },
  {
    label: 'Oyuncular',
    items: [
      { id: 'players', label: 'Oyuncu listesi', path: '/oyuncular', icon: Users },
      { id: 'riskAnalizi', label: 'Risk analizi', path: '/risk-analizi', icon: ShieldAlert },
      { id: 'oyuncuKategorileme', label: 'Otomatik kategori', path: '/oyuncu-kategorileme', icon: Layers },
      { id: 'userSystem', label: 'Kullanıcı sistemi', path: '/admin/kullanici-sistemi', icon: UserCog },
      { id: 'affiliate', label: 'Affiliate merkezi', path: '/affiliate', icon: Handshake },
    ],
  },
  {
    // Bonusla ilgili her sey TEK grupta: verme, kural, rapor.
    label: 'Bonus',
    items: [
      { id: 'bonuses', label: 'Bonus merkezi', path: '/bonuslar', icon: Gift },
      { id: 'rules', label: 'Kural merkezi', path: '/bonus-kurallari', icon: SlidersHorizontal },
      { id: 'bonusReport', label: 'Bonus raporu', path: '/tum-bonus-raporu', icon: ClipboardList },
      { id: 'loyaltySettings', label: 'Sadakat sistemi', path: '/loyalty-ayarlari', icon: Star },
      { id: 'vipSettings', label: 'VIP ayarları', path: '/admin/vip-ayarlari', icon: Crown },
    ],
  },
  {
    label: 'Oyunlar',
    items: [
      { id: 'wheelManager', label: 'Şans çarkı', path: '/admin/sans-carki', icon: Target },
      { id: 'scratchManager', label: 'Kazı kazan', path: '/admin/kazi-kazan-yonetimi', icon: Ticket },
      { id: 'predictionLeague', label: 'Skor tahmin', path: '/admin/skor-tahmin-yonetimi', icon: CalendarDays },
      { id: 'millionaireShowcase', label: 'Kazanç vitrini', path: '/admin/kazanc-vitrini', icon: Sparkles },
      { id: 'dailyTasks', label: 'Günlük görevler', path: '/admin/gunluk-gorevler', icon: ListChecks },
      { id: 'tournament', label: 'Turnuvalar', path: '/turnuva-ayarlari', icon: Trophy },
      { id: 'games', label: 'Oyun ayarları', path: '/admin/oyun-ayarlari', icon: Gamepad2 },
    ],
  },
  {
    // Denetim ve teshis: "ne oldu" sorusunun sorulacagi yer.
    label: 'Denetim',
    items: [
      { id: 'providerReport', label: 'Sağlayıcı raporu', path: '/saglayici-raporu', icon: BarChart2 },
      { id: 'manuelDuzeltmeler', label: 'Manuel düzeltmeler', path: '/manuel-duzeltmeler', icon: Scale },
      { id: 'audit', label: 'Audit kayıtları', path: '/audit', icon: ScrollText },
      { id: 'apiTrafik', label: 'API trafiği', path: '/api-trafigi', icon: Activity },
      { id: 'lynonDocs', label: 'Lynon API dökümanı', path: '/lynon-docs', icon: BookOpen },
    ],
  },
  {
    label: 'Site',
    items: [
      { id: 'lobbyDesign', label: 'Lobi tasarımı', path: '/admin/lobi-tasarimi', icon: Palette },
      { id: 'forms', label: 'Talep formları', path: '/admin/formlar', icon: Mailbox },
      { id: 'iframeGen', label: 'iFrame entegrasyonu', path: '/admin/iframe-generator', icon: Code2 },
    ],
  },
];

const TAB_PERMISSION: Partial<Record<TabId, string>> = {
  dashboard: 'dashboard',
  players: 'players',
  profile: 'players',
  registrationStats: 'players',
  affiliate: 'players',
  withdrawals: 'finance',
  deposits: 'finance',
  transactions: 'finance',
  autoWithdraw: 'finance',
  bonuses: 'bonuses',
  rules: 'bonuses',
  games: 'experience',
  tournament: 'experience',
  loyaltySettings: 'experience',
  wheelManager: 'experience',
  scratchManager: 'experience',
  predictionLeague: 'experience',
  millionaireShowcase: 'experience',
  lobbyDesign: 'system',
  dailyTasks: 'experience',  vipSettings: 'system',
  forms: 'forms',
  providerReport: 'reports',
  bonusReport: 'reports',
  audit: 'reports',
  riskAnalizi: 'reports',
  oyuncuKategorileme: 'reports',
  manuelDuzeltmeler: 'reports',
  liveRadar: 'reports',
  iframeGen: 'system',
  userSystem: 'system',
};

function canAccessTab(user: any, tabId: TabId) {
  if (!user || user.role === 'admin') return true;
  const permission = TAB_PERMISSION[tabId];
  if (!permission) return true;
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
}

export default function App() {
  const location = useLocation();
  const pathname = location.pathname || '/';
  const activeTab = pathToTab(pathname);
  const hasDateFilters = activeTab === 'dashboard' || activeTab === 'withdrawals' || activeTab === 'deposits' || activeTab === 'autoWithdraw' || activeTab === 'registrationStats' || activeTab === 'providerReport' || activeTab === 'bonusReport' || activeTab === 'transactions';
  const narcosPublicPaths = ['/bonus-talep', '/lobi', '/milyonerler', '/cark', '/kazi-kazan', '/skor-tahmin', '/gorevler', '/beni-ara', '/ortaklik', '/sadakat', '/vip'];

  useEffect(() => {
    const isNarcosPublicPage = narcosPublicPaths.some((route) => pathname === route || pathname.startsWith(`${route}/`)) || pathname.startsWith('/turnuva/');
    document.documentElement.classList.toggle('narcos-theme', isNarcosPublicPage);
    return () => document.documentElement.classList.remove('narcos-theme');
  }, [pathname]);

  const { dateRange, setDateRange } = useDateRange();
  const queryClient = useQueryClient();

  const [playerSearch, setPlayerSearch] = useState('');
  const [playerBTag, setPlayerBTag] = useState('');
  const [playerPage, setPlayerPage] = useState(1);
  const rowsPerPage = 20;



  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 28 menü öğesi 6 grupta; sabit 224px her ekranda yer kaplıyordu ve daraltma
  // yoktu. Rail modu tercihi oturumlar arası korunur.
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try { return localStorage.getItem('admin_nav_collapsed') === '1'; } catch { return false; }
  });
  const [navQuery, setNavQuery] = useState('');
  const [isMasterAuth, setIsMasterAuth] = useState<boolean | null>(null);

  // Tenant/Branding Config
  const [tenantConfig, setTenantConfig] = useState<{themeColor?: string; logoUrl?: string; adminTitle?: string} | null>(null);

  useEffect(() => {
    // Fetch global tenant info
    fetch('/api/tenant-info').then(r => r.json()).then(data => {
      if (data && data.ok) {
        setTenantConfig(data);
        if (data.themeColor) {
           document.documentElement.style.setProperty('--primary-color', data.themeColor);
           // Fallback CSS vars for Tailwind
           document.documentElement.style.setProperty('--color-blue-500', data.themeColor); // Quick hack to overwrite default violet
        }
      }
    }).catch(console.error);

    // Master panel kontrolü
    if (pathname.startsWith('/master')) {
      fetch('/api/master/check', { credentials: 'include' })
        .then(async (res) => {
          setIsMasterAuth(res.ok);
        })
        .catch(() => setIsMasterAuth(false));
      return;
    }

    // Oyuncu sayfalarındaysak admin auth kontrolü yapmaya gerek yok (401 hatasını önler)
    // Ancak halihazırda admin girişi yapılmışsa auth kontrolüne devam et
    const publicRoutes = ['/bonus-talep', '/lobi', '/milyonerler', '/cark', '/kazi-kazan', '/skor-tahmin', '/gorevler', '/beni-ara', '/ortaklik', '/turnuva', '/sadakat', '/vip'];
    if (publicRoutes.some(route => pathname === route || pathname.startsWith(route)) && isAuthenticated !== true) {
      setIsAuthenticated(false);
      return;
    }

    // Normal admin kontrolü
    fetch('/api/me', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          setIsAuthenticated(false);
          setCurrentUser(null);
          return;
        }
        const data = await res.json().catch(() => null);
        setCurrentUser(data?.user || null);
        setIsAuthenticated(true);
      })
      .catch(() => {
        setIsAuthenticated(false);
        setCurrentUser(null);
      });
  }, [pathname]);

  const handleLoginSuccess = async () => {
    const res = await fetch('/api/me', { credentials: 'include' }).catch(() => null);
    if (res?.ok) {
      const data = await res.json().catch(() => null);
      setCurrentUser(data?.user || null);
    }
    setIsAuthenticated(true);
  };

  useEffect(() => {
    console.log('[auth] isAuthenticated durumu:', isAuthenticated);
  }, [isAuthenticated]);

  // Mobilde sayfa değişince menüyü kapat
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    console.log('[auth] Çıkış yapılıyor...');
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    setIsAuthenticated(false);
    setCurrentUser(null);
    queryClient.clear();
  };

  /** Alt sekmeler */
  type DashboardSubTab = 'all' | 'financial' | 'partner' | 'sportbook';
  const [dashboardSubTab, setDashboardSubTab] = useState<DashboardSubTab>('all');

  const queries = useDashboardData(dateRange, { enabled: !!isAuthenticated && activeTab === 'dashboard' });

  const bonusesQuery = useQuery({
    queryKey: ['bonuses'],
    queryFn: () => dashboardApi.bonusesAll(),
    staleTime: 2 * 60 * 1000,
    enabled: !!isAuthenticated && activeTab === 'bonuses',
  });

  const freebetQuery = useQuery({
    queryKey: ['freebet-bonuses'],
    queryFn: () => dashboardApi.freebetBonuses(),
    staleTime: 2 * 60 * 1000,
    enabled: !!isAuthenticated && activeTab === 'bonuses',
  });

  const clientsQuery = useQuery({
    queryKey: ['clients', playerPage, playerSearch, playerBTag],
    queryFn: () => dashboardApi.clients({
      SkeepRows: (playerPage - 1) * rowsPerPage,
      MaxRows: rowsPerPage,
      Login: playerSearch || undefined,
      BTag: playerBTag || undefined
    }),
    staleTime: 2 * 60 * 1000,
    enabled: !!isAuthenticated && activeTab === 'players',
  });

  const withdrawalQuery = useQuery({
    queryKey: ['withdrawal-requests', dateRange.startDate, dateRange.endDate],
    queryFn: () => dashboardApi.withdrawalRequests(dateRange),
    staleTime: 2 * 60 * 1000,
    enabled: !!isAuthenticated && activeTab === 'withdrawals',
  });

  const depositsQuery = useQuery({
    queryKey: ['deposits', dateRange.startDate, dateRange.endDate],
    queryFn: () => dashboardApi.deposits(dateRange),
    staleTime: 2 * 60 * 1000,
    enabled: !!isAuthenticated && activeTab === 'deposits',
  });




  // 401 kontrolü
  useEffect(() => {
    if (!isAuthenticated) return;
    const allQueries = [
      ...Array.isArray(queries) ? queries : [],
      bonusesQuery, freebetQuery, clientsQuery, withdrawalQuery, depositsQuery
    ];
    const authError = allQueries.find(q => isSessionExpiredError(q.error));
    if (authError) {
      console.warn('Oturum geçersiz (401). Yönlendiriliyor...');
      setIsAuthenticated(false);
    }
  }, [queries, bonusesQuery, freebetQuery, clientsQuery, withdrawalQuery, depositsQuery, isAuthenticated]);

  const [summary, partnerProfit, topSports, topCasino, sportbook] = Array.isArray(queries) ? queries : [{}, {}, {}, {}, {}];
  const isLoadingDashboard = Array.isArray(queries) && queries.some((q) => q.isLoading);
  const errors = Array.isArray(queries) ? queries.map((q) => q.error?.message ?? null).filter(Boolean) : [];
  const firstError = errors[0] ?? null;
  const allFetched = Array.isArray(queries) && queries.every((q) => q.isFetched);
  const success = allFetched && errors.length === 0;
  const dashboardUpdatedAt = Array.isArray(queries)
    ? Math.max(0, ...queries.map((query) => Number(query.dataUpdatedAt || 0)))
    : 0;
  const dashboardUpdatedTime = dashboardUpdatedAt > 0
    ? new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(dashboardUpdatedAt))
    : '—';

  const handleRefreshDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ['summary'] });
    queryClient.invalidateQueries({ queryKey: ['partner-profit'] });
    queryClient.invalidateQueries({ queryKey: ['top-sports'] });
    queryClient.invalidateQueries({ queryKey: ['top-casino'] });
    queryClient.invalidateQueries({ queryKey: ['sportbook-overview'] });
  };

  const sidebarNavRef = useRef<HTMLDivElement>(null);
  const handleSidebarKeyDown = useCallback((e: React.KeyboardEvent) => {
    const container = sidebarNavRef.current;
    if (!container) return;
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'));
    if (links.length === 0) return;
    const current = document.activeElement as HTMLAnchorElement | null;
    const idx = current && links.includes(current) ? links.indexOf(current) : -1;
    if (e.key === 'ArrowDown' && idx < links.length - 1) {
      e.preventDefault();
      links[idx + 1].focus();
    } else if (e.key === 'ArrowUp' && idx > 0) {
      e.preventDefault();
      links[idx - 1].focus();
    }
  }, []);

  const visibleNavGroups = useMemo(() => NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessTab(currentUser, item.id)),
    }))
    .filter((group) => group.items.length > 0), [currentUser]);

  // Hızlı menü araması. 28 öğe taramayı yavaşlatıyordu; Türkçe karakterler
  // için locale-aware karşılaştırma (İ/ı sorunu için toLocaleLowerCase).
  const filteredNavGroups = useMemo(() => {
    const q = navQuery.trim();
    if (!q) return visibleNavGroups;
    return visibleNavGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => matchesTr(item.label, q)),
      }))
      .filter((group) => group.items.length > 0);
  }, [visibleNavGroups, navQuery]);

  const toggleNavCollapsed = useCallback(() => {
    setNavCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('admin_nav_collapsed', next ? '1' : '0'); } catch { /* yoksay */ }
      if (next) setNavQuery('');
      return next;
    });
  }, []);
  const hasActiveAccess = canAccessTab(currentUser, activeTab);

  return (
    <AnimatePresence mode="wait">
      {isAuthenticated === null &&
       !['/bonus-talep', '/lobi', '/milyonerler', '/cark', '/kazi-kazan', '/skor-tahmin', '/gorevler', '/beni-ara', '/ortaklik', '/sadakat', '/yazi-tura', '/tas-kagit-makas', '/vip'].includes(pathname) &&
       !pathname.startsWith('/master') ? (
        <motion.div
          key="auth-loading"
          className="fixed inset-0 bg-black flex items-center justify-center"
        >
          <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        </motion.div>
      ) : pathname === '/bonus-talep' ? (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0a0f1a]"><div className="w-10 h-10 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" /></div>}>
          <BonusTalepSayfasi />
        </Suspense>
      ) : pathname === '/lobi' ? (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0a0f1a]"><div className="w-10 h-10 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" /></div>}>
          <PlayerLobby />
        </Suspense>
      ) : pathname === '/milyonerler' ? (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#070b14]"><div className="w-10 h-10 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" /></div>}>
          <MillionaireShowcasePage />
        </Suspense>
      ) : pathname === '/cark' ? (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0a0f1a]"><div className="w-10 h-10 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" /></div>}>
          <CarkSayfasi />
        </Suspense>
      ) : pathname === '/kazi-kazan' ? (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0a0f1a]"><div className="w-10 h-10 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" /></div>}>
          <KaziKazanSayfasi />
        </Suspense>
      ) : pathname === '/skor-tahmin' ? (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#070b14]"><div className="w-10 h-10 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /></div>}>
          <SkorTahminSayfasi />
        </Suspense>
      ) : pathname === '/gorevler' ? (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#070b14]"><div className="w-10 h-10 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" /></div>}>
          <DailyTasksPage />
        </Suspense>
      ) : pathname === '/beni-ara' ? (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#070b14]"><div className="w-10 h-10 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" /></div>}>
          <BeniAraSayfasi />
        </Suspense>
      ) : pathname === '/turnuva/gunluk' ? (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#070b14]"><div className="w-10 h-10 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" /></div>}>
          <GunlukTurnuva />
        </Suspense>
      ) : pathname === '/turnuva/haftalik' ? (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#070b14]"><div className="w-10 h-10 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" /></div>}>
          <HaftalikTurnuva />
        </Suspense>
      ) : pathname === '/turnuva/aylik' ? (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#070b14]"><div className="w-10 h-10 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" /></div>}>
          <AylikTurnuva />
        </Suspense>
      ) : pathname === '/ortaklik' ? (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#070b14]"><div className="w-10 h-10 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" /></div>}>
          <OrtaklikSayfasi />
        </Suspense>
      ) : pathname === '/yazi-tura' ? (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#070b14]"><div className="w-10 h-10 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" /></div>}>
          <YaziTuraSayfasi />
        </Suspense>
      ) : pathname === '/tas-kagit-makas' ? (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#070b14]"><div className="w-10 h-10 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" /></div>}>
          <TasKagitMakasSayfasi />
        </Suspense>
      ) : pathname === '/sadakat' ? (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#070b14]"><div className="w-10 h-10 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" /></div>}>
          <LoyaltyHub />
        </Suspense>
      ) : pathname === '/vip' ? (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#070b14]"><div className="w-10 h-10 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" /></div>}>
          <VipSayfasi />
        </Suspense>
      ) : pathname.startsWith('/master') ? (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#050505]"><div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" /></div>}>
           {isMasterAuth === null ? (
              <div className="flex h-screen items-center justify-center bg-[#050505]"><div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" /></div>
           ) : isMasterAuth === false ? (
              <MasterLogin onLoginSuccess={() => setIsMasterAuth(true)} />
           ) : (
              <MasterPanel />
           )}
        </Suspense>
      ) : isAuthenticated === false ? (
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <LoginPage onLoginSuccess={handleLoginSuccess} tenantConfig={tenantConfig} />
        </motion.div>
      ) : (
        <motion.div
          key="main-app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="app-shell"
        >
          <div className="app-backdrop" />

          {/* Mobil sidebar overlay */}
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity md:hidden"
            style={{ opacity: sidebarOpen ? 1 : 0, pointerEvents: sidebarOpen ? 'auto' : 'none' }}
            onClick={() => setSidebarOpen(false)}
          />

          <aside
            // 29 menu ogesi 7 grupta; 200px'te uzun etiketler kirpiliyordu
            // ("Lynon API Dökümanı", "iFrame entegrasyonu"). 260px hepsini
            // tek satirda tutuyor.
            style={{ ['--nav-w' as any]: navCollapsed ? '64px' : '260px' }}
            className={cn(
              "premium-sidebar fixed left-0 top-0 z-50 flex h-full w-[268px] flex-col transition-[transform,width] duration-200 ease-out md:w-[var(--nav-w)] md:translate-x-0",
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <div className="sidebar-brand flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 grid-cols-2 gap-1 rounded-lg border border-blue-300/20 bg-blue-300/[0.09] p-2">
                  <i className="rounded-[2px] bg-blue-300" /><i className="rounded-[2px] bg-blue-300" />
                  <i className="rounded-[2px] bg-blue-300" /><i className="rounded-[2px] bg-blue-300" />
                </span>
                <span className={cn("min-w-0 leading-tight", navCollapsed && "md:hidden")}>
                  <strong className="block truncate text-[13px] font-bold tracking-[-0.02em] text-white">Bugs Software</strong>
                  <small className="mt-0.5 block truncate text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-600">Control Suite</small>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="md:hidden flex items-center justify-center w-7 h-7 rounded-lg text-zinc-500 hover:text-white transition-colors"
                aria-label="Menüyü kapat"
              >
                <X size={18} />
              </button>
              <button
                type="button"
                onClick={toggleNavCollapsed}
                aria-expanded={!navCollapsed}
                aria-label={navCollapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
                title={navCollapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
                className="hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                {navCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            </div>
            {!navCollapsed && (
              <div className="shrink-0 px-3 pt-3">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input
                    type="text"
                    value={navQuery}
                    onChange={(e) => setNavQuery(e.target.value)}
                    placeholder="Menüde ara"
                    aria-label="Menüde ara"
                    className="h-9 w-full rounded-lg border border-white/[0.07] bg-black/25 pl-8 pr-2.5 text-[12px] font-medium text-white outline-none transition placeholder:text-slate-600 focus:border-blue-300/40"
                  />
                </div>
              </div>
            )}
            <nav className="flex-1 overflow-y-auto px-2.5 py-2.5" aria-label="Menü">
              <div ref={sidebarNavRef} className="space-y-4" onKeyDown={handleSidebarKeyDown} role="menu">
                {filteredNavGroups.length === 0 && (
                  <p className="px-2 py-4 text-center text-[11px] text-slate-600">Eşleşen menü yok.</p>
                )}
                {filteredNavGroups.map((group) => (
                  <section key={group.label} className="sidebar-nav-group">
                    {/*
                      * Daraltilmis modda grup adi gizleniyordu ve 29 oge
                      * tek bir simge yiginina donuyordu. Artik yerine ince
                      * bir ayirici geliyor; gruplar dar modda da okunuyor.
                      */}
                    <p className={cn("sidebar-section-label flex items-center gap-2", navCollapsed && "md:hidden")}>
                      <span>{group.label}</span>
                      <span className="h-px flex-1 bg-white/[0.05]" />
                      <span className="tabular-nums text-[9px] font-semibold text-slate-700">{group.items.length}</span>
                    </p>
                    {navCollapsed && <span className="mx-auto mb-2 hidden h-px w-6 bg-white/[0.07] md:block" />}
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.end}
                            title={navCollapsed ? item.label : undefined}
                            className={({ isActive }) => cn(tabStyle(isActive), navCollapsed && 'md:justify-center md:px-0')}
                          >
                            {({ isActive }) => (
                              <>
                                {isActive && <ActiveTabIndicator />}
                                <span className="sidebar-link-icon relative z-10">
                                  <Icon size={15} strokeWidth={1.85} />
                                </span>
                                <span className={cn('relative z-10 min-w-0 flex-1 truncate text-[12.5px]', navCollapsed && 'md:hidden')}>{item.label}</span>
                                {isActive && <span className={cn('relative z-10 h-1.5 w-1.5 rounded-full bg-blue-300', navCollapsed && 'md:hidden')} />}
                              </>
                            )}
                          </NavLink>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>

            </nav>
            <div className="border-t border-white/[0.06] p-2">
              <div className={cn("sidebar-system-card", navCollapsed && "md:hidden")}>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-50" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">Sistem aktif</span>
                </div>
                <span className="text-[10px] text-slate-600">Yerel yönetici oturumu</span>
              </div>
              <button
                onClick={handleLogout}
                title={navCollapsed ? 'Güvenli çıkış' : undefined}
                className={cn(
                  'flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-[11px] font-semibold text-slate-500 transition hover:bg-rose-400/[0.06] hover:text-rose-300',
                  navCollapsed && 'md:justify-center md:px-0'
                )}
              >
                <LogOut size={18} />
                <span className={cn(navCollapsed && 'md:hidden')}>Güvenli çıkış</span>
              </button>
            </div>
          </aside>

          {/* Content */}
          <div className={cn(
            "relative z-10 flex min-w-0 flex-1 flex-col pl-0 transition-[padding] duration-200 ease-out",
            navCollapsed ? "md:pl-[64px]" : "md:pl-[260px]"
          )}>
            <header className="app-header relative z-40 w-full flex-shrink-0 px-3 md:px-4">
              <div className="mx-auto flex h-[58px] max-w-[1900px] items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.035] text-slate-400 transition hover:text-white md:hidden"
                    aria-label="Menüyü aç"
                  >
                    <Menu size={22} />
                  </button>
                  <div className="mr-2 min-w-[168px]">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-300/65">{TAB_META[activeTab].eyebrow}</p>
                    <h1 className="truncate text-lg font-bold tracking-[-0.025em] text-white">{TAB_META[activeTab].title}</h1>
                  </div>
                  {hasDateFilters && (
                    <div className="hidden min-w-0 flex-1 items-center gap-1.5 overflow-visible xl:flex">
                      <DateRangePresets />
                      <DateRangeBar range={dateRange} onRangeChange={setDateRange} onRefresh={activeTab === 'dashboard' ? handleRefreshDashboard : undefined} isLoading={activeTab === 'dashboard' ? isLoadingDashboard : false} />
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className={cn("hidden items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs font-semibold text-slate-300 lg:flex", hasDateFilters && "xl:hidden")}>
                    <CalendarDays size={16} className="text-slate-500" />
                    {adminDateLabel}
                  </div>
                  <button
                    type="button"
                    onClick={handleRefreshDashboard}
                    className={cn("hidden items-center gap-2 rounded-lg bg-blue-400 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-300 lg:flex", hasDateFilters && "xl:hidden")}
                  >
                    <RefreshCw size={16} />
                    Verileri yenile
                  </button>
                  <NotificationCenter />
                  <div className="hidden h-9 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2 lg:flex">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-400 text-[9px] font-black text-white">BS</div>
                    <div className="leading-tight">
                      <p className="text-[11px] font-bold tracking-[-0.01em] text-white">Bugs Software</p>
                      <p className="text-[8px] font-medium uppercase tracking-[0.12em] text-slate-600">TR · Partner</p>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <div className="app-content">
              <section className="tab-intro workspace-context-bar">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-300/65">{TAB_META[activeTab].eyebrow}</p>
                    <h2 className="sr-only">{TAB_META[activeTab].title}</h2>
                    <p className="max-w-5xl truncate text-xs leading-5 text-slate-500">{TAB_DESCRIPTIONS[activeTab]}</p>
                  </div>
                </div>
                <div className="hidden items-center gap-3 sm:flex">
                  <div className="tab-intro-status">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    Canlı çalışma alanı · son güncelleme {dashboardUpdatedTime}
                  </div>
                </div>
              </section>

              {hasDateFilters && (
                <div className="tab-filter-dock mb-5 flex flex-wrap items-center gap-3 xl:hidden">
                  <DateRangePresets />
                  <DateRangeBar range={dateRange} onRangeChange={setDateRange} onRefresh={activeTab === 'dashboard' ? handleRefreshDashboard : undefined} isLoading={activeTab === 'dashboard' ? isLoadingDashboard : false} />
                </div>
              )}
              <Suspense fallback={<div className="flex flex-1 items-center justify-center py-20"><LoadingState label="Yükleniyor..." /></div>}>
                <div className="tab-workspace" data-tab={activeTab}>
                  <AnimatePresence mode="wait">
                  {!hasActiveAccess ? (
                    <AccessDeniedCard />
                  ) : (
                    <>
                  {activeTab === 'dashboard' && (
                    <motion.div key="dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                      <div className="space-y-3">
                        <div className="dashboard-mode-tabs relative inline-flex gap-1 rounded-lg border border-white/[0.07] bg-[#0d1119] p-0.5">
                          {[
                            { id: 'all' as const, label: 'TAM ANALİZ' },
                            { id: 'financial' as const, label: 'FİNANSAL' },
                            { id: 'partner' as const, label: 'PARTNER' },
                            { id: 'sportbook' as const, label: 'SPOR ANALİZ' },
                          ].map(({ id, label }) => (
                            <button
                              key={id}
                              onClick={() => setDashboardSubTab(id)}
                              className={cn(
                                "relative h-8 rounded-md px-3 text-[9px] font-bold tracking-[0.08em] transition-colors duration-150",
                                dashboardSubTab === id ? "text-white" : "text-slate-500 hover:text-slate-200"
                              )}
                            >
                              {dashboardSubTab === id && (
                                <motion.div
                                  layoutId="dashboardSubTab"
                                  className="absolute inset-0 rounded-md border border-blue-400/20 bg-blue-400/[0.12]"
                                />
                              )}
                              <span className="relative z-10">{label}</span>
                            </button>
                          ))}
                        </div>
                        {/*
                          * Pano ritmi TEK: bölümler arası space-y-3, ızgara
                          * içi gap-3. Önceden space-y-3 / gap-8 / space-y-8
                          * karışıktı ve parçalar farklı ekranlardan
                          * toplanmış gibi duruyordu.
                          */}
                        {(dashboardSubTab === 'all' || dashboardSubTab === 'financial') && (
                          <div className="space-y-3">
                            <SummaryCards data={summary.data} isLoading={summary.isLoading ?? false} error={summary.error ?? null} />
                            <Suspense fallback={<div className="h-64 animate-pulse rounded-xl border border-white/[0.07] bg-white/[0.025]" />}>
                              <DashboardCharts data={partnerProfit?.data?.Data} />
                            </Suspense>
                          </div>
                        )}
                        {(dashboardSubTab === 'all' || dashboardSubTab === 'partner') && (
                          <div className="space-y-3">
                            <PartnerProfit data={partnerProfit?.data} isLoading={partnerProfit?.isLoading ?? false} error={partnerProfit?.error ?? null} />
                            <SportbookOverview data={sportbook?.data} isLoading={sportbook?.isLoading ?? false} error={sportbook?.error ?? null} />
                          </div>
                        )}
                        {(dashboardSubTab === 'all' || dashboardSubTab === 'sportbook') && (
                          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                            <TopSports data={topSports?.data} isLoading={topSports?.isLoading ?? false} error={topSports?.error ?? null} />
                            <TopCasinoGames data={topCasino?.data} isLoading={topCasino?.isLoading ?? false} error={topCasino?.error ?? null} />
                          </div>
                        )}
                        <StatusBar isLoading={isLoadingDashboard} error={firstError} success={success} />
                      </div>
                    </motion.div>
                  )}
                  {activeTab === 'bonuses' && (
                    <motion.div key="bonuses" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <BonusList data={bonusesQuery?.data} isLoading={bonusesQuery?.isLoading ?? false} error={bonusesQuery?.error ?? null} />
                      <FreeBetBonusList data={freebetQuery?.data} isLoading={freebetQuery?.isLoading ?? false} error={freebetQuery?.error ?? null} />
                    </motion.div>
                  )}
                  {activeTab === 'players' && (
                    <motion.div key="players" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <AllPlayersList data={clientsQuery?.data} isLoading={clientsQuery?.isLoading ?? false} error={clientsQuery?.error ?? null} currentPage={playerPage} onPageChange={setPlayerPage} rowsPerPage={rowsPerPage} searchTerm={playerSearch} onSearchChange={(v: string) => { setPlayerSearch(v); setPlayerPage(1); }} btagTerm={playerBTag} onBTagChange={(v: string) => { setPlayerBTag(v); setPlayerPage(1); }} />
                    </motion.div>
                  )}
                  {activeTab === 'withdrawals' && (
                    <motion.div key="withdrawals" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <WithdrawalRequestsList data={withdrawalQuery.data} isLoading={withdrawalQuery.isLoading} error={withdrawalQuery.error ?? null} onRetry={() => withdrawalQuery.refetch()} />
                    </motion.div>
                  )}
                  {activeTab === 'deposits' && (
                    <motion.div key="deposits" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <DepositsList data={depositsQuery.data} isLoading={depositsQuery.isLoading} error={depositsQuery.error ?? null} />
                    </motion.div>
                  )}

                  {activeTab === 'profile' && <motion.div key="profile"><PlayerProfile /></motion.div>}
                  {activeTab === 'transactions' && <motion.div key="transactions"><TransactionsList dateRange={dateRange} /></motion.div>}
                  {activeTab === 'autoWithdraw' && <motion.div key="autoWithdraw" className="mt-4 min-h-0 flex-1"><AutoWithdrawPanel /></motion.div>}
                  {activeTab === 'riskAnalizi' && <motion.div key="riskAnalizi" className="mt-4 min-h-0 flex-1"><RiskAnalysisPage /></motion.div>}
                  {activeTab === 'oyuncuKategorileme' && <motion.div key="oyuncuKategorileme" className="mt-4 min-h-0 flex-1"><OyuncuKategorileme /></motion.div>}
                  {activeTab === 'manuelDuzeltmeler' && <motion.div key="manuelDuzeltmeler" className="mt-4 min-h-0 flex-1"><ManuelDuzeltmeler /></motion.div>}
                  {activeTab === 'liveRadar' && <motion.div key="liveRadar" className="mt-4 min-h-0 flex-1"><LiveRadar /></motion.div>}
                  {activeTab === 'affiliate' && <motion.div key="affiliate" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><AffiliatePanel /></motion.div>}
                  {activeTab === 'registrationStats' && <motion.div key="registrationStats"><RegistrationStats dateRange={dateRange} /></motion.div>}
                  {activeTab === 'providerReport' && <motion.div key="providerReport"><ProviderReport /></motion.div>}
                  {activeTab === 'bonusReport' && <motion.div key="bonusReport" className="mt-4 min-h-0 flex-1"><ClientBonusReport /></motion.div>}
                  {activeTab === 'audit' && <motion.div key="audit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><AuditLogPage /></motion.div>}
                  {activeTab === 'rules' && <motion.div key="rules" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><RulesManager /></motion.div>}
                  {activeTab === 'lynonDocs' && <motion.div key="lynonDocs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><LynonApiDocs /></motion.div>}
                  {activeTab === 'apiTrafik' && <motion.div key="apiTrafik" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><ApiTrafik /></motion.div>}
                  {activeTab === 'games' && <motion.div key="games" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><AdminGames /></motion.div>}
                  {activeTab === 'wheelManager' && <motion.div key="wheelManager" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><AdminGames initialTab="wheel" /></motion.div>}
                  {activeTab === 'scratchManager' && <motion.div key="scratchManager" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><AdminGames initialTab="scratch" /></motion.div>}
                  {activeTab === 'predictionLeague' && <motion.div key="predictionLeague" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><AdminGames initialTab="prediction" /></motion.div>}
                  {activeTab === 'millionaireShowcase' && <motion.div key="millionaireShowcase" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><AdminGames initialTab="millionaires" /></motion.div>}
                  {activeTab === 'lobbyDesign' && <motion.div key="lobbyDesign" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><AdminGames initialTab="lobby" /></motion.div>}
                  {activeTab === 'dailyTasks' && <motion.div key="dailyTasks" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><AdminGames initialTab="dailyTasks" /></motion.div>}
                  {activeTab === 'vipSettings' && <motion.div key="vipSettings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><VIPSettings /></motion.div>}
                  {activeTab === 'forms' && <motion.div key="forms" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><AdminForms /></motion.div>}
                  {activeTab === 'userSystem' && <motion.div key="userSystem" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><UserSystem /></motion.div>}
                  {activeTab === 'tournament' && <motion.div key="tournament" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><AdminTournamentSettings /></motion.div>}
                  {activeTab === 'loyaltySettings' && <motion.div key="loyaltySettings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><LoyaltySettings /></motion.div>}
                  {activeTab === 'iframeGen' && <motion.div key="iframeGen" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><IFrameGenerator /></motion.div>}
                    </>
                  )}
                  </AnimatePresence>
                </div>
              </Suspense>
            </div>
          </div>
          <GlobalNotifications />
        </motion.div>
      )
      }
    </AnimatePresence >
  );
}

function AccessDeniedCard() {
  return (
    <motion.div
      key="access-denied"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[1.75rem] border border-amber-300/20 bg-amber-300/[0.07] p-8 text-center"
    >
      <ShieldCheck className="mx-auto mb-4 text-amber-200" size={34} />
      <h3 className="text-xl font-black text-white">Bu bölüm için yetkiniz yok</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm font-medium text-slate-400">
        Bu alt panel hesabına ilgili modül izni verilmemiş. Müşteri admini kullanıcı sistemi ekranından yetki ekleyebilir.
      </p>
    </motion.div>
  );
}

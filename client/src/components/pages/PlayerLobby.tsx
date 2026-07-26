import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Crown,
  Gift,
  Goal,
  Handshake,
  Layers,
  ListChecks,
  Loader2,
  Phone,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  User,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { bonusPanelApi, formsApi, gamesApi, loyaltyApi, tournamentApi } from '../../api/client';
import { cn } from '../../lib/utils';

type LobbyTabId = 'games' | 'tournaments' | 'support';

type LobbyQuickAccessItem = {
  id: string;
  label: string;
  desc: string;
  to: string;
  icon: string;
  accentColor: string;
  enabled: boolean;
};

type LobbyTournamentCardConfig = {
  id: string;
  label: string;
  period: string;
  prizeFallback: string;
  to: string;
  icon: string;
  accentColor: string;
  enabled: boolean;
};

type LobbySupportCardConfig = {
  id: string;
  title: string;
  desc: string;
  to: string;
  icon: string;
  accentColor: string;
  enabled: boolean;
};

type LobbyTabsConfig = {
  games: {
    enabled: boolean;
    label: string;
    hint: string;
    sectionTitle: string;
    actionText: string;
  };
  tournaments: {
    enabled: boolean;
    label: string;
    hint: string;
    sectionTitle: string;
    actionText: string;
    rankPrefix: string;
    prizeSuffix: string;
    cardDescription: string;
    cards: LobbyTournamentCardConfig[];
  };
  support: {
    enabled: boolean;
    label: string;
    hint: string;
    sectionTitle: string;
    actionText: string;
    searchPlaceholder: string;
    infoTitle: string;
    infoDescription: string;
    infoAccentColor: string;
    cards: LobbySupportCardConfig[];
  };
};

type LobbyTheme = {
  themePreset: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  backgroundImageUrl: string;
  backgroundOverlay: number;
  banner: {
    enabled: boolean;
    imageUrl: string;
    title: string;
    subtitle: string;
    ctaLabel: string;
    linkUrl: string;
  };
  quickAccess: LobbyQuickAccessItem[];
  tabs: LobbyTabsConfig;
};

const DEFAULT_QUICK_ACCESS_ITEMS: LobbyQuickAccessItem[] = [
  { id: 'bonus', label: 'Bonus Talep', desc: 'Kampanya ve freespin', to: '/bonus-talep', icon: 'gift', accentColor: '#fb7185', enabled: true },
  { id: 'wheel', label: 'Şans Çarkı', desc: 'Çevir, ödül kazan', to: '/cark', icon: 'zap', accentColor: '#c084fc', enabled: true },
  { id: 'scratch', label: 'Kazı Kazan', desc: 'Kartını kazı', to: '/kazi-kazan', icon: 'sparkles', accentColor: '#f0abfc', enabled: true },
  { id: 'prediction', label: 'Skor Tahmin', desc: 'Maç skoru bil', to: '/skor-tahmin', icon: 'goal', accentColor: '#6ee7b7', enabled: true },
  { id: 'daily-tasks', label: 'Günlük Görevler', desc: 'API ilerleme', to: '/gorevler', icon: 'list-checks', accentColor: '#7dd3fc', enabled: true },  { id: 'tournament', label: 'Turnuva', desc: 'Sıralamaya gir', to: '/turnuva/gunluk', icon: 'trophy', accentColor: '#facc15', enabled: true },
  { id: 'loyalty', label: 'Sadakat', desc: 'XP ve ödüller', to: '/sadakat', icon: 'star', accentColor: '#facc15', enabled: true },
  { id: 'millionaires', label: 'Milyonerler', desc: 'Büyük kazançlar', to: '/milyonerler', icon: 'crown', accentColor: '#facc15', enabled: true },
  { id: 'vip', label: 'VIP', desc: 'Özel üyelik', to: '/vip', icon: 'shield', accentColor: '#c084fc', enabled: true },
  { id: 'partner', label: 'İş Birliği', desc: 'Partner ol', to: '/ortaklik', icon: 'handshake', accentColor: '#7dd3fc', enabled: true },
  { id: 'call-me', label: 'Beni Ara', desc: '7/24 destek', to: '/beni-ara', icon: 'phone', accentColor: '#7dd3fc', enabled: true },
];

const QUICK_ACCESS_ICON_MAP = {
  gift: Gift,
  zap: Zap,
  sparkles: Sparkles,
  goal: Goal,
  'list-checks': ListChecks,
  layers: Layers,
  trophy: Trophy,
  star: Star,
  crown: Crown,
  shield: ShieldCheck,
  handshake: Handshake,
  phone: Phone,
} as const;

const DEFAULT_LOBBY_THEME: LobbyTheme = {
  themePreset: 'gold',
  primaryColor: '#d4af37',
  secondaryColor: '#9a701a',
  accentColor: '#f4d36f',
  backgroundColor: '#100b04',
  surfaceColor: '#1a1005',
  textColor: '#fff7df',
  mutedTextColor: '#c6ae76',
  backgroundImageUrl: '',
  backgroundOverlay: 72,
  banner: {
    enabled: false,
    imageUrl: '',
    title: 'Sezon fırsatları başladı',
    subtitle: 'Günlük görevler ve sezon kartı ödülleri yayında.',
    ctaLabel: 'Hemen katıl',
    linkUrl: '/gorevler'
  },
  quickAccess: DEFAULT_QUICK_ACCESS_ITEMS,
  tabs: {
    games: {
      enabled: true,
      label: 'Hızlı Erişim',
      hint: 'Kısayollar',
      sectionTitle: 'Hızlı Erişim',
      actionText: '{count} kısayol'
    },
    tournaments: {
      enabled: true,
      label: 'Turnuva',
      hint: 'Sıralama',
      sectionTitle: 'Turnuvalar',
      actionText: 'Canlı etkinlik',
      rankPrefix: 'Popülerlik',
      prizeSuffix: '₺',
      cardDescription: 'Sıralamaya gir, ödül havuzunda yerini al.',
      cards: [
        { id: 'daily', label: 'Günlük', period: '24 saat', prizeFallback: '50.000', to: '/turnuva/gunluk', icon: 'zap', accentColor: '#facc15', enabled: true },
        { id: 'weekly', label: 'Haftalık', period: '7 gün', prizeFallback: '250.000', to: '/turnuva/haftalik', icon: 'star', accentColor: '#7dd3fc', enabled: true },
        { id: 'monthly', label: 'Aylık', period: '30 gün', prizeFallback: '500.000', to: '/turnuva/aylik', icon: 'trophy', accentColor: '#c084fc', enabled: true }
      ]
    },
    support: {
      enabled: true,
      label: 'Destek',
      hint: 'Yardım',
      sectionTitle: 'Destek',
      actionText: '7/24',
      searchPlaceholder: 'Oyun ara...',
      infoTitle: '7/24 destek',
      infoDescription: 'Mobilde hızlı yardım için hazır.',
      infoAccentColor: '#c084fc',
      cards: [
        { id: 'call', title: 'Sizi arayalım', desc: 'Destek için numaranızı bırakın.', to: '/beni-ara', icon: 'phone', accentColor: '#7dd3fc', enabled: true },
        { id: 'partner', title: 'İş birliği', desc: 'Yayıncı ve reklam başvurusu.', to: '/ortaklik', icon: 'handshake', accentColor: '#facc15', enabled: true }
      ]
    }
  }
};

function clampOverlay(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_LOBBY_THEME.backgroundOverlay;
  return Math.min(95, Math.max(0, Math.round(numeric)));
}

function asHexColor(value: unknown, fallback: string) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : fallback;
}

function asText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function normalizeLobbyRoute(value: unknown, fallback: string) {
  const route = String(value || '').trim().replace(/^#/, '');
  const aliases: Record<string, string> = {
    '/wheel': '/cark',
    '/sans-carki': '/cark',
    '/scratch': '/kazi-kazan',
    '/scratch-card': '/kazi-kazan',
    '/call-request': '/beni-ara',
    '/score-prediction': '/skor-tahmin',
  };
  return aliases[route] || (route.startsWith('/') ? route : fallback);
}
function normalizeQuickAccess(items: unknown): LobbyQuickAccessItem[] {
  if (!Array.isArray(items)) return DEFAULT_QUICK_ACCESS_ITEMS;

  return items.map((item, index) => {
    const source = item && typeof item === 'object' ? item as Partial<LobbyQuickAccessItem> : {};
    const fallback = DEFAULT_QUICK_ACCESS_ITEMS[index] || DEFAULT_QUICK_ACCESS_ITEMS[0];
    const legacyAccentMap: Record<string, string> = {
      rose: '#fb7185',
      purple: '#d4af37',
      fuchsia: '#f4d36f',
      emerald: '#6ee7b7',
      amber: '#facc15',
      sky: '#7dd3fc'
    };
    const legacyAccent = typeof (source as any).accent === 'string'
      ? legacyAccentMap[(source as any).accent] || fallback.accentColor
      : fallback.accentColor;

    return {
      id: asText(source.id, fallback.id || `quick-${index + 1}`),
      label: asText(source.label, fallback.label),
      desc: asText(source.desc, fallback.desc),
      to: normalizeLobbyRoute(source.to, fallback.to),
      icon: asText(source.icon, fallback.icon),
      accentColor: asHexColor(source.accentColor, legacyAccent),
      enabled: source.enabled !== false
    };
  });
}

function normalizeTournamentCards(items: unknown): LobbyTournamentCardConfig[] {
  const defaults = DEFAULT_LOBBY_THEME.tabs.tournaments.cards;
  if (!Array.isArray(items)) return defaults;

  return items.map((item, index) => {
    const source = item && typeof item === 'object' ? item as Partial<LobbyTournamentCardConfig> : {};
    const fallback = defaults[index] || defaults[0];

    return {
      id: asText(source.id, fallback.id || `tournament-${index + 1}`),
      label: asText(source.label, fallback.label),
      period: asText(source.period, fallback.period),
      prizeFallback: asText(source.prizeFallback, fallback.prizeFallback),
      to: normalizeLobbyRoute(source.to, fallback.to),
      icon: asText(source.icon, fallback.icon),
      accentColor: asHexColor(source.accentColor, fallback.accentColor),
      enabled: source.enabled !== false
    };
  });
}

function normalizeSupportCards(items: unknown): LobbySupportCardConfig[] {
  const defaults = DEFAULT_LOBBY_THEME.tabs.support.cards;
  if (!Array.isArray(items)) return defaults;

  return items.map((item, index) => {
    const source = item && typeof item === 'object' ? item as Partial<LobbySupportCardConfig> : {};
    const fallback = defaults[index] || defaults[0];

    return {
      id: asText(source.id, fallback.id || `support-${index + 1}`),
      title: asText(source.title, fallback.title),
      desc: asText(source.desc, fallback.desc),
      to: normalizeLobbyRoute(source.to, fallback.to),
      icon: asText(source.icon, fallback.icon),
      accentColor: asHexColor(source.accentColor, fallback.accentColor),
      enabled: source.enabled !== false
    };
  });
}

function normalizeLobbyTabs(config: any): LobbyTabsConfig {
  const defaults = DEFAULT_LOBBY_THEME.tabs;
  const games = config?.games || {};
  const tournaments = config?.tournaments || {};
  const support = config?.support || {};

  return {
    games: {
      enabled: games.enabled !== false,
      label: asText(games.label, defaults.games.label),
      hint: asText(games.hint, defaults.games.hint),
      sectionTitle: asText(games.sectionTitle, defaults.games.sectionTitle),
      actionText: asText(games.actionText, defaults.games.actionText)
    },
    tournaments: {
      enabled: tournaments.enabled !== false,
      label: asText(tournaments.label, defaults.tournaments.label),
      hint: asText(tournaments.hint, defaults.tournaments.hint),
      sectionTitle: asText(tournaments.sectionTitle, defaults.tournaments.sectionTitle),
      actionText: asText(tournaments.actionText, defaults.tournaments.actionText),
      rankPrefix: asText(tournaments.rankPrefix, defaults.tournaments.rankPrefix),
      prizeSuffix: asText(tournaments.prizeSuffix, defaults.tournaments.prizeSuffix),
      cardDescription: asText(tournaments.cardDescription, defaults.tournaments.cardDescription),
      cards: normalizeTournamentCards(tournaments.cards)
    },
    support: {
      enabled: support.enabled !== false,
      label: asText(support.label, defaults.support.label),
      hint: asText(support.hint, defaults.support.hint),
      sectionTitle: asText(support.sectionTitle, defaults.support.sectionTitle),
      actionText: asText(support.actionText, defaults.support.actionText),
      searchPlaceholder: asText(support.searchPlaceholder, defaults.support.searchPlaceholder),
      infoTitle: asText(support.infoTitle, defaults.support.infoTitle),
      infoDescription: asText(support.infoDescription, defaults.support.infoDescription),
      infoAccentColor: asHexColor(support.infoAccentColor, defaults.support.infoAccentColor),
      cards: normalizeSupportCards(support.cards)
    }
  };
}

function normalizeLobbyTheme(config: any): LobbyTheme {
  const banner = config?.banner || {};
  return {
    themePreset: 'gold',
    primaryColor: DEFAULT_LOBBY_THEME.primaryColor,
    secondaryColor: DEFAULT_LOBBY_THEME.secondaryColor,
    accentColor: DEFAULT_LOBBY_THEME.accentColor,
    backgroundColor: DEFAULT_LOBBY_THEME.backgroundColor,
    surfaceColor: DEFAULT_LOBBY_THEME.surfaceColor,
    textColor: DEFAULT_LOBBY_THEME.textColor,
    mutedTextColor: DEFAULT_LOBBY_THEME.mutedTextColor,
    backgroundImageUrl: asText(config?.backgroundImageUrl),
    backgroundOverlay: clampOverlay(config?.backgroundOverlay),
    banner: {
      enabled: banner.enabled === true,
      imageUrl: asText(banner.imageUrl),
      title: asText(banner.title, DEFAULT_LOBBY_THEME.banner.title),
      subtitle: asText(banner.subtitle, DEFAULT_LOBBY_THEME.banner.subtitle),
      ctaLabel: asText(banner.ctaLabel, DEFAULT_LOBBY_THEME.banner.ctaLabel),
      linkUrl: asText(banner.linkUrl, DEFAULT_LOBBY_THEME.banner.linkUrl)
    },
    quickAccess: normalizeQuickAccess(config?.quickAccess),
    tabs: normalizeLobbyTabs(config?.tabs)
  };
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '').trim();
  const full = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return `rgba(0,0,0,${alpha})`;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function cssUrl(url: string) {
  return url.replace(/["\\\r\n]/g, '');
}

export function PlayerLobby() {
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [userStatus, setUserStatus] = useState<'idle' | 'success' | 'not_found' | 'error'>('idle');
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loyalty, setLoyalty] = useState<any>(null);
  const [lobbyConfig, setLobbyConfig] = useState<any>(null);
  const [activeLobbyTab, setActiveLobbyTab] = useState<LobbyTabId>('games');

  const liveWinners = useMemo(() => [
    { user: 'Ahmet***', win: '₺2.450', game: 'Şans Çarkı', time: '1 dk önce' },
    { user: 'Selin***', win: '₺12.800', game: 'Sweet Bonanza', time: '2 dk önce' },
    { user: 'Mert***', win: '₺500', game: 'Kazı Kazan', time: '3 dk önce' },
    { user: 'Ayşe***', win: '₺45.000', game: 'Gates of Olympus', time: '4 dk önce' },
    { user: 'Kaan***', win: '₺3.200', game: 'Aviator', time: '6 dk önce' },
    { user: 'Buse***', win: '₺8.900', game: 'Big Bass Splash', time: '8 dk önce' },
    { user: 'Can***', win: '₺1.150', game: 'Şans Çarkı', time: '10 dk önce' },
    { user: 'Deniz***', win: '₺22.400', game: 'Sugar Rush', time: '12 dk önce' },
  ], []);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const urlUsername = query.get('username')
      || query.get('player')
      || query.get('login');

    const restorePlayer = async () => {
      const existing = await bonusPanelApi.me();
      if (existing.ok) {
        setActiveUser(existing.login);
        setUserStatus('success');
        localStorage.setItem('saved_username', existing.login);
        return;
      }

      const candidate = urlUsername?.trim();
      if (candidate) {
        setChecking(true);
        const verified = await bonusPanelApi.login(candidate).catch(() => ({ ok: false }));
        setChecking(false);
        if (verified.ok && 'login' in verified) {
          setActiveUser(verified.login);
          setUserStatus('success');
          localStorage.setItem('saved_username', verified.login);
          return;
        }
        setUserStatus('not_found');
      }

      const saved = localStorage.getItem('saved_username');
      if (saved) setUsername(saved);
    };

    restorePlayer();
    tournamentApi.getSettings().then(setSettings).catch(() => {});
    gamesApi.config().then((res: any) => {
      setLobbyConfig(res?.data?.lobby || null);
    }).catch(() => {});
  }, [location.search]);

  useEffect(() => {
    if (!activeUser) return;
    const syncStatus = () => loyaltyApi.status().then(setLoyalty).catch(() => {});
    syncStatus();
    const interval = setInterval(syncStatus, 30000);
    return () => clearInterval(interval);
  }, [activeUser]);

  const handleCheck = async () => {
    if (!username.trim() || checking) return;
    setChecking(true);
    setUserStatus('idle');
    try {
      const res = await bonusPanelApi.login(username.trim());
      if (res.ok) {
        setUserStatus('success');
        setActiveUser(res.login);
        localStorage.setItem('saved_username', res.login);
      } else {
        setUserStatus('not_found');
        setActiveUser(null);
      }
    } catch {
      setUserStatus('error');
      setActiveUser(null);
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    await bonusPanelApi.logout();
    setActiveUser(null);
    setUserStatus('idle');
    setUsername('');
  };

  const statusMessage = userStatus === 'not_found'
    ? 'Kullanıcı bulunamadı. Lütfen kullanıcı adını kontrol edin.'
    : userStatus === 'error'
      ? 'Bağlantı hatası oluştu. Biraz sonra tekrar deneyin.'
      : '';

  const lobbyTheme = useMemo(() => normalizeLobbyTheme(lobbyConfig), [lobbyConfig]);
  const visibleQuickAccess = useMemo(
    () => lobbyTheme.quickAccess.filter((item) => item.enabled !== false),
    [lobbyTheme.quickAccess]
  );
  const lobbyTabs = useMemo(() => {
    const tabs = [
      { id: 'games' as const, icon: Zap, ...lobbyTheme.tabs.games },
      { id: 'tournaments' as const, icon: Trophy, ...lobbyTheme.tabs.tournaments },
      { id: 'support' as const, icon: Phone, ...lobbyTheme.tabs.support }
    ];
    return tabs.filter((tab) => tab.enabled !== false);
  }, [lobbyTheme.tabs]);
  const tournamentCards = useMemo(() => {
    const prizeById: Record<string, string | undefined> = {
      daily: settings?.gunluk?.prize,
      gunluk: settings?.gunluk?.prize,
      weekly: settings?.haftalik?.prize,
      haftalik: settings?.haftalik?.prize,
      monthly: settings?.aylik?.prize,
      aylik: settings?.aylik?.prize
    };

    return lobbyTheme.tabs.tournaments.cards
      .filter((card) => card.enabled !== false)
      .map((card) => ({
        ...card,
        prize: prizeById[card.id] || card.prizeFallback
      }));
  }, [lobbyTheme.tabs.tournaments.cards, settings]);

  useEffect(() => {
    if (!lobbyTabs.length) return;
    if (!lobbyTabs.some((tab) => tab.id === activeLobbyTab)) {
      setActiveLobbyTab(lobbyTabs[0].id);
    }
  }, [activeLobbyTab, lobbyTabs]);
  const rootStyle = useMemo(() => ({
    backgroundColor: lobbyTheme.backgroundColor,
    color: lobbyTheme.textColor,
    '--lobby-primary': lobbyTheme.primaryColor,
    '--lobby-secondary': lobbyTheme.secondaryColor,
    '--lobby-accent': lobbyTheme.accentColor,
    '--lobby-bg': lobbyTheme.backgroundColor,
    '--lobby-surface': lobbyTheme.surfaceColor,
    '--lobby-text': lobbyTheme.textColor,
    '--lobby-muted': lobbyTheme.mutedTextColor
  }) as CSSProperties, [lobbyTheme]);
  const backgroundStyle = useMemo(() => {
    const overlay = lobbyTheme.backgroundOverlay / 100;
    if (lobbyTheme.backgroundImageUrl) {
      return {
        backgroundImage: `linear-gradient(${hexToRgba(lobbyTheme.backgroundColor, overlay)}, ${hexToRgba(lobbyTheme.backgroundColor, overlay)}), url("${cssUrl(lobbyTheme.backgroundImageUrl)}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      } as CSSProperties;
    }

    return {
      background: `radial-gradient(circle at 12% 0%, ${hexToRgba(lobbyTheme.primaryColor, 0.22)}, transparent 34%), radial-gradient(circle at 92% 22%, ${hexToRgba(lobbyTheme.accentColor, 0.13)}, transparent 30%), linear-gradient(180deg, ${lobbyTheme.backgroundColor}, ${lobbyTheme.surfaceColor} 55%, ${lobbyTheme.backgroundColor})`
    } as CSSProperties;
  }, [lobbyTheme]);

  return (
    <div className="narcos-lobby relative min-h-screen overflow-x-hidden bg-[#100b04] pb-24 font-sans text-zinc-100 selection:bg-[#d4af37]/30 md:pb-8" style={rootStyle}>
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0" style={backgroundStyle} />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:42px_42px] opacity-50 md:bg-[size:72px_72px]" />
      </div>

      <LiveTicker winners={liveWinners} theme={lobbyTheme} />

      <main className="relative z-10 mx-auto flex w-full max-w-[1480px] flex-col gap-5 px-3 py-4 sm:px-5 md:gap-8 md:px-8 md:py-7">
        <header className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Link to="/lobi" className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
                style={{
                  borderColor: hexToRgba(lobbyTheme.primaryColor, 0.24),
                  backgroundColor: hexToRgba(lobbyTheme.primaryColor, 0.16),
                  color: lobbyTheme.primaryColor,
                  boxShadow: `0 0 30px ${hexToRgba(lobbyTheme.primaryColor, 0.2)}`
                }}
              >
                <Zap size={23} className="fill-current" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-black uppercase tracking-[-0.035em] sm:text-xl" style={{ color: lobbyTheme.textColor }}>Ödül Merkezi</p>
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: lobbyTheme.mutedTextColor }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.85)]" />
                  Mobil lobi
                </p>
              </div>
            </Link>

            <button type="button" aria-label="Bildirimler" className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-zinc-400">
              <Bell size={20} />
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full ring-2 ring-[#07070d]" style={{ backgroundColor: lobbyTheme.accentColor }} />
            </button>
          </div>

          <section className="rounded-[1.7rem] border border-white/[0.075] bg-white/[0.045] p-3 shadow-[0_18px_55px_rgba(0,0,0,.28)] backdrop-blur-2xl md:p-4">
            {activeUser ? (
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
                  style={{
                    borderColor: hexToRgba(lobbyTheme.primaryColor, 0.24),
                    backgroundColor: hexToRgba(lobbyTheme.primaryColor, 0.16),
                    color: lobbyTheme.primaryColor
                  }}
                >
                  <User size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: lobbyTheme.primaryColor }}>Hoş geldin</p>
                  <p className="truncate text-base font-black uppercase text-white">{activeUser}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-2 py-1 text-[10px] font-black text-emerald-300">
                      <Wallet size={12} /> ₺{loyalty?.balance?.toLocaleString('tr-TR') || '0'}
                    </span>
                    {loyalty && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/15 bg-amber-300/10 px-2 py-1 text-[10px] font-black text-amber-300">
                        LVL {loyalty.level}
                      </span>
                    )}
                  </div>
                </div>
                <button type="button" onClick={handleLogout} aria-label="Çıkış yap" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-300/10 bg-rose-400/10 text-rose-300">
                  <XCircle size={20} />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-zinc-400">
                    {checking ? <Loader2 size={22} className="animate-spin" style={{ color: lobbyTheme.primaryColor }} /> : <User size={22} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Oyuncu doğrulama</p>
                    <input
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && handleCheck()}
                      className="mt-1 w-full border-0 bg-transparent p-0 text-base font-black text-white outline-none placeholder:text-zinc-700 focus:ring-0"
                      placeholder="Kullanıcı adınız"
                    />
                  </div>
                </div>
                {statusMessage && (
                  <div className="rounded-2xl border border-rose-300/15 bg-rose-400/10 px-3 py-2 text-xs font-bold text-rose-200">
                    {statusMessage}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleCheck}
                  disabled={!username.trim() || checking}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#d4af37] to-[#9a701a] text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_35px_rgba(212,175,55,.25)] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: `linear-gradient(90deg, ${lobbyTheme.primaryColor}, ${lobbyTheme.secondaryColor})`,
                    boxShadow: `0 14px 35px ${hexToRgba(lobbyTheme.primaryColor, 0.28)}`
                  }}
                >
                  {checking ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Giriş yap
                </button>
              </div>
            )}
          </section>
        </header>

        <section className="grid grid-cols-5 gap-2 md:hidden" aria-label="Hızlı erişim">
          {visibleQuickAccess.slice(0, 10).map((item) => (
            <QuickAction
              key={item.id}
              to={item.to}
              icon={QUICK_ACCESS_ICON_MAP[item.icon as keyof typeof QUICK_ACCESS_ICON_MAP] || Gift}
              label={item.label}
              accentColor={item.accentColor}
            />
          ))}
        </section>

        <LobbyBanner theme={lobbyTheme} />

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[2rem] border p-5 shadow-[0_24px_80px_rgba(0,0,0,.35)] md:grid md:min-h-[360px] md:grid-cols-[1fr_280px] md:p-9"
          style={{
            borderColor: hexToRgba(lobbyTheme.primaryColor, 0.2),
            background: `linear-gradient(135deg, ${hexToRgba(lobbyTheme.primaryColor, 0.28)}, ${hexToRgba(lobbyTheme.surfaceColor, 0.92)} 48%, ${hexToRgba(lobbyTheme.backgroundColor, 0.98)})`
          }}
        >
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full blur-[85px]" style={{ backgroundColor: hexToRgba(lobbyTheme.primaryColor, 0.24) }} />
          <div
            className="absolute bottom-0 left-0 h-px w-2/3"
            style={{ background: `linear-gradient(90deg, ${hexToRgba(lobbyTheme.primaryColor, 0.7)}, transparent)` }}
          />

          <div className="relative z-10 flex flex-col justify-center">
            <div
              className="mb-5 inline-flex w-max items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em]"
              style={{
                borderColor: hexToRgba(lobbyTheme.primaryColor, 0.18),
                backgroundColor: hexToRgba(lobbyTheme.primaryColor, 0.12),
                color: lobbyTheme.primaryColor
              }}
            >
              <Star size={12} className="fill-current" />
              Öne çıkan
            </div>
            <h1 className="max-w-[620px] text-4xl font-black leading-[0.94] tracking-[-0.065em] text-white sm:text-5xl md:text-6xl">
              Bonusunu seç, talebini hızlıca gönder.
            </h1>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link to="/bonus-talep" className="inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-black transition active:scale-[0.98]">
                Bonus talep et <ChevronRight size={18} />
              </Link>
              <Link
                to="/cark"
                className="inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl border bg-white/[0.055] px-6 py-4 text-sm font-black text-white transition active:scale-[0.98]"
                style={{ borderColor: hexToRgba(lobbyTheme.primaryColor, 0.22) }}
              >
                Çarkı çevir <Zap size={18} />
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-7 hidden items-center justify-center md:flex">
            <motion.div animate={{ y: [0, -16, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} className="relative">
              <div className="flex h-44 w-44 rotate-6 items-center justify-center rounded-[2.2rem] border border-white/10 bg-white/[0.07] shadow-2xl backdrop-blur-xl">
                <Gift size={78} style={{ color: lobbyTheme.primaryColor, filter: `drop-shadow(0 0 20px ${hexToRgba(lobbyTheme.primaryColor, 0.45)})` }} />
              </div>
              <div className="absolute -bottom-5 -right-5 flex h-20 w-20 -rotate-12 items-center justify-center rounded-[1.5rem] border border-white/10 bg-[#0b0d13] text-amber-300 shadow-xl" style={{ backgroundColor: lobbyTheme.surfaceColor, color: lobbyTheme.accentColor }}>
                <Zap size={34} />
              </div>
            </motion.div>
          </div>
        </motion.section>

        <section className="rounded-[1.9rem] border border-white/[0.075] bg-white/[0.035] p-2 shadow-[0_18px_50px_rgba(0,0,0,.22)] backdrop-blur-2xl sm:p-3 md:p-4">
          <div role="tablist" aria-label="Lobi bölümleri" className="grid grid-cols-3 gap-1 rounded-[1.45rem] border border-white/[0.06] bg-black/25 p-1">
            {lobbyTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeLobbyTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`lobby-panel-${tab.id}`}
                  id={`lobby-tab-${tab.id}`}
                  onClick={() => setActiveLobbyTab(tab.id)}
                  className={cn(
                    'flex min-w-0 flex-col items-center justify-center gap-1 rounded-[1.1rem] px-1.5 py-2.5 text-[9px] font-black uppercase tracking-[0.08em] transition sm:flex-row sm:gap-2 sm:px-3 sm:text-xs',
                    isActive
                      ? 'bg-white text-black shadow-[0_10px_28px_rgba(255,255,255,.12)]'
                      : 'text-zinc-500 hover:bg-white/[0.055] hover:text-white'
                  )}
                >
                  <Icon size={17} className="shrink-0" />
                  <span className="max-w-full truncate leading-none">{tab.label}</span>
                  <span className={cn('hidden rounded-full px-2 py-1 text-[9px] tracking-[0.12em] lg:inline', isActive ? 'bg-black/10 text-black/55' : 'bg-white/5 text-zinc-600')}>
                    {tab.hint}
                  </span>
                </button>
              );
            })}
          </div>

          <motion.div
            key={activeLobbyTab}
            role="tabpanel"
            id={`lobby-panel-${activeLobbyTab}`}
            aria-labelledby={`lobby-tab-${activeLobbyTab}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="pt-3 sm:pt-4"
          >
            {activeLobbyTab === 'games' && <GamesTab items={visibleQuickAccess} config={lobbyTheme.tabs.games} />}
            {activeLobbyTab === 'tournaments' && <TournamentsTab cards={tournamentCards} config={lobbyTheme.tabs.tournaments} />}
            {activeLobbyTab === 'support' && <SupportTab config={lobbyTheme.tabs.support} />}
          </motion.div>
        </section>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl md:hidden"
        style={{
          borderColor: hexToRgba(lobbyTheme.textColor, 0.08),
          backgroundColor: hexToRgba(lobbyTheme.surfaceColor, 0.92)
        }}
      >
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          <BottomNav to="/lobi" icon={Star} label="Lobi" active accentColor={lobbyTheme.primaryColor} />
          <BottomNav to="/bonus-talep" icon={Gift} label="Bonus" />
          <BottomNav to="/cark" icon={Zap} label="Çark" />
          <BottomNav to="/sadakat" icon={Trophy} label="Sadakat" />
        </div>
      </nav>

      <style>{`
        @keyframes lobby-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .lobby-marquee {
          animation: lobby-marquee 55s linear infinite;
        }
      `}</style>
    </div>
  );
}

function formatActionText(template: string, count: number) {
  return template.replace('{count}', String(count));
}

function GamesTab({ items, config }: { items: LobbyQuickAccessItem[]; config: LobbyTabsConfig['games'] }) {
  return (
    <div className="space-y-5">
      <SectionTitle title={config.sectionTitle} action={formatActionText(config.actionText, items.length)} />
      <div className="grid grid-cols-3 gap-3 md:gap-4 lg:grid-cols-5">
        {items.map((item) => {
          const Icon = QUICK_ACCESS_ICON_MAP[item.icon as keyof typeof QUICK_ACCESS_ICON_MAP] || Gift;
          const inner = (
            <>
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl border transition group-hover:scale-110 md:h-20 md:w-20"
                style={{
                  borderColor: hexToRgba(item.accentColor, 0.28),
                  backgroundColor: hexToRgba(item.accentColor, 0.13),
                  color: item.accentColor
                }}
              >
                <Icon size={28} className="md:hidden" />
                <Icon size={34} className="hidden md:block" />
              </div>
              <div>
                <p className="text-xs font-black leading-tight text-white md:text-sm">{item.label}</p>
                <p className="mt-1 text-[10px] font-semibold leading-tight text-zinc-600 md:text-[11px]">{item.desc}</p>
              </div>
            </>
          );
          const cardCls = 'group flex flex-col items-center gap-3 rounded-[1.6rem] border border-white/[0.07] bg-white/[0.035] p-4 text-center active:scale-[0.97] hover:bg-white/[0.06] transition md:p-5';
          return <Link key={item.id} to={item.to} className={cardCls}>{inner}</Link>;
        })}
      </div>

    </div>
  );
}

type TournamentLobbyCard = LobbyTournamentCardConfig & { prize: string };

function TournamentsTab({ cards, config }: { cards: TournamentLobbyCard[]; config: LobbyTabsConfig['tournaments'] }) {
  const [selectedTournament, setSelectedTournament] = useState(cards[0]?.id ?? '');
  const selectedCard = cards.find((card) => card.id === selectedTournament) ?? cards[0];
  const selectedIndex = Math.max(cards.findIndex((card) => card.id === selectedCard?.id), 0);

  useEffect(() => {
    if (!cards.length) return;
    if (!cards.some((card) => card.id === selectedTournament)) {
      setSelectedTournament(cards[0].id);
    }
  }, [cards, selectedTournament]);

  return (
    <div className="space-y-4">
      <SectionTitle title={config.sectionTitle} action={config.actionText} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="tablist" aria-label="Turnuva dönemleri">
        {cards.map((card) => {
          const Icon = QUICK_ACCESS_ICON_MAP[card.icon as keyof typeof QUICK_ACCESS_ICON_MAP] || Trophy;
          const selected = selectedTournament === card.id;

          return (
            <button
              key={card.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setSelectedTournament(card.id)}
              className={cn(
                'group flex min-h-[92px] min-w-0 items-center gap-3 rounded-[1.25rem] border p-3 text-left transition active:scale-[0.98]',
                selected
                  ? 'border-white/20 bg-white text-black shadow-[0_18px_36px_rgba(255,255,255,.10)]'
                  : 'border-white/[0.07] bg-white/[0.035] text-zinc-400 hover:border-white/12 hover:bg-white/[0.07] hover:text-white'
              )}
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
                style={selected
                  ? { borderColor: 'rgba(0,0,0,0.1)', backgroundColor: 'rgba(0,0,0,0.05)' }
                  : { borderColor: hexToRgba(card.accentColor, 0.18), backgroundColor: hexToRgba(card.accentColor, 0.1), color: card.accentColor }
                }
              >
                <Icon size={20} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black uppercase tracking-[0.08em]">{card.label}</span>
                <span className={cn('mt-1 block truncate text-[10px] font-black uppercase tracking-[0.14em]', selected ? 'text-black/45' : 'text-zinc-600')}>
                  {card.period}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {selectedCard && (
        <div className="grid grid-cols-1 gap-3">
          <TournamentCard
            card={selectedCard}
            rankHint={`${config.rankPrefix} #${selectedIndex + 1}`}
            prizeSuffix={config.prizeSuffix}
            description={config.cardDescription}
          />
        </div>
      )}
    </div>
  );
}

function SupportTab({ config }: { config: LobbyTabsConfig['support'] }) {
  const cards = config.cards.filter((card) => card.enabled !== false);

  return (
    <div className="space-y-4">
      <SectionTitle title={config.sectionTitle} action={config.actionText} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_320px] md:gap-5">
        {cards.map((card) => (
          <FeatureCard key={card.id} card={card} />
        ))}
        <div className="rounded-[1.6rem] border border-white/[0.07] bg-white/[0.035] p-4 md:p-5">
          <div className="relative">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              type="text"
              placeholder={config.searchPlaceholder}
              className="h-12 w-full rounded-2xl border border-white/[0.06] bg-black/30 pl-11 pr-4 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-[#d4af37]/60"
            />
          </div>
          <div
            className="mt-4 rounded-2xl border p-4"
            style={{
              borderColor: hexToRgba(config.infoAccentColor, 0.18),
              backgroundColor: hexToRgba(config.infoAccentColor, 0.1)
            }}
          >
            <CheckCircle2 className="mb-3" style={{ color: config.infoAccentColor }} size={24} />
            <p className="text-sm font-black text-white">{config.infoTitle}</p>
            <p className="mt-1 text-xs font-medium leading-5 text-zinc-500">{config.infoDescription}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LobbyBanner({ theme }: { theme: LobbyTheme }) {
  const banner = theme.banner;
  if (!banner.enabled) return null;

  const hasContent = banner.imageUrl || banner.title || banner.subtitle;
  if (!hasContent) return null;

  const bannerStyle: CSSProperties = {
    backgroundImage: banner.imageUrl
      ? `linear-gradient(90deg, ${hexToRgba(theme.backgroundColor, 0.84)}, ${hexToRgba(theme.backgroundColor, 0.18)}), url("${cssUrl(banner.imageUrl)}")`
      : `linear-gradient(90deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    borderColor: hexToRgba(theme.primaryColor, 0.24),
    boxShadow: `0 22px 70px ${hexToRgba(theme.primaryColor, 0.18)}`
  };

  const content = (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative flex min-h-[118px] overflow-hidden rounded-[1.7rem] border p-4 sm:min-h-[150px] sm:p-6 md:min-h-[190px] md:items-center md:p-8"
      style={bannerStyle}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-black/35 via-transparent to-transparent" />
      <div className="relative z-10 max-w-[620px]">
        {banner.title && (
          <h2 className="max-w-full text-2xl font-black leading-[0.95] tracking-[-0.055em] text-white sm:text-4xl md:text-5xl">
            {banner.title}
          </h2>
        )}
        {banner.subtitle && (
          <p className="mt-2 max-w-[520px] text-xs font-bold leading-5 text-white/78 sm:text-sm md:text-base">
            {banner.subtitle}
          </p>
        )}
        {banner.ctaLabel && (
          <span
            className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black uppercase tracking-[0.14em] text-black transition group-hover:translate-x-0.5"
            style={{ backgroundColor: theme.accentColor }}
          >
            {banner.ctaLabel}
            <ChevronRight size={16} />
          </span>
        )}
      </div>
    </motion.section>
  );

  const link = banner.linkUrl.trim();
  if (!link) return content;
  if (/^https?:\/\//i.test(link) || link.startsWith('#')) {
    return (
      <a href={link} target={/^https?:\/\//i.test(link) ? '_blank' : undefined} rel={/^https?:\/\//i.test(link) ? 'noreferrer' : undefined}>
        {content}
      </a>
    );
  }
  return <Link to={link}>{content}</Link>;
}

function LiveTicker({ winners, theme }: { winners: Array<{ user: string; win: string; game: string; time: string }>; theme: LobbyTheme }) {
  return (
    <div className="relative z-20 flex h-9 w-full items-center overflow-hidden border-b border-white/[0.07] bg-black/70 backdrop-blur-xl md:h-10">
      <div
        className="z-10 flex h-full shrink-0 items-center gap-2 px-3 text-[9px] font-black uppercase tracking-[0.16em] text-white shadow-[8px_0_24px_rgba(0,0,0,.55)] md:px-6 md:text-[10px]"
        style={{ background: `linear-gradient(90deg, ${theme.primaryColor}, ${theme.secondaryColor})` }}
      >
        <Activity size={12} className="animate-pulse" />
        Canlı
      </div>
      <div className="lobby-marquee flex items-center gap-7 whitespace-nowrap px-5">
        {[...winners, ...winners].map((winner, index) => (
          <div key={`${winner.user}-${index}`} className="flex items-center gap-2 text-xs font-bold text-zinc-500">
            <span className="text-white">{winner.user}</span>
            <span style={{ color: theme.accentColor }}>{winner.win}</span>
            <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">{winner.game}</span>
            <span className="text-[10px] text-zinc-700">{winner.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label, accentColor = '#a855f7' }: { to: string; icon: any; label: string; accentColor?: string }) {
  return (
    <Link to={to} className="flex min-h-[70px] flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.045] p-2 text-center active:scale-[0.98]">
      <Icon size={20} style={{ color: accentColor }} />
      <span className="text-[9px] font-black uppercase tracking-[0.06em] text-zinc-300 min-[390px]:text-[10px]">{label}</span>
    </Link>
  );
}

function TournamentCard({
  card,
  rankHint,
  prizeSuffix,
  description
}: {
  card: TournamentLobbyCard;
  rankHint: string;
  prizeSuffix: string;
  description: string;
}) {
  const Icon = QUICK_ACCESS_ICON_MAP[card.icon as keyof typeof QUICK_ACCESS_ICON_MAP] || Trophy;

  return (
    <Link
      to={card.to}
      className="group flex min-h-[190px] flex-col justify-between overflow-hidden rounded-[1.4rem] border bg-gradient-to-br to-black/30 p-4 shadow-[0_14px_35px_rgba(0,0,0,.18)] transition active:scale-[0.98] md:p-5"
      style={{
        borderColor: hexToRgba(card.accentColor, 0.18),
        backgroundImage: `linear-gradient(135deg, ${hexToRgba(card.accentColor, 0.2)}, rgba(0,0,0,0.3))`,
        color: card.accentColor
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl border"
            style={{
              borderColor: hexToRgba(card.accentColor, 0.2),
              backgroundColor: hexToRgba(card.accentColor, 0.1),
              color: card.accentColor
            }}
          >
            <Icon size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">{card.period}</p>
            <p className="mt-1 text-sm font-black uppercase text-white">{card.label}</p>
          </div>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.045] text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-white">
          <ChevronRight size={17} />
        </div>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">{rankHint}</p>
        <p className="mt-1 truncate text-4xl font-black tracking-[-0.055em] text-white md:text-5xl">{card.prize}{prizeSuffix}</p>
        <p className="mt-2 text-xs font-bold leading-5 text-zinc-500">{description}</p>
      </div>
    </Link>
  );
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="flex items-end justify-between gap-3 px-1">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/70">Lobi</p>
        <h2 className="truncate text-xl font-black tracking-[-0.04em] text-white md:text-2xl">{title}</h2>
      </div>
      {action && <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">{action}</span>}
    </div>
  );
}


function FeatureCard({ card }: { card: LobbySupportCardConfig }) {
  const Icon = QUICK_ACCESS_ICON_MAP[card.icon as keyof typeof QUICK_ACCESS_ICON_MAP] || Phone;

  return (
    <Link to={card.to} className="rounded-[1.6rem] border border-white/[0.075] bg-white/[0.04] p-4 active:scale-[0.98] md:p-6">
      <div
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border"
        style={{
          borderColor: hexToRgba(card.accentColor, 0.2),
          backgroundColor: hexToRgba(card.accentColor, 0.1),
          color: card.accentColor
        }}
      >
        <Icon size={21} />
      </div>
      <h3 className="text-base font-black tracking-[-0.035em] text-white md:text-xl">{card.title}</h3>
      <p className="mt-1 text-xs font-medium leading-5 text-zinc-500 md:text-sm">{card.desc}</p>
    </Link>
  );
}

function BottomNav({ to, icon: Icon, label, active = false, accentColor = '#a855f7' }: { to: string; icon: any; label: string; active?: boolean; accentColor?: string }) {
  return (
    <Link
      to={to}
      className={cn('flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-black uppercase tracking-[0.08em]', active ? '' : 'text-zinc-500')}
      style={active ? { backgroundColor: hexToRgba(accentColor, 0.16), color: accentColor } : undefined}
    >
      <Icon size={19} />
      {label}
    </Link>
  );
}

const VIP_TIERS = [
  {
    id: 'prestij',
    badge: '🏅',
    label: 'Prestij',
    sublabel: 'Başlangıç',
    minDeposit: '10.000 TL',
    color: 'from-zinc-400/20 border-zinc-400/25 text-zinc-300',
    iconColor: 'bg-zinc-400/10 border-zinc-400/20 text-zinc-300',
    popular: false,
    perks: [
      '7/24 Kişisel VIP Asistanı',
      'Öncelikli müşteri desteği',
      'Özel hoşgeldin bonusu',
      'Haftalık cashback teklifi',
    ],
  },
  {
    id: 'champion',
    badge: '🏆',
    label: 'Champion',
    sublabel: 'Popüler',
    minDeposit: '50.000 TL',
    color: 'from-amber-400/20 border-amber-300/30 text-amber-200',
    iconColor: 'bg-amber-400/15 border-amber-300/25 text-amber-300',
    popular: true,
    perks: [
      'Tüm Prestij avantajları',
      'Özel etkinliklere davet',
      'Extra promosyonlar',
      'Hızlandırılmış çekim',
      'Kişisel bonus danışmanı',
    ],
  },
  {
    id: 'elite',
    badge: '💠',
    label: 'Elite',
    sublabel: 'Premium',
    minDeposit: '100.000 TL',
    color: 'from-sky-400/20 border-sky-300/25 text-sky-200',
    iconColor: 'bg-sky-400/10 border-sky-300/20 text-sky-300',
    popular: false,
    perks: [
      'Tüm Champion avantajları',
      'VIP çekim limitleri',
      'Doğum günü özel bonusu',
      'Lüks etkinlik davetleri',
      'Öncelikli VIP hattı',
    ],
  },
  {
    id: 'master',
    badge: '👑',
    label: 'Master',
    sublabel: 'Ultimate',
    minDeposit: '250.000 TL',
    color: 'from-amber-400/20 border-amber-300/30 text-amber-100',
    iconColor: 'bg-amber-400/15 border-amber-300/25 text-amber-300',
    popular: false,
    perks: [
      'Tüm Elite avantajları',
      'Limitsiz avantajlar',
      'Özel günlerde hediyeler',
      'Kişisel VIP koordinatörü',
      'Yıllık lüks sürpriz',
      'Sınırsız bonus fırsatı',
    ],
  },
];

const VIP_STATS = [
  { value: '15K+', label: 'VIP Üye' },
  { value: '7/24', label: 'Destek' },
  { value: '%99', label: 'Memnuniyet' },
  { value: '8M₺', label: 'Aylık Bonus' },
];

const VIP_FAQ = [
  { q: 'VIP üyelik nasıl alınır?', a: 'Aşağıdaki formu doldurarak başvuru yapabilirsiniz. Ekibimiz en kısa sürede sizinle iletişime geçecektir.' },
  { q: 'VIP seviyeleri nasıl belirlenir?', a: 'Yatırım miktarı, platform aktiviteniz ve sadakat puanlarınıza göre seviyeniz otomatik olarak güncellenir.' },
  { q: 'VIP üyeliğin ücretli olup olmadığı?', a: 'VIP programımız tamamen ücretsizdir. Belirli aktivite eşiklerini geçtiğinizde otomatik olarak davet edilirsiniz.' },
  { q: 'Hangi bonuslar VIP üyelere özel?', a: 'Cashback oranları, yükleme bonusları, freespin miktarları ve özel etkinlik ödülleri VIP seviyenize göre artış gösterir.' },
];

export function VIPTab() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [form, setForm] = useState({ username: '', name: '', email: '', phone: '' });
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [vipConfig, setVipConfig] = useState<any>(null);
  useEffect(() => {
    gamesApi.config().then((res: any) => {
      if (res?.data?.vip) setVipConfig(res.data.vip);
    }).catch(() => {});
  }, []);

  const cfg = vipConfig || {};
  const tiers = (cfg.tiers || VIP_TIERS).map((tier: any, index: number) => ({
    ...VIP_TIERS[index],
    ...tier,
  }));
  const stats = cfg.stats || VIP_STATS;
  const faq = cfg.faq || VIP_FAQ;
  const isActive = cfg.isActive !== false;
  const showStats = cfg.showStats !== false;
  const showFaq = cfg.showFaq !== false;
  const formActive = cfg.formActive !== false;
  const formTitle = cfg.formTitle || 'VIP başvurusu';
  const formButtonText = cfg.formButtonText || 'Başvur';
  const formSuccessMessage = cfg.formSuccessMessage || 'VIP başvurunuz alındı!';
  const title = cfg.title || 'Ayrıcalıklı deneyim, özel avantajlar';
  const description = cfg.description || 'Sadık oyuncularımıza özel 4 kademeli VIP programı.';
  const eyebrow = cfg.eyebrow || 'VIP Üyelik Programı';

  if (!isActive) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim() || submitting) return;
    setSubmitting(true);
    try {
      await formsApi.submitVipRequest(form);
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-2">
      {/* Başlık */}
      <div className="px-1 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-amber-200">
          <Crown size={12} />
          {eyebrow}
        </div>
        <h2 className="mt-3 text-2xl font-black tracking-[-0.05em] text-white md:text-3xl">{title}</h2>
        <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">{description}</p>
      </div>

      {/* İstatistikler */}
      {showStats && (
      <div className="grid grid-cols-4 gap-2">
        {stats.map((stat: any) => (
          <div key={stat.label} className="rounded-[1.25rem] border border-white/[0.07] bg-white/[0.035] p-3 text-center">
            <p className="text-lg font-black tracking-[-0.04em] text-white md:text-2xl">{stat.value}</p>
            <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">{stat.label}</p>
          </div>
        ))}
      </div>
      )}

      {/* VIP Tier Kartlar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiers.map((tier: any) => (
          <div
            key={tier.id}
            className={cn(
              'relative overflow-hidden rounded-[1.6rem] border bg-gradient-to-b to-black/40 p-4 md:p-5',
              tier.color,
              tier.popular && 'ring-1 ring-amber-300/30'
            )}
          >
            {tier.popular && (
              <div className="absolute right-3 top-3 rounded-full bg-amber-300 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-black">
                Popüler
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-2xl', tier.iconColor)}>
                {tier.badge}
              </div>
              <div>
                <p className="text-base font-black tracking-[-0.03em] text-white">{tier.label}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-50">{tier.sublabel}</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/20 px-3 py-2">
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-600">Minimum yatırım</p>
              <p className="mt-0.5 text-xs font-black text-white">{tier.minDeposit || 'Belirtilmedi'}</p>
            </div>
            <ul className="mt-4 space-y-2">
              {(tier.perks || []).map((perk: string) => (
                <li key={perk} className="flex items-start gap-2 text-xs font-semibold leading-5 text-zinc-300">
                  <Check size={13} className="mt-0.5 shrink-0 opacity-70" />
                  {perk}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* SSS */}
      {showFaq && faq.length > 0 && (
      <div className="space-y-2">
        <p className="px-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Sık sorulan sorular</p>
        {faq.map((item: any, i: number) => (
          <div key={i} className="overflow-hidden rounded-[1.25rem] border border-white/[0.07] bg-white/[0.035]">
            <button
              type="button"
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
            >
              <span className="text-sm font-black text-white">{item.q}</span>
              <ChevronDown
                size={16}
                className={cn('shrink-0 text-zinc-500 transition-transform duration-200', openFaq === i && 'rotate-180')}
              />
            </button>
            <AnimatePresence>
              {openFaq === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <p className="border-t border-white/[0.06] px-4 py-3 text-xs font-medium leading-6 text-zinc-500">{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
      )}

      {/* Başvuru Formu */}
      {formActive && (
      <div className="rounded-[1.6rem] border border-amber-300/15 bg-amber-300/[0.06] p-4 md:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/15 text-amber-300">
            <Crown size={20} />
          </div>
          <div>
            <p className="text-base font-black text-white">{formTitle}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-600">Ekibimiz size ulaşacak</p>
          </div>
        </div>
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 size={36} className="text-emerald-400" />
            <p className="text-base font-black text-white">Başvurunuz alındı!</p>
            <p className="text-xs font-medium text-zinc-500">{formSuccessMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Kullanıcı adı *"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="h-12 w-full rounded-2xl border border-white/[0.07] bg-black/30 px-4 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-[#d4af37]/60"
                required
              />
              <input
                type="text"
                placeholder="Ad Soyad"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-12 w-full rounded-2xl border border-white/[0.07] bg-black/30 px-4 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-[#d4af37]/60"
              />
              <input
                type="email"
                placeholder="E-posta"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-12 w-full rounded-2xl border border-white/[0.07] bg-black/30 px-4 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-[#d4af37]/60"
              />
              <input
                type="tel"
                placeholder="Telefon"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-12 w-full rounded-2xl border border-white/[0.07] bg-black/30 px-4 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-[#d4af37]/60"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#d4af37] to-[#9a701a] text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_14px_35px_rgba(212,175,55,.22)] transition active:scale-[0.98] disabled:opacity-60"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {formButtonText}
            </button>
          </form>
        )}
      </div>
      )}
    </div>
  );
}


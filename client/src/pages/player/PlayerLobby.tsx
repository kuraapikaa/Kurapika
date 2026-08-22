import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Crown,
  Gift,
  Loader2,
  Phone,
  Send,
  ShieldCheck,
  Star,
  Trophy,
  User,
  XCircle,
  Zap,
} from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { bonusPanelApi, formsApi, gamesApi, loyaltyApi, tournamentApi } from '@/api/client';
import { LobiDurumSeridi } from '@/components/player/LobiDurumSeridi';
import { LobiKartAkisi } from '@/components/player/LobiKartAkisi';
import { fetchGamesConfigCached, readCachedGamesConfig } from '@/lib/lobbyConfigCache';
import { useOtomatikOturum } from '@/lib/useParentUsername';
import { cn } from '@/lib/utils';
import { normalizeLobbyPalette } from '@/lib/lobbyTheme';
import { sadakatIlerlemesi } from '@/lib/sadakatIlerlemesi';
import { yeniTamamlananlar, type DuyurulacakGorev } from '@/lib/gorevBildirimi';

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
  { id: 'wheel', label: 'Şans Çarkı', desc: 'Çevir, ödül kazan', to: '/cark', icon: 'zap', accentColor: '#eed9a3', enabled: true },
  { id: 'scratch', label: 'Kazı Kazan', desc: 'Kartını kazı', to: '/kazi-kazan', icon: 'sparkles', accentColor: '#5fd6a7', enabled: true },
  { id: 'prediction', label: 'Skor Tahmin', desc: 'Maç skoru bil', to: '/skor-tahmin', icon: 'goal', accentColor: '#6ee7b7', enabled: true },
  { id: 'daily-tasks', label: 'Günlük Görevler', desc: 'API ilerleme', to: '/gorevler', icon: 'list-checks', accentColor: '#e7c574', enabled: true },  { id: 'tournament', label: 'Turnuva', desc: 'Sıralamaya gir', to: '/turnuva/gunluk', icon: 'trophy', accentColor: '#d3a952', enabled: true },
  { id: 'loyalty', label: 'Sadakat', desc: 'XP ve ödüller', to: '/sadakat', icon: 'star', accentColor: '#d3a952', enabled: true },
  { id: 'millionaires', label: 'Milyonerler', desc: 'Büyük kazançlar', to: '/milyonerler', icon: 'crown', accentColor: '#d3a952', enabled: true },
  { id: 'vip', label: 'VIP', desc: 'Özel üyelik', to: '/vip', icon: 'shield', accentColor: '#eed9a3', enabled: true },
  { id: 'partner', label: 'İş Birliği', desc: 'Partner ol', to: '/ortaklik', icon: 'handshake', accentColor: '#e7c574', enabled: true },
  { id: 'call-me', label: 'Beni Ara', desc: '7/24 destek', to: '/beni-ara', icon: 'phone', accentColor: '#e7c574', enabled: true },
];


/**
 * Ağ isteği gelmeden önceki ilk kare — `LobbyDesignManager`daki "Gold"
 * hazır temasıyla BİREBİR AYNI olmalı (bkz. `lobbyTheme.ts`
 * `DEFAULT_LOBBY_PALETTE` üzerindeki not). Eskiden buradaki degerler
 * gercek "gold" temasindan farkliydi (ozellikle yesil accentColor) ve
 * sayfa acilista once bu yanlis renklerle, sonra dogru altin temayla
 * boyaniyordu — bildirilen "once eski skin sonra gold" hatasi buydu.
 */
const DEFAULT_LOBBY_THEME: LobbyTheme = {
  themePreset: 'gold',
  primaryColor: '#f59e0b',
  secondaryColor: '#eab308',
  accentColor: '#fde68a',
  backgroundColor: '#090805',
  surfaceColor: '#171207',
  textColor: '#fff7ed',
  mutedTextColor: '#d6c59b',
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
        { id: 'daily', label: 'Günlük', period: '24 saat', prizeFallback: '50.000', to: '/turnuva/gunluk', icon: 'zap', accentColor: '#d3a952', enabled: true },
        { id: 'weekly', label: 'Haftalık', period: '7 gün', prizeFallback: '250.000', to: '/turnuva/haftalik', icon: 'star', accentColor: '#e7c574', enabled: true },
        { id: 'monthly', label: 'Aylık', period: '30 gün', prizeFallback: '500.000', to: '/turnuva/aylik', icon: 'trophy', accentColor: '#eed9a3', enabled: true }
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
      infoAccentColor: '#e7c574',
      cards: [
        { id: 'call', title: 'Sizi arayalım', desc: 'Destek için numaranızı bırakın.', to: '/beni-ara', icon: 'phone', accentColor: '#e7c574', enabled: true },
        { id: 'partner', title: 'İş birliği', desc: 'Yayıncı ve reklam başvurusu.', to: '/ortaklik', icon: 'handshake', accentColor: '#d3a952', enabled: true }
      ]
    }
  }
};

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
    // Eski kayitli yapilandirmalar rengi ada gore tutuyordu. Adlar korunuyor
    // ama karsiliklari yeni altin/yesil sistemine cekildi; aksi halde eski
    // kayitlar sayfaya mavi/pembe lekeler olarak geri geliyordu.
    const legacyAccentMap: Record<string, string> = {
      rose: '#e7c574',
      purple: '#d3a952',
      fuchsia: '#5fd6a7',
      emerald: '#5fd6a7',
      amber: '#eed9a3',
      sky: '#e7c574'
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
  // Renkler admin panelindeki "Lobi Renkleri"nden gelir. Daha önce bu alanlar
  // sabit varsayılana bağlıydı, bu yüzden paneldeki renk seçicileri hiçbir işe
  // yaramıyordu; artık kayıtlı config okunuyor (geçersiz/boş değerde varsayılan).
  const palette = normalizeLobbyPalette(config);
  return {
    themePreset: asText(config?.themePreset, 'gold'),
    primaryColor: palette.primaryColor,
    secondaryColor: palette.secondaryColor,
    accentColor: palette.accentColor,
    backgroundColor: palette.backgroundColor,
    surfaceColor: palette.surfaceColor,
    textColor: palette.textColor,
    mutedTextColor: palette.mutedTextColor,
    backgroundImageUrl: palette.backgroundImageUrl,
    backgroundOverlay: palette.backgroundOverlay,
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
  // `settings` yalnizca YAZILIYOR: turnuva sekmesi kaldirilinca okuyani
  // kalmadi. Cagri korunuyor cunku ayni istek lobiConfig'i de tazeliyor.
  const [, setSettings] = useState<any>(null);
  const [loyalty, setLoyalty] = useState<any>(null);
  // İlk kareyi son bilinen yapılandırmayla boya: aksi halde lobi önce
  // varsayılan tasarımla açılıp yanıt gelince yeniden boyanıyor (flash).
  const [lobbyConfig, setLobbyConfig] = useState<any>(
    () => readCachedGamesConfig()?.data?.lobby ?? null
  );
  const [activeLobbyTab, setActiveLobbyTab] = useState<LobbyTabId>('games');

  // Kazanan adlari yalnizca ILK HARF + maske. Onceden ad govdesi aciktaydi
  // ("Ahmet***"); ayni ilk isim + oyun + tutar birlesimi taniyan biri icin
  // kimlik ipucu veriyordu. Tek harf hem oyuncuyu gizliyor hem seridin
  // "gercek insanlar kazaniyor" hissini koruyor.
  // Tamamlanan gunluk gorevler lobiye girildiginde bir kez duyurulur.
  // Duyurulmus olanlarin kaydi tarayicida (bkz. gorevBildirimi).
  const [gorevBildirimleri, setGorevBildirimleri] = useState<DuyurulacakGorev[]>([]);
  useEffect(() => {
    if (!activeUser) return;
    let iptal = false;
    gamesApi.dailyTasksStatus()
      .then((res: any) => {
        if (iptal || !res?.ok) return;
        const veri = res.data || {};
        const yeni = yeniTamamlananlar(String(veri.dateKey || ''), veri.tasks || []);
        if (yeni.length > 0) setGorevBildirimleri(yeni);
      })
      .catch(() => { /* gorev servisi dususe lobi calismaya devam etsin */ });
    return () => { iptal = true; };
  }, [activeUser]);


  // Ana sitede giriş yapmış oyuncunun kimliği (iframe -> postMessage).
  // Panel oturumunu da kurduğu için lobide artık kullanıcı adı sorulmuyor.
  const { username: otoAd } = useOtomatikOturum();
  useEffect(() => {
    if (!otoAd) return;
    setActiveUser(otoAd);
    setUserStatus('success');
    setUsername(otoAd);
    try { localStorage.setItem('saved_username', otoAd); } catch { /* depolama kapalı */ }
  }, [otoAd]);

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
    fetchGamesConfigCached().then((res: any) => {
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
    <div
      className="narcos-lobby relative min-h-screen overflow-x-hidden pb-[68px] font-lobby md:pb-6"
      style={{ ...rootStyle, backgroundColor: lobbyTheme.backgroundColor, color: lobbyTheme.textColor }}
    >
      {/* Izgara dokusu kaldirildi; derinlik yalnizca tepedeki altin haleden
          geliyor (alt sayfalarla ayni karar, bkz. LobbyPageShell). */}
      <div className="pointer-events-none fixed inset-0" style={backgroundStyle} />

      <header
        className="sticky top-0 z-30 border-b"
        style={{
          borderColor: hexToRgba(lobbyTheme.textColor, 0.07),
          backgroundColor: hexToRgba(lobbyTheme.backgroundColor, 0.82)
        }}
      >
        <div className="mx-auto flex h-13 w-full max-w-[1400px] items-center justify-between gap-3 px-3 py-2 sm:px-5 md:h-14 md:px-7">
          <Link to="/lobi" className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border md:h-9 md:w-9"
              style={{
                borderColor: hexToRgba(lobbyTheme.primaryColor, 0.26),
                backgroundColor: hexToRgba(lobbyTheme.primaryColor, 0.14),
                color: lobbyTheme.primaryColor
              }}
            >
              <Zap size={17} className="fill-current" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-black uppercase leading-none tracking-[-0.02em] md:text-[15px]" style={{ color: lobbyTheme.textColor }}>
                Ödül Merkezi
              </span>
              <span className="mt-1 flex items-center gap-1.5 text-[9px] font-bold uppercase leading-none tracking-[0.14em]" style={{ color: lobbyTheme.mutedTextColor }}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,.8)]" />
                Canlı
              </span>
            </span>
          </Link>

          <div className="flex min-w-0 items-center gap-2">
            {activeUser && (
              <div className="hidden min-w-0 items-center gap-1.5 rounded-full border border-[rgba(243,236,221,0.08)] bg-[rgba(243,236,221,0.05)] py-1 pl-1 pr-2.5 sm:flex">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: hexToRgba(lobbyTheme.primaryColor, 0.18), color: lobbyTheme.primaryColor }}
                >
                  <User size={13} />
                </span>
                <span className="truncate text-[11px] font-black uppercase tracking-tight text-[color:var(--lobby-text,#f3ecdd)]">{activeUser}</span>
                <span className="h-3 w-px bg-[rgba(243,236,221,0.10)]" />
                <span className="whitespace-nowrap text-[11px] font-black tabular-nums text-emerald-300">
                  ₺{loyalty?.balance?.toLocaleString('tr-TR') || '0'}
                </span>
                {loyalty && (
                  <>
                    <span className="h-3 w-px bg-[rgba(243,236,221,0.10)]" />
                    <span className="whitespace-nowrap text-[11px] font-black tabular-nums text-amber-300">LVL {loyalty.level}</span>
                  </>
                )}
              </div>
            )}
            <button
              type="button"
              aria-label="Bildirimler"
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[rgba(243,236,221,0.08)] bg-[rgba(243,236,221,0.045)] text-[color:var(--lobby-muted,#8f8674)] transition hover:text-[color:var(--lobby-text,#f3ecdd)] md:h-9 md:w-9"
            >
              <Bell size={16} />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: lobbyTheme.accentColor }} />
            </button>
            {activeUser && (
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Çıkış yap"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-rose-300/12 bg-rose-400/10 text-rose-300 transition hover:bg-rose-400/20 md:h-9 md:w-9"
              >
                <XCircle size={16} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col gap-3.5 px-3 py-3.5 sm:px-5 md:gap-4 md:px-7 md:py-5">
        {!activeUser && (
          <section className="cam p-3 md:p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-[rgba(243,236,221,0.06)] bg-black/25 px-3 py-2">
                <span className="shrink-0 text-[color:var(--lobby-muted,#8f8674)]">
                  {checking ? <Loader2 size={17} className="animate-spin" style={{ color: lobbyTheme.primaryColor }} /> : <User size={17} />}
                </span>
                <div className="min-w-0 flex-1">
                  <label htmlFor="lobby-username" className="block text-[9px] font-black uppercase leading-none tracking-[0.16em] text-[color:var(--lobby-muted,#8f8674)]">
                    Oyuncu doğrulama
                  </label>
                  <input
                    id="lobby-username"
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && handleCheck()}
                    className="mt-1 w-full border-0 bg-transparent p-0 text-sm font-black leading-none text-[color:var(--lobby-text,#f3ecdd)] outline-none placeholder:text-[color:var(--lobby-muted,#8f8674)] focus:ring-0"
                    placeholder="Kullanıcı adınız"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleCheck}
                disabled={!username.trim() || checking}
                className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--lobby-text,#f3ecdd)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
                style={{
                  background: `linear-gradient(90deg, ${lobbyTheme.primaryColor}, ${lobbyTheme.secondaryColor})`,
                  boxShadow: `0 8px 22px ${hexToRgba(lobbyTheme.primaryColor, 0.26)}`
                }}
              >
                {checking ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                Giriş yap
              </button>
            </div>
            {statusMessage && (
              <p className="mt-2 rounded-xl border border-rose-300/15 bg-rose-400/10 px-3 py-1.5 text-[11px] font-bold text-rose-200">
                {statusMessage}
              </p>
            )}
          </section>
        )}

        <GorevBildirimPaneli
          gorevler={gorevBildirimleri}
          theme={lobbyTheme}
          onKapat={() => setGorevBildirimleri([])}
        />

        {activeUser && <LobbyWelcome theme={lobbyTheme} username={activeUser} loyalty={loyalty} />}

        {/* Oyuncunun kendi turnuva sirasi ve gunluk gorev ilerlemesi.
            Onceden ikisi de yalnizca birer bagdi; oyuncu kacinci oldugunu
            gormek icin sayfayi acmak zorundaydi. */}
        {activeUser && <LobiDurumSeridi username={activeUser} />}

        {/*
          KART AKISI.

          Sekmeli yapinin ("Hizli Erisim / Turnuva / Destek") ve buyuk
          hero banner'in yerini aldi. Oyuncu ne yapabilecegini sekme
          gezmeden, tek kaydirmada goruyor.

          Kart listesi lobiConfig'ten geliyor: panelden kapatilan bir
          kisayol burada da kayboluyor.
        */}
        <LobiKartAkisi
          kartlar={visibleQuickAccess}
          vurguRengi={lobbyTheme.primaryColor}
          metinRengi={lobbyTheme.textColor}
          sonukRenk={lobbyTheme.mutedTextColor}
        />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 md:hidden"
        style={{
          borderColor: hexToRgba(lobbyTheme.textColor, 0.08),
          backgroundColor: hexToRgba(lobbyTheme.surfaceColor, 0.94)
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

/**
 * Giris yapmis oyuncunun karsilama blogu (mockup: "Hos geldin" + bakiye/sadakat).
 *
 * Selamlama saate gore degisiyor; sabit bir "Hos geldin" yerine gunun saatini
 * kullanmak ekrani canli tutuyor ve mockup'in davranisi da bu.
 *
 * Sadakat ilerlemesi gercek veriden hesaplaniyor. Sunucudaki formul
 * level = floor(xp/1000)+1, yani seviye basina 1000 XP: ilerleme xp%1000,
 * kalan 1000-(xp%1000). Mockup'taki %62 / 1.900 XP degerleri temsiliydi.
 */
/**
 * Tamamlanan gorev bildirimi.
 *
 * Modal degil, sayfanin ustunde duran bir serit: lobiye giren oyuncunun
 * onune engel cikarmadan haber veriyor. Modal olsaydi her girisde
 * kapatilmasi gereken bir adim eklerdi.
 *
 * Odul "al" akisi bilerek burada degil — bildirim haber verir, islem
 * Gorevler sayfasinda yapilir; iki yerde ayni akisi tutmak ikisini de
 * bozulmaya acik hale getirirdi.
 */
function GorevBildirimPaneli({
  gorevler,
  theme,
  onKapat,
}: {
  gorevler: DuyurulacakGorev[];
  theme: LobbyTheme;
  onKapat: () => void;
}) {
  if (gorevler.length === 0) return null;
  const cogul = gorevler.length > 1;

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      role="status"
      aria-live="polite"
      className="relative flex flex-wrap items-center gap-3 rounded-xl border p-3.5 md:p-4"
      style={{
        borderColor: hexToRgba(theme.accentColor, 0.3),
        backgroundColor: hexToRgba(theme.accentColor, 0.08),
      }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: hexToRgba(theme.accentColor, 0.16), color: theme.accentColor }}
      >
        <CheckCircle2 size={20} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-black" style={{ color: theme.textColor }}>
          {cogul ? `${gorevler.length} görev tamamlandı` : 'Görev tamamlandı'}
        </p>
        <p className="mt-0.5 truncate text-[12px] font-semibold" style={{ color: theme.mutedTextColor }}>
          {gorevler.map((g) => g.title).join(' · ')}
        </p>
      </div>

      <Link
        to="/gorevler"
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-4 text-[11px] font-black uppercase tracking-[0.12em]"
        style={{
          background: `linear-gradient(120deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
          color: '#171204',
        }}
      >
        Ödülü al
        <ChevronRight size={14} />
      </Link>

      <button
        type="button"
        onClick={onKapat}
        aria-label="Bildirimi kapat"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition"
        style={{ color: theme.mutedTextColor }}
      >
        <XCircle size={16} />
      </button>
    </motion.section>
  );
}

function LobbyWelcome({ theme, username, loyalty }: { theme: LobbyTheme; username: string; loyalty: any }) {
  const saat = new Date().getHours();
  const selam = saat < 6 ? 'İyi geceler' : saat < 12 ? 'Günaydın' : saat < 18 ? 'İyi günler' : 'İyi akşamlar';

  const { seviye, yuzde, kalan } = sadakatIlerlemesi(loyalty?.xp, loyalty?.level);

  return (
    <section className="flex flex-wrap items-stretch gap-3.5 md:gap-4">
      <div
        className="flex min-w-[280px] flex-[2] flex-col justify-center rounded-[20px] border p-6 md:p-7"
        style={{
          borderColor: hexToRgba(theme.primaryColor, 0.22),
          background: `linear-gradient(120deg, ${hexToRgba(theme.primaryColor, 0.1)}, ${hexToRgba(theme.surfaceColor, 0.7)} 50%, ${hexToRgba(theme.backgroundColor, 0.4)})`,
        }}
      >
        <p
          className="text-[11px] font-bold uppercase leading-none tracking-[0.2em]"
          style={{ color: hexToRgba(theme.primaryColor, 0.85) }}
        >
          {selam}
        </p>
        <h1
          className="mt-2.5 text-[24px] font-extrabold leading-[1.08] tracking-[-0.02em] md:text-[30px]"
          style={{ color: theme.textColor }}
        >
          {username}, bugün seni ne bekliyor?
        </h1>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link
            to="/bonus-talep"
            className="inline-flex h-11 items-center gap-2 rounded-xl px-5 text-[13px] font-extrabold tracking-[0.03em] transition active:scale-[0.98]"
            style={{
              background: `linear-gradient(120deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
              color: '#1a1508',
            }}
          >
            Bonus talep et
            <ChevronRight size={15} />
          </Link>
          <Link
            to="/cark"
            className="inline-flex h-11 items-center gap-2 rounded-xl border px-5 text-[13px] font-bold transition active:scale-[0.98]"
            style={{
              borderColor: hexToRgba(theme.textColor, 0.14),
              backgroundColor: hexToRgba(theme.textColor, 0.05),
              color: theme.textColor,
            }}
          >
            Çarkı çevir
          </Link>
        </div>
      </div>

      <div
        className="flex min-w-[260px] flex-1 flex-col justify-center gap-4 rounded-[20px] border p-5 md:p-6"
        style={{
          borderColor: hexToRgba(theme.textColor, 0.08),
          backgroundColor: hexToRgba(theme.textColor, 0.03),
        }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span
            className="text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: theme.mutedTextColor }}
          >
            Bakiye
          </span>
          <span
            className="text-[22px] font-extrabold tabular-nums tracking-[-0.02em] md:text-[24px]"
            style={{ color: theme.accentColor }}
          >
            ₺{Number(loyalty?.balance ?? 0).toLocaleString('tr-TR')}
          </span>
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <span
              className="text-[11px] font-bold uppercase tracking-[0.16em]"
              style={{ color: theme.mutedTextColor }}
            >
              Sadakat · Seviye {seviye}
            </span>
            <span className="text-[12px] font-bold tabular-nums" style={{ color: theme.primaryColor }}>
              %{yuzde}
            </span>
          </div>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: hexToRgba(theme.textColor, 0.08) }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${yuzde}%`,
                background: `linear-gradient(90deg, ${theme.secondaryColor}, ${theme.primaryColor})`,
              }}
            />
          </div>
          <p className="mt-2 text-[12px] font-medium" style={{ color: theme.mutedTextColor }}>
            Seviye {seviye + 1} için {kalan.toLocaleString('tr-TR')} XP kaldı
          </p>
        </div>
      </div>
    </section>
  );
}

function BottomNav({ to, icon: Icon, label, active = false, accentColor = '#e7c574' }: { to: string; icon: any; label: string; active?: boolean; accentColor?: string }) {
  return (
    <Link
      to={to}
      className={cn('flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[9px] font-black uppercase tracking-[0.06em] transition', active ? '' : 'text-[color:var(--lobby-muted,#8f8674)]')}
      style={active ? { backgroundColor: hexToRgba(accentColor, 0.16), color: accentColor } : undefined}
    >
      <Icon size={17} />
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
    color: 'from-[rgba(243,236,221,0.2)] border-[rgba(243,236,221,0.25)] text-[color:var(--lobby-text,#f3ecdd)]',
    iconColor: 'bg-[rgba(243,236,221,0.1)] border-[rgba(243,236,221,0.2)] text-[color:var(--lobby-text,#f3ecdd)]',
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

  const [vipConfig, setVipConfig] = useState<any>(
    () => readCachedGamesConfig()?.data?.vip ?? null
  );
  useEffect(() => {
    fetchGamesConfigCached().then((res: any) => {
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
        <h2 className="mt-3 text-2xl font-black tracking-[-0.05em] text-[color:var(--lobby-text,#f3ecdd)] md:text-3xl">{title}</h2>
        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--lobby-muted,#8f8674)]">{description}</p>
      </div>

      {/* İstatistikler */}
      {showStats && (
      <div className="grid grid-cols-4 gap-2">
        {stats.map((stat: any) => (
          <div key={stat.label} className="cam p-3 text-center">
            <p className="text-lg font-black tracking-[-0.04em] text-[color:var(--lobby-text,#f3ecdd)] md:text-2xl">{stat.value}</p>
            <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[color:var(--lobby-muted,#8f8674)]">{stat.label}</p>
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
              <div className="absolute right-3 top-3 rounded-full bg-amber-300 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#171204]">
                Popüler
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-2xl', tier.iconColor)}>
                {tier.badge}
              </div>
              <div>
                <p className="text-base font-black tracking-[-0.03em] text-[color:var(--lobby-text,#f3ecdd)]">{tier.label}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-50">{tier.sublabel}</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-[rgba(243,236,221,0.06)] bg-black/20 px-3 py-2">
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[color:var(--lobby-muted,#8f8674)]">Minimum yatırım</p>
              <p className="mt-0.5 text-xs font-black text-[color:var(--lobby-text,#f3ecdd)]">{tier.minDeposit || 'Belirtilmedi'}</p>
            </div>
            <ul className="mt-4 space-y-2">
              {(tier.perks || []).map((perk: string) => (
                <li key={perk} className="flex items-start gap-2 text-xs font-semibold leading-5 text-[color:var(--lobby-text,#f3ecdd)]">
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
        <p className="px-1 text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--lobby-muted,#8f8674)]">Sık sorulan sorular</p>
        {faq.map((item: any, i: number) => (
          <div key={i} className="cam overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
            >
              <span className="text-sm font-black text-[color:var(--lobby-text,#f3ecdd)]">{item.q}</span>
              <ChevronDown
                size={16}
                className={cn('shrink-0 text-[color:var(--lobby-muted,#8f8674)] transition-transform duration-200', openFaq === i && 'rotate-180')}
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
                  <p className="border-t border-[rgba(243,236,221,0.06)] px-4 py-3 text-xs font-medium leading-6 text-[color:var(--lobby-muted,#8f8674)]">{item.a}</p>
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
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-400/15 text-amber-300">
            <Crown size={20} />
          </div>
          <div>
            <p className="text-base font-black text-[color:var(--lobby-text,#f3ecdd)]">{formTitle}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--lobby-muted,#8f8674)]">Ekibimiz size ulaşacak</p>
          </div>
        </div>
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 size={36} className="text-emerald-400" />
            <p className="text-base font-black text-[color:var(--lobby-text,#f3ecdd)]">Başvurunuz alındı!</p>
            <p className="text-xs font-medium text-[color:var(--lobby-muted,#8f8674)]">{formSuccessMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Kullanıcı adı *"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="h-12 w-full rounded-xl border border-[rgba(243,236,221,0.07)] bg-black/30 px-4 text-sm font-bold text-[color:var(--lobby-text,#f3ecdd)] outline-none placeholder:text-[color:var(--lobby-muted,#8f8674)] focus:border-[color:var(--lobby-primary,#e7c574)]/60"
                required
              />
              <input
                type="text"
                placeholder="Ad Soyad"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-12 w-full rounded-xl border border-[rgba(243,236,221,0.07)] bg-black/30 px-4 text-sm font-bold text-[color:var(--lobby-text,#f3ecdd)] outline-none placeholder:text-[color:var(--lobby-muted,#8f8674)] focus:border-[color:var(--lobby-primary,#e7c574)]/60"
              />
              <input
                type="email"
                placeholder="E-posta"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-12 w-full rounded-xl border border-[rgba(243,236,221,0.07)] bg-black/30 px-4 text-sm font-bold text-[color:var(--lobby-text,#f3ecdd)] outline-none placeholder:text-[color:var(--lobby-muted,#8f8674)] focus:border-[color:var(--lobby-primary,#e7c574)]/60"
              />
              <input
                type="tel"
                placeholder="Telefon"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-12 w-full rounded-xl border border-[rgba(243,236,221,0.07)] bg-black/30 px-4 text-sm font-bold text-[color:var(--lobby-text,#f3ecdd)] outline-none placeholder:text-[color:var(--lobby-muted,#8f8674)] focus:border-[color:var(--lobby-primary,#e7c574)]/60"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-xs font-extrabold uppercase tracking-[0.16em] transition active:scale-[0.98] disabled:opacity-60"
              style={{
                // VIPTab bagimsiz bir bilesen; temayi kok elemanin CSS
                // degiskenlerinden okuyor (LobbyPageShell/PlayerLobby set eder).
                background: 'linear-gradient(120deg, var(--lobby-primary, #e7c574), var(--lobby-secondary, #d3a952))',
                color: '#171204',
              }}
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


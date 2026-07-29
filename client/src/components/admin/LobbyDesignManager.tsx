import type { CSSProperties, ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Crown,
  Gift,
  Goal,
  Handshake,
  Image,
  Layers,
  Link2,
  ListChecks,
  MonitorSmartphone,
  Palette,
  Phone,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Zap,
  type LucideIcon
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  DEFAULT_LOBBY_PAGE_CONTENTS,
  LOBBY_PAGE_EXTRA_FIELDS,
  LOBBY_PAGE_ORDER,
  normalizeLobbyPages,
  type LobbyPageContent,
  type LobbyPageId
} from '../../lib/lobbyContent';

type LobbyBannerConfig = {
  enabled: boolean;
  imageUrl: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  linkUrl: string;
};

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

export type LobbyDesignConfig = {
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
  banner: LobbyBannerConfig;
  quickAccess: LobbyQuickAccessItem[];
  tabs: LobbyTabsConfig;
  pages: Record<LobbyPageId, LobbyPageContent>;
};

type LobbyDesignManagerProps = {
  config?: Partial<LobbyDesignConfig>;
  onUpdate: (config: LobbyDesignConfig) => void;
};

const DEFAULT_QUICK_ACCESS_ITEMS: LobbyQuickAccessItem[] = [
  { id: 'bonus', label: 'Bonus Talep', desc: 'Kampanya ve freespin', to: '/bonus-talep', icon: 'gift', accentColor: '#fb7185', enabled: true },
  { id: 'wheel', label: 'Şans Çarkı', desc: 'Çevir, ödül kazan', to: '/cark', icon: 'zap', accentColor: '#60a5fa', enabled: true },
  { id: 'scratch', label: 'Kazı Kazan', desc: 'Kartını kazı', to: '/kazi-kazan', icon: 'sparkles', accentColor: '#5eead4', enabled: true },
  { id: 'prediction', label: 'Skor Tahmin', desc: 'Maç skoru bil', to: '/skor-tahmin', icon: 'goal', accentColor: '#6ee7b7', enabled: true },
  { id: 'daily-tasks', label: 'Günlük Görevler', desc: 'API ilerleme', to: '/gorevler', icon: 'list-checks', accentColor: '#7dd3fc', enabled: true },  { id: 'tournament', label: 'Turnuva', desc: 'Sıralamaya gir', to: '/turnuva/gunluk', icon: 'trophy', accentColor: '#38bdf8', enabled: true },
  { id: 'loyalty', label: 'Sadakat', desc: 'XP ve ödüller', to: '/sadakat', icon: 'star', accentColor: '#38bdf8', enabled: true },
  { id: 'millionaires', label: 'Milyonerler', desc: 'Büyük kazançlar', to: '/milyonerler', icon: 'crown', accentColor: '#38bdf8', enabled: true },
  { id: 'vip', label: 'VIP', desc: 'Özel üyelik', to: '/vip', icon: 'shield', accentColor: '#60a5fa', enabled: true },
  { id: 'partner', label: 'İş Birliği', desc: 'Partner ol', to: '/ortaklik', icon: 'handshake', accentColor: '#7dd3fc', enabled: true },
  { id: 'call-me', label: 'Beni Ara', desc: '7/24 destek', to: '/beni-ara', icon: 'phone', accentColor: '#7dd3fc', enabled: true },
];

const DEDICATED_CONTENT_OWNER: Partial<Record<LobbyPageId, string>> = {
  prediction: 'Skor Tahmin Yönetimi başlık, açıklama ve maç içeriklerinde önceliklidir.',
  'daily-tasks': 'Günlük Görevler ayarları görev başlığı ve açıklamasında önceliklidir.',
  'battle-pass': 'Sezon Kartı ayarları sezon başlığı ve açıklamasında önceliklidir.',
  millionaires: 'Kazanç Vitrini ayarları hero başlığı, açıklaması ve CTA metninde önceliklidir.',
  vip: 'VIP Ayarları hero, form, kademe ve SSS içeriklerinde önceliklidir.',
  partner: 'Form Ayarları ortaklık başlığı, açıklaması, başarı mesajı ve butonunda önceliklidir.',
  'call-me': 'Form Ayarları beni ara başlığı, açıklaması, başarı mesajı ve butonunda önceliklidir.'
};

const QUICK_ACCESS_ICON_OPTIONS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: 'gift', label: 'Hediye', icon: Gift },
  { value: 'zap', label: 'Şimşek', icon: Zap },
  { value: 'sparkles', label: 'Parıltı', icon: Sparkles },
  { value: 'goal', label: 'Hedef', icon: Goal },
  { value: 'list-checks', label: 'Liste', icon: ListChecks },
  { value: 'layers', label: 'Katman', icon: Layers },
  { value: 'trophy', label: 'Kupa', icon: Trophy },
  { value: 'star', label: 'Yıldız', icon: Star },
  { value: 'crown', label: 'Taç', icon: Crown },
  { value: 'shield', label: 'Kalkan', icon: ShieldCheck },
  { value: 'handshake', label: 'El sıkışma', icon: Handshake },
  { value: 'phone', label: 'Telefon', icon: Phone },
];

const LOBBY_THEME_PRESETS = [
  {
    id: 'purple',
    label: 'Mor',
    primaryColor: '#3b82f6',
    secondaryColor: '#ec4899',
    accentColor: '#22d3ee',
    backgroundColor: '#05060a',
    surfaceColor: '#0b0d13',
    textColor: '#ffffff',
    mutedTextColor: '#a1a1aa'
  },
  {
    id: 'gold',
    label: 'Gold',
    primaryColor: '#f59e0b',
    secondaryColor: '#eab308',
    accentColor: '#fde68a',
    backgroundColor: '#090805',
    surfaceColor: '#171207',
    textColor: '#fff7ed',
    mutedTextColor: '#d6c59b'
  },
  {
    id: 'blue',
    label: 'Mavi',
    primaryColor: '#38bdf8',
    secondaryColor: '#2563eb',
    accentColor: '#93c5fd',
    backgroundColor: '#030712',
    surfaceColor: '#071426',
    textColor: '#f8fafc',
    mutedTextColor: '#94a3b8'
  },
  {
    id: 'green',
    label: 'Yeşil',
    primaryColor: '#22c55e',
    secondaryColor: '#14b8a6',
    accentColor: '#86efac',
    backgroundColor: '#03110a',
    surfaceColor: '#071a12',
    textColor: '#f0fdf4',
    mutedTextColor: '#9bc8aa'
  },
  {
    id: 'red',
    label: 'Kırmızı',
    primaryColor: '#ef4444',
    secondaryColor: '#f97316',
    accentColor: '#fecaca',
    backgroundColor: '#120506',
    surfaceColor: '#1f0a0c',
    textColor: '#fff1f2',
    mutedTextColor: '#d6a3a8'
  },
  {
    id: 'night',
    label: 'Gece',
    primaryColor: '#64748b',
    secondaryColor: '#0f172a',
    accentColor: '#67e8f9',
    backgroundColor: '#020617',
    surfaceColor: '#0f172a',
    textColor: '#f8fafc',
    mutedTextColor: '#94a3b8'
  }
];

const DEFAULT_LOBBY_CONFIG: LobbyDesignConfig = {
  themePreset: 'purple',
  primaryColor: '#3b82f6',
  secondaryColor: '#ec4899',
  accentColor: '#22d3ee',
  backgroundColor: '#05060a',
  surfaceColor: '#0b0d13',
  textColor: '#ffffff',
  mutedTextColor: '#a1a1aa',
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
  pages: DEFAULT_LOBBY_PAGE_CONTENTS,
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
        { id: 'daily', label: 'Günlük', period: '24 saat', prizeFallback: '50.000', to: '/turnuva/gunluk', icon: 'zap', accentColor: '#38bdf8', enabled: true },
        { id: 'weekly', label: 'Haftalık', period: '7 gün', prizeFallback: '250.000', to: '/turnuva/haftalik', icon: 'star', accentColor: '#7dd3fc', enabled: true },
        { id: 'monthly', label: 'Aylık', period: '30 gün', prizeFallback: '500.000', to: '/turnuva/aylik', icon: 'trophy', accentColor: '#60a5fa', enabled: true }
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
      infoAccentColor: '#60a5fa',
      cards: [
        { id: 'call', title: 'Sizi arayalım', desc: 'Destek için numaranızı bırakın.', to: '/beni-ara', icon: 'phone', accentColor: '#7dd3fc', enabled: true },
        { id: 'partner', title: 'İş birliği', desc: 'Yayıncı ve reklam başvurusu.', to: '/ortaklik', icon: 'handshake', accentColor: '#38bdf8', enabled: true }
      ]
    }
  }
};

function clampOverlay(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_LOBBY_CONFIG.backgroundOverlay;
  return Math.min(95, Math.max(0, Math.round(numeric)));
}

function asText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asHexColor(value: unknown, fallback: string) {
  return typeof value === 'string' && isHexColor(value.trim()) ? value.trim() : fallback;
}

function normalizeQuickAccess(items: unknown): LobbyQuickAccessItem[] {
  if (!Array.isArray(items)) return DEFAULT_QUICK_ACCESS_ITEMS;

  return items.map((item, index) => {
    const source = item && typeof item === 'object' ? item as Partial<LobbyQuickAccessItem> : {};
    const fallback = DEFAULT_QUICK_ACCESS_ITEMS[index] || DEFAULT_QUICK_ACCESS_ITEMS[0];

    return {
      id: asText(source.id, fallback.id || `quick-${index + 1}`),
      label: asText(source.label, fallback.label),
      desc: asText(source.desc, fallback.desc),
      to: asText(source.to, fallback.to),
      icon: asText(source.icon, fallback.icon),
      accentColor: asHexColor(source.accentColor, fallback.accentColor),
      enabled: source.enabled !== false
    };
  });
}

function normalizeTournamentCards(items: unknown): LobbyTournamentCardConfig[] {
  const defaults = DEFAULT_LOBBY_CONFIG.tabs.tournaments.cards;
  if (!Array.isArray(items)) return defaults;

  return items.map((item, index) => {
    const source = item && typeof item === 'object' ? item as Partial<LobbyTournamentCardConfig> : {};
    const fallback = defaults[index] || defaults[0];

    return {
      id: asText(source.id, fallback.id || `tournament-${index + 1}`),
      label: asText(source.label, fallback.label),
      period: asText(source.period, fallback.period),
      prizeFallback: asText(source.prizeFallback, fallback.prizeFallback),
      to: asText(source.to, fallback.to),
      icon: asText(source.icon, fallback.icon),
      accentColor: asHexColor(source.accentColor, fallback.accentColor),
      enabled: source.enabled !== false
    };
  });
}

function normalizeSupportCards(items: unknown): LobbySupportCardConfig[] {
  const defaults = DEFAULT_LOBBY_CONFIG.tabs.support.cards;
  if (!Array.isArray(items)) return defaults;

  return items.map((item, index) => {
    const source = item && typeof item === 'object' ? item as Partial<LobbySupportCardConfig> : {};
    const fallback = defaults[index] || defaults[0];

    return {
      id: asText(source.id, fallback.id || `support-${index + 1}`),
      title: asText(source.title, fallback.title),
      desc: asText(source.desc, fallback.desc),
      to: asText(source.to, fallback.to),
      icon: asText(source.icon, fallback.icon),
      accentColor: asHexColor(source.accentColor, fallback.accentColor),
      enabled: source.enabled !== false
    };
  });
}

function normalizeTabs(tabs: unknown): LobbyTabsConfig {
  const source = tabs && typeof tabs === 'object' ? tabs as Partial<LobbyTabsConfig> : {};
  const games = (source.games || {}) as Partial<LobbyTabsConfig['games']>;
  const tournaments = (source.tournaments || {}) as Partial<LobbyTabsConfig['tournaments']>;
  const support = (source.support || {}) as Partial<LobbyTabsConfig['support']>;
  const defaults = DEFAULT_LOBBY_CONFIG.tabs;

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

function withDefaults(config?: Partial<LobbyDesignConfig>): LobbyDesignConfig {
  return {
    ...DEFAULT_LOBBY_CONFIG,
    ...(config || {}),
    backgroundOverlay: clampOverlay(config?.backgroundOverlay),
    quickAccess: normalizeQuickAccess(config?.quickAccess),
    pages: normalizeLobbyPages(config?.pages as Record<string, Partial<LobbyPageContent>> | undefined),
    tabs: normalizeTabs(config?.tabs),
    banner: {
      ...DEFAULT_LOBBY_CONFIG.banner,
      ...(config?.banner || {})
    }
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

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function formatExtraFieldValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.join('\n') : value || '';
}

function parseExtraLines(value: string) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function isLobbyPageId(value: string): value is LobbyPageId {
  return LOBBY_PAGE_ORDER.includes(value as LobbyPageId);
}

function getQuickAccessIcon(icon: string) {
  return QUICK_ACCESS_ICON_OPTIONS.find((option) => option.value === icon)?.icon || Gift;
}

export function LobbyDesignManager({ config, onUpdate }: LobbyDesignManagerProps) {
  const theme = withDefaults(config);

  const updateTheme = (patch: Partial<LobbyDesignConfig>) => {
    onUpdate(withDefaults({ ...theme, ...patch }));
  };

  const applyPreset = (preset: typeof LOBBY_THEME_PRESETS[number]) => {
    updateTheme({
      themePreset: preset.id,
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      accentColor: preset.accentColor,
      backgroundColor: preset.backgroundColor,
      surfaceColor: preset.surfaceColor,
      textColor: preset.textColor,
      mutedTextColor: preset.mutedTextColor
    });
  };

  const updateBanner = (patch: Partial<LobbyBannerConfig>) => {
    onUpdate(withDefaults({
      ...theme,
      banner: {
        ...theme.banner,
        ...patch
      }
    }));
  };

  const updateTab = <T extends keyof LobbyTabsConfig>(tab: T, patch: Partial<LobbyTabsConfig[T]>) => {
    updateTheme({
      tabs: {
        ...theme.tabs,
        [tab]: {
          ...theme.tabs[tab],
          ...patch
        }
      }
    });
  };

  const updateQuickAccess = (index: number, patch: Partial<LobbyQuickAccessItem>) => {
    const quickAccess = theme.quickAccess.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    ));
    const itemId = theme.quickAccess[index]?.id;

    if (typeof patch.to === 'string' && itemId && isLobbyPageId(itemId)) {
      updateTheme({
        quickAccess,
        pages: {
          ...theme.pages,
          [itemId]: {
            ...theme.pages[itemId],
            path: patch.to
          }
        }
      });
      return;
    }

    updateTheme({ quickAccess });
  };

  const updatePage = (pageId: LobbyPageId, patch: Partial<LobbyPageContent>) => {
    updateTheme({
      pages: {
        ...theme.pages,
        [pageId]: {
          ...theme.pages[pageId],
          ...patch
        }
      }
    });
  };

  const updatePagePath = (pageId: LobbyPageId, path: string) => {
    updateTheme({
      quickAccess: theme.quickAccess.map((item) => (
        item.id === pageId ? { ...item, to: path } : item
      )),
      pages: {
        ...theme.pages,
        [pageId]: {
          ...theme.pages[pageId],
          path
        }
      }
    });
  };

  const updatePageExtra = (pageId: LobbyPageId, key: string, value: string | string[]) => {
    updatePage(pageId, {
      extra: {
        ...theme.pages[pageId].extra,
        [key]: value
      }
    });
  };

  const moveQuickAccess = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= theme.quickAccess.length) return;
    const quickAccess = [...theme.quickAccess];
    const [item] = quickAccess.splice(index, 1);
    quickAccess.splice(nextIndex, 0, item);
    updateTheme({ quickAccess });
  };

  const addQuickAccess = () => {
    const nextNumber = theme.quickAccess.length + 1;
    updateTheme({
      quickAccess: [
        ...theme.quickAccess,
        {
          id: `custom-${Date.now()}`,
          label: `Yeni Kart ${nextNumber}`,
          desc: 'Kısa açıklama',
          to: '/lobi',
          icon: 'star',
          accentColor: theme.accentColor,
          enabled: true
        }
      ]
    });
  };

  const removeQuickAccess = (index: number) => {
    updateTheme({
      quickAccess: theme.quickAccess.filter((_, itemIndex) => itemIndex !== index)
    });
  };

  const updateTournamentCard = (index: number, patch: Partial<LobbyTournamentCardConfig>) => {
    const cards = theme.tabs.tournaments.cards.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    ));
    updateTab('tournaments', { cards });
  };

  const moveTournamentCard = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    const cards = [...theme.tabs.tournaments.cards];
    if (nextIndex < 0 || nextIndex >= cards.length) return;
    const [item] = cards.splice(index, 1);
    cards.splice(nextIndex, 0, item);
    updateTab('tournaments', { cards });
  };

  const addTournamentCard = () => {
    updateTab('tournaments', {
      cards: [
        ...theme.tabs.tournaments.cards,
        {
          id: `custom-${Date.now()}`,
          label: 'Yeni Turnuva',
          period: 'Süre',
          prizeFallback: '0',
          to: '/turnuva/gunluk',
          icon: 'trophy',
          accentColor: theme.accentColor,
          enabled: true
        }
      ]
    });
  };

  const removeTournamentCard = (index: number) => {
    updateTab('tournaments', {
      cards: theme.tabs.tournaments.cards.filter((_, itemIndex) => itemIndex !== index)
    });
  };

  const updateSupportCard = (index: number, patch: Partial<LobbySupportCardConfig>) => {
    const cards = theme.tabs.support.cards.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    ));
    updateTab('support', { cards });
  };

  const moveSupportCard = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    const cards = [...theme.tabs.support.cards];
    if (nextIndex < 0 || nextIndex >= cards.length) return;
    const [item] = cards.splice(index, 1);
    cards.splice(nextIndex, 0, item);
    updateTab('support', { cards });
  };

  const addSupportCard = () => {
    updateTab('support', {
      cards: [
        ...theme.tabs.support.cards,
        {
          id: `custom-${Date.now()}`,
          title: 'Yeni Destek Kartı',
          desc: 'Kısa açıklama',
          to: '/beni-ara',
          icon: 'phone',
          accentColor: theme.accentColor,
          enabled: true
        }
      ]
    });
  };

  const removeSupportCard = (index: number) => {
    updateTab('support', {
      cards: theme.tabs.support.cards.filter((_, itemIndex) => itemIndex !== index)
    });
  };

  const pagePreviewStyle: CSSProperties = {
    color: theme.textColor,
    background: theme.backgroundImageUrl
      ? `linear-gradient(${hexToRgba(theme.backgroundColor, theme.backgroundOverlay / 100)}, ${hexToRgba(theme.backgroundColor, theme.backgroundOverlay / 100)}), url("${theme.backgroundImageUrl}") center / cover`
      : `radial-gradient(circle at 16% 0%, ${hexToRgba(theme.primaryColor, 0.28)}, transparent 34%), radial-gradient(circle at 92% 18%, ${hexToRgba(theme.accentColor, 0.18)}, transparent 32%), linear-gradient(180deg, ${theme.backgroundColor}, ${theme.surfaceColor} 58%, ${theme.backgroundColor})`
  };

  const bannerPreviewStyle: CSSProperties = {
    backgroundImage: theme.banner.imageUrl
      ? `linear-gradient(90deg, ${hexToRgba(theme.backgroundColor, 0.7)}, ${hexToRgba(theme.backgroundColor, 0.18)}), url("${theme.banner.imageUrl}")`
      : `linear-gradient(90deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-5">
        <Panel title="Tasarım Önayarları" icon={Palette}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {LOBBY_THEME_PRESETS.map((preset) => {
              const active = theme.themePreset === preset.id;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition',
                    active ? 'border-cyan-300/45 bg-[color:var(--panel-info,#64d2ff)]/[0.08]' : 'border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.035] hover:border-[color:var(--panel-border,rgba(242,244,248,0.1))]'
                  )}
                >
                  <span className="mb-3 flex h-9 items-center gap-1">
                    {[preset.primaryColor, preset.secondaryColor, preset.accentColor].map((color) => (
                      <span key={color} className="h-7 flex-1 rounded-md border border-[color:var(--panel-border,rgba(242,244,248,0.1))]" style={{ backgroundColor: color }} />
                    ))}
                  </span>
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-white">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title="Lobi Renkleri" icon={Palette}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            <ColorField label="Ana renk" value={theme.primaryColor} onChange={(primaryColor) => updateTheme({ primaryColor })} />
            <ColorField label="İkincil renk" value={theme.secondaryColor} onChange={(secondaryColor) => updateTheme({ secondaryColor })} />
            <ColorField label="Vurgu rengi" value={theme.accentColor} onChange={(accentColor) => updateTheme({ accentColor })} />
            <ColorField label="Arkaplan" value={theme.backgroundColor} onChange={(backgroundColor) => updateTheme({ backgroundColor })} />
            <ColorField label="Panel zemini" value={theme.surfaceColor} onChange={(surfaceColor) => updateTheme({ surfaceColor })} />
            <ColorField label="Ana metin" value={theme.textColor} onChange={(textColor) => updateTheme({ textColor })} />
            <ColorField label="İkincil metin" value={theme.mutedTextColor} onChange={(mutedTextColor) => updateTheme({ mutedTextColor })} />
          </div>
        </Panel>

        <Panel title="Arkaplan" icon={Image}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px]">
            <TextField
              label="Arkaplan görsel URL"
              value={theme.backgroundImageUrl}
              placeholder="https://.../lobi-arkaplan.jpg"
              onChange={(backgroundImageUrl) => updateTheme({ backgroundImageUrl })}
            />
            <div className="rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 p-3">
              <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-muted,#8a919c)]">
                <SlidersHorizontal size={14} />
                Koyuluk
              </label>
              <input
                type="range"
                min={0}
                max={95}
                value={theme.backgroundOverlay}
                onChange={(event) => updateTheme({ backgroundOverlay: clampOverlay(event.target.value) })}
                className="mt-4 w-full accent-cyan-300"
              />
              <div className="mt-2 flex items-center justify-between text-xs font-semibold text-[color:var(--panel-muted,#8a919c)]">
                <span>0</span>
                <span className="rounded-md bg-white/10 px-2 py-1 text-white">{theme.backgroundOverlay}%</span>
                <span>95</span>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Yatay Banner" icon={MonitorSmartphone}>
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-4 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.035] p-4">
              <span>
                <span className="block text-sm font-semibold text-white">Banner aktif</span>
                <span className="mt-1 block text-xs font-medium text-[color:var(--panel-muted,#8a919c)]">Lobinin üst bölümünde geniş kampanya görseli gösterilir.</span>
              </span>
              <input
                type="checkbox"
                checked={theme.banner.enabled}
                onChange={(event) => updateBanner({ enabled: event.target.checked })}
                className="h-5 w-5 accent-cyan-300"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TextField
                label="Banner görsel URL"
                value={theme.banner.imageUrl}
                placeholder="https://.../banner.jpg"
                onChange={(imageUrl) => updateBanner({ imageUrl })}
              />
              <TextField
                label="Tıklama hedefi"
                value={theme.banner.linkUrl}
                placeholder="/gorevler veya https://..."
                icon={Link2}
                onChange={(linkUrl) => updateBanner({ linkUrl })}
              />
              <TextField label="Başlık" value={theme.banner.title} onChange={(title) => updateBanner({ title })} />
              <TextField label="Alt metin" value={theme.banner.subtitle} onChange={(subtitle) => updateBanner({ subtitle })} />
              <TextField label="Buton yazısı" value={theme.banner.ctaLabel} onChange={(ctaLabel) => updateBanner({ ctaLabel })} />
            </div>
          </div>
        </Panel>

        <Panel title="Hızlı Erişim Kartları" icon={ListChecks}>
          <div className="space-y-2">
            <div className="flex flex-col gap-3 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.035] p-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Lobi kartları</p>
                <p className="mt-0.5 truncate text-xs font-medium text-[color:var(--panel-muted,#8a919c)]">Başlık, açıklama, link, ikon ve renk tek satırda düzenlenir.</p>
              </div>
              <button
                type="button"
                onClick={addQuickAccess}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[color:var(--panel-info,#64d2ff)] px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#050609] transition hover:bg-[color:var(--panel-info,#64d2ff)]"
              >
                <Plus size={14} />
                Kart ekle
              </button>
            </div>

            <div className="hidden grid-cols-[34px_40px_minmax(120px,1fr)_minmax(140px,1.2fr)_minmax(120px,1fr)_118px_76px_108px] gap-2 px-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-faint,#5c6470)] xl:grid">
              <span>Aktif</span>
              <span>İkon</span>
              <span>Başlık</span>
              <span>Açıklama</span>
              <span>Link</span>
              <span>İkon tipi</span>
              <span>Renk</span>
              <span>Sıra</span>
            </div>

            {theme.quickAccess.map((item, index) => {
              const Icon = getQuickAccessIcon(item.icon);

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[34px_40px_1fr] items-center gap-2 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 p-2 xl:grid-cols-[34px_40px_minmax(120px,1fr)_minmax(140px,1.2fr)_minmax(120px,1fr)_118px_76px_108px]"
                >
                  <CompactToggle checked={item.enabled} onChange={(enabled) => updateQuickAccess(index, { enabled })} label={`${item.label} aktif`} />
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                    style={{
                      borderColor: hexToRgba(item.accentColor, 0.3),
                      backgroundColor: hexToRgba(item.accentColor, 0.13),
                      color: item.accentColor
                    }}
                  >
                    <Icon size={18} />
                  </span>
                  <CompactTextInput value={item.label} onChange={(label) => updateQuickAccess(index, { label })} placeholder="Başlık" />
                  <CompactTextInput value={item.desc} onChange={(desc) => updateQuickAccess(index, { desc })} placeholder="Açıklama" className="col-span-3 xl:col-span-1" />
                  <CompactTextInput value={item.to} onChange={(to) => updateQuickAccess(index, { to })} placeholder="/link" className="col-span-3 xl:col-span-1" />
                  <CompactSelect value={item.icon} onChange={(icon) => updateQuickAccess(index, { icon })} />
                  <CompactColorInput value={item.accentColor} onChange={(accentColor) => updateQuickAccess(index, { accentColor })} />
                  <div className="col-span-3 flex items-center justify-end gap-1 xl:col-span-1 xl:justify-start">
                    <IconButton label="Yukarı al" disabled={index === 0} onClick={() => moveQuickAccess(index, -1)} icon={ArrowUp} compact />
                    <IconButton label="Aşağı al" disabled={index === theme.quickAccess.length - 1} onClick={() => moveQuickAccess(index, 1)} icon={ArrowDown} compact />
                    <IconButton label="Sil" disabled={theme.quickAccess.length <= 1} onClick={() => removeQuickAccess(index)} icon={Trash2} danger compact />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Sayfa İçerikleri" icon={MonitorSmartphone}>
          <div className="space-y-3">
            <div className="rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.035] p-3">
              <p className="text-sm font-semibold text-white">Lobi elemanlarının açtığı sayfalar</p>
              <p className="mt-0.5 text-xs font-medium text-[color:var(--panel-muted,#8a919c)]">Başlık, açıklama, buton, boş durum, form ve sayfaya özel metinler buradan düzenlenir.</p>
            </div>

            {LOBBY_PAGE_ORDER.map((pageId) => {
              const page = theme.pages[pageId];
              const quickAccessItem = theme.quickAccess.find((item) => item.id === pageId);
              const extraFields = LOBBY_PAGE_EXTRA_FIELDS[pageId] || [];
              const dedicatedOwner = DEDICATED_CONTENT_OWNER[pageId];

              return (
                <details key={pageId} open={pageId === 'bonus'} className="group rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 marker:hidden">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">{page.label}</span>
                      <span className="mt-0.5 block truncate text-xs font-medium text-[color:var(--panel-muted,#8a919c)]">
                        {quickAccessItem ? `Kart: ${quickAccessItem.label} · ${page.path}` : page.path}
                      </span>
                    </span>
                    <span className="rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--panel-muted,#8a919c)] group-open:text-cyan-300">
                      Düzenle
                    </span>
                  </summary>

                  <div className="space-y-4 border-t border-[color:var(--panel-border,rgba(242,244,248,0.1))] p-3">
                    {dedicatedOwner && (
                      <div className="rounded-lg border border-amber-300/15 bg-[color:var(--panel-warning,#ff9f0a)]/[0.07] p-3 text-xs font-semibold leading-5 text-amber-100/80">
                        {dedicatedOwner} Buradaki alanlar ortak/fallback metinler ve lobi bağlantı düzeni için kullanılır.
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <TextField label="Sayfa etiketi" value={page.label} onChange={(label) => updatePage(pageId, { label })} />
                      <TextField label="Sayfa yolu / kart linki" value={page.path} onChange={(path) => updatePagePath(pageId, path)} />
                      <TextField label="Üst etiket" value={page.eyebrow} onChange={(eyebrow) => updatePage(pageId, { eyebrow })} />
                      <TextField label="Başlık" value={page.title} onChange={(title) => updatePage(pageId, { title })} />
                      <TextField label="Birincil buton" value={page.primaryButton} onChange={(primaryButton) => updatePage(pageId, { primaryButton })} />
                      <TextField label="İkincil buton" value={page.secondaryButton} onChange={(secondaryButton) => updatePage(pageId, { secondaryButton })} />
                      <PageAccentField
                        value={page.accentColor ?? ''}
                        fallback={theme.accentColor}
                        onChange={(accentColor) => updatePage(pageId, { accentColor })}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <TextAreaField label="Açıklama" value={page.subtitle} onChange={(subtitle) => updatePage(pageId, { subtitle })} />
                      <TextAreaField label="Form açıklaması" value={page.formDescription} onChange={(formDescription) => updatePage(pageId, { formDescription })} />
                      <TextField label="Form başlığı" value={page.formTitle} onChange={(formTitle) => updatePage(pageId, { formTitle })} />
                      <TextField label="Kullanıcı label" value={page.usernameLabel} onChange={(usernameLabel) => updatePage(pageId, { usernameLabel })} />
                      <TextField label="Kullanıcı placeholder" value={page.usernamePlaceholder} onChange={(usernamePlaceholder) => updatePage(pageId, { usernamePlaceholder })} />
                      <TextField label="Gönder butonu" value={page.submitButton} onChange={(submitButton) => updatePage(pageId, { submitButton })} />
                      <TextField label="Yükleniyor metni" value={page.loadingText} onChange={(loadingText) => updatePage(pageId, { loadingText })} />
                      <TextField label="Başarı başlığı" value={page.successTitle} onChange={(successTitle) => updatePage(pageId, { successTitle })} />
                      <TextAreaField label="Başarı açıklaması" value={page.successDescription} onChange={(successDescription) => updatePage(pageId, { successDescription })} />
                      <TextField label="Başarı butonu" value={page.successButton} onChange={(successButton) => updatePage(pageId, { successButton })} />
                      <TextField label="Boş durum başlığı" value={page.emptyTitle} onChange={(emptyTitle) => updatePage(pageId, { emptyTitle })} />
                      <TextAreaField label="Boş durum açıklaması" value={page.emptyDescription} onChange={(emptyDescription) => updatePage(pageId, { emptyDescription })} />
                      <TextField label="Kapalı başlığı" value={page.unavailableTitle} onChange={(unavailableTitle) => updatePage(pageId, { unavailableTitle })} />
                      <TextAreaField label="Kapalı açıklaması" value={page.unavailableDescription} onChange={(unavailableDescription) => updatePage(pageId, { unavailableDescription })} />
                    </div>

                    {extraFields.length > 0 && (
                      <div className="rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.025] p-3">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-muted,#8a919c)]">Sayfaya özel elementler</p>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {extraFields.map((field) => {
                            const value = page.extra[field.key];

                            return field.type === 'lines' ? (
                              <TextAreaField
                                key={field.key}
                                label={field.label}
                                value={formatExtraFieldValue(value)}
                                placeholder={field.placeholder}
                                rows={4}
                                onChange={(nextValue) => updatePageExtra(pageId, field.key, parseExtraLines(nextValue))}
                              />
                            ) : (
                              <TextField
                                key={field.key}
                                label={field.label}
                                value={formatExtraFieldValue(value)}
                                placeholder={field.placeholder}
                                onChange={(nextValue) => updatePageExtra(pageId, field.key, nextValue)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </Panel>

        <Panel title="Tab İçerikleri" icon={Layers}>
          <div className="space-y-4">
            <TabBaseEditor
              title="Hızlı Erişim Tabı"
              value={theme.tabs.games}
              onChange={(patch) => updateTab('games', patch)}
            />

            <TabBaseEditor
              title="Turnuva Tabı"
              value={theme.tabs.tournaments}
              onChange={(patch) => updateTab('tournaments', patch)}
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <TextField label="Sıralama etiketi" value={theme.tabs.tournaments.rankPrefix} onChange={(rankPrefix) => updateTab('tournaments', { rankPrefix })} />
                <TextField label="Ödül eki" value={theme.tabs.tournaments.prizeSuffix} onChange={(prizeSuffix) => updateTab('tournaments', { prizeSuffix })} />
                <TextField label="Kart açıklaması" value={theme.tabs.tournaments.cardDescription} onChange={(cardDescription) => updateTab('tournaments', { cardDescription })} />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-muted,#8a919c)]">Turnuva kartları</p>
                <button type="button" onClick={addTournamentCard} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[color:var(--panel-info,#64d2ff)] px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#050609]">
                  <Plus size={14} />
                  Kart ekle
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {theme.tabs.tournaments.cards.map((item, index) => {
                  const Icon = getQuickAccessIcon(item.icon);

                  return (
                    <div key={item.id} className="rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 p-3">
                      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border" style={{ borderColor: hexToRgba(item.accentColor, 0.3), backgroundColor: hexToRgba(item.accentColor, 0.13), color: item.accentColor }}>
                            <Icon size={19} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{item.label}</p>
                            <p className="truncate text-xs text-[color:var(--panel-muted,#8a919c)]">{item.period} · {item.to}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <TogglePill checked={item.enabled} onChange={(enabled) => updateTournamentCard(index, { enabled })} />
                          <IconButton label="Yukarı al" disabled={index === 0} onClick={() => moveTournamentCard(index, -1)} icon={ArrowUp} />
                          <IconButton label="Aşağı al" disabled={index === theme.tabs.tournaments.cards.length - 1} onClick={() => moveTournamentCard(index, 1)} icon={ArrowDown} />
                          <IconButton label="Sil" disabled={theme.tabs.tournaments.cards.length <= 1} onClick={() => removeTournamentCard(index)} icon={Trash2} danger />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <TextField label="Başlık" value={item.label} onChange={(label) => updateTournamentCard(index, { label })} />
                        <TextField label="Süre" value={item.period} onChange={(period) => updateTournamentCard(index, { period })} />
                        <TextField label="Varsayılan ödül" value={item.prizeFallback} onChange={(prizeFallback) => updateTournamentCard(index, { prizeFallback })} />
                        <TextField label="Hedef link" value={item.to} icon={Link2} onChange={(to) => updateTournamentCard(index, { to })} />
                        <IconSelect value={item.icon} onChange={(icon) => updateTournamentCard(index, { icon })} />
                        <ColorField label="Kart rengi" value={item.accentColor} onChange={(accentColor) => updateTournamentCard(index, { accentColor })} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabBaseEditor>

            <TabBaseEditor
              title="Destek Tabı"
              value={theme.tabs.support}
              onChange={(patch) => updateTab('support', patch)}
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <TextField label="Arama placeholder" value={theme.tabs.support.searchPlaceholder} onChange={(searchPlaceholder) => updateTab('support', { searchPlaceholder })} />
                <ColorField label="Bilgi kutusu rengi" value={theme.tabs.support.infoAccentColor} onChange={(infoAccentColor) => updateTab('support', { infoAccentColor })} />
                <TextField label="Bilgi başlığı" value={theme.tabs.support.infoTitle} onChange={(infoTitle) => updateTab('support', { infoTitle })} />
                <TextField label="Bilgi açıklaması" value={theme.tabs.support.infoDescription} onChange={(infoDescription) => updateTab('support', { infoDescription })} />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-muted,#8a919c)]">Destek kartları</p>
                <button type="button" onClick={addSupportCard} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[color:var(--panel-info,#64d2ff)] px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#050609]">
                  <Plus size={14} />
                  Kart ekle
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {theme.tabs.support.cards.map((item, index) => {
                  const Icon = getQuickAccessIcon(item.icon);

                  return (
                    <div key={item.id} className="rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 p-3">
                      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border" style={{ borderColor: hexToRgba(item.accentColor, 0.3), backgroundColor: hexToRgba(item.accentColor, 0.13), color: item.accentColor }}>
                            <Icon size={19} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                            <p className="truncate text-xs text-[color:var(--panel-muted,#8a919c)]">{item.to}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <TogglePill checked={item.enabled} onChange={(enabled) => updateSupportCard(index, { enabled })} />
                          <IconButton label="Yukarı al" disabled={index === 0} onClick={() => moveSupportCard(index, -1)} icon={ArrowUp} />
                          <IconButton label="Aşağı al" disabled={index === theme.tabs.support.cards.length - 1} onClick={() => moveSupportCard(index, 1)} icon={ArrowDown} />
                          <IconButton label="Sil" disabled={theme.tabs.support.cards.length <= 1} onClick={() => removeSupportCard(index)} icon={Trash2} danger />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <TextField label="Başlık" value={item.title} onChange={(title) => updateSupportCard(index, { title })} />
                        <TextField label="Açıklama" value={item.desc} onChange={(desc) => updateSupportCard(index, { desc })} />
                        <TextField label="Hedef link" value={item.to} icon={Link2} onChange={(to) => updateSupportCard(index, { to })} />
                        <IconSelect value={item.icon} onChange={(icon) => updateSupportCard(index, { icon })} />
                        <ColorField label="Kart rengi" value={item.accentColor} onChange={(accentColor) => updateSupportCard(index, { accentColor })} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabBaseEditor>
          </div>
        </Panel>
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/70">Canlı görünüm</p>
              <h3 className="text-lg font-semibold text-white">Lobi önizlemesi</h3>
            </div>
            <MonitorSmartphone className="text-[color:var(--panel-muted,#8a919c)]" size={20} />
          </div>
          <div className="overflow-hidden rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))]" style={pagePreviewStyle}>
            <div className="border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/45 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
              <span style={{ color: theme.accentColor }}>Canlı</span>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: hexToRgba(theme.primaryColor, 0.35),
                    backgroundColor: hexToRgba(theme.primaryColor, 0.16),
                    color: theme.primaryColor
                  }}
                >
                  <Palette size={19} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Ödül Merkezi</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: theme.mutedTextColor }}>Mobil lobi</p>
                </div>
              </div>

              {theme.banner.enabled && (
                <div className="min-h-[96px] rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] p-4" style={bannerPreviewStyle}>
                  <p className="max-w-[260px] text-lg font-semibold leading-tight">{theme.banner.title || 'Banner başlığı'}</p>
                  <p className="mt-1 max-w-[240px] text-xs font-semibold" style={{ color: theme.textColor }}>{theme.banner.subtitle || 'Banner açıklaması'}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {theme.quickAccess.filter((item) => item.enabled).slice(0, 4).map((item) => {
                  const Icon = getQuickAccessIcon(item.icon);

                  return (
                    <div key={item.id} className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.045] p-3 text-center">
                      <div
                        className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border"
                        style={{
                          borderColor: hexToRgba(item.accentColor, 0.3),
                          backgroundColor: hexToRgba(item.accentColor, 0.13),
                          color: item.accentColor
                        }}
                      >
                        <Icon size={18} />
                      </div>
                      <p className="mt-2 truncate text-[11px] font-semibold">{item.label}</p>
                      <p className="mt-0.5 truncate text-[9px] font-semibold" style={{ color: theme.mutedTextColor }}>{item.desc}</p>
                    </div>
                  );
                })}
              </div>

              <div
                className="rounded-xl border p-4"
                style={{
                  borderColor: hexToRgba(theme.primaryColor, 0.22),
                  background: `linear-gradient(135deg, ${hexToRgba(theme.primaryColor, 0.18)}, ${hexToRgba(theme.surfaceColor, 0.92)})`
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.primaryColor }}>Öne çıkan</p>
                <p className="mt-2 text-2xl font-semibold leading-none">Bonusunu seç.</p>
                <button
                  type="button"
                  className="mt-4 h-10 rounded-lg px-4 text-xs font-semibold text-white"
                  style={{ background: `linear-gradient(90deg, ${theme.primaryColor}, ${theme.secondaryColor})` }}
                >
                  {theme.banner.ctaLabel || 'Hemen katıl'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function IconButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  danger,
  compact
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-35',
        compact ? 'h-8 w-8' : 'h-9 w-9',
        danger
          ? 'border-rose-300/15 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15'
          : 'border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.035] text-[color:var(--panel-muted,#8a919c)] hover:text-white'
      )}
    >
      <Icon size={15} />
    </button>
  );
}

function CompactTextInput({
  value,
  onChange,
  placeholder,
  className
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        'h-9 min-w-0 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 px-2.5 text-xs font-bold text-white outline-none transition placeholder:text-[color:var(--panel-faint,#5c6470)] focus:border-cyan-300/40',
        className
      )}
    />
  );
}

function CompactSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="col-span-2 h-9 min-w-0 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 px-2 text-xs font-bold text-white outline-none transition focus:border-cyan-300/40 xl:col-span-1"
    >
      {QUICK_ACCESS_ICON_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function CompactColorInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const colorValue = isHexColor(value) ? value : '#000000';

  return (
    <span className="flex h-9 min-w-0 items-center gap-1 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 px-1.5">
      <input
        type="color"
        value={colorValue}
        onChange={(event) => onChange(event.target.value)}
        className="h-6 w-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
        aria-label="Kart rengi"
      />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[11px] font-bold text-white outline-none"
      />
    </span>
  );
}

function CompactToggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <label className="flex h-9 items-center justify-center rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.035]" title={label}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-cyan-300"
        aria-label={label}
      />
    </label>
  );
}

type TabBaseValue = {
  enabled: boolean;
  label: string;
  hint: string;
  sectionTitle: string;
  actionText: string;
};

function TabBaseEditor({
  title,
  value,
  onChange,
  children
}: {
  title: string;
  value: TabBaseValue;
  onChange: (patch: Partial<TabBaseValue>) => void;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/20 p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-white">{title}</h4>
          <p className="mt-1 text-xs font-medium text-[color:var(--panel-muted,#8a919c)]">Tab başlığı, alt etiketi ve içerik başlığı.</p>
        </div>
        <TogglePill checked={value.enabled} onChange={(enabled) => onChange({ enabled })} />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TextField label="Tab adı" value={value.label} onChange={(label) => onChange({ label })} />
        <TextField label="Tab kısa bilgi" value={value.hint} onChange={(hint) => onChange({ hint })} />
        <TextField label="İç başlık" value={value.sectionTitle} onChange={(sectionTitle) => onChange({ sectionTitle })} />
        <TextField label="Sağ aksiyon metni" value={value.actionText} onChange={(actionText) => onChange({ actionText })} />
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

function TogglePill({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.035] px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--panel-text-dim,#c8cdd5)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-cyan-300"
      />
      Aktif
    </label>
  );
}

function IconSelect({ value, onChange, label = 'İkon' }: { value: string; onChange: (value: string) => void; label?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-muted,#8a919c)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 px-3 text-sm font-bold text-white outline-none transition focus:border-cyan-300/40"
      >
        {QUICK_ACCESS_ICON_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-[color:var(--panel-surface,rgba(242,244,248,0.028))] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--panel-info,#64d2ff)] text-[#050609]">
          <Icon size={18} />
        </span>
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>
      {children}
    </section>
  );
}

/**
 * Sayfaya özel vurgu rengi. Boş bırakıldığında lobinin global accent rengi
 * devralınır; "Temadan devral" bu yüzden değeri temizler, sıfırlamaz.
 */
function PageAccentField({ value, fallback, onChange }: { value: string; fallback: string; onChange: (value: string) => void }) {
  const inherited = !isHexColor(value);
  const effective = inherited ? fallback : value;
  return (
    <div className="rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.035] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-muted,#8a919c)]">Vurgu rengi</span>
        {!inherited && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded border border-[color:var(--panel-border,rgba(242,244,248,0.1))] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[color:var(--panel-muted,#8a919c)] transition hover:text-white"
          >
            Temadan devral
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isHexColor(effective) ? effective : '#3b82f6'}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-transparent p-1"
        />
        <input
          type="text"
          value={value}
          placeholder={`${fallback} (temadan)`}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 min-w-0 flex-1 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 px-3 text-sm font-bold text-white outline-none placeholder:text-[color:var(--panel-faint,#5c6470)] focus:border-cyan-300/40"
        />
      </div>
      <p className="mt-1.5 text-[10px] font-medium text-[color:var(--panel-faint,#5c6470)]">
        {inherited ? 'Lobi temasının vurgu rengi kullanılıyor.' : 'Bu sayfa kendi vurgu rengini kullanıyor.'}
      </p>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const colorValue = isHexColor(value) ? value : '#000000';
  return (
    <label className="block rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-white/[0.035] p-3">
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-muted,#8a919c)]">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={colorValue}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-transparent p-1"
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 min-w-0 flex-1 rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 px-3 text-sm font-bold text-white outline-none focus:border-cyan-300/40"
        />
      </span>
    </label>
  );
}

function TextField({
  label,
  value,
  placeholder,
  icon: Icon,
  onChange
}: {
  label: string;
  value: string;
  placeholder?: string;
  icon?: LucideIcon;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-muted,#8a919c)]">
        {Icon && <Icon size={13} />}
        {label}
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'h-11 w-full rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 px-3 text-sm font-bold text-white outline-none transition placeholder:text-[color:var(--panel-faint,#5c6470)] focus:border-cyan-300/40',
          !value && 'text-[color:var(--panel-muted,#8a919c)]'
        )}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  placeholder,
  rows = 3,
  onChange
}: {
  label: string;
  value: string;
  placeholder?: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-muted,#8a919c)]">{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'w-full resize-none rounded-lg border border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-black/25 px-3 py-2.5 text-sm font-bold text-white outline-none transition placeholder:text-[color:var(--panel-faint,#5c6470)] focus:border-cyan-300/40',
          !value && 'text-[color:var(--panel-muted,#8a919c)]'
        )}
      />
    </label>
  );
}

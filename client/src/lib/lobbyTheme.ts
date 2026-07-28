import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CSSProperties } from 'react';
import { fetchGamesConfigCached, readCachedGamesConfig } from './lobbyConfigCache';
import { normalizeLobbyPageContent, type LobbyPageId } from './lobbyContent';

/**
 * Lobi ve tüm alt sayfaların paylaştığı görsel tema. Renkler admin panelindeki
 * "Lobi Tasarımı" bölümünden yönetilir; her alt sayfa bu temayı temel alır ve
 * yalnızca kendi vurgu (accent) rengini ezebilir.
 */
export type LobbyPalette = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  backgroundImageUrl: string;
  backgroundOverlay: number;
};

export const DEFAULT_LOBBY_PALETTE: LobbyPalette = {
  primaryColor: '#3b82f6',
  secondaryColor: '#1d4ed8',
  accentColor: '#5eead4',
  backgroundColor: '#060911',
  surfaceColor: '#0d1119',
  textColor: '#f1f5f9',
  mutedTextColor: '#7dd3fc',
  backgroundImageUrl: '',
  backgroundOverlay: 72,
};

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function asHexColor(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim();
  return HEX_PATTERN.test(text) ? text : fallback;
}

export function clampOverlay(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_LOBBY_PALETTE.backgroundOverlay;
  return Math.min(95, Math.max(0, Math.round(numeric)));
}

/** #rrggbb + alfa → rgba(). Kısa (#abc) biçimi de desteklenir. */
export function hexToRgba(hex: string, alpha: number): string {
  let value = String(hex ?? '').trim().replace('#', '');
  if (value.length === 3) value = value.split('').map((char) => char + char).join('');
  if (value.length !== 6) return `rgba(59,130,246,${alpha})`;
  const num = Number.parseInt(value, 16);
  if (!Number.isFinite(num)) return `rgba(59,130,246,${alpha})`;
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

/** url() içine güvenli gömme: tırnak ve parantez kaçışı. */
export function cssUrl(url: string): string {
  return String(url ?? '').replace(/["\\]/g, '\\$&').replace(/[()]/g, encodeURIComponent);
}

export function normalizeLobbyPalette(config: unknown): LobbyPalette {
  const source = (config && typeof config === 'object' ? config : {}) as Record<string, unknown>;
  return {
    primaryColor: asHexColor(source.primaryColor, DEFAULT_LOBBY_PALETTE.primaryColor),
    secondaryColor: asHexColor(source.secondaryColor, DEFAULT_LOBBY_PALETTE.secondaryColor),
    accentColor: asHexColor(source.accentColor, DEFAULT_LOBBY_PALETTE.accentColor),
    backgroundColor: asHexColor(source.backgroundColor, DEFAULT_LOBBY_PALETTE.backgroundColor),
    surfaceColor: asHexColor(source.surfaceColor, DEFAULT_LOBBY_PALETTE.surfaceColor),
    textColor: asHexColor(source.textColor, DEFAULT_LOBBY_PALETTE.textColor),
    mutedTextColor: asHexColor(source.mutedTextColor, DEFAULT_LOBBY_PALETTE.mutedTextColor),
    backgroundImageUrl: String(source.backgroundImageUrl ?? ''),
    backgroundOverlay: clampOverlay(source.backgroundOverlay),
  };
}

/** Tema renklerini CSS değişkenlerine çevirir; alt bileşenler var(--lobby-*) ile okur. */
export function paletteToCssVars(palette: LobbyPalette): CSSProperties {
  return {
    backgroundColor: palette.backgroundColor,
    color: palette.textColor,
    '--lobby-primary': palette.primaryColor,
    '--lobby-secondary': palette.secondaryColor,
    '--lobby-accent': palette.accentColor,
    '--lobby-bg': palette.backgroundColor,
    '--lobby-surface': palette.surfaceColor,
    '--lobby-text': palette.textColor,
    '--lobby-muted': palette.mutedTextColor,
  } as CSSProperties;
}

export function paletteBackgroundStyle(palette: LobbyPalette): CSSProperties {
  const overlay = palette.backgroundOverlay / 100;
  if (palette.backgroundImageUrl) {
    return {
      backgroundImage: `linear-gradient(${hexToRgba(palette.backgroundColor, overlay)}, ${hexToRgba(palette.backgroundColor, overlay)}), url("${cssUrl(palette.backgroundImageUrl)}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }
  return {
    background: `radial-gradient(circle at 12% 0%, ${hexToRgba(palette.primaryColor, 0.2)}, transparent 34%), radial-gradient(circle at 92% 22%, ${hexToRgba(palette.accentColor, 0.12)}, transparent 30%), linear-gradient(180deg, ${palette.backgroundColor}, ${palette.surfaceColor} 55%, ${palette.backgroundColor})`,
  };
}

/**
 * Alt sayfalar için tema + sayfa metni tek çağrıda. Sayfanın admin'de tanımlı
 * kendi accent rengi varsa global accent'i ezer (ortak iskelet, sayfaya özel kimlik).
 */
export function useLobbyPageTheme(pageId: LobbyPageId) {
  const query = useQuery({
    queryKey: ['games-config', 'lobby-pages'],
    queryFn: fetchGamesConfigCached,
    staleTime: 5 * 60 * 1000,
  });

  // İlk kareyi son bilinen paletle boya, yoksa varsayılana düş.
  // placeholderData KULLANMIYORUZ: o yalnızca sorgu "pending" iken geçerli,
  // istek hata verirse düşüyor ve sayfa yine varsayılana dönüyordu.
  const lobby = query.data?.data?.lobby ?? readCachedGamesConfig()?.data?.lobby;

  const content = useMemo(
    () => normalizeLobbyPageContent(pageId, lobby?.pages?.[pageId]),
    [pageId, lobby?.pages]
  );

  const palette = useMemo(() => {
    const base = normalizeLobbyPalette(lobby);
    const pageAccent = asHexColor(lobby?.pages?.[pageId]?.accentColor, '');
    return pageAccent ? { ...base, accentColor: pageAccent } : base;
  }, [lobby, pageId]);

  const rootStyle = useMemo(() => paletteToCssVars(palette), [palette]);
  const backgroundStyle = useMemo(() => paletteBackgroundStyle(palette), [palette]);

  return { content, palette, rootStyle, backgroundStyle, isLoading: query.isLoading };
}

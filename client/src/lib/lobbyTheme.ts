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

/**
 * Lobi yeniden tasarımının renk sistemi.
 *
 * Sıcak siyah zemin + krem metin + altın vurgu. Kazanç tutarları yeşille
 * ayrılır; para hareketi tek renkte toplandığı için ekranda aranmadan bulunur.
 *
 * DİKKAT: bu yalnızca VARSAYILAN. Admin "Lobi Tasarımı" bölümünden palet
 * kaydedildiyse veritabanındaki değer bunu ezer ve burada yapılan değişiklik
 * canlıda görünmez.
 */
export const DEFAULT_LOBBY_PALETTE: LobbyPalette = {
  primaryColor: '#e7c574',
  secondaryColor: '#d3a952',
  accentColor: '#5fd6a7',
  backgroundColor: '#0e0c09',
  surfaceColor: '#121009',
  textColor: '#f3ecdd',
  mutedTextColor: '#8f8674',
  backgroundImageUrl: '',
  backgroundOverlay: 72,
};

/**
 * Palete bağlı olmayan, tasarımın kendi ölçüleri.
 *
 * Renkler admin'den değişebildiği için bunlar ayrı tutuldu: yazı ölçeği,
 * köşe yarıçapı ve kenarlık şiddeti tasarımın kimliği ve tema değişse de sabit.
 */
export const LOBBY_TOKENS = {
  /** Mockup'ta baskın yarıçaplar: kart 12, geniş yüzey 20, rozet tam yuvarlak. */
  radius: { pill: '9999px', card: '12px', panel: '20px', control: '10px' },
  /** Büyük harf mikro etiketlerin harf aralığı — tasarımın en belirgin imzası. */
  tracking: { label: '0.16em', tight: '0.12em' },
  /** Kenarlıklar metin renginin düşük alfası; ayrı bir gri getirilmiyor. */
  border: (alpha: number) => `rgba(243, 236, 221, ${alpha})`,
  /** Kazanç/pozitif tutar rengi. */
  win: '#5fd6a7',
} as const;

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
  // Tepeden yayılan geniş bir altın hâle, sağ omuzda daha zayıf bir yeşil.
  // Elips (daire değil): ekran genişledikçe ışık yatayda yayılıyor, dikeyde
  // sabit kalıyor; böylece masaüstünde tepeye yapışık bir vinyet oluşuyor.
  return {
    background: [
      `radial-gradient(ellipse 900px 420px at 50% -80px, ${hexToRgba(palette.primaryColor, 0.09)}, transparent 70%)`,
      `radial-gradient(ellipse 600px 400px at 92% 30%, ${hexToRgba(palette.accentColor, 0.045)}, transparent 70%)`,
      `linear-gradient(180deg, ${palette.backgroundColor}, ${palette.surfaceColor} 60%, ${palette.backgroundColor})`,
    ].join(', '),
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
